<script setup>
import Navbar from './components/Navbar.vue'
import Toast from './components/Toast.vue'
import CommandPalette from './components/CommandPalette.vue'
import AvisoBackup from './components/AvisoBackup.vue'
import AvisoSemDados from './components/AvisoSemDados.vue'
import ModalConferenciaPlanilha from './components/ModalConferenciaPlanilha.vue'
import ModalRelatorio from './components/ModalRelatorio.vue'
import ModalTutorial from './components/ModalTutorial.vue'
import { useAuditoriasStore } from './stores/auditoriasStore'

// A tela abre com o resumo das auditorias; os itens chegam logo depois, em segundo plano.
const auditorias = useAuditoriasStore()
</script>

<template>
  <div class="min-h-screen text-slate-800">
    <a href="#conteudo" class="sr-only z-[80] rounded-lg bg-white px-4 py-2 font-semibold text-blue-700 shadow focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
      Pular para o conteúdo
    </a>
    <Navbar />
    <Toast />
    <CommandPalette />
    <AvisoBackup />
    <AvisoSemDados />
    <ModalConferenciaPlanilha />
    <ModalRelatorio />
    <ModalTutorial />
    <p v-if="!auditorias.itensCarregados" class="fixed bottom-4 left-4 z-30 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm print:hidden" role="status">
      <i class="fas fa-spinner fa-spin text-blue-600"></i>Carregando os itens das auditorias...
    </p>
    <main id="conteudo">
      <router-view v-slot="{ Component, route }">
        <transition name="pagina" mode="out-in">
          <component :is="Component" :key="route.path" />
        </transition>
      </router-view>
    </main>
  </div>
</template>
