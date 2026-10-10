<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import UiButton from './ui/UiButton.vue'
import UiModal from './ui/UiModal.vue'
import { usePaleta } from '../composables/usePaleta'

const isOpen = ref(false)
const mostrarSobre = ref(false)
const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine)
const route = useRoute()
const { abrir: abrirBusca } = usePaleta()
const ehMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '')

const links = [
  { to: '/', label: 'Início', icon: 'fas fa-home' },
  { to: '/auditorias', label: 'Auditorias', icon: 'fas fa-clipboard-check' },
  { to: '/auditorias/analise', label: 'Análise', icon: 'fas fa-chart-line' },
  { to: '/vencimentos', label: 'Vencimentos', icon: 'fas fa-calendar-alt' }
]

const isActive = (path) => {
  if (path === '/') return route.path === '/'
  if (path === '/auditorias') return route.path === '/auditorias' || route.path.startsWith('/auditoria/')
  return route.path === path || route.path.startsWith(`${path}/`)
}

watch(() => route.fullPath, () => { isOpen.value = false })

const abrirSobre = () => {
  isOpen.value = false
  mostrarSobre.value = true
}

const abrirBuscaMobile = () => {
  isOpen.value = false
  abrirBusca()
}

const atualizarConexao = () => { online.value = navigator.onLine }
onMounted(() => {
  window.addEventListener('online', atualizarConexao)
  window.addEventListener('offline', atualizarConexao)
})
onBeforeUnmount(() => {
  window.removeEventListener('online', atualizarConexao)
  window.removeEventListener('offline', atualizarConexao)
})
</script>

