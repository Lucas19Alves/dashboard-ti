import { META_PENDENTE_PERCENTUAL } from './metricasAuditoria'
import { tendencia } from './analiseHistorica'
import { codigoDoItem, codigoLocal, custoRupturaDoItem, fornecedorDoItem, itemPendente, localDoItem, produtoDoItem, setorDoItem, usuarioDoItem } from './itemAuditoria'
import { isItemLido } from './itemLido'
import { momentoLeitura } from './sinaisAuditoria'
import { PAUSA_MINUTOS } from './trajetoUsuario'

// Análises entre várias auditorias: reincidência, evolução de usuários e ruptura em valor.

const dataDe = a => String(a?.data || '').slice(0, 10)
const emOrdem = lista => [...(lista || [])].filter(Boolean).sort((a, b) => dataDe(a).localeCompare(dataDe(b)) || (a.id || 0) - (b.id || 0))
const percentual = (parte, total) => (total ? (parte / total) * 100 : 0)
const pendenteDoLocal = d => {
  const total = (d?.lidos || 0) + (d?.pendentes || 0) + (d?.comProblema || 0)
  return { total, pendentes: d?.pendentes || 0, perc: percentual(d?.pendentes || 0, total) }
}

// ---------- Reincidência por local ----------
// Para cada local: em quantas auditorias apareceu e em quantas ficou acima da meta.
export const reincidenciaLocais = (auditorias, meta = META_PENDENTE_PERCENTUAL) => {
  const mapa = new Map()
  for (const auditoria of emOrdem(auditorias)) {
    for (const [local, d] of Object.entries(auditoria?.analise?.porLocal || {})) {
      const { total, pendentes, perc } = pendenteDoLocal(d)
      if (!total) continue
      const r = mapa.get(local) || { chave: local, local: codigoLocal(local), auditorias: 0, foraMeta: 0, pendentes: 0, itens: 0, sequencia: 0, ultimaData: '', historico: [] }
      const fora = perc > meta
      r.auditorias++
      r.foraMeta += fora ? 1 : 0
      r.pendentes += pendentes
      r.itens += total
      r.sequencia = fora ? r.sequencia + 1 : 0 // auditorias seguidas (as mais recentes) fora da meta
      r.ultimaData = dataDe(auditoria)
      r.historico.push({ data: dataDe(auditoria), perc, fora })
      mapa.set(local, r)
    }
  }
  return [...mapa.values()]
    .map(r => ({ ...r, taxaFora: percentual(r.foraMeta, r.auditorias), percMedio: percentual(r.pendentes, r.itens), historico: r.historico.slice(-12) }))
    .sort((a, b) => b.foraMeta - a.foraMeta || b.taxaFora - a.taxaFora || b.pendentes - a.pendentes)
}

// Produtos que ficaram pendentes em mais de uma auditoria.
export const reincidenciaProdutos = (auditorias, minimo = 2) => {
  const mapa = new Map()
  for (const auditoria of emOrdem(auditorias)) {
    const vistos = new Set()
    for (const item of Array.isArray(auditoria?.dados) ? auditoria.dados : []) {
      if (!itemPendente(item)) continue
      const codigo = codigoDoItem(item)
      if (!codigo || vistos.has(codigo)) continue
      vistos.add(codigo)
      const r = mapa.get(codigo) || { codigo, produto: produtoDoItem(item), setor: setorDoItem(item), local: '', vezes: 0, ultimaData: '', custo: 0 }
      r.vezes++
      r.local = codigoLocal(localDoItem(item))
      r.ultimaData = dataDe(auditoria)
      r.custo += custoRupturaDoItem(item)
      mapa.set(codigo, r)
    }
  }
  return [...mapa.values()].filter(r => r.vezes >= minimo).sort((a, b) => b.vezes - a.vezes || b.custo - a.custo)
}

