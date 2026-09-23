import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import router from './router/index.js'
import '@fortawesome/fontawesome-free/css/all.css'
import { useAuditoriasStore } from './stores/auditoriasStore'
import { useVencimentosStore } from './stores/vencimentosStore'

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
})

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(error => {
      console.warn('Não foi possível ativar o modo offline.', error)
    })
  })
}
