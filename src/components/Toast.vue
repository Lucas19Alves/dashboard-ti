<template>
  <div class="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-4 sm:top-20 sm:bottom-auto sm:w-[24rem]" aria-live="polite" aria-atomic="true">
    <transition-group name="toast">
      <div
        v-for="toast in store.toasts"
        :key="toast.id"
        role="status"
        class="pointer-events-auto relative w-full overflow-hidden rounded-xl border bg-white/95 shadow-xl shadow-slate-900/10 backdrop-blur"
        :class="estilos[toast.tipo]?.borda || estilos.info.borda"
      >
        <div class="flex items-start gap-3 p-3.5">
          <span class="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg" :class="estilos[toast.tipo]?.icone || estilos.info.icone">
            <i :class="[estilos[toast.tipo]?.simbolo || estilos.info.simbolo, 'text-xs']"></i>
          </span>
          <p class="min-w-0 flex-1 text-sm font-medium leading-snug text-slate-800">{{ toast.mensagem }}</p>
          <button
            type="button"
            @click="store.removeToast(toast.id)"
            class="-m-1 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Fechar notificação"
          >
            <i class="fas fa-times text-xs"></i>
          </button>
        </div>
        <span class="toast-progresso absolute bottom-0 left-0 h-0.5" :class="estilos[toast.tipo]?.barra || estilos.info.barra"></span>
      </div>
    </transition-group>
  </div>
</template>

<script setup>
import { useAuditoriasStore } from '../stores/auditoriasStore'

const store = useAuditoriasStore()

const estilos = {
  success: { borda: 'border-emerald-200', icone: 'bg-emerald-100 text-emerald-700', simbolo: 'fas fa-check', barra: 'bg-emerald-500' },
  error: { borda: 'border-red-200', icone: 'bg-red-100 text-red-700', simbolo: 'fas fa-exclamation', barra: 'bg-red-500' },
  warning: { borda: 'border-amber-200', icone: 'bg-amber-100 text-amber-700', simbolo: 'fas fa-triangle-exclamation', barra: 'bg-amber-500' },
  info: { borda: 'border-blue-200', icone: 'bg-blue-100 text-blue-700', simbolo: 'fas fa-info', barra: 'bg-blue-500' }
}
</script>

<style scoped>
.toast-progresso {
  width: 100%;
  transform-origin: left;
  animation: toast-tempo 5s linear forwards;
}

@keyframes toast-tempo {
  from { transform: scaleX(1); }
  to { transform: scaleX(0); }
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}
</style>
