<script setup>
import { computed, ref } from 'vue'
import { formatarDataBR } from '../../utils/busca'

// Série única (% pendente por auditoria) com linha de referência da meta.
const props = defineProps({
  pontos: { type: Array, default: () => [] }, // [{ id, data, valor }]
  meta: { type: Number, default: 3 },
  rotulo: { type: String, default: 'Pendente' }
})
const emit = defineEmits(['selecionar'])

const L = 240
const A = 64
const M = { topo: 8, base: 8, lado: 6 }
const ativo = ref(null)

const maximo = computed(() => Math.max(props.meta * 2, ...props.pontos.map(p => p.valor)) * 1.1)
const x = i => props.pontos.length <= 1 ? L / 2 : M.lado + (i * (L - M.lado * 2)) / (props.pontos.length - 1)
const y = v => A - M.base - (v / maximo.value) * (A - M.topo - M.base)

const caminho = computed(() => props.pontos.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`).join(' '))
const yMeta = computed(() => y(props.meta))
const ultimo = computed(() => props.pontos.length - 1)
const pontoAtivo = computed(() => (ativo.value === null ? null : props.pontos[ativo.value]))
const marcadores = computed(() => {
  if (!props.pontos.length) return []
  return [...new Set(pontoAtivo.value ? [ativo.value, ultimo.value] : [ultimo.value])]
})

const aoMover = (evento) => {
  if (!props.pontos.length) return
  const caixa = evento.currentTarget.getBoundingClientRect()
  const relativo = ((evento.clientX - caixa.left) / caixa.width) * L
  let melhor = 0
  props.pontos.forEach((_, i) => { if (Math.abs(x(i) - relativo) < Math.abs(x(melhor) - relativo)) melhor = i })
  ativo.value = melhor
}
</script>

<template>
  <div class="relative">
    <svg
      :viewBox="`0 0 ${L} ${A}`"
      class="h-16 w-full cursor-crosshair overflow-visible"
      preserveAspectRatio="none"
      role="img"
      :aria-label="`${rotulo}: ${pontos.map(p => `${formatarDataBR(p.data)} ${p.valor.toFixed(1)}%`).join(', ')}`"
      @mousemove="aoMover"
      @mouseleave="ativo = null"
      @click="pontoAtivo && emit('selecionar', pontoAtivo)"
    >
      <line :x1="0" :x2="L" :y1="yMeta" :y2="yMeta" stroke="#94a3b8" stroke-width="1" stroke-dasharray="3 3" vector-effect="non-scaling-stroke" />
      <path :d="caminho" fill="none" stroke="#2563eb" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
      <line v-if="pontoAtivo" :x1="x(ativo)" :x2="x(ativo)" :y1="M.topo / 2" :y2="A" stroke="#cbd5e1" stroke-width="1" vector-effect="non-scaling-stroke" />
    </svg>
    <!-- Marcadores em HTML para não distorcer com preserveAspectRatio="none". -->
    <span
      v-for="i in marcadores"
      :key="i"
      class="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-blue-600 shadow"
      :style="{ left: `${(x(i) / L) * 100}%`, top: `${(y(pontos[i].valor) / A) * 100}%` }"
    ></span>
    <div
      v-if="pontoAtivo"
      class="pointer-events-none absolute -top-9 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-medium text-white shadow-lg"
      :style="{ left: `${Math.min(85, Math.max(15, (x(ativo) / L) * 100))}%` }"
    >
      {{ formatarDataBR(pontoAtivo.data) }} · <span class="font-bold">{{ pontoAtivo.valor.toFixed(1) }}%</span> {{ rotulo.toLowerCase() }}
    </div>
  </div>
</template>
