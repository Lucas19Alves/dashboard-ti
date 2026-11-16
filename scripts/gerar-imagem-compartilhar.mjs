// Gera public/og-image.png (1200x630) e public/apple-touch-icon.png (180x180) com o Chrome ou o Edge
// instalados, sem dependências novas. Uso: node scripts/gerar-imagem-compartilhar.mjs
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const raiz = resolve(import.meta.dirname, '..')
const navegadores = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].filter(Boolean)
const navegador = navegadores.find(existsSync)
if (!navegador) throw new Error('Chrome/Edge não encontrado; informe o caminho em CHROME_PATH.')

const capturar = (url, saida, largura, altura) => {
  const perfil = mkdtempSync(join(tmpdir(), 'og-'))
  execFileSync(navegador, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    `--user-data-dir=${perfil}`, '--allow-file-access-from-files', '--virtual-time-budget=3000',
    `--window-size=${largura},${altura}`, `--screenshot=${saida}`, url
  ], { stdio: 'ignore' })
  console.log('gerado', saida)
}

capturar(pathToFileURL(join(raiz, 'scripts/imagem-compartilhar.html')).href, join(raiz, 'public/og-image.png'), 1200, 630)

// Ícone da tela inicial do iPhone: fundo opaco (o iOS pinta de preto o que for transparente).
const icone = join(tmpdir(), 'apple-touch-icon.html')
writeFileSync(icone, `<!doctype html><style>*{margin:0}html,body{width:180px;height:180px;background:#fff;overflow:hidden}img{display:block;width:180px;height:180px}</style><img src="${pathToFileURL(join(raiz, 'public/favicon.png')).href}">`)
capturar(pathToFileURL(icone).href, join(raiz, 'public/apple-touch-icon.png'), 180, 180)
