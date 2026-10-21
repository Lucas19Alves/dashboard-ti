<script setup>
defineProps({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  icon: { type: String, default: 'fas fa-inbox' }
})
</script>

<template>
  <div class="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
    <span class="mx-auto inline-flex size-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
      <i :class="[icon, 'text-xl']"></i>
    </span>
    <h2 class="mt-4 text-base font-bold text-slate-800">{{ title }}</h2>
    <p v-if="description" class="mx-auto mt-1 max-w-lg text-sm leading-relaxed text-slate-500">{{ description }}</p>
    <div v-if="$slots.actions" class="mt-5 flex justify-center gap-2"><slot name="actions" /></div>
  </div>
</template>
