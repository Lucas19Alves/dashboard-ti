<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

const props = defineProps({
  to: { type: [String, Object], default: null },
  variant: { type: String, default: 'primary' },
  size: { type: String, default: 'md' },
  type: { type: String, default: 'button' },
  disabled: { type: Boolean, default: false },
  block: { type: Boolean, default: false }
})

const component = computed(() => props.to ? RouterLink : 'button')
const variants = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700',
  secondary: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700',
  warning: 'bg-orange-600 text-white hover:bg-orange-700',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  dangerSoft: 'bg-red-50 text-red-700 hover:bg-red-100',
  dark: 'bg-slate-800 text-white hover:bg-slate-900',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
}
const sizes = {
  sm: 'min-h-8 px-3 py-1.5 text-xs rounded-lg',
  md: 'min-h-10 px-4 py-2 text-sm rounded-xl',
  lg: 'min-h-11 px-5 py-2.5 text-sm rounded-xl'
}
</script>

<template>
  <component
    :is="component"
    :to="to || undefined"
    :type="to ? undefined : type"
    :disabled="disabled"
    class="inline-flex items-center justify-center gap-2 font-semibold shadow-sm transition duration-200 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
    :class="[variants[variant] || variants.primary, sizes[size] || sizes.md, block ? 'w-full' : '']"
  >
    <slot />
  </component>
</template>
