<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  width: { type: String, default: 'max-w-lg' }
})
const emit = defineEmits(['close'])
const painel = ref(null)
let focoAnterior = null
let overflowAnterior = ''

const aoTeclar = (evento) => {
  if (evento.key === 'Escape') {
    evento.stopPropagation()
    emit('close')
  }
}

onMounted(() => {
  focoAnterior = document.activeElement
  overflowAnterior = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  painel.value?.focus({ preventScroll: true })
})

onBeforeUnmount(() => {
  document.body.style.overflow = overflowAnterior
  if (focoAnterior instanceof HTMLElement) focoAnterior.focus({ preventScroll: true })
})
</script>

<template>
  <Teleport to="body">
    <div class="ui-fade-in fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4" @click.self="emit('close')" @keydown="aoTeclar">
      <section
        ref="painel"
        tabindex="-1"
        class="ui-pop-in flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl outline-none sm:rounded-2xl"
        :class="width"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
      >
        <header class="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 class="font-bold text-slate-900">{{ title }}</h2>
            <p v-if="subtitle" class="mt-0.5 text-sm text-slate-500">{{ subtitle }}</p>
          </div>
          <button type="button" class="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Fechar" title="Fechar (Esc)" @click="emit('close')">
            <i class="fas fa-times"></i>
          </button>
        </header>
        <div class="min-h-0 flex-1 overflow-y-auto p-5"><slot /></div>
        <footer v-if="$slots.footer" class="flex shrink-0 justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3"><slot name="footer" /></footer>
      </section>
    </div>
  </Teleport>
</template>
