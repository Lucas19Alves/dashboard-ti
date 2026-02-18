import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSistemasStore = defineStore('sistemas', () => {
  const sistemas = ref([
    { key: 'rub', nome: 'RUB', url: '' },
    { key: 'getis', nome: 'GETIS', url: '' },
    { key: 'adp', nome: 'ADP', url: '' },
    { key: 'csa', nome: 'CSA', url: '' },
    { key: 'conecta', nome: 'Conecta', url: '' }
  ])

  const status = ref({})

  const normalizarUrl = (u) => {
    if (!u || typeof u !== 'string') return ''
    const trimmed = u.trim()
    if (!trimmed) return ''
    if (/^https?:\/\//i.test(trimmed)) return trimmed
    return 'https://' + trimmed
  }

  const marcarVerificando = (key) => {
    status.value[key] = {
      estado: 'verificando',
      latencyMs: null,
      lastChecked: null,
      erro: null
    }
  }

  const checkSystem = async (key, timeoutMs = 4000) => {
    const sys = sistemas.value.find(s => s.key === key)
    if (!sys) return
    const url = normalizarUrl(sys.url)
    if (!url) {
      status.value[key] = { estado: 'desconhecido', latencyMs: null, lastChecked: new Date().toISOString(), erro: 'sem_url' }
      return
    }
    marcarVerificando(key)
    const controller = new AbortController()
    const start = performance.now()
    let online = false
    let erro = null
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      await fetch(url, { method: 'GET', mode: 'no-cors', cache: 'no-store', signal: controller.signal })
      online = true
    } catch (e) {
      online = false
      erro = e && e.message ? e.message : 'erro'
    } finally {
      clearTimeout(timer)
    }
    const latency = online ? Math.round(performance.now() - start) : null
    status.value[key] = {
      estado: online ? 'online' : 'offline',
      latencyMs: latency,
      lastChecked: new Date().toISOString(),
      erro
    }
  }

  const checkAll = async () => {
    for (const s of sistemas.value) {
      await checkSystem(s.key)
    }
  }

  const setUrl = (key, url) => {
    const idx = sistemas.value.findIndex(s => s.key === key)
    if (idx !== -1) {
      sistemas.value[idx] = { ...sistemas.value[idx], url }
    }
  }

  return {
    sistemas,
    status,
    checkSystem,
    checkAll,
    setUrl
  }
})

