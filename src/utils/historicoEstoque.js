import { ehInsumo } from './estoqueTotal'

// Histórico do estoque: cada importação da planilha de estoque total guarda uma "foto" (só o que
// muda de um dia para outro: código, estoque, dias sem venda, última compra e setor). Com várias
// fotos dá para ver a evolução (itens com estoque, parados, valor estimado) e projetar as próximas
// semanas, e estimar quanto cada item vende por dia pela queda do estoque entre fotos sem compra.
//
// Valor em R$: a planilha não traz custo. O custo unitário vem das auditorias ("Custo Ruptura" é
// quantidade × custo; ver custoUnitario em utils/estoque.js). Itens sem custo conhecido ficam fora
// do valor, e a cobertura (% do estoque com custo) aparece junto.

const DIA = 86400000
const diaISO = d => new Date(d).toISOString().slice(0, 10)
export const diasEntre = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DIA)
export const somarDias = (iso, dias) => diaISO(Date.parse(`${iso}T00:00:00Z`) + Math.round(dias) * DIA)

// Data da foto: a última venda registrada na planilha (a loja vende todo dia). Assim uma planilha
// antiga importada depois entra no dia certo. Sem vendas na planilha, vale a data da importação.
export const dataDaPlanilha = (itens, importadoEm = new Date().toISOString()) => {
  let maior = ''
  for (const i of itens || []) if (i.ultimaVenda && i.ultimaVenda > maior) maior = i.ultimaVenda
  const hoje = String(importadoEm).slice(0, 10)
  return maior && maior <= hoje ? maior : hoje
}

// Foto compacta: { id (= data), data, importadoEm, arquivo, total } + itens [{ c, e, d, u, s }].
export const fotoDoEstoque = (itens, { importadoEm, arquivo }) => {
  const data = dataDaPlanilha(itens, importadoEm)
  return {
    meta: { id: data, data, importadoEm, arquivo: arquivo || '', total: (itens || []).length },
    itens: {
      id: data,
      itens: (itens || []).map(i => ({ c: i.codigo, e: i.estoque, d: i.diasSemVenda, u: i.ultimaCompra || '', s: i.setor }))
    }
  }
}

// Resumo de uma foto (excluindo insumos, como nas listas de problemas).
export const resumoDaFoto = (itens, { custos = new Map(), limiarParado = 30 } = {}) => {
  const r = { itens: 0, comEstoque: 0, parados: 0, semVenda90: 0, valor: 0, valorParado: 0, comCusto: 0 }
  for (const i of itens || []) {
    if (ehInsumo({ setor: i.s })) continue
    r.itens++
    if (!(i.e > 0)) continue
    r.comEstoque++
    const custo = custos.get(i.c)
    const valor = custo ? custo * i.e : 0
    if (custo) r.comCusto++
    r.valor += valor
    const parado = i.d !== null && i.d !== undefined && i.d >= limiarParado
    if (parado) { r.parados++; r.valorParado += valor }
    if (i.d !== null && i.d !== undefined && i.d >= 90) r.semVenda90++
  }
  r.coberturaCusto = r.comEstoque ? r.comCusto / r.comEstoque : 0
  return r
}

// Série: um ponto por foto, em ordem de data.
export const serieDoHistorico = (fotos, opcoes) => [...(fotos || [])]
  .filter(f => f?.data && Array.isArray(f.itens))
  .sort((a, b) => a.data.localeCompare(b.data))
  .map(f => ({ id: f.id, data: f.data, arquivo: f.arquivo, importadoEm: f.importadoEm, ...resumoDaFoto(f.itens, opcoes) }))

