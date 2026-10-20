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

// Produtos vencidos, que vencem hoje ou a vencer que também ficaram sem presença (pendentes) em auditorias.
export const cruzarValidadeRuptura = (itens, auditorias, { categorias = TODAS } = {}) => {
  const ruptura = new Map()
  for (const auditoria of emOrdem(auditorias).filter(a => a.tipo === 'Presença' || a.tipo === 'Ruptura')) {
    const vistos = new Set()
    for (const item of Array.isArray(auditoria?.dados) ? auditoria.dados : []) {
      const codigo = codigoDoItem(item)
      if (!codigo || vistos.has(codigo) || !itemPendente(item)) continue
      vistos.add(codigo)
      const r = ruptura.get(codigo) || { vezes: 0, ultima: '', custo: 0 }
      r.vezes++
      r.ultima = dataDe(auditoria)
      r.custo += custoRupturaDoItem(item)
      ruptura.set(codigo, r)
    }
  }
  const linhas = []
  for (const item of itens || []) {
    const categoria = categoriaVencimento(item)
    if (!categoria || !categorias.includes(categoria)) continue
    const dias = item?._diasParaVencer
    const r = ruptura.get(String(item._codigo || '').trim())
    if (!r) continue
    const estoque = Number(item._estoque) || 0
    const diagnostico = r.vezes >= 2 && estoque > 0
      ? 'Falta na gôndola com frequência e vence no estoque: rever exposição, reposição e tamanho do pedido'
      : estoque > 0
        ? 'Tem estoque perto do vencimento e já faltou na gôndola: repor e expor'
        : 'Validade curta e ruptura: conferir pedido e recebimento'
    linhas.push({
      codigo: item._codigo,
      produto: item._produto,
      setor: item._setor,
      fornecedor: item._fornecedor,
      validade: item._validadeISO,
      categoria,
      dias: Number(dias),
      estoque,
      vezesRuptura: r.vezes,
      ultimaRuptura: r.ultima,
      custoRuptura: r.custo,
      gravidade: (r.vezes >= 2 ? 2 : 1) + (Number(dias) <= 3 ? 1 : 0) + (estoque > 0 ? 1 : 0),
      diagnostico
    })
  }
  return linhas.sort((a, b) => b.gravidade - a.gravidade || b.vezesRuptura - a.vezesRuptura || a.dias - b.dias)
}
