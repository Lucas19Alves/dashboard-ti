<script setup>
const props = defineProps({
  title: { type: String, required: true },
  value: { type: [String, Number], default: 0 },
  description: { type: String, default: '' },
  icon: { type: String, default: 'fas fa-chart-simple' },
  tone: { type: String, default: 'blue' },
  critical: { type: Boolean, default: false }
})

const tones = {
  blue: { icon: 'bg-blue-50 text-blue-600', value: 'text-blue-700' },
  indigo: { icon: 'bg-indigo-50 text-indigo-600', value: 'text-indigo-700' },
  green: { icon: 'bg-emerald-50 text-emerald-600', value: 'text-emerald-700' },
  amber: { icon: 'bg-amber-50 text-amber-600', value: 'text-amber-700' },
  red: { icon: 'bg-red-50 text-red-600', value: 'text-red-700' }
}
</script>

<template>
  <article class="ui-card ui-card-hover min-h-36 p-4">
    <div class="flex items-center justify-between gap-2">
      <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">{{ title }}</p>
      <span class="inline-flex size-8 items-center justify-center rounded-xl" :class="tones[props.tone]?.icon || tones.blue.icon">
        <i :class="[icon, 'text-xs']"></i>
      </span>
    </div>
    <p class="mt-3 text-3xl font-bold tracking-tight" :class="critical ? 'text-red-700' : (tones[props.tone]?.value || tones.blue.value)">
      {{ value }}
    </p>
    <p class="mt-1.5 text-xs leading-relaxed text-slate-500">{{ description }}</p>
  </article>
</template>
