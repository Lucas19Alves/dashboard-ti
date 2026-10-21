<script setup>
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  icon: { type: String, default: 'fas fa-chart-simple' },
  tone: { type: String, default: 'blue' }
})

// Título da página sem ícone em caixa: o nome da tela já diz onde a pessoa está.
// `icon` e `tone` continuam aceitos para não quebrar quem passa.
</script>

<template>
  <header class="flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-end md:justify-between">
    <div class="min-w-0">
      <h1 class="text-[1.75rem] font-semibold leading-tight tracking-tight text-slate-950 md:text-[2rem]">{{ title }}</h1>
      <p v-if="subtitle" class="mt-1 max-w-[72ch] text-sm leading-relaxed text-slate-500">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2 md:justify-end">
      <slot name="actions" />
    </div>
  </header>
</template>
