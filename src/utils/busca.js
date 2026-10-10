// Normaliza texto para busca sem acento e sem diferenciar maiúsculas.
export const normalizarBusca = valor => String(valor ?? '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .trim()

// Todos os termos da consulta precisam aparecer em algum dos campos.
export const correspondeBusca = (consulta, campos) => {
  const termos = normalizarBusca(consulta).split(/\s+/).filter(Boolean)
  if (!termos.length) return true
  const alvo = campos.map(normalizarBusca).join(' ')
  return termos.every(termo => alvo.includes(termo))
}

export const formatarDataBR = (iso) => {
  const texto = String(iso || '').slice(0, 10)
  const partes = texto.split('-')
  return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : texto
}
