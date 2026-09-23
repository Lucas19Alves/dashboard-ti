<script setup>
const model = defineModel({ type: [String, Number], required: true })
defineProps({
  items: { type: Array, required: true },
  sticky: { type: Boolean, default: false }
})
</script>

<template>
  <nav
    class="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1"
    :class="sticky ? 'sticky top-[4.5rem] z-20 shadow-sm' : ''"
    aria-label="Navegação da página"
  >
    <button
      v-for="item in items"
      :key="item.value"
      type="button"
      class="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition"
      :class="model === item.value ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'"
      :aria-current="model === item.value ? 'page' : undefined"
      @click="model = item.value"
    >
      <i v-if="item.icon" :class="[item.icon, 'text-xs']"></i>
      {{ item.label }}
    </button>
  </nav>
</template>
