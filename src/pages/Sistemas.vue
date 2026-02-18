<script setup>
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { useSistemasStore } from '../stores/sistemasStore'

const store = useSistemasStore()

const statusSistema = (key) => store.status[key] || { estado: 'desconhecido', latencyMs: null, lastChecked: null }
const classeIcone = (estado) => {
  if (estado === 'online') return 'fas fa-check-circle text-green-500 text-2xl'
  if (estado === 'offline') return 'fas fa-times-circle text-red-500 text-2xl'
  if (estado === 'verificando') return 'fas fa-spinner fa-spin text-blue-500 text-2xl'
  return 'fas fa-question-circle text-gray-400 text-2xl'
}
const classeChip = (estado) => {
  if (estado === 'online') return 'text-green-700 bg-green-50 border border-green-200'
  if (estado === 'offline') return 'text-red-700 bg-red-50 border border-red-200'
  if (estado === 'verificando') return 'text-blue-700 bg-blue-50 border border-blue-200'
  return 'text-gray-700 bg-gray-50 border border-gray-200'
}
const textoEstado = (estado) => {
  if (estado === 'online') return 'Online'
  if (estado === 'offline') return 'Offline'
  if (estado === 'verificando') return 'Verificando...'
  return 'Desconhecido'
}
const podeAcessar = (url) => Boolean(url && url.trim() && url.trim() !== '#')
const abrir = (url) => { if (podeAcessar(url)) window.open(url, '_blank') }
const ultimoHorario = (iso) => iso ? new Date(iso).toLocaleTimeString() : '—'

let intervalId = null
onMounted(async () => {
  await store.checkAll()
  intervalId = setInterval(() => store.checkAll(), 60000)
})
onBeforeUnmount(() => {
  if (intervalId) clearInterval(intervalId)
})
</script>

<template>
  <div class="p-8">
    <div class="flex items-center gap-3 mb-6">
      <i class="fas fa-server text-3xl text-green-600"></i>
      <h1 class="text-4xl font-bold text-gray-800">Sistemas</h1>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div
        v-for="s in store.sistemas"
        :key="s.key"
        class="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition border"
      >
        <div class="flex items-start justify-between mb-4">
          <div>
            <h3 class="text-xl font-bold text-gray-800">{{ s.nome }}</h3>
            <p class="text-gray-600 text-sm">Monitoramento</p>
          </div>
          <i :class="classeIcone(statusSistema(s.key).estado)"></i>
        </div>
        <div class="space-y-3">
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-600 font-semibold">Status:</span>
            <span class="px-2 py-0.5 text-xs rounded-full" :class="classeChip(statusSistema(s.key).estado)">
              {{ textoEstado(statusSistema(s.key).estado) }}
            </span>
          </div>
          <div class="flex items-center justify-between text-sm text-gray-600">
            <span>Latência</span>
            <span class="font-medium">{{ statusSistema(s.key).latencyMs != null ? statusSistema(s.key).latencyMs + ' ms' : '—' }}</span>
          </div>
          <div class="flex items-center justify-between text-sm text-gray-600">
            <span>Última verificação</span>
            <span class="font-medium">{{ ultimoHorario(statusSistema(s.key).lastChecked) }}</span>
          </div>
          <div class="flex items-center gap-2 pt-2">
            <button
              @click.stop="abrir(s.url)"
              :disabled="!podeAcessar(s.url)"
              class="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition disabled:bg-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed"
            >
              <i class="fas fa-external-link-alt mr-2"></i>Acessar
            </button>
            <button
              @click.stop="store.checkSystem(s.key)"
              class="px-3 py-2 rounded-lg bg-gray-100 text-gray-800 font-medium hover:bg-gray-200 transition"
              :title="'Verificar ' + s.nome"
            >
              <i class="fas fa-sync-alt"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
