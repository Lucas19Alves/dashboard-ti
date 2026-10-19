// Gera src/styles/temaEscuro.css a partir da paleta do Tailwind instalada.
// Uso: node scripts/gerar-tema-escuro.mjs
//
// Como funciona: o Tailwind v4 pinta tudo com variáveis (--color-blue-600...). No modo escuro
// as escalas são invertidas (50↔950, 100↔900...), então fundos claros viram escuros e textos
// escuros viram claros sem mexer nos componentes. Elementos com texto branco (botões, faixas,
// dicas) recebem de volta a paleta original e continuam com o mesmo contraste.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const tema = readFileSync(new URL('../node_modules/tailwindcss/theme.css', import.meta.url), 'utf8')
const cores = {}
for (const [, cor, tom, valor] of tema.matchAll(/--color-([a-z]+)-(\d+):\s*([^;]+);/g)) {
  (cores[cor] ??= {})[tom] = valor.trim()
}
const TONS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']
const INVERSO = { 50: '950', 100: '900', 200: '800', 300: '700', 400: '600', 500: '500', 600: '400', 700: '300', 800: '200', 900: '100', 950: '50' }
// Neutros: rampa própria, com superfícies azuladas e textos legíveis.
const NEUTRO = { 50: '#1a2436', 100: '#1f2a3d', 200: '#2b384e', 300: '#3d4b63', 400: '#7c8aa0', 500: '#97a3b6', 600: '#b3bdcb', 700: '#cbd3de', 800: '#dfe5ec', 900: '#eef2f6', 950: '#f6f8fb' }
const NEUTRAS = ['slate', 'gray', 'zinc', 'neutral', 'stone']
// Alto contraste: textos "apagados" ficam mais fortes e bordas mais visíveis.
const CONTRASTE_CLARO = { 300: '500', 400: '600', 500: '700', 200: '300', 100: '200' }
const CONTRASTE_ESCURO = { 400: '#b3bdcb', 500: '#cbd3de', 600: '#dfe5ec', 200: '#4a5a75', 300: '#5b6b86' }

const escuro = []
const original = []
for (const [cor, tons] of Object.entries(cores)) {
  for (const tom of TONS) {
    if (!tons[tom]) continue
    escuro.push(`  --color-${cor}-${tom}: ${NEUTRAS.includes(cor) ? NEUTRO[tom] : tons[INVERSO[tom]]};`)
    original.push(`  --color-${cor}-${tom}: ${tons[tom]};`)
  }
}
const contrasteClaro = NEUTRAS.flatMap(cor => Object.entries(CONTRASTE_CLARO).map(([tom, novo]) => `  --color-${cor}-${tom}: ${cores[cor][novo]};`))
const contrasteEscuro = NEUTRAS.flatMap(cor => Object.entries(CONTRASTE_ESCURO).map(([tom, novo]) => `  --color-${cor}-${tom}: ${novo};`))

const css = `/* Gerado por scripts/gerar-tema-escuro.mjs — não editar à mão. */

html.dark {
  color-scheme: dark;
  --color-white: #121b2d;
${escuro.join('\n')}
}

/* Texto branco = fundo forte (botão, faixa, dica): mantém as cores originais. */
html.dark .text-white,
html.dark .ui-btn-primary,
html.dark .ui-btn-danger {
  --color-white: #fff;
${original.join('\n')}
}

html.alto-contraste:not(.dark) {
${contrasteClaro.join('\n')}
}

html.alto-contraste.dark {
${contrasteEscuro.join('\n')}
}
`
mkdirSync(new URL('../src/styles/', import.meta.url), { recursive: true })
writeFileSync(new URL('../src/styles/temaEscuro.css', import.meta.url), css)
console.log(`temaEscuro.css: ${escuro.length} cores`)
