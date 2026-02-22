<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const isOpen = ref(false)
const router = useRouter()
const route = useRoute()

const toggleMenu = () => {
  isOpen.value = !isOpen.value
}

const isActive = (path) => {
  return route.path === path
}
</script>

<template>
  <nav class="bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg">
    <div class="max-w-7xl mx-auto px-4">
      <div class="flex justify-between items-center h-16">
        <!-- Logo -->
        <div class="flex-shrink-0 font-bold text-2xl flex items-center gap-2">
          <i class="fas fa-tachometer-alt"></i>
          Dashboard TI
        </div>

        <!-- Desktop Menu -->
        <div class="hidden md:flex space-x-2">
          <router-link 
            to="/" 
            :class="['flex items-center gap-2 px-4 py-2 rounded-md font-medium transition', isActive('/') ? 'bg-blue-700' : 'hover:bg-blue-700']"
          >
            <i class="fas fa-home"></i>
            Início
          </router-link>
          <router-link 
            to="/auditorias" 
            :class="['flex items-center gap-2 px-4 py-2 rounded-md font-medium transition', isActive('/auditorias') ? 'bg-blue-700' : 'hover:bg-blue-700']"
          >
            <i class="fas fa-search"></i>
            Auditorias
          </router-link>
          <router-link 
            to="/auditorias/analise" 
            :class="['flex items-center gap-2 px-4 py-2 rounded-md font-medium transition', isActive('/auditorias/analise') ? 'bg-blue-700' : 'hover:bg-blue-700']"
          >
            <i class="fas fa-chart-line"></i>
            Análise
          </router-link>
          <router-link 
            to="/vencimentos" 
            :class="['flex items-center gap-2 px-4 py-2 rounded-md font-medium transition', isActive('/vencimentos') ? 'bg-blue-700' : 'hover:bg-blue-700']"
          >
            <i class="fas fa-calendar-alt"></i>
            Vencimentos
          </router-link>
        </div>

        <!-- Mobile Menu Button -->
        <button
          @click="toggleMenu"
          class="md:hidden inline-flex items-center justify-center p-2 rounded-md hover:bg-blue-700 transition"
        >
          <i class="fas fa-bars text-2xl"></i>
        </button>
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
      </div>
    </div>
  </nav>
</template>
