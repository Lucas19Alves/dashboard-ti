import { codigoDoItem, codigoLocal, custoRupturaDoItem, fornecedorDoItem, localDoItem, numeroBR, produtoDoItem, setorDoItem, temEstoque } from './itemAuditoria'
import { isItemLido } from './itemLido'

// Análises de estoque a partir das auditorias de Presença e Ruptura (as que leem a gôndola):
// - reincidências: itens com estoque que não são lidos há semanas (somem da gôndola);
// - sem estoque no sistema: itens lidos na gôndola com estoque zerado (entrada não lançada);
// - estoque parado: itens com estoque e muitos dias sem venda.
// Tudo parte da situação de cada código na última vez em que apareceu nas auditorias.

export const LIMIAR_REINCIDENCIA_DIAS = 14
export const LIMIAR_PARADO_DIAS = 30
export const TIPOS_PROBLEMA = {
  reincidencia: { rotulo: 'Reincidência', curto: 'Sem leitura', icone: 'fas fa-repeat' },
  semEstoque: { rotulo: 'Sem estoque no sistema', curto: 'Estoque zerado', icone: 'fas fa-box-open' },
  parado: { rotulo: 'Estoque parado', curto: 'Sem venda', icone: 'fas fa-hourglass-half' }
}

const TIPOS_LEITURA = new Set(['Presença', 'Ruptura'])
const dataDe = a => String(a?.data || '').slice(0, 10)
const emOrdem = lista => [...(lista || [])].filter(Boolean).sort((a, b) => dataDe(a).localeCompare(dataDe(b)) || (a.id || 0) - (b.id || 0))
export const diasEntre = (a, b) => (a && b ? Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000) : null)
const numeroOuNulo = v => (v === '' || v === null || v === undefined ? null : numeroBR(v))
const localValido = l => l && !/^n[aã]o especificado$/i.test(l)
const texto = v => String(v ?? '').trim()

// Situação de um código numa auditoria (junta as linhas repetidas do mesmo código).
const lerAuditoria = (dados) => {
  const vistos = new Map()
  for (const item of dados) {
    const codigo = codigoDoItem(item)
    if (!codigo) continue
    const naoPertence = Boolean(item._lidoNaoPertence)
    const local = codigoLocal(localDoItem(item))
    const r = vistos.get(codigo) || { lido: false, naoPertence: false, localLido: '', local: '', item: null }
    if (naoPertence) {
      r.naoPertence = true
      if (localValido(local)) r.localLido = local
    } else if (isItemLido(item)) {
      r.lido = true
    }
    // A linha do local vinculado manda nos dados do item; "lido não pertence" só quando é a única.
    if (!naoPertence || !r.item) {
      r.item = item
      if (!naoPertence && localValido(local)) r.local = local
    }
    vistos.set(codigo, r)
  }
  return vistos
}

// Uma passada por todas as auditorias de Presença/Ruptura: histórico e situação atual de cada código.
export const indexarEstoque = (auditorias) => {
  const lista = emOrdem(auditorias).filter(a => TIPOS_LEITURA.has(a?.tipo) && Array.isArray(a.dados) && a.dados.length)
  const itens = new Map()
  for (const auditoria of lista) {
    const data = dataDe(auditoria)
    for (const [codigo, v] of lerAuditoria(auditoria.dados)) {
      const item = v.item
      const comEstoque = temEstoque(item)
      const estoque = numeroBR(item?._estoque ?? item?.['Estoque atual'] ?? item?.['Estoque Atual'])
      const r = itens.get(codigo) || {
        codigo, produto: '', setor: '', classe: '', fornecedor: '', local: '',
        primeiraData: data, ultimaData: '', ultimaLeitura: '', pendenteDesde: '',
        aparicoes: 0, leituras: 0, seguidasSemLeitura: 0, custoAcumulado: 0,
        semEstoqueVezes: 0, semEstoqueDesde: '', naoPertence: new Map(), historico: []
      }
      r.produto = produtoDoItem(item)
      r.setor = setorDoItem(item)
      r.classe = texto(item?.['Classe de Produto']) || r.classe
      r.fornecedor = fornecedorDoItem(item)
      if (v.local) r.local = v.local
      r.estoque = estoque
      r.comEstoque = comEstoque
      r.diasSemVenda = numeroOuNulo(item?.['Dias sem venda'])
      r.custo = custoRupturaDoItem(item)
      r.ultimaCompra = texto(item?.['Última compra'] ?? item?.['Última Compra'])
      r.ultimaData = data
      r.aparicoes++
      // "Lido não pertence" não conta como leitura: o local vinculado continuou sem o produto.
      const lido = v.lido
      if (v.naoPertence && v.localLido) {
        const n = r.naoPertence.get(v.localLido) || { vezes: 0, ultima: '' }
        n.vezes++
        n.ultima = data
        r.naoPertence.set(v.localLido, n)
      }
      let situacao
      if (lido) {
        r.leituras++
        r.ultimaLeitura = data
        r.seguidasSemLeitura = 0
        r.pendenteDesde = ''
        situacao = comEstoque ? 'lido' : 'lidoSemEstoque'
      } else if (comEstoque) {
        r.seguidasSemLeitura++
        r.pendenteDesde ||= data
        r.custoAcumulado += r.custo
        situacao = 'pendente'
      } else {
        r.seguidasSemLeitura = 0
        r.pendenteDesde = ''
        situacao = 'semEstoque'
      }
      if (situacao === 'lidoSemEstoque') {
        r.semEstoqueVezes++
        r.semEstoqueDesde ||= data
      } else {
        r.semEstoqueVezes = 0
        r.semEstoqueDesde = ''
      }
      r.situacao = situacao
      r.historico.push({ data, tipo: auditoria.tipo, auditoriaId: auditoria.id, situacao, local: v.local || r.local, localLido: v.localLido, estoque, diasSemVenda: r.diasSemVenda })
      itens.set(codigo, r)
    }
  }
  // Ciclo atual: a partir da última Presença. Quem não apareceu nele saiu da lista (ex.: zerou o estoque).
  const presencas = lista.filter(a => a.tipo === 'Presença')
  const inicioCiclo = presencas.length ? dataDe(presencas.at(-1)) : (lista.length ? dataDe(lista.at(-1)) : '')
  for (const r of itens.values()) r.ativo = r.ultimaData >= inicioCiclo
  return {
    itens,
    auditorias: lista.length,
    inicioCiclo,
    ultimaData: lista.length ? dataDe(lista.at(-1)) : '',
    primeiraData: lista.length ? dataDe(lista[0]) : ''
  }
}

