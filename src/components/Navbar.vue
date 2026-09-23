<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const isOpen = ref(false)
const mostrarSobre = ref(false)
const router = useRouter()
const route = useRoute()

const toggleMenu = () => {
  isOpen.value = !isOpen.value
}

const isActive = (path) => {
  if (path === '/') return route.path === '/'
  return route.path === path || route.path.startsWith(`${path}/`)
}

const abrirSobre = () => {
  mostrarSobre.value = true
}

const fecharSobre = () => {
  mostrarSobre.value = false
}

const abrirDocumentacao = () => {
  // Abre o arquivo de documentação diretamente no navegador (se disponível no servidor)
  // ou aponta para o link do repositório/arquivo markdown
  window.open('https://github.com/Lucas19Alves/dashboard-ti/blob/main/DOCUMENTATION.md', '_blank', 'noopener,noreferrer')
}

const irPara = (url) => {
  window.open(url, '_blank', 'noopener,noreferrer')
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

    <div
      v-if="mostrarSobre"
      class="ui-modal-backdrop"
    >
      <div class="ui-modal">
        <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="h-9 w-9 rounded-full bg-blue-600/10 flex items-center justify-center">
              <i class="fas fa-circle-info text-blue-600"></i>
            </div>
            <div>
              <h2 class="text-sm font-semibold text-gray-900">Sobre o projeto</h2>
              <p class="text-xs text-gray-500">Informações sobre o desenvolvedor</p>
            </div>
          </div>
          <button
            type="button"
            @click="fecharSobre"
            class="text-gray-400 hover:text-gray-600"
          >
            <i class="fas fa-times text-sm"></i>
          </button>
        </div>

        <div class="px-5 py-4 space-y-3 text-sm text-gray-700">
          <p>
            Este painel foi desenvolvido para apoiar a operação de loja,
            com foco em auditorias e acompanhamento de validades.
          </p>
          <div class="rounded-xl bg-gray-50 border border-gray-100 p-3 space-y-1">
            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Criado por
            </p>
            <p class="font-semibold text-gray-900">
              Lucas Alves
            </p>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              @click="irPara('https://github.com/Lucas19Alves')"
              class="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-800 hover:bg-gray-100 transition"
            >
              <i class="fab fa-github"></i>
              GitHub
            </button>
            <button
              type="button"
              @click="irPara('https://www.linkedin.com/in/lucaas19alves/')"
              class="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-800 hover:bg-gray-100 transition"
            >
              <i class="fab fa-linkedin-in"></i>
              LinkedIn
            </button>
            <button
              type="button"
              @click="irPara('https://portfolio-lucasalves.vercel.app/')"
              class="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-800 hover:bg-gray-100 transition"
            >
              <i class="fas fa-globe"></i>
              Portfólio
            </button>
            <button
              type="button"
              @click="abrirDocumentacao"
              class="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-100 text-xs font-bold text-blue-700 hover:bg-blue-100 transition shadow-sm"
            >
              <i class="fas fa-book"></i>
              Documentação
            </button>
          </div>
        </div>

        <div class="px-5 py-3 border-t border-gray-100 flex justify-end">
          <button
            type="button"
            @click="fecharSobre"
            class="px-4 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  </nav>
</template>