// Mapa de reincidência: cada local conta uma "ocorrência" por auditoria; fora da meta entra como
// pendente. O mapa da loja mostra então o % de ocorrências fora da meta por área.
export const mapaReincidencia = (auditorias, meta = META_PENDENTE_PERCENTUAL) => {
  const porLocal = {}
  for (const auditoria of auditorias || []) {
    for (const [local, d] of Object.entries(auditoria?.analise?.porLocal || {})) {
      const { total, perc } = pendenteDoLocal(d)
      if (!total) continue
      const destino = (porLocal[local] ??= { lidos: 0, pendentes: 0, comProblema: 0 })
      if (perc > meta) destino.pendentes++
      else destino.lidos++
    }
  }
  // Uma linha por local (com o histórico) para o painel e a lista de locais de cada área.
  const dados = reincidenciaLocais(auditorias, meta).map(r => ({ ...r, Local: r.chave }))
  return { analise: { porLocal }, dados }
}

// ---------- Evolução dos usuários ----------
// Tempo ativo: soma dos intervalos entre leituras seguidas, ignorando pausas.
export const tempoAtivoMs = (instantes) => {
  const ordenados = [...instantes].sort((a, b) => a - b)
  let total = 0
  for (let i = 1; i < ordenados.length; i++) {
    const gap = ordenados[i] - ordenados[i - 1]
    if (gap <= PAUSA_MINUTOS * 60000) total += gap
  }
  return total
}

// subindo | caindo | estavel | indefinida (sem juízo de valor: ritmo subir é bom, problema subir é ruim).
const sentido = (valores) => {
  const { direcao } = tendencia(valores)
  return direcao === 'melhorando' ? 'caindo' : direcao === 'piorando' ? 'subindo' : direcao
}

export const evolucaoUsuarios = (auditorias) => {
  const mapa = new Map()
  for (const auditoria of emOrdem(auditorias)) {
    const instantes = new Map()
    for (const item of Array.isArray(auditoria?.dados) ? auditoria.dados : []) {
      const usuario = usuarioDoItem(item)
      if (!usuario || !isItemLido(item)) continue
      const m = momentoLeitura(item)
      if (!m) continue
      const lista = instantes.get(usuario) || []
      lista.push(m.instante)
      instantes.set(usuario, lista)
    }
    for (const [usuario, d] of Object.entries(auditoria?.analise?.porUsuario || {})) {
      const leituras = (d?.lidos || 0) + (d?.comProblema || 0)
      if (!leituras) continue
      const ativo = tempoAtivoMs(instantes.get(usuario) || [])
      const u = mapa.get(usuario) || { usuario, serie: [] }
      u.serie.push({
        auditoriaId: auditoria.id,
        data: dataDe(auditoria),
        tipo: auditoria.tipo,
        leituras,
        percProblema: percentual(d?.comProblema || 0, leituras),
        ritmo: ativo >= 10 * 60000 ? leituras / (ativo / 3600000) : null // menos de 10 min não é base confiável
      })
      mapa.set(usuario, u)
    }
  }
  return [...mapa.values()].map(u => {
    const ritmos = u.serie.map(s => s.ritmo).filter(v => v !== null)
    const media = lista => (lista.length ? lista.reduce((s, v) => s + v, 0) / lista.length : null)
    return {
      ...u,
      auditorias: u.serie.length,
      leituras: u.serie.reduce((s, x) => s + x.leituras, 0),
      ritmoMedio: media(ritmos),
      ritmoRecente: media(ritmos.slice(-3)),
      percProblemaMedio: media(u.serie.map(s => s.percProblema)),
      tendenciaRitmo: sentido(ritmos.slice(-8)),
      tendenciaProblema: sentido(u.serie.slice(-8).map(s => s.percProblema))
    }
  }).sort((a, b) => b.leituras - a.leituras)
}

