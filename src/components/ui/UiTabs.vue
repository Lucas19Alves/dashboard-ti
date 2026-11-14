<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'

// Abas da página. Um item pode ter subabas (`itens`): a aba de cima agrupa e a linha de baixo
// mostra as subabas do grupo aberto. O valor (v-model) é sempre o de uma aba final, então os
// endereços (?aba=...) continuam os mesmos.
// Item: { value, label, icon?, badge?, itens?: [{ value, label, icon?, badge? }] }
const model = defineModel({ type: [String, Number], required: true })
const props = defineProps({
  items: { type: Array, required: true },
  sticky: { type: Boolean, default: false }
})

const grupoDe = valor => props.items.find(i => i.value === valor || i.itens?.some(s => s.value === valor))
const ativo = computed(() => grupoDe(model.value))
// Última subaba aberta em cada grupo: voltar ao grupo reabre onde a pessoa estava.
const ultima = reactive({})
const escolher = (item) => {
  if (!item.itens?.length) { model.value = item.value; return }
  if (ativo.value === item) return
  const lembrada = item.itens.find(s => s.value === ultima[item.value])
  model.value = (lembrada || item.itens[0]).value
}
watch(model, (v) => { const g = grupoDe(v); if (g?.itens) ultima[g.value] = v }, { immediate: true })
const escolherSub = (grupo, sub) => {
  ultima[grupo.value] = sub.value
  model.value = sub.value
}
const fmt = v => (typeof v === 'number' ? v.toLocaleString('pt-BR') : v)

// Em telas estreitas as abas rolam para o lado: mantém a aba (e a subaba) aberta à vista.
const raiz = ref(null)
const mostrarAtiva = async () => {
  await nextTick()
  for (const el of raiz.value?.querySelectorAll('[aria-current="page"]') || []) {
    const nav = el.parentElement
    if (nav.scrollWidth <= nav.clientWidth) continue
    nav.scrollTo({ left: Math.max(0, el.offsetLeft - nav.offsetLeft - 16), behavior: 'smooth' })
  }
}
watch(model, mostrarAtiva)
onMounted(mostrarAtiva)
</script>

<template>
  <div ref="raiz" :class="sticky ? 'sticky top-16 z-20 bg-[var(--ui-paper)]' : ''">
    <nav class="abas-rolagem flex max-w-full gap-1 overflow-x-auto overflow-y-hidden border-b border-slate-200" aria-label="Navegação da página">
      <button
        v-for="item in items"
        :key="item.value"
        type="button"
        class="relative -mb-px inline-flex min-h-10 shrink-0 items-center justify-center gap-2 border-b-[3px] px-3.5 pb-2 pt-2.5 text-sm font-medium transition-colors"
        :class="ativo === item ? 'border-blue-700 text-slate-950' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-900'"
        :aria-current="ativo === item ? 'page' : undefined"
        @click="escolher(item)"
      >
        <i v-if="item.icon" :class="[item.icon, 'text-xs', ativo === item ? 'text-blue-700' : 'opacity-70']"></i>
        {{ item.label }}
        <span v-if="item.badge !== undefined && item.badge !== null && item.badge !== ''" class="rounded-full px-1.5 text-[11px] font-semibold tabular-nums" :class="ativo === item ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'">{{ fmt(item.badge) }}</span>
        <i v-if="item.itens?.length" class="fas fa-chevron-down text-[9px] opacity-50"></i>
      </button>
    </nav>
    <nav v-if="ativo?.itens?.length" class="abas-rolagem flex max-w-full gap-1.5 overflow-x-auto overflow-y-hidden border-b border-slate-100 py-2" :aria-label="ativo.label">
      <button
        v-for="sub in ativo.itens"
        :key="sub.value"
        type="button"
        class="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition"
        :class="model === sub.value ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'"
        :aria-current="model === sub.value ? 'page' : undefined"
        @click="escolherSub(ativo, sub)"
      >
        <i v-if="sub.icon" :class="[sub.icon, 'text-[11px]', model === sub.value ? '' : 'opacity-60']"></i>
        {{ sub.label }}
        <span v-if="sub.badge !== undefined && sub.badge !== null && sub.badge !== ''" class="tabular-nums" :class="model === sub.value ? 'text-blue-100' : 'text-slate-400'">{{ fmt(sub.badge) }}</span>
      </button>
    </nav>
  </div>
</template>

<style scoped>
/* Só rolagem lateral (fina) quando as abas não cabem; nunca a barra vertical ao lado. */
.abas-rolagem { scrollbar-width: thin; }
</style>
