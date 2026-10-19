// Auxiliares das tabelas do detalhe da auditoria (sem estado; compartilhados entre as abas).

export const isPlaceholder = (valor) => {
  if (!valor) return true
  if (typeof valor === 'string') {
    const limpo = valor.trim()
    return limpo.startsWith('###') || 
           limpo === '' || 
           limpo.toLowerCase() === 'undefined' || 
           limpo.toLowerCase() === 'null' ||
           limpo.toLowerCase() === 'não' ||
           limpo.toLowerCase() === 'nao'
  }
  return false
}

export const getSetorItem = (item) => {
  const setor = item?.['Classe de Produto Raiz'] ?? item?.['Setor'] ?? 'Não especificado'
  return String(setor || 'Não especificado').trim()
}

export const extrairEstoque = (item) => {
  // Se já tem valor normalizado, usa ele
  if (item._estoque !== undefined) {
    return item._estoque
  }
  
  // Senão, tenta extrair manualmente (fallback)
  const colunasEstoque = ['Estoque atual', 'oque atual', 'Estoque Leitura']
  for (const coluna of colunasEstoque) {
    if (item[coluna] !== undefined && item[coluna] !== null) {
      const valor = item[coluna]
      if (typeof valor === 'number') {
        return valor > 0 ? valor : 0
      }
      if (typeof valor === 'string') {
        let limpo = valor.replace(/^###\s*/, '').trim()
        limpo = limpo.replace(/KG/gi, '').replace(/\s+/g, ' ')
        const match = limpo.match(/(\d+)[,.]?(\d*)/)
        if (match) {
          const parteInteira = match[1] || '0'
          const parteDecimal = match[2] || '0'
          const numero = parseFloat(parteInteira + '.' + parteDecimal)
          if (!isNaN(numero) && numero > 0) {
            return numero
          }
        }
      }
    }
  }
  return 0
}

export const temPresencaConfirmada = (item) => {
  // Se já tem valor normalizado, usa ele
  if (item._temPresenca !== undefined) {
    return item._temPresenca
  }
  
  // Senão, tenta determinar manualmente (fallback)
  const situacao = item['Situação'] || item['Situação atual da auditoria'] || ''
  if (situacao) {
    const sitLower = situacao.toString().toLowerCase()
    if (sitLower.includes('com prese') || sitLower.includes('com presença')) {
      return true
    }
    if (sitLower.includes('sem prese') || sitLower.includes('sem presença')) {
      return false
    }
  }
  
  const presenca = item['Presença confirmada'] || item['Presença'] || ''
  if (presenca) {
    if (isPlaceholder(presenca)) {
      return false
    }
    if (typeof presenca === 'number') {
      return true
    }
    if (typeof presenca === 'string' && presenca.trim() !== '') {
      return !isPlaceholder(presenca)
    }
  }
  
  return false
}

export const sortDados = (lista, ordenacao) => {
  const col = ordenacao.coluna
  const dir = ordenacao.direcao
  return [...lista].sort((a, b) => {
    const va = a[col]; const vb = b[col]
    if (typeof va === 'number' && typeof vb === 'number') return dir === 'asc' ? va - vb : vb - va
    return dir === 'asc' ? String(va ?? '').localeCompare(String(vb ?? '')) : String(vb ?? '').localeCompare(String(va ?? ''))
  })
}

export const filtrarBuscaDados = (lista, termo) => {
  if (!termo) return lista
  const t = termo.toLowerCase()
  return lista.filter(item => Object.values(item).some(v => String(v).toLowerCase().includes(t)))
}

export const atualizarOrdenacaoDados = (obj, coluna) => {
  if (obj.coluna === coluna) {
    obj.direcao = obj.direcao === 'asc' ? 'desc' : 'asc'
  } else {
    obj.coluna = coluna
    obj.direcao = 'asc'
  }
}

export const paginasVisiveisFn = (total, atual) => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = [1]
  if (atual > 3) pages.push('...')
  for (let i = Math.max(2, atual - 1); i <= Math.min(total - 1, atual + 1); i++) pages.push(i)
  if (atual < total - 2) pages.push('...')
  pages.push(total)
  return pages
}
