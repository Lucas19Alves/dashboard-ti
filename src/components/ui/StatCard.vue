<script setup>
const props = defineProps({
  title: { type: String, required: true },
  value: { type: [String, Number], default: 0 },
  description: { type: String, default: '' },
  icon: { type: String, default: 'fas fa-chart-simple' },
  tone: { type: String, default: 'blue' },
  critical: { type: Boolean, default: false }
})

// O tom aparece só no marcador ao lado do título; o número fica na cor do texto
// (vermelho apenas quando é crítico). Cor na tela = informação, não decoração.
const tones = {
  blue: 'bg-blue-600',
  indigo: 'bg-indigo-500',
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-600'
}
</script>

<template>
  <article class="ui-card min-h-32 p-4">
    <div class="flex items-center gap-2">
      <span class="size-2 shrink-0 rounded-full" :class="tones[props.tone] || tones.blue" aria-hidden="true"></span>
      <p class="truncate text-[13px] font-semibold text-slate-600">{{ title }}</p>
      <i :class="[icon, 'ml-auto text-xs text-slate-300']" aria-hidden="true"></i>
    </div>
    <p class="mt-2.5 text-[2rem] font-semibold leading-none tracking-tight tabular-nums" :class="critical ? 'text-red-700' : 'text-slate-900'">
      {{ value }}
    </p>
    <p class="mt-2 text-xs leading-relaxed text-slate-500">{{ description }}</p>
  </article>
</template>
