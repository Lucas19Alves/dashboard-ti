// CSV separado por ";" (padrão do Excel em pt-BR), com proteção contra injeção de fórmulas.
const celula = valor => {
  const conteudo = String(valor ?? '')
  const seguro = /^[=+@\-\t\r]/.test(conteudo) ? `'${conteudo}` : conteudo
  return `"${seguro.replaceAll('"', '""')}"`
}

// `colunas`: [{ chave, titulo }] ou [[chave, titulo]].
export const gerarCsv = (linhas, colunas) => {
  const normalizadas = colunas.map(c => (Array.isArray(c) ? { chave: c[0], titulo: c[1] } : c))
  return [
    normalizadas.map(c => celula(c.titulo)).join(';'),
    ...(linhas || []).map(linha => normalizadas.map(c => celula(linha?.[c.chave])).join(';'))
  ].join('\r\n')
}

export const baixarCsv = (linhas, colunas, nomeArquivo) => {
  const url = URL.createObjectURL(new Blob(['﻿', gerarCsv(linhas, colunas)], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = nomeArquivo.endsWith('.csv') ? nomeArquivo : `${nomeArquivo}.csv`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
