<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { normalizarBusca } from '../../utils/busca'

// Escolha de vários valores de uma coluna (setor, local, status...), com busca e contagem.
// `opcoes` é uma função: só calcula as contagens quando o menu abre.
const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  opcoes: { type: Function, required: true }, // () => [{ valor, total }]
  rotulo: { type: String, default: '' }, // mostrado no botão (filtro rápido)
  negado: { type: Boolean, default: false },
  bloco: { type: Boolean, default: false } // ocupa a largura toda (painel de filtros)
})
const emit = defineEmits(['update:modelValue'])

const aberto = ref(false)
const raiz = ref(null)
const campo = ref(null)
const termo = ref('')
const lista = ref([])
// Abre para a esquerda quando o botão está perto da borda direita da tela.
const paraEsquerda = ref(false)
const selecionados = computed(() => new Set(props.modelValue))

const abrir = async () => {
  aberto.value = !aberto.value
  if (!aberto.value) return
  lista.value = props.opcoes()
  const r = raiz.value?.getBoundingClientRect()
  paraEsquerda.value = Boolean(r) && r.left + 288 > window.innerWidth - 8
  termo.value = ''
  await nextTick()
  campo.value?.focus()
}
const fechar = (e) => { if (aberto.value && raiz.value && !raiz.value.contains(e.target)) aberto.value = false }
watch(aberto, v => { v ? document.addEventListener('pointerdown', fechar) : document.removeEventListener('pointerdown', fechar) })
onBeforeUnmount(() => document.removeEventListener('pointerdown', fechar))

const visiveis = computed(() => {
  const t = normalizarBusca(termo.value)
  // Selecionados que não aparecem mais (sem itens) continuam visíveis para poder desmarcar.
  const extras = props.modelValue.filter(v => !lista.value.some(o => o.valor === v)).map(v => ({ valor: v, total: 0 }))
  const todas = [...lista.value, ...extras]
  return (t ? todas.filter(o => normalizarBusca(o.valor).includes(t)) : todas).slice(0, 300)
})
const alternar = (valor) => {
  const s = new Set(props.modelValue)
  s.has(valor) ? s.delete(valor) : s.add(valor)
  emit('update:modelValue', [...s])
}
const marcarVisiveis = () => emit('update:modelValue', [...new Set([...props.modelValue, ...visiveis.value.map(o => o.valor)])])
const limpar = () => emit('update:modelValue', [])
const resumo = computed(() => {
  const v = props.modelValue
  if (!v.length) return props.rotulo ? '' : 'Escolher...'
  return v.length === 1 ? v[0] : `${v[0]} +${v.length - 1}`
})
const teclar = (e) => {
  if (e.key === 'Escape') { aberto.value = false; e.stopPropagation() }
  if (e.key === 'Enter' && visiveis.value.length === 1) alternar(visiveis.value[0].valor)
}
</script>

<template>
  <div ref="raiz" class="relative" :class="bloco ? 'w-full' : ''" @keydown="teclar">
    <button
      type="button"
      class="inline-flex h-9 max-w-full items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition"
      :class="[modelValue.length ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-slate-300/80 bg-white text-slate-700 hover:border-slate-400', bloco ? 'w-full' : '']"
      :aria-expanded="aberto"
      @click="abrir"
    >
      <span v-if="rotulo" class="shrink-0" :class="modelValue.length ? 'font-semibold' : ''">{{ rotulo }}<template v-if="modelValue.length">{{ negado ? ' não é' : ':' }}</template></span>
      <span class="min-w-0 truncate" :class="!modelValue.length && !rotulo ? 'text-slate-400' : ''">{{ resumo }}</span>
      <i class="fas fa-chevron-down ml-auto shrink-0 text-[10px] opacity-60"></i>
    </button>
    <div v-if="aberto" class="absolute z-40 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-2 shadow-xl" :class="paraEsquerda ? 'right-0' : 'left-0'">
      <input ref="campo" v-model="termo" type="search" class="ui-input py-1.5 text-sm" placeholder="Procurar..." />
      <div class="mt-1.5 flex items-center justify-between px-1 text-[11px]">
        <button type="button" class="font-semibold text-blue-700 hover:underline" @click="marcarVisiveis">Marcar {{ termo ? 'encontrados' : 'todos' }}</button>
        <button type="button" class="font-semibold text-slate-500 hover:text-red-600" :disabled="!modelValue.length" @click="limpar">Limpar</button>
      </div>
      <ul class="mt-1 max-h-64 overflow-y-auto">
        <li v-for="o in visiveis" :key="o.valor">
          <label class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50">
            <input type="checkbox" class="accent-blue-600" :checked="selecionados.has(o.valor)" @change="alternar(o.valor)" />
            <span class="min-w-0 flex-1 truncate" :title="o.valor">{{ o.valor }}</span>
            <span class="shrink-0 text-xs tabular-nums text-slate-400">{{ o.total.toLocaleString('pt-BR') }}</span>
          </label>
        </li>
        <li v-if="!visiveis.length" class="px-2 py-3 text-center text-xs text-slate-500">Nada encontrado.</li>
      </ul>
    </div>
  </div>
</template>
