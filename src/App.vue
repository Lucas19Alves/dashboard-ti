<script setup>
import Navbar from './components/Navbar.vue'
import Toast from './components/Toast.vue'
import CommandPalette from './components/CommandPalette.vue'
import AvisoBackup from './components/AvisoBackup.vue'
import AvisoSemDados from './components/AvisoSemDados.vue'
import ModalConferenciaPlanilha from './components/ModalConferenciaPlanilha.vue'
import ModalRelatorio from './components/ModalRelatorio.vue'
import ModalTutorial from './components/ModalTutorial.vue'
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
    <main id="conteudo">
      <router-view v-slot="{ Component, route }">
        <transition name="pagina" mode="out-in">
          <component :is="Component" :key="route.path" />
        </transition>
      </router-view>
    </main>
  </div>
</template>
