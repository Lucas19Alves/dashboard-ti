import { numeroBR } from './itemAuditoria'
import { sugerirLocal } from './naoVinculados'

// Planilha de estoque total da loja (relatório "Produto" do ERP): todos os itens com estoque.
// Ela não traz local, leitura nem validade; esses dados vêm das auditorias, das validades e dos
// não vinculados. Quando importada, passa a ser a base das análises de estoque: só entram os itens
// que estão nela, com o estoque e os dias sem venda dela (mais atuais que os da última auditoria).

const texto = v => String(v ?? '').trim()
// "35 - MERCEARIA DOCE" → "MERCEARIA DOCE"; "21633 - TOZZI" → "TOZZI" (as auditorias vêm sem o código).
export const semCodigo = v => texto(v).replace(/^\d+(?:\.\d+)*\s+-\s+/, '')
const isoDe = (v) => {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? '' : v.toISOString().slice(0, 10)
  const t = texto(v)
  const br = t.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (br) return `${br[3]}-${br[2]}-${br[1]}`
  return /^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 10) : ''
}
const numeroOuNulo = v => (v === '' || v === null || v === undefined ? null : numeroBR(v))
const sim = v => /^s(im)?$/i.test(texto(v))

// "26,694 KG" → { valor: 26.694, unidade: 'KG' }; 150 → { valor: 150, unidade: '' }.
export const lerQuantidade = (v) => {
  if (typeof v === 'number') return { valor: Number.isFinite(v) ? v : 0, unidade: '' }
  const t = texto(v)
  const m = t.match(/^(-?[\d.]*\d(?:,\d+)?)\s*([A-Za-zÀ-ú]+)?$/)
  if (!m) return { valor: numeroBR(t), unidade: '' }
  return { valor: numeroBR(m[1]), unidade: texto(m[2]).toUpperCase() }
}

export const COLUNAS_OBRIGATORIAS = ['Código', 'Nome', 'Estoque']
export const faltandoColunas = colunas => COLUNAS_OBRIGATORIAS.filter(c => !colunas.some(x => texto(x).toLowerCase() === c.toLowerCase()))

// Linha do relatório → item do estoque total.
export const normalizarItemEstoque = (row) => {
  const estoque = lerQuantidade(row.Estoque ?? row['Estoque atual'])
  const indisponivel = lerQuantidade(row['Estoque Indisponível'])
  return {
    codigo: texto(row['Código'] ?? row.Codigo),
    produto: texto(row.Nome || row.Produto) || 'Produto não informado',
    complemento: texto(row.Complemento),
    estoque: estoque.valor,
    unidade: estoque.unidade,
    indisponivel: indisponivel.valor,
    diasSemVenda: numeroOuNulo(row['Dias sem venda']),
    ultimaVenda: isoDe(row['Última venda'] ?? row['Última Venda']),
    ultimaCompra: isoDe(row['Última Compra'] ?? row['Última compra']),
    classe: semCodigo(row['Classe de Produto']),
    setor: semCodigo(row['Classe de Produto Raiz'] || row.Setor) || 'Não especificado',
    fornecedor: semCodigo(row.Fornecedor) || 'Não informado',
    ranking: numeroOuNulo(row['Ranking de Vendas']),
    gerenciado: sim(row.Gerenciado),
    pesoVariavel: sim(row['Peso Variável'])
  }
}

// Um item por código (a primeira linha vale).
export const tratarEstoqueTotal = (linhas) => {
  const itens = new Map()
  for (const row of linhas || []) {
    const item = normalizarItemEstoque(row)
    if (item.codigo && !itens.has(item.codigo)) itens.set(item.codigo, item)
  }
  return [...itens.values()]
}

export const mapaEstoqueTotal = itens => new Map((itens || []).map(i => [i.codigo, i]))

// 26.694 + "KG" → "26,694 kg"; 150 → "150".
export const formatarQuantidade = (valor, unidade = '') => {
  const n = (Number(valor) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })
  return unidade ? `${n} ${unidade.toLowerCase()}` : n
}


// Insumos (setor OUTROS: sacolas, pallets, tabloides...) não entram na auditoria e não são problema.
export const ehInsumo = item => /^outros$/i.test(texto(item?.setor))

