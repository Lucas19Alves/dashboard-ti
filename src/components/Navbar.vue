<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import UiButton from './ui/UiButton.vue'
import UiModal from './ui/UiModal.vue'

const isOpen = ref(false)
const mostrarSobre = ref(false)
const route = useRoute()

const toggleMenu = () => {
  isOpen.value = !isOpen.value
}

const isActive = (path) => {
  if (path === '/') return route.path === '/'
  return route.path === path || route.path.startsWith(`${path}/`)
}

const abrirSobre = () => {
  isOpen.value = false
  mostrarSobre.value = true
}

const fecharSobre = () => {
  mostrarSobre.value = false
}

</script>

<template>
  <nav class="sticky top-0 z-40 border-b border-blue-800 bg-blue-700/95 text-white shadow-lg shadow-blue-950/10 backdrop-blur-xl">
    <div class="max-w-7xl mx-auto px-4">
      <div class="flex justify-between items-center h-16">
        <div class="flex items-center gap-4">
          <div class="flex-shrink-0 font-bold text-xl flex items-center gap-2.5 tracking-tight">
            <span class="inline-flex size-9 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
              <i class="fas fa-chart-pie text-sm"></i>
            </span>
            <span>Dashboard <span class="text-blue-200">TI</span></span>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <div class="hidden md:flex space-x-2">
            <router-link 
              to="/" 
              :class="['flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition', isActive('/') ? 'bg-white text-blue-700 shadow-sm' : 'text-blue-50 hover:bg-white/10']"
            >
              <i class="fas fa-home"></i>
              Início
            </router-link>
            <router-link 
              to="/auditorias" 
              :class="['flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition', route.path === '/auditorias' || route.path.startsWith('/auditoria/') ? 'bg-white text-blue-700 shadow-sm' : 'text-blue-50 hover:bg-white/10']"
            >
              <i class="fas fa-search"></i>
              Auditorias
            </router-link>
            <router-link 
              to="/auditorias/analise" 
              :class="['flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition', isActive('/auditorias/analise') ? 'bg-white text-blue-700 shadow-sm' : 'text-blue-50 hover:bg-white/10']"
            >
              <i class="fas fa-chart-line"></i>
              Análise
            </router-link>
            <router-link 
              to="/vencimentos" 
              :class="['flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition', isActive('/vencimentos') ? 'bg-white text-blue-700 shadow-sm' : 'text-blue-50 hover:bg-white/10']"
            >
              <i class="fas fa-calendar-alt"></i>
              Vencimentos
            </router-link>
          </div>

          <button
            type="button"
            @click="abrirSobre"
            class="inline-flex items-center justify-center w-9 h-9 rounded-full bg-blue-500/80 hover:bg-blue-400 transition shadow-sm"
            title="Sobre o projeto"
            aria-label="Sobre o projeto"
          >
            <i class="fas fa-info-circle text-lg"></i>
          </button>

          <button
            @click="toggleMenu"
            class="md:hidden inline-flex items-center justify-center p-2 rounded-md hover:bg-blue-700 transition"
            :aria-expanded="isOpen"
            aria-label="Abrir menu de navegação"
          >
            <i class="fas fa-bars text-2xl"></i>
          </button>
        </div>
      </div>

      <!-- Mobile Menu -->
      <div v-if="isOpen" class="md:hidden pb-4 space-y-2">
        <router-link 
          to="/" 
          :class="['flex items-center gap-2 px-4 py-2 rounded-md font-medium transition block', isActive('/') ? 'bg-blue-700' : 'hover:bg-blue-700']"
        >
          <i class="fas fa-home"></i>
          Início
        </router-link>
        <router-link
          to="/auditorias/analise"
          class="flex items-center gap-2 px-4 py-2 rounded-md font-medium transition hover:bg-blue-700"
        >
          <i class="fas fa-chart-line"></i>
          Análise
        </router-link>
        <router-link 
          to="/auditorias" 
          :class="['flex items-center gap-2 px-4 py-2 rounded-md font-medium transition block', isActive('/auditorias') ? 'bg-blue-700' : 'hover:bg-blue-700']"
        >
          <i class="fas fa-search"></i>
          Auditorias
        </router-link>
        <router-link 
          to="/vencimentos" 
          :class="['flex items-center gap-2 px-4 py-2 rounded-md font-medium transition block', isActive('/vencimentos') ? 'bg-blue-700' : 'hover:bg-blue-700']"
        >
          <i class="fas fa-calendar-alt"></i>
          Vencimentos
        </router-link>
        <button
          type="button"
          @click="abrirSobre"
          class="flex items-center gap-2 px-4 py-2 rounded-md font-medium transition text-sm text-blue-50 hover:bg-blue-700"
        >
          <i class="fas fa-info-circle"></i>
          Sobre
        </button>
      </div>
    </div>

    <UiModal
      v-if="mostrarSobre"
      title="Sobre o projeto"
      subtitle="Informações sobre o desenvolvedor"
      @close="fecharSobre"
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
          <a href="https://github.com/Lucas19Alves/dashboard-ti/blob/main/DOCUMENTATION.md" target="_blank" rel="noopener noreferrer" class="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100">
            <i class="fas fa-book"></i>Documentação
          </a>
        </div>
      </div>

      <template #footer>
        <UiButton variant="secondary" size="sm" @click="fecharSobre">Fechar</UiButton>
      </template>
    </UiModal>
  </nav>
</template>
