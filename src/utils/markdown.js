// Markdown simples para a documentação in-app (títulos, listas, código, links, ênfase).
// Todo texto é escapado antes da formatação; links só aceitam http(s), âncoras e caminhos relativos.
import { escapeHtml } from './print'

export const slug = texto => String(texto).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// Texto do título sem emoji, números de seção e marcação.
export const textoTitulo = linha => linha.replace(/^#+\s*/, '').replace(/[*`]/g, '')
  .replace(/^[^\p{L}\p{N}]+/u, '').trim()

const inline = (texto) => {
  const codigos = []
  let html = escapeHtml(texto).replace(/`([^`]+)`/g, (_, c) => `\u0000${codigos.push(c) - 1}\u0000`)
  html = html
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, rotulo, url) => {
      const externo = /^https?:\/\//.test(url)
      if (!externo && url.includes(':')) return rotulo
      return `<a href="${url}"${externo ? ' target="_blank" rel="noopener noreferrer"' : ''}>${rotulo}</a>`
    })
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*\s][^*]*)\*(?!\w)/g, '$1<em>$2</em>')
  return html.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codigos[i]}</code>`)
}

// Retorna { html, titulos: [{ id, texto, nivel }] }.
export const renderizarMarkdown = (fonte) => {
  const linhas = String(fonte ?? '').replace(/\r\n?/g, '\n').split('\n')
  const saida = []
  const titulos = []
  const pilhaListas = [] // [{ tipo: 'ul'|'ol', indent }]
  let paragrafo = []

  const fecharParagrafo = () => {
    if (paragrafo.length) saida.push(`<p>${inline(paragrafo.join(' '))}</p>`)
    paragrafo = []
  }
  const fecharListas = (ate = -1) => {
    while (pilhaListas.length && pilhaListas.at(-1).indent > ate) saida.push(`</li></${pilhaListas.pop().tipo}>`)
  }

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i]
    if (/^```/.test(linha)) {
      fecharParagrafo(); fecharListas()
      const codigo = []
      while (++i < linhas.length && !/^```/.test(linhas[i])) codigo.push(linhas[i])
      saida.push(`<pre><code>${escapeHtml(codigo.join('\n'))}</code></pre>`)
      continue
    }
    const titulo = linha.match(/^(#{1,4})\s+(.+)$/)
    if (titulo) {
      fecharParagrafo(); fecharListas()
      const nivel = titulo[1].length
      const texto = textoTitulo(titulo[2])
      let id = slug(texto) || `secao-${titulos.length + 1}`
      if (titulos.some(t => t.id === id)) id = `${id}-${titulos.length + 1}`
      titulos.push({ id, texto, nivel })
      saida.push(`<h${nivel} id="${id}">${inline(titulo[2].replace(/^[^\p{L}\p{N}`*]+/u, ''))}</h${nivel}>`)
      continue
    }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(linha)) {
      fecharParagrafo(); fecharListas()
      saida.push('<hr>')
      continue
    }
    const item = linha.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/)
    if (item) {
      fecharParagrafo()
      const indent = item[1].length
      const tipo = /\d/.test(item[2]) ? 'ol' : 'ul'
      fecharListas(indent)
      const topo = pilhaListas.at(-1)
      if (topo && topo.indent === indent && topo.tipo === tipo) saida.push('</li><li>')
      else {
        if (topo && topo.indent === indent) saida.push(`</li></${pilhaListas.pop().tipo}>`)
        pilhaListas.push({ tipo, indent })
        saida.push(`<${tipo}><li>`)
      }
      saida.push(inline(item[3]))
      continue
    }
    if (!linha.trim()) {
      fecharParagrafo()
      continue
    }
    if (pilhaListas.length && /^\s+/.test(linha)) {
      saida.push(` ${inline(linha.trim())}`)
      continue
    }
    fecharListas()
    paragrafo.push(linha.trim())
  }
  fecharParagrafo(); fecharListas()
  return { html: saida.join('\n'), titulos }
}