// Itens com estoque na planilha que nunca apareceram nas auditorias de Presença/Ruptura:
// sem local vinculado no sistema (não vinculados). Insumos ficam de fora.
// Quem já apareceu e saiu da auditoria é reincidência (ver reincidencias em utils/estoque.js).
export const semLocalNaPlanilha = ({ total, indice, historico, naoVinculados = [] }) => {
  if (!total?.size || !indice?.auditorias) return []
  const nv = new Map((naoVinculados || []).filter(i => i.status !== 'resolvido').map(i => [i.codigo, i]))
  const linhas = []
  for (const t of total.values()) {
    if (!(t.estoque > 0) || ehInsumo(t) || indice.itens.has(t.codigo)) continue
    const daLista = nv.get(t.codigo)
    const sugestao = daLista?.sugestao?.local ? daLista.sugestao : historico ? sugerirLocal(t, historico) : null
    const vende = t.diasSemVenda !== null && t.diasSemVenda <= 7
    linhas.push({
      codigo: t.codigo,
      produto: t.produto,
      setor: t.setor,
      fornecedor: t.fornecedor,
      local: '',
      estoque: t.estoque,
      unidade: t.unidade,
      diasSemVenda: t.diasSemVenda,
      ultimaVenda: t.ultimaVenda,
      ultimaData: '',
      ultimaLeitura: '',
      tipo: 'semLocal',
      naLista: Boolean(daLista),
      gerenciado: t.gerenciado,
      sugerido: sugestao?.local || '',
      motivoSugestao: sugestao?.motivo || '',
      confianca: sugestao?.confianca || 'nenhuma',
      gravidade: 1 + (vende ? 2 : 0) + (t.gerenciado ? 1 : 0) + (t.estoque >= 50 ? 1 : 0),
      diagnostico: sugestao?.local
        ? `Não vinculado: vincular em ${sugestao.local} (${sugestao.motivo.charAt(0).toLowerCase()}${sugestao.motivo.slice(1)})`
        : 'Não vinculado: definir o local e vincular no sistema'
    })
  }
  return linhas.sort((a, b) => b.gravidade - a.gravidade || (a.diasSemVenda ?? 9999) - (b.diasSemVenda ?? 9999) || b.estoque - a.estoque)
}

// Situação de cada item da planilha nas auditorias (para a lista completa do estoque).
export const SITUACAO_ITEM = {
  lido: 'Lido na última auditoria',
  pendente: 'Não lido, com estoque',
  lidoSemEstoque: 'Lido com estoque zerado',
  semEstoque: 'Sem estoque na auditoria',
  saiu: 'Saiu da auditoria',
  semLocal: 'Sem local (não vinculado)',
  insumo: 'Insumo (não auditado)'
}
export const situacaoNoEstoque = (r, t) => (r?.ativo ? r.situacao : ehInsumo(t) ? 'insumo' : r ? 'saiu' : 'semLocal')

// Lista completa: cada item da planilha com local, leitura, validade e situação nas auditorias.
export const cruzarEstoqueTotal = ({ total, indice, validades }) => {
  const linhas = []
  for (const t of total?.values() || []) {
    const r = indice?.itens.get(t.codigo)
    const v = validades?.get(t.codigo)
    linhas.push({
      ...t,
      local: r?.local || '',
      ultimaLeitura: r?.ultimaLeitura || '',
      ultimaData: r?.ultimaData || '',
      situacao: situacaoNoEstoque(r, t),
      validade: v?.validade || '',
      venceEm: v && v.dias !== null ? Number(v.dias) : null
    })
  }
  return linhas
}

// Insumos da planilha (setor OUTROS), com a situação nas auditorias quando aparecem nelas.
export const insumosNaPlanilha = ({ total, indice }) => {
  const linhas = []
  for (const t of total?.values() || []) {
    if (!ehInsumo(t)) continue
    const r = indice?.itens.get(t.codigo)
    linhas.push({ ...t, local: r?.local || '', ultimaLeitura: r?.ultimaLeitura || '' })
  }
  return linhas.sort((a, b) => b.estoque - a.estoque)
}
