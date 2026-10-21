import { codigoDoItem, codigoLocal, custoRupturaDoItem, itemPendente, localDoItem } from './itemAuditoria'

// Cruzamentos de vencimentos com as auditorias: onde estão os itens perto de vencer (mapa)
// e quais produtos vencem no estoque enquanto faltam na gôndola (ruptura recorrente).

export const PRAZOS_CRITICOS = ['vencidos', 'hoje', 'ate3']
export const CATEGORIAS_VENCIMENTO = [
  { valor: 'vencidos', rotulo: 'Vencidos' },
  { valor: 'hoje', rotulo: 'Vencem hoje' },
  { valor: 'aVencer', rotulo: 'A vencer' }
]

// vencidos (dias < 0) · hoje (0) · aVencer (dias > 0); null sem validade.
export const categoriaVencimento = (item) => {
  const dias = item?._diasParaVencer
  if (dias !== null && dias !== undefined && dias !== '' && !Number.isNaN(Number(dias))) {
    const d = Number(dias)
    return d < 0 ? 'vencidos' : d === 0 ? 'hoje' : 'aVencer'
  }
  if (item?._prazo === 'vencidos') return 'vencidos'
  if (item?._prazo === 'hoje') return 'hoje'
  if (item?._prazo === 'ate3' || item?._prazo === 'futuro') return 'aVencer'
  return null
}
const TODAS = CATEGORIAS_VENCIMENTO.map(c => c.valor)
const dataDe = a => String(a?.data || '').slice(0, 10)
const emOrdem = lista => [...(lista || [])].filter(Boolean).sort((a, b) => dataDe(a).localeCompare(dataDe(b)) || (a.id || 0) - (b.id || 0))

// Último local de cada código nas auditorias (para itens de vencimento sem coluna de local).
export const localPorCodigo = (auditorias) => {
  const mapa = new Map()
  for (const auditoria of emOrdem(auditorias)) {
    for (const item of Array.isArray(auditoria?.dados) ? auditoria.dados : []) {
      const codigo = codigoDoItem(item)
      if (codigo && item?.Local) mapa.set(codigo, codigoLocal(localDoItem(item)))
    }
  }
  return mapa
}

// "G05A; G06B" ou "G05A - G05A" → "G05A" (primeiro local informado).
export const localDoVencimento = (item, locais) => {
  const proprio = String(item?._local || '').split(/[;,|/]/)[0].trim()
  if (proprio) return { local: codigoLocal(proprio), origem: 'planilha' }
  const daAuditoria = locais?.get(String(item?._codigo || '').trim())
  return daAuditoria ? { local: daAuditoria, origem: 'auditoria' } : { local: '', origem: '' }
}

// Mapa: por local, contagem de vencidos, que vencem hoje e a vencer (só as categorias escolhidas).
// No formato do mapa da loja: pendentes = vencidos, comProblema = vencem hoje, lidos = a vencer.
// `dados` leva os itens com o local resolvido, para o modal "Ver itens" de cada área.
export const mapaVencimentos = (itens, auditorias, categorias = TODAS) => {
  const locais = localPorCodigo(auditorias)
  const porLocal = {}
  const dados = []
  let semLocal = 0
  let pelaAuditoria = 0
  for (const item of itens || []) {
    const categoria = categoriaVencimento(item)
    if (!categoria || !categorias.includes(categoria)) continue
    const { local, origem } = localDoVencimento(item, locais)
    if (!local) { semLocal++; continue }
    if (origem === 'auditoria') pelaAuditoria++
    const destino = (porLocal[local] ??= { lidos: 0, pendentes: 0, comProblema: 0 })
    if (categoria === 'vencidos') destino.pendentes++
    else if (categoria === 'hoje') destino.comProblema++
    else destino.lidos++
    dados.push({ ...item, Local: local, _categoria: categoria, _origemLocal: origem })
  }
  return { auditoria: { analise: { porLocal }, dados }, semLocal, pelaAuditoria, total: dados.length + semLocal }
}

