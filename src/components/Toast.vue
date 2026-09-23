<template>
  <div class="fixed right-4 top-20 z-50 w-[min(24rem,calc(100vw-2rem))] space-y-2" aria-live="polite" aria-atomic="true">
    <transition-group name="toast" tag="div">
      <div
        v-for="toast in store.toasts"
        :key="toast.id"
        :class="[
          'rounded-xl border p-4 font-medium shadow-xl backdrop-blur animate-slideIn',
          {
            'border-emerald-200 bg-emerald-50/95 text-emerald-900': toast.tipo === 'success',
            'border-red-200 bg-red-50/95 text-red-900': toast.tipo === 'error',
            'border-amber-200 bg-amber-50/95 text-amber-900': toast.tipo === 'warning',
            'border-blue-200 bg-blue-50/95 text-blue-900': toast.tipo === 'info'
          }
        ]"
      >
        <div class="flex items-center justify-between">
          <span>{{ toast.mensagem }}</span>
          <button 
            @click="store.removeToast(toast.id)"
            class="ml-4 opacity-60 hover:opacity-100"
            aria-label="Fechar notificação"
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