const base = r => ({
  codigo: r.codigo, produto: r.produto, setor: r.setor, fornecedor: r.fornecedor, local: r.local || '',
  estoque: r.estoque, diasSemVenda: r.diasSemVenda, ultimaData: r.ultimaData, ultimaLeitura: r.ultimaLeitura
})

// Onde o item foi achado fora do lugar depois da última leitura no local vinculado.
const achadoEm = (r, desde = '') => [...r.naoPertence.entries()]
  .filter(([, n]) => n.ultima >= desde)
  .sort((a, b) => b[1].ultima.localeCompare(a[1].ultima) || b[1].vezes - a[1].vezes)[0]?.[0] || ''

export const diagnosticoReincidencia = ({ nuncaLido, diasSemVenda, achado, dias }) => {
  const vende = diasSemVenda !== null && diasSemVenda <= 7
  const parado = diasSemVenda === null || diasSemVenda >= LIMIAR_PARADO_DIAS
  if (achado) return `Lido em ${achado}, fora do local vinculado: devolver ao local ou corrigir o vínculo`
  if (vende) return 'Vende, mas não é achado no local: procurar no depósito e em outros locais e repor a gôndola'
  if (nuncaLido && parado) return 'Nunca lido e sem venda: provável estoque que não existe, contar e ajustar'
  if (parado) return `Sem leitura há ${dias} dias e sem venda: contar o físico e ajustar o estoque`
  return 'Procurar no depósito, repor a gôndola e conferir o vínculo do local'
}

// Itens com estoque que não são lidos há `limiar` dias ou mais (Presença/Ruptura).
export const reincidencias = (indice, { limiar = LIMIAR_REINCIDENCIA_DIAS } = {}) => {
  const linhas = []
  for (const r of indice.itens.values()) {
    if (!r.ativo || r.situacao !== 'pendente') continue
    const nuncaLido = !r.ultimaLeitura
    const desde = r.ultimaLeitura || r.pendenteDesde
    const dias = diasEntre(desde, r.ultimaData)
    if (dias === null || dias < limiar) continue
    const achado = achadoEm(r, desde)
    const vende = r.diasSemVenda !== null && r.diasSemVenda <= 7
    linhas.push({
      ...base(r),
      tipo: 'reincidencia',
      dias,
      nuncaLido,
      desde,
      auditoriasSemLeitura: r.seguidasSemLeitura,
      custoAcumulado: r.custoAcumulado,
      achadoEm: achado,
      gravidade: 2 + (vende ? 2 : 0) + Math.min(3, Math.floor(dias / 14)) + (r.custoAcumulado > 0 ? 1 : 0) + (achado ? 1 : 0),
      diagnostico: diagnosticoReincidencia({ nuncaLido, diasSemVenda: r.diasSemVenda, achado, dias })
    })
  }
  return linhas.sort((a, b) => b.gravidade - a.gravidade || b.dias - a.dias || b.custoAcumulado - a.custoAcumulado)
}

// Itens lidos na gôndola com estoque zerado no sistema na última auditoria em que apareceram.
export const semEstoqueNoSistema = (indice) => {
  const linhas = []
  for (const r of indice.itens.values()) {
    if (!r.ativo || r.situacao !== 'lidoSemEstoque') continue
    const vezes = r.semEstoqueVezes
    linhas.push({
      ...base(r),
      tipo: 'semEstoque',
      vezes,
      desde: r.semEstoqueDesde,
      dias: diasEntre(r.semEstoqueDesde, r.ultimaData),
      gravidade: 2 + (vezes >= 2 ? 1 : 0) + (vezes >= 4 ? 1 : 0),
      diagnostico: vezes >= 2
        ? `Na gôndola com estoque zerado em ${vezes} auditorias seguidas: conferir a nota de entrada e ajustar o estoque`
        : 'Na gôndola com estoque zerado no sistema: conferir a nota de entrada e ajustar o estoque'
    })
  }
  return linhas.sort((a, b) => b.gravidade - a.gravidade || b.vezes - a.vezes || a.produto.localeCompare(b.produto))
}

