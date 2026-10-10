<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

// Barra de abas fixa do detalhe da auditoria. Quando o cabeçalho sai da tela,
// mostra um resumo compacto (tipo, data e % pendente) junto das abas.
const model = defineModel({ type: String, required: true })
defineProps({
  items: { type: Array, required: true }, // [{ value, label, icon, badge?, tom? }]
  resumo: { type: Object, default: null } // { titulo, pendente, naMeta }
})
defineEmits(['relatorio'])

const sentinela = ref(null)
const fixa = ref(false)
const lista = ref(null)
let observador

onMounted(() => {
  observador = new IntersectionObserver(([e]) => { fixa.value = !e.isIntersecting }, { rootMargin: '-64px 0px 0px 0px' })
  if (sentinela.value) observador.observe(sentinela.value)
})
onBeforeUnmount(() => observador?.disconnect())

// Setas do teclado trocam de aba (padrão de tablist).
const aoTeclar = async (evento, itens) => {
  const i = itens.findIndex(x => x.value === model.value)
  const passo = { ArrowRight: 1, ArrowLeft: -1 }[evento.key]
  if (!passo) return
  evento.preventDefault()
  model.value = itens[(i + passo + itens.length) % itens.length].value
  await nextTick()
  lista.value?.querySelector('[aria-selected="true"]')?.focus()
}
</script>

<template>
  <div ref="sentinela" class="h-px"></div>
  <div class="sticky top-16 z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur print:hidden">
    <div class="ui-container flex items-center gap-4">
      <transition name="resumo">
        <div v-if="fixa && resumo" class="hidden shrink-0 items-center gap-3 border-r border-slate-200 py-2 pr-4 lg:flex">
          <span class="text-sm font-bold text-slate-900">{{ resumo.titulo }}</span>
          <span class="rounded-full px-2.5 py-0.5 text-xs font-black" :class="resumo.naMeta ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'">{{ resumo.pendente }}</span>
        </div>
      </transition>

      <div ref="lista" role="tablist" aria-label="Seções da auditoria" class="-mb-px flex min-w-0 flex-1 gap-1 overflow-x-auto" @keydown="aoTeclar($event, items)">
        <button
          v-for="item in items"
          :key="item.value"
          type="button"
          role="tab"
          :aria-selected="model === item.value"
          :tabindex="model === item.value ? 0 : -1"
          class="group relative inline-flex shrink-0 items-center gap-2 px-3 py-3.5 text-sm font-semibold transition"
          :class="model === item.value ? 'text-blue-700' : 'text-slate-500 hover:text-slate-900'"
          @click="model = item.value"
        >
          <i :class="[item.icon, 'text-xs']"></i>
          {{ item.label }}
          <span
            v-if="item.badge !== undefined && item.badge !== null && item.badge !== ''"
            class="rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none"
            :class="item.tom === 'alerta' ? 'bg-amber-100 text-amber-800' : model === item.value ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'"
          >{{ item.badge }}</span>
          <span class="absolute inset-x-2 bottom-0 h-0.5 rounded-full transition" :class="model === item.value ? 'bg-blue-600' : 'bg-transparent group-hover:bg-slate-200'"></span>
        </button>
      </div>

      <button v-if="fixa" type="button" class="hidden shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 md:inline-flex" @click="$emit('relatorio')">
        <i class="fas fa-file-alt mr-1.5"></i>Relatório
      </button>
    </div>
  </div>
</template>

<style scoped>
.resumo-enter-active,
.resumo-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.resumo-enter-from,
.resumo-leave-to { opacity: 0; transform: translateX(-6px); }
</style>
