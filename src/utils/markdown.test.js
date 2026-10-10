import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { renderizarMarkdown } from './markdown'

describe('renderizarMarkdown', () => {
  it('gera títulos com âncora e sumário sem emoji', () => {
    const { html, titulos } = renderizarMarkdown('## 🚀 1. Visão Geral\n### 4.1 Sistema (`store.js`)')
    expect(titulos[0]).toEqual({ id: '1-visao-geral', texto: '1. Visão Geral', nivel: 2 })
    expect(html).toContain('<h2 id="1-visao-geral">1. Visão Geral</h2>')
    expect(html).toContain('<code>store.js</code>')
  })

  it('renderiza listas aninhadas, ênfase, código e links', () => {
    const html = renderizarMarkdown('- **A**: x\n  - `b` *c*\n- [Site](https://x.dev)\n\n1. um\n2. dois\n\n```text\n<pre>\n```').html.replace(/\n/g, '')
    expect(html).toContain('<ul><li><strong>A</strong>: x<ul><li><code>b</code> <em>c</em></li></ul></li><li>')
    expect(html).toContain('<a href="https://x.dev" target="_blank" rel="noopener noreferrer">Site</a>')
    expect(html).toContain('<ol><li>um</li><li>dois</li></ol>')
    expect(html).toContain('<pre><code>&lt;pre&gt;</code></pre>')
  })

  it('escapa HTML e bloqueia links perigosos', () => {
    const { html } = renderizarMarkdown('<img src=x onerror=alert(1)> [x](javascript:alert(1))')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('href="javascript')
  })

  it('renderiza a documentação do projeto', () => {
    const { titulos } = renderizarMarkdown(fs.readFileSync('DOCUMENTATION.md', 'utf8'))
    expect(titulos.filter(t => t.nivel === 2).length).toBeGreaterThanOrEqual(7)
  })
})
