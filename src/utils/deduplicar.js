const codigoDoItem = item => (item?.['Código'] ?? item?.Codigo ?? '').toString().trim()

// Mantém um registro por código em O(n). Itens sem código são preservados.
// `deveSubstituir(existente, atual)` decide se o atual ocupa a posição do existente.
export const deduplicarPorCodigo = (itens, deveSubstituir) => {
  const resultado = []
  const indicePorCodigo = new Map()
  for (const item of itens || []) {
    const codigo = codigoDoItem(item)
    if (!codigo) {
      resultado.push(item)
      continue
    }
    const indice = indicePorCodigo.get(codigo)
    if (indice === undefined) {
      indicePorCodigo.set(codigo, resultado.length)
      resultado.push(item)
    } else if (deveSubstituir(resultado[indice], item)) {
      resultado[indice] = item
    }
  }
  return resultado
}
