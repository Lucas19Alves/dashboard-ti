// Item lido na auditoria: presença confirmada, "lido não pertence" ou (Etiqueta) status de leitura.
const normalizar = (valor) => {
  if (valor == null) return ''
  try {
    return String(valor).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
  } catch {
    return String(valor).toLowerCase()
  }
}

export const isItemLido = (item) => {
  if (!item) return false
  if (item._temPresenca === true || item._lidoNaoPertence === true) return true

  const lidoNaoPertence = item['Lido não pertence'] ?? item['Lido nao pertence']
  if (lidoNaoPertence === true) return true
  if (typeof lidoNaoPertence === 'string' && normalizar(lidoNaoPertence).includes('sim')) return true

  // Etiqueta registra a leitura pelo status, mesmo quando não há presença confirmada.
  // Os estados de "não lido" são descartados antes dos estados positivos para evitar
  // que "não lido atualizado" seja interpretado como leitura.
  const situacao = normalizar(item._situacao || item['Situação'] || item['Situação atual da auditoria'] || '')
  if (situacao.includes('nao lido') || situacao.includes('sem leitura')) return false
  if (
    situacao.includes('atualizado') ||
    situacao.includes('desatualizado') ||
    situacao.includes('lido sem estoque') ||
    situacao.includes('lido nao pertence')
  ) return true

  return false
}
