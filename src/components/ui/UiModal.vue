<script setup>
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  width: { type: String, default: 'max-w-lg' }
})
const emit = defineEmits(['close'])
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" @click.self="emit('close')">
      <section class="w-full overflow-hidden rounded-xl bg-white shadow-2xl" :class="width" role="dialog" aria-modal="true" :aria-label="title">
        <header class="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 class="font-bold text-slate-900">{{ title }}</h2>
            <p v-if="subtitle" class="mt-0.5 text-sm text-slate-500">{{ subtitle }}</p>
          </div>
          <button type="button" class="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Fechar" @click="emit('close')">
            <i class="fas fa-times"></i>
          </button>
        </header>
        <div class="p-5"><slot /></div>
        <footer v-if="$slots.footer" class="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3"><slot name="footer" /></footer>
      </section>
    </div>
  </Teleport>
</template>
