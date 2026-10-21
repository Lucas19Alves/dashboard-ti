<script setup>
const model = defineModel({ type: [String, Number], required: true })
defineProps({
  items: { type: Array, required: true },
  sticky: { type: Boolean, default: false }
})
</script>

<template>
  <nav
    class="flex max-w-full gap-1 overflow-x-auto border-b border-slate-200"
    :class="sticky ? 'sticky top-16 z-20 bg-[var(--ui-paper)]' : ''"
    aria-label="Navegação da página"
  >
    <button
      v-for="item in items"
      :key="item.value"
      type="button"
      class="relative -mb-px inline-flex min-h-10 shrink-0 items-center justify-center gap-2 border-b-[3px] px-3.5 pb-2 pt-2.5 text-sm font-medium transition-colors"
      :class="model === item.value ? 'border-blue-700 text-slate-950' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-900'"
      :aria-current="model === item.value ? 'page' : undefined"
      @click="model = item.value"
    >
      <i v-if="item.icon" :class="[item.icon, 'text-xs', model === item.value ? 'text-blue-700' : 'opacity-70']"></i>
      {{ item.label }}
    </button>
  </nav>
</template>
