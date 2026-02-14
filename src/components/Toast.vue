<template>
  <div class="fixed top-4 right-4 z-50 space-y-2 max-w-md">
    <transition-group name="toast" tag="div">
      <div
        v-for="toast in store.toasts"
        :key="toast.id"
        :class="[
          'rounded-lg shadow-lg p-4 text-white font-medium animate-slideIn',
          {
            'bg-green-500': toast.tipo === 'success',
            'bg-red-500': toast.tipo === 'error',
            'bg-yellow-500': toast.tipo === 'warning',
            'bg-blue-500': toast.tipo === 'info'
          }
        ]"
      >
        <div class="flex items-center justify-between">
          <span>{{ toast.mensagem }}</span>
          <button 
            @click="store.removeToast(toast.id)"
            class="ml-4 text-white hover:opacity-75"
          >
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    </transition-group>
  </div>
</template>

<script setup>
import { useAuditoriasStore } from '../stores/auditoriasStore'

const store = useAuditoriasStore()
</script>

<style scoped>
.animate-slideIn {
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    transform: translateX(400px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  transform: translateX(400px);
  opacity: 0;
}
</style>
