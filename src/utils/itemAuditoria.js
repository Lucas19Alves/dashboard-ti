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