<template>
  <nav class="sticky top-0 z-40 border-b border-white/10 bg-blue-700 text-white shadow-lg shadow-blue-950/10 print:hidden">
    <div class="ui-container">
      <div class="flex h-16 items-center justify-between gap-3">
        <router-link to="/" class="flex shrink-0 items-center gap-2.5 text-lg font-bold tracking-tight">
          <span class="inline-flex size-9 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
            <i class="fas fa-chart-pie text-sm"></i>
          </span>
          <span>Dashboard <span class="text-blue-200">TI</span></span>
        </router-link>

        <div class="hidden items-center gap-1 rounded-2xl bg-white/10 p-1 ring-1 ring-white/10 md:flex">
          <router-link
            v-for="link in links"
            :key="link.to"
            :to="link.to"
            class="flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition"
            :class="isActive(link.to) ? 'bg-white text-blue-700 shadow-sm' : 'text-blue-50 hover:bg-white/10'"
            :aria-current="isActive(link.to) ? 'page' : undefined"
          >
            <i :class="[link.icon, 'text-xs']"></i>
            {{ link.label }}
          </router-link>
        </div>

        <div class="flex items-center gap-2">
          <span
            v-if="!online"
            class="hidden items-center gap-1.5 rounded-full bg-amber-400/20 px-2.5 py-1 text-xs font-semibold text-amber-100 ring-1 ring-amber-300/40 sm:inline-flex"
            title="Sem conexão. Os dados continuam salvos neste navegador."
          >
            <i class="fas fa-wifi text-[10px]"></i>Offline
          </span>

          <button
            type="button"
            class="hidden h-9 items-center gap-2 rounded-xl bg-white/10 pl-3 pr-2 text-sm text-blue-50 ring-1 ring-white/15 transition hover:bg-white/20 lg:inline-flex"
            title="Busca rápida"
            @click="abrirBusca"
          >
            <i class="fas fa-search text-xs"></i>
            <span class="mr-4">Buscar...</span>
            <kbd class="rounded-md bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold">{{ ehMac ? '⌘' : 'Ctrl' }} K</kbd>
          </button>
          <button
            type="button"
            class="inline-flex size-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15 transition hover:bg-white/20 lg:hidden"
            title="Busca rápida"
            aria-label="Busca rápida"
            @click="abrirBusca"
          >
            <i class="fas fa-search text-sm"></i>
          </button>

          <button
            type="button"
            @click="abrirSobre"
            class="hidden size-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15 transition hover:bg-white/20 md:inline-flex"
            title="Sobre o projeto"
            aria-label="Sobre o projeto"
          >
            <i class="fas fa-info-circle"></i>
          </button>

          <button
            type="button"
            @click="isOpen = !isOpen"
            class="inline-flex size-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15 transition hover:bg-white/20 md:hidden"
            :aria-expanded="isOpen"
            aria-label="Abrir menu de navegação"
          >
            <i :class="isOpen ? 'fas fa-times' : 'fas fa-bars'"></i>
          </button>
        </div>
      </div>

      <transition name="menu">
        <div v-if="isOpen" class="space-y-1 pb-4 md:hidden">
          <router-link
            v-for="link in links"
            :key="link.to"
            :to="link.to"
            class="flex items-center gap-3 rounded-xl px-4 py-2.5 font-semibold transition"
            :class="isActive(link.to) ? 'bg-white text-blue-700' : 'text-blue-50 hover:bg-white/10'"
          >
            <i :class="[link.icon, 'w-4 text-center text-sm']"></i>
            {{ link.label }}
          </router-link>
          <div class="grid grid-cols-2 gap-2 pt-2">
            <button type="button" @click="abrirBuscaMobile" class="flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-blue-50 hover:bg-white/20">
              <i class="fas fa-search"></i>Buscar
            </button>
            <button type="button" @click="abrirSobre" class="flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-blue-50 hover:bg-white/20">
              <i class="fas fa-info-circle"></i>Sobre
            </button>
          </div>
        </div>
      </transition>
    </div>

    <UiModal
      v-if="mostrarSobre"
      title="Sobre o projeto"
      subtitle="Informações sobre o desenvolvedor"
      @close="mostrarSobre = false"
    >
      <div class="space-y-5 text-sm text-slate-600">
        <p>
          Este painel foi desenvolvido para apoiar a operação de loja,
          com foco em auditorias e acompanhamento de validades.
        </p>

        <div class="rounded-lg bg-slate-50 px-4 py-3">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Criado por</p>
          <p class="mt-1 font-semibold text-slate-900">Lucas Alves</p>
        </div>

        <div class="rounded-lg border border-slate-100 px-4 py-3">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Atalhos</p>
          <ul class="mt-2 space-y-1.5 text-xs">
            <li class="flex justify-between"><span>Busca rápida</span><kbd class="rounded bg-slate-100 px-1.5 font-semibold">{{ ehMac ? '⌘' : 'Ctrl' }} K</kbd></li>
            <li class="flex justify-between"><span>Busca rápida (fora de campos)</span><kbd class="rounded bg-slate-100 px-1.5 font-semibold">/</kbd></li>
            <li class="flex justify-between"><span>Fechar janelas</span><kbd class="rounded bg-slate-100 px-1.5 font-semibold">Esc</kbd></li>
          </ul>
        </div>

        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <a href="https://github.com/Lucas19Alves" target="_blank" rel="noopener noreferrer" class="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100">
            <i class="fab fa-github"></i>GitHub
          </a>
          <a href="https://www.linkedin.com/in/lucaas19alves/" target="_blank" rel="noopener noreferrer" class="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100">
            <i class="fab fa-linkedin-in"></i>LinkedIn
          </a>
          <a href="https://portfolio-lucasalves.vercel.app/" target="_blank" rel="noopener noreferrer" class="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100">
            <i class="fas fa-globe"></i>Portfólio
          </a>
          <router-link to="/documentacao" @click="mostrarSobre = false" class="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100">
            <i class="fas fa-book"></i>Documentação
          </router-link>
        </div>
      </div>

      <template #footer>
        <UiButton variant="secondary" size="sm" @click="mostrarSobre = false">Fechar</UiButton>
      </template>
    </UiModal>
  </nav>
</template>

<style scoped>
.menu-enter-active,
.menu-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.menu-enter-from,
.menu-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
