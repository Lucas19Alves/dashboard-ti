import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

const VENDOR_CHUNKS = {
  'vendor-vue': ['vue', '@vue', 'vue-router', 'pinia'],
  'vendor-db': ['dexie']
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    vue(),
    tailwindcss()],
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
