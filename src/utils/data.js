// Formato único de data do sistema: DD/MM/AAAA (e DD/MM/AAAA HH:MM com hora).
// Aceita Date, ISO "AAAA-MM-DD[THH:MM...]" ou timestamp. Datas ISO só com o dia
// são lidas pelo texto para não escorregarem um dia por causa do fuso.

const dois = n => String(n).padStart(2, '0')

const paraDate = (valor) => {
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor
  if (typeof valor === 'number') return paraDate(new Date(valor))
  const texto = String(valor ?? '').trim()
  if (!texto) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return paraDate(new Date(`${texto}T12:00:00`))
  return paraDate(new Date(texto))
}

export const formatarData = (valor, vazio = '') => {
  const texto = typeof valor === 'string' ? valor.trim() : ''
  // Texto ISO: o dia vem do próprio texto (como sempre foi), sem conversão de fuso.
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(texto)) return texto
  const d = paraDate(valor)
  return d ? `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()}` : vazio
}

export const formatarDataHora = (valor, vazio = '') => {
  const d = paraDate(valor)
  if (!d) return vazio
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor.trim())) return formatarData(valor, vazio)
  return `${formatarData(d)} ${dois(d.getHours())}:${dois(d.getMinutes())}`
}

// "seg., 16/11/2026": dia da semana abreviado + data.
export const formatarDataSemana = (valor, vazio = '') => {
  const d = paraDate(valor)
  if (!d) return vazio
  return `${d.toLocaleDateString('pt-BR', { weekday: 'short' })}, ${formatarData(d)}`
}
