<script setup>
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  icon: { type: String, default: 'fas fa-chart-simple' },
  tone: { type: String, default: 'blue' }
})

const tones = {
  blue: 'bg-blue-50 text-blue-600',
  indigo: 'bg-indigo-50 text-indigo-600',
  orange: 'bg-orange-50 text-orange-600',
  emerald: 'bg-emerald-50 text-emerald-600'
}
</script>

<template>
  <header class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
    <div class="flex min-w-0 items-center gap-3.5">
      <span class="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl" :class="tones[tone] || tones.blue">
        <i :class="[icon, 'text-xl']"></i>
      </span>
      <div class="min-w-0">
        <h1 class="text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">{{ title }}</h1>
        <p v-if="subtitle" class="mt-1 text-sm leading-relaxed text-slate-500">{{ subtitle }}</p>
      </div>
    </div>
    <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2 md:justify-end">
      <slot name="actions" />
    </div>
  </header>
</template>
