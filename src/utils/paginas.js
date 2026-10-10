// Divide uma lista em páginas de tamanho fixo (ao menos uma página, mesmo vazia).
export const paginar = (lista, tamanho) => {
  const itens = Array.isArray(lista) ? lista : []
  const passo = Math.max(1, Math.floor(tamanho) || 1)
  if (!itens.length) return [[]]
  const paginas = []
  for (let i = 0; i < itens.length; i += passo) paginas.push(itens.slice(i, i + passo))
  return paginas
}

// Mesmo número de páginas que `paginar`, mas com itens distribuídos por igual (13 → 7 + 6, não 11 + 2).
export const paginarEquilibrado = (lista, maximo) => {
  const itens = Array.isArray(lista) ? lista : []
  if (!itens.length) return [[]]
  const total = Math.ceil(itens.length / Math.max(1, Math.floor(maximo) || 1))
  return paginar(itens, Math.ceil(itens.length / total))
}
