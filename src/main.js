import { createApp } from 'vue'
import { createPinia } from 'pinia'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-sans/700.css'
import './style.css'
import App from './App.vue'
import { iniciarBackupAutomatico } from './utils/backupPasta'
import router from './router/index.js'
import '@fortawesome/fontawesome-free/css/all.css'
import { useAuditoriasStore } from './stores/auditoriasStore'
import { useVencimentosStore } from './stores/vencimentosStore'

// Uma aba aberta antes do deploy pode pedir um chunk cujo nome ja nao existe.
window.addEventListener('vite:preloadError', event => {
  const chave = 'dashboard-ti-ultima-recarga-chunk'
  const ultimaRecarga = Number(sessionStorage.getItem(chave) || 0)
  if (Date.now() - ultimaRecarga < 30_000) return

  event.preventDefault()
  sessionStorage.setItem(chave, String(Date.now()))
  window.location.reload()
})

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

const auditoriasStore = useAuditoriasStore(pinia)
const vencimentosStore = useVencimentosStore(pinia)

Promise.all([
  auditoriasStore.carregarAuditoriasPersistidas(),
  vencimentosStore.carregarVencimentosPersistidos()
]).finally(() => {
  app.mount('#app')
  iniciarBackupAutomatico()
})

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`/sw.js?v=${__VERSAO_BUILD__}`).catch(error => {
      console.warn('Não foi possível ativar o modo offline.', error)
    })
  })
}
