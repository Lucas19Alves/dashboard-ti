// O ERP exporta o usuário como "5485398 (GISELE FERREIRA DE NORONHA)".
// Separa matrícula e nome para exibição; mantém o texto original quando não segue o padrão.
const PADRAO = /^\s*(\d+)\s*[-–(]\s*(.*?)\s*\)?\s*$/

const capitalizar = texto => texto
  .toLowerCase()
  .replace(/(^|[\s/-])(\p{L})/gu, (_, sep, letra) => sep + letra.toUpperCase())
  .replace(/\b(Da|De|Do|Das|Dos|E)\b/g, p => p.toLowerCase())

export const separarUsuario = (valor) => {
  const original = String(valor ?? '').trim()
  const m = original.match(PADRAO)
  if (m && m[2]) return { original, matricula: m[1], nome: capitalizar(m[2]) }
  if (/^\d+$/.test(original)) return { original, matricula: original, nome: '' }
  return { original, matricula: '', nome: original }
}

// Texto curto para gráficos e impressão: "Gisele Ferreira de Noronha (5485398)".
export const rotuloUsuario = (valor) => {
  const { matricula, nome, original } = separarUsuario(valor)
  if (nome && matricula) return `${nome} (${matricula})`
  return nome || matricula || original
}