const numero = v => {
  const n = Number(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
const un = n => `${n} un.`
const diaMes = iso => (iso ? `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}` : '')

// O que fazer com o produto, cruzando validade, estoque, ruptura e giro:
// - sem estoque no sistema: conferir físico (vencido) ou pedido/recebimento (a vencer);
// - vencido com estoque: retirar e registrar perda;
// - vence hoje: rebaixar e expor;
// - a vencer: repor já se faltou na última auditoria, senão expor na frente/rebaixar quando curto;
// - ruptura frequente com estoque: problema de reposição, não de compra;
// - sem venda há muito tempo: rever pedido/mix.
export const diagnosticoVencimento = ({ categoria, dias, estoque, vezes, auditorias, faltouNaUltima, diasSemVenda, validade }) => {
  const frequente = vezes >= 2 && (!auditorias || vezes / auditorias >= 0.5)
  const parado = diasSemVenda !== null && diasSemVenda >= 30
  const extras = []
  let principal
  if (estoque <= 0) {
    principal = categoria === 'aVencer'
      ? 'Sem estoque no sistema e faltando na gôndola: conferir pedido e recebimento com o fornecedor'
      : 'Sem estoque no sistema: conferir se ainda há produto vencido no físico, retirar e ajustar o estoque'
  } else if (categoria === 'vencidos') {
    principal = `Retirar ${un(estoque)} vencidas da venda e registrar a perda`
    if (faltouNaUltima) extras.push('o estoque ficou no depósito enquanto faltava na gôndola')
    if (frequente || parado) extras.push('reduzir o pedido')
  } else if (categoria === 'hoje') {
    principal = faltouNaUltima ? `Repor agora e rebaixar: ${un(estoque)} vencem hoje e faltavam na gôndola` : `Rebaixar hoje e expor na frente: ${un(estoque)} vencem hoje`
  } else if (dias <= 3) {
    principal = faltouNaUltima
      ? `Repor a gôndola agora: ${un(estoque)} no estoque vencem em ${dias} dia(s)`
      : `Expor na frente e avaliar rebaixa: ${un(estoque)} vencem em ${dias} dia(s)`
  } else if (frequente) {
    principal = `Falta na gôndola com frequência mesmo com estoque: rever reposição e ponto de abastecimento (vence ${diaMes(validade)})`
  } else {
    principal = faltouNaUltima ? `Repor e girar (primeiro que vence, primeiro que sai) antes de ${diaMes(validade)}` : `Girar o estoque antes de ${diaMes(validade)}`
  }
  if (estoque > 0 && parado) extras.push(`sem venda há ${diasSemVenda} dias: rever pedido/mix`)
  return [principal, ...extras].join('; ')
}

// Produtos vencidos, que vencem hoje ou a vencer que também ficaram sem presença (pendentes) em auditorias.
export const cruzarValidadeRuptura = (itens, auditorias, { categorias = TODAS } = {}) => {
  const ruptura = new Map()
  const presenca = emOrdem(auditorias).filter(a => a.tipo === 'Presença' || a.tipo === 'Ruptura')
  const ultimaData = presenca.length ? dataDe(presenca.at(-1)) : ''
  const diasSemVenda = new Map()
  for (const auditoria of presenca) {
    const vistos = new Set()
    for (const item of Array.isArray(auditoria?.dados) ? auditoria.dados : []) {
      const codigo = codigoDoItem(item)
      if (!codigo) continue
      const dsv = numero(item?.['Dias sem venda'])
      if (dsv !== null) diasSemVenda.set(codigo, dsv)
      if (vistos.has(codigo) || !itemPendente(item)) continue
      vistos.add(codigo)
      const r = ruptura.get(codigo) || { vezes: 0, ultima: '', custo: 0 }
      r.vezes++
      r.ultima = dataDe(auditoria)
      r.custo += custoRupturaDoItem(item)
      ruptura.set(codigo, r)
    }
  }
  const PESO = { vencidos: 3, hoje: 3, aVencer: 1 }
  const linhas = []
  for (const item of itens || []) {
    const categoria = categoriaVencimento(item)
    if (!categoria || !categorias.includes(categoria)) continue
    const codigo = String(item._codigo || '').trim()
    const r = ruptura.get(codigo)
    if (!r) continue
    const dias = Number(item?._diasParaVencer)
    const estoque = Number(item._estoque) || 0
    const faltouNaUltima = r.ultima === ultimaData
    const dsv = diasSemVenda.has(codigo) ? diasSemVenda.get(codigo) : null
    linhas.push({
      codigo: item._codigo,
      produto: item._produto,
      setor: item._setor,
      fornecedor: item._fornecedor,
      validade: item._validadeISO,
      categoria,
      dias,
      estoque,
      vezesRuptura: r.vezes,
      ultimaRuptura: r.ultima,
      faltouNaUltima,
      diasSemVenda: dsv,
      custoRuptura: r.custo,
      gravidade: PESO[categoria] + (categoria === 'aVencer' && dias <= 3 ? 1 : 0) + (r.vezes >= 2 ? 1 : 0) + (faltouNaUltima ? 1 : 0) + (estoque > 0 ? 1 : 0),
      diagnostico: diagnosticoVencimento({ categoria, dias, estoque, vezes: r.vezes, auditorias: presenca.length, faltouNaUltima, diasSemVenda: dsv, validade: item._validadeISO })
    })
  }
  return linhas.sort((a, b) => b.gravidade - a.gravidade || b.vezesRuptura - a.vezesRuptura || a.dias - b.dias)
}