// Menor validade de cada código nos vencimentos (para cruzar com estoque parado).
export const validadePorCodigo = (vencimentos) => {
  const mapa = new Map()
  for (const v of vencimentos || []) {
    const codigo = texto(v?._codigo)
    if (!codigo || !v._validadeISO) continue
    const atual = mapa.get(codigo)
    if (!atual || v._validadeISO < atual.validade) mapa.set(codigo, { validade: v._validadeISO, dias: v._diasParaVencer ?? null, estoque: Number(v._estoque) || 0 })
  }
  return mapa
}

// Itens com estoque e `limiar` dias ou mais sem venda.
export const estoqueParado = (indice, vencimentos = [], { limiar = LIMIAR_PARADO_DIAS } = {}) => {
  const validades = validadePorCodigo(vencimentos)
  const linhas = []
  for (const r of indice.itens.values()) {
    if (!r.ativo || !r.comEstoque || r.diasSemVenda === null || r.diasSemVenda < limiar) continue
    const v = validades.get(r.codigo)
    const venceEm = v && v.dias !== null ? Number(v.dias) : null
    const naoAchado = r.situacao === 'pendente'
    let diagnostico
    if (venceEm !== null && venceEm < 0) diagnostico = 'Vencido e sem venda: retirar, registrar a perda e rever o pedido'
    else if (venceEm !== null && venceEm <= 30) diagnostico = `Vence em ${venceEm} dia(s) e não gira: rebaixar ou negociar troca com o fornecedor`
    else if (naoAchado) diagnostico = 'Sem venda e não achado na gôndola: contar o físico, pode ser estoque que não existe'
    else if (r.diasSemVenda >= 90) diagnostico = `Sem venda há ${r.diasSemVenda} dias: suspender o pedido e avaliar saída do mix`
    else diagnostico = `Sem venda há ${r.diasSemVenda} dias: melhorar a exposição ou rebaixar`
    linhas.push({
      ...base(r),
      tipo: 'parado',
      dias: r.diasSemVenda,
      validade: v?.validade || '',
      venceEm,
      naoAchado,
      gravidade: 1 + (venceEm !== null && venceEm <= 30 ? 3 : 0) + (naoAchado ? 1 : 0) + (r.estoque >= 50 ? 1 : 0) + (r.diasSemVenda >= 90 ? 1 : 0),
      diagnostico
    })
  }
  return linhas.sort((a, b) => b.gravidade - a.gravidade || b.dias - a.dias || b.estoque - a.estoque)
}

// ---------- Onde agir ----------
// Soma os problemas por local, setor ou fornecedor.
export const agruparProblemas = ({ reincidentes = [], semEstoque = [], parados = [], naoVinculados = [], suspeitos = [] }, campo) => {
  const mapa = new Map()
  const somar = (chave, tipo, extra = 0) => {
    const k = chave || (campo === 'local' ? 'Sem local' : 'Não informado')
    const r = mapa.get(k) || { chave: k, reincidentes: 0, semEstoque: 0, parados: 0, naoVinculados: 0, suspeitos: 0, custo: 0, total: 0 }
    r[tipo]++
    r.total++
    r.custo += extra
    mapa.set(k, r)
  }
  for (const l of reincidentes) somar(l[campo], 'reincidentes', l.custoAcumulado || 0)
  for (const l of semEstoque) somar(l[campo], 'semEstoque')
  for (const l of parados) somar(l[campo], 'parados')
  const campoNv = { local: i => i.sugestao?.local, setor: i => i.setor, fornecedor: i => i.fornecedor }[campo]
  if (campoNv) for (const i of naoVinculados) somar(campoNv(i), 'naoVinculados')
  if (campo === 'local' || campo === 'setor') for (const s of suspeitos) somar(campo === 'local' ? s.vinculadoEm : s.setor, 'suspeitos')
  return [...mapa.values()].sort((a, b) => b.total - a.total || b.custo - a.custo || a.chave.localeCompare(b.chave, 'pt-BR', { numeric: true }))
}

// Busca de itens no índice (código exato primeiro, depois por nome).
export const buscarItens = (indice, termo, limite = 30) => {
  const t = texto(termo).toLowerCase()
  if (t.length < 2) return []
  const exato = indice.itens.get(texto(termo))
  const resultado = exato ? [exato] : []
  for (const r of indice.itens.values()) {
    if (resultado.length >= limite) break
    if (r === exato) continue
    if (r.codigo.includes(t) || r.produto.toLowerCase().includes(t)) resultado.push(r)
  }
  return resultado
}
