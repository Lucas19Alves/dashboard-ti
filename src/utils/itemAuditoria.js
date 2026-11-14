import { isItemLido } from './itemLido'

// Leitura dos campos de um item da planilha, com as mesmas regras da análise da auditoria.

const texto = valor => String(valor ?? '').trim()

export const usuarioDoItem = item => texto(item?.['Usuário'])
export const setorDoItem = item => texto(item?.['Classe de Produto Raiz'] || item?.['Setor']) || 'Não especificado'
export const localDoItem = item => texto(item?.['Local']) || 'Não especificado'
// "G05A - G05A" → "G05A" (o ERP repete o código do local).
export const codigoLocal = local => texto(String(local ?? '').split(' - ')[0]) || texto(local)
export const codigoDoItem = item => texto(item?.['Código'] ?? item?.Codigo)
export const produtoDoItem = item => texto(item?.['Produto']) || 'Produto não informado'
export const fornecedorDoItem = item => texto(item?.['Fornecedor']) || 'Não informado'

// Quantidade de estoque escrita na planilha: "9.051,374 KG" → 9051.374; "### 25,502 KG" → 25.502;
// "1.234" → 1234 (ponto de milhar); "12" → 12. Negativo ou inválido → 0.
export const numeroEstoque = (valor) => {
  if (typeof valor === 'number') return Number.isFinite(valor) && valor > 0 ? valor : 0
  const limpo = texto(valor).replace(/^###\s*/, '').replace(/KG|UN/gi, '').trim()
  const m = limpo.match(/-?[\d.,]*\d/)
  if (!m) return 0
  const bruto = m[0]
  const normalizado = bruto.includes(',')
    ? bruto.replace(/\./g, '').replace(',', '.')
    : /^-?\d{1,3}(\.\d{3})+$/.test(bruto) ? bruto.replace(/\./g, '') : bruto
  const n = Number(normalizado)
  return Number.isFinite(n) && n > 0 ? n : 0
}

// Recalcula o _estoque guardado nos itens (as importações antigas liam "9.051,374 KG" como 9,051).
export const corrigirEstoqueDosItens = (dados) => {
  if (!Array.isArray(dados)) return 0
  let mudou = 0
  for (const item of dados) {
    if (!item || typeof item !== 'object') continue
    const bruto = item['Estoque atual'] ?? item['Estoque Atual']
    if (typeof bruto !== 'string' || item._estoque === undefined) continue
    const certo = numeroEstoque(bruto)
    if (certo !== item._estoque) { item._estoque = certo; mudou++ }
  }
  return mudou
}

export const numeroBR = (valor) => {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0
  const limpo = texto(valor).replace(/R\$\s*/i, '')
  if (!limpo) return 0
  // "1.234,56" → 1234.56; "12.5" → 12.5
  const normalizado = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo
  const n = Number(normalizado)
  return Number.isFinite(n) ? n : 0
}

export const custoRupturaDoItem = item => numeroBR(item?.['Custo Ruptura'] ?? item?.['Custo de Ruptura'] ?? item?.['Custo ruptura'] ?? item?.['Custo de ruptura'])

// Estoque pela Situação (fonte de verdade) e, sem ela, pela coluna de estoque.
export const temEstoque = (item) => {
  if (item?._temEstoqueSituacao !== null && item?._temEstoqueSituacao !== undefined) return Boolean(item._temEstoqueSituacao)
  return numeroBR(item?._estoque ?? item?.['Estoque atual'] ?? item?.['Estoque Atual']) > 0
}

// Pendente: não lido e com estoque (mesma regra do % pendente da auditoria).
export const itemPendente = item => Boolean(item) && !isItemLido(item) && temEstoque(item)