// ---------- Ruptura em valor ----------
// Ruptura é uma foto: quanto estava faltando na gôndola (em "Custo Ruptura") no dia de cada auditoria.
// Fotos não se somam (a falta de uma semana costuma ser a mesma da semana seguinte): o histórico
// mostra cada foto, a média das fotos de um período (ex.: um mês) e a última foto.
// Use um tipo de auditoria por vez: a Ruptura repete os pendentes da Presença da mesma semana.
export const rupturaEmValor = (auditorias) => {
  const fotos = []
  const porFornecedor = new Map()
  const porSetor = new Map()
  const porProduto = new Map()
  const acumular = (mapa, chave, valor, extra = {}) => {
    const r = mapa.get(chave) || { chave, soma: 0, ocorrencias: 0, ...extra }
    r.soma += valor
    r.ocorrencias++
    mapa.set(chave, r)
    return r
  }
  const lista = emOrdem(auditorias)
  for (const auditoria of lista) {
    const data = dataDe(auditoria)
    const foto = { id: auditoria.id, data, mes: data.slice(0, 7), tipo: auditoria.tipo, valor: 0, itens: 0, fornecedores: new Map(), setores: new Map() }
    for (const item of Array.isArray(auditoria?.dados) ? auditoria.dados : []) {
      if (!itemPendente(item)) continue
      const custo = custoRupturaDoItem(item)
      if (custo <= 0) continue
      foto.valor += custo
      foto.itens++
      const fornecedor = fornecedorDoItem(item)
      const setor = setorDoItem(item)
      foto.fornecedores.set(fornecedor, (foto.fornecedores.get(fornecedor) || 0) + custo)
      foto.setores.set(setor, (foto.setores.get(setor) || 0) + custo)
      acumular(porFornecedor, fornecedor, custo)
      acumular(porSetor, setor, custo)
      const p = acumular(porProduto, codigoDoItem(item) || produtoDoItem(item), custo, { produto: produtoDoItem(item), fornecedor: fornecedorDoItem(item), setor, ultimoValor: 0, ultimaData: '' })
      p.ultimoValor = custo
      p.ultimaData = data
    }
    fotos.push(foto)
  }
  const n = fotos.length
  const ultima = fotos.at(-1) || null
  const media = n ? fotos.reduce((s, f) => s + f.valor, 0) / n : 0
  const pico = fotos.reduce((m, f) => (!m || f.valor > m.valor ? f : m), null)

  // Por fornecedor/setor: valor médio por auditoria no período e o valor na última auditoria.
  const ranking = (mapa, chaveFoto) => {
    const somaMedias = [...mapa.values()].reduce((s, r) => s + r.soma / n, 0)
    return [...mapa.values()].map(r => ({
      chave: r.chave,
      valor: r.soma / n,
      ultima: ultima?.[chaveFoto].get(r.chave) || 0,
      itens: r.ocorrencias / n,
      participacao: percentual(r.soma / n, somaMedias)
    })).sort((a, b) => b.valor - a.valor)
  }
  const produtos = [...porProduto.values()].map(p => ({
    chave: p.chave,
    produto: p.produto,
    fornecedor: p.fornecedor,
    setor: p.setor,
    vezes: p.ocorrencias,
    valorMedio: p.soma / p.ocorrencias,
    ultimoValor: p.ultimoValor,
    ultimaData: p.ultimaData,
    naUltima: Boolean(ultima) && p.ultimaData === ultima.data
  })).sort((a, b) => Number(b.naUltima) - Number(a.naUltima) || b.ultimoValor - a.ultimoValor)

  // Por mês: média das fotos do mês (o "quanto estava" típico), a última foto e a pior.
  const porMes = new Map()
  for (const f of fotos) {
    if (!f.mes) continue
    const m = porMes.get(f.mes) || { chave: f.mes, fotos: [] }
    m.fotos.push(f)
    porMes.set(f.mes, m)
  }
  const meses = [...porMes.values()].sort((a, b) => a.chave.localeCompare(b.chave)).map(m => ({
    chave: m.chave,
    auditorias: m.fotos.length,
    valor: m.fotos.reduce((s, f) => s + f.valor, 0) / m.fotos.length,
    itens: m.fotos.reduce((s, f) => s + f.itens, 0) / m.fotos.length,
    ultima: m.fotos.at(-1).valor,
    ultimaData: m.fotos.at(-1).data,
    pico: Math.max(...m.fotos.map(f => f.valor))
  }))

  return {
    auditorias: fotos.map(({ fornecedores, setores, ...f }) => f),
    ultima: ultima ? { data: ultima.data, valor: ultima.valor, itens: ultima.itens, id: ultima.id } : null,
    media,
    itensMedia: n ? fotos.reduce((s, f) => s + f.itens, 0) / n : 0,
    pico: pico ? { data: pico.data, valor: pico.valor, id: pico.id } : null,
    porFornecedor: ranking(porFornecedor, 'fornecedores'),
    porSetor: ranking(porSetor, 'setores'),
    porProduto: produtos,
    meses,
    tendencia: sentido(meses.map(m => m.valor))
  }
}
