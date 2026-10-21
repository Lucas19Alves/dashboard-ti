<script setup>
const props = defineProps({
  as: { type: String, default: 'section' },
  padding: { type: String, default: 'md' },
  hover: { type: Boolean, default: false }
})

const paddings = { none: '', sm: 'p-4', md: 'p-5 md:p-6', lg: 'p-6 md:p-8' }
</script>

<template>
  <component
    :is="props.as"
    class="rounded-xl border border-slate-200/80 bg-white shadow-sm"
    :class="[paddings[padding] || paddings.md, hover ? 'transition duration-200' : '']"
  >
    <slot />
  </component>
</template>
