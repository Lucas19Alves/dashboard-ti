import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

const VENDOR_CHUNKS = {
  'vendor-vue': ['vue', '@vue', 'vue-router', 'pinia'],
  'vendor-db': ['dexie']
}

// Lista dos arquivos gerados no build: o service worker baixa todos na instalação,
// então o app abre e navega por todas as páginas mesmo sem internet.
const VERSAO_BUILD = Date.now()

const listaOffline = () => ({
  name: 'lista-offline',
  apply: 'build',
  generateBundle(_, bundle) {
    const arquivos = Object.keys(bundle).filter(nome => nome.startsWith('assets/')).map(nome => `/${nome}`)
    this.emitFile({ type: 'asset', fileName: 'precache.json', source: JSON.stringify({ versao: VERSAO_BUILD, arquivos }) })
  }
})

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    vue(),
    tailwindcss(),
    listaOffline()],
  // Versão do build: muda o endereço do service worker a cada deploy, forçando a atualização do pacote offline.
  define: { __VERSAO_BUILD__: JSON.stringify(String(VERSAO_BUILD)) },
  // Logs de diagnóstico ficam apenas em desenvolvimento.
  esbuild: mode === 'production' ? { pure: ['console.log', 'console.debug'] } : {},
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        // Bibliotecas mudam menos que o app: chunks separados aproveitam melhor o cache.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          for (const [chunk, pacotes] of Object.entries(VENDOR_CHUNKS)) {
            if (pacotes.some(pacote => id.includes(`/node_modules/${pacote}/`))) return chunk
          }
        }
      }
    }
  }
}))