// Projeção linear (mínimos quadrados pelo tempo) com as últimas `janela` fotos.
// Precisa de 3 fotos em pelo menos 7 dias; senão a tendência não diz nada.
export const projetar = (serie, campo, { dias = 28, janela = 8 } = {}) => {
  const pontos = (serie || []).filter(p => Number.isFinite(p?.[campo])).slice(-janela)
  if (pontos.length < 3) return null
  const base = pontos[0].data
  const xs = pontos.map(p => diasEntre(base, p.data))
  if (xs.at(-1) - xs[0] < 7) return null
  const ys = pontos.map(p => p[campo])
  const n = xs.length
  const mx = xs.reduce((s, x) => s + x, 0) / n
  const my = ys.reduce((s, y) => s + y, 0) / n
  const sxx = xs.reduce((s, x) => s + (x - mx) ** 2, 0)
  if (!sxx) return null
  const inclinacao = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / sxx
  const ultimo = pontos.at(-1)
  const valorEm = d => Math.max(0, ultimo[campo] + inclinacao * d)
  const passos = [7, 14, 21, 28].filter(d => d <= dias)
  return {
    porSemana: inclinacao * 7,
    atual: ultimo[campo],
    final: valorEm(dias),
    dataFinal: somarDias(ultimo.data, dias),
    pontos: [{ data: ultimo.data, valor: ultimo[campo] }, ...passos.map(d => ({ data: somarDias(ultimo.data, d), valor: valorEm(d) }))],
    fotos: n
  }
}

// Venda estimada por item: a queda do estoque entre duas fotos seguidas, quando não houve compra
// entre elas (a última compra não mudou). Subidas sem compra (ajuste, devolução) não contam.
// Devolve, por código: { venda (por dia), dias (período usado), intervalos }.
export const vendaEstimada = (fotos) => {
  const ordem = [...(fotos || [])].filter(f => f?.data && Array.isArray(f.itens)).sort((a, b) => a.data.localeCompare(b.data))
  const acumulado = new Map()
  for (let k = 1; k < ordem.length; k++) {
    const antes = ordem[k - 1]
    const depois = ordem[k]
    const dias = diasEntre(antes.data, depois.data)
    if (dias <= 0) continue
    const mapaAntes = new Map(antes.itens.map(i => [i.c, i]))
    for (const b of depois.itens) {
      const a = mapaAntes.get(b.c)
      if (!a) continue
      const comprou = (b.u || '') !== (a.u || '')
      if (comprou) continue
      const queda = (Number(a.e) || 0) - (Number(b.e) || 0)
      if (queda < 0) continue
      const r = acumulado.get(b.c) || { vendido: 0, dias: 0, intervalos: 0 }
      r.vendido += queda
      r.dias += dias
      r.intervalos++
      acumulado.set(b.c, r)
    }
  }
  const resultado = new Map()
  for (const [c, r] of acumulado) resultado.set(c, { venda: r.dias ? r.vendido / r.dias : 0, dias: r.dias, intervalos: r.intervalos })
  return resultado
}

// Giro de cada item com estoque na planilha atual: venda por dia, dias de cobertura e quando zera.
export const giroDosItens = ({ total, fotos, custos = new Map(), dataBase }) => {
  if (!total?.size) return []
  const vendas = vendaEstimada(fotos)
  const base = dataBase || diaISO(Date.now())
  const linhas = []
  for (const t of total.values()) {
    if (!(t.estoque > 0) || ehInsumo(t)) continue
    const v = vendas.get(t.codigo)
    if (!v) continue
    const cobertura = v.venda > 0 ? t.estoque / v.venda : null
    const custo = custos.get(t.codigo) || 0
    linhas.push({
      codigo: t.codigo,
      produto: t.produto,
      setor: t.setor,
      fornecedor: t.fornecedor,
      estoque: t.estoque,
      unidade: t.unidade,
      diasSemVenda: t.diasSemVenda,
      venda: v.venda,
      vendaSemana: v.venda * 7,
      diasObservados: v.dias,
      cobertura,
      zeraEm: cobertura === null ? '' : somarDias(base, cobertura),
      semGiro: v.venda === 0 && v.dias >= 7,
      valor: custo * t.estoque,
      situacao: v.dias < 7 ? 'Pouco histórico' : v.venda === 0 ? 'Sem giro' : cobertura <= 7 ? 'Acaba em até 7 dias' : cobertura <= 30 ? 'Até 30 dias' : cobertura <= 90 ? '30 a 90 dias' : 'Mais de 90 dias'
    })
  }
  return linhas.sort((a, b) => (a.cobertura ?? Infinity) - (b.cobertura ?? Infinity))
}

// Custo unitário por código, vindo das auditorias (indexarEstoque).
export const custosDoIndice = (indice) => {
  const mapa = new Map()
  for (const r of indice?.itens?.values() || []) if (r.custoUnitario > 0) mapa.set(r.codigo, r.custoUnitario)
  return mapa
}
