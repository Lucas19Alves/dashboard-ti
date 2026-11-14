<script setup>
import { computed, ref } from 'vue'

// Linha de uma série ao longo do tempo (uma foto por data) com a projeção tracejada à frente.
// Passe o mouse para ver o valor de cada ponto.
const props = defineProps({
  pontos: { type: Array, default: () => [] }, // [{ data: 'AAAA-MM-DD', valor }]
  projecao: { type: Array, default: () => [] }, // [{ data, valor }], começando no último ponto
  formato: { type: Function, default: v => Math.round(v).toLocaleString('pt-BR') },
  rotulo: { type: String, default: '' }
})

const L = 640
const A = 220
const M = { top: 12, right: 16, bottom: 26, left: 56 }
const dia = iso => Date.parse(`${iso}T00:00:00Z`) / 86400000
const br = iso => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

const todos = computed(() => [...props.pontos, ...props.projecao.slice(1)])
const dominioX = computed(() => {
  const xs = todos.value.map(p => dia(p.data))
  const min = Math.min(...xs)
  const max = Math.max(...xs)
  return [min, max === min ? min + 1 : max]
})
const maximoY = computed(() => {
  const m = Math.max(1, ...todos.value.map(p => p.valor))
  const pot = 10 ** Math.floor(Math.log10(m))
  const passo = [1, 2, 2.5, 5, 10].map(f => f * pot).find(p => m / p <= 4) || pot * 10
  return Math.ceil(m / passo) * passo
})
const x = d => M.left + ((dia(d) - dominioX.value[0]) / (dominioX.value[1] - dominioX.value[0])) * (L - M.left - M.right)
const y = v => A - M.bottom - (v / maximoY.value) * (A - M.top - M.bottom)
const linha = lista => lista.map((p, i) => `${i ? 'L' : 'M'}${x(p.data).toFixed(1)},${y(p.valor).toFixed(1)}`).join(' ')
const grade = computed(() => [0, 0.5, 1].map(f => f * maximoY.value))
// Rótulos do eixo X: no máximo 6 datas, sempre a primeira e a última.
const datasEixo = computed(() => {
  const ds = todos.value.map(p => p.data)
  if (ds.length <= 6) return ds
  const passo = Math.ceil((ds.length - 1) / 5)
  return [...new Set([...ds.filter((_, i) => i % passo === 0), ds.at(-1)])]
})

const ativo = ref(null)
const marcadores = computed(() => [
  ...props.pontos.map(p => ({ ...p, tipo: 'foto' })),
  ...props.projecao.slice(1).map(p => ({ ...p, tipo: 'projecao' }))
])
const mover = (e) => {
  const svg = e.currentTarget.getBoundingClientRect()
  const px = ((e.clientX - svg.left) / svg.width) * L
  let melhor = null
  for (const m of marcadores.value) if (!melhor || Math.abs(x(m.data) - px) < Math.abs(x(melhor.data) - px)) melhor = m
  ativo.value = melhor
}
</script>

<template>
  <div class="relative">
    <svg :viewBox="`0 0 ${L} ${A}`" class="h-auto w-full touch-none select-none" role="img" :aria-label="rotulo" @pointermove="mover" @pointerleave="ativo = null">
      <g v-for="g in grade" :key="g">
        <line :x1="M.left" :x2="L - M.right" :y1="y(g)" :y2="y(g)" class="stroke-slate-200" stroke-width="1" />
        <text :x="M.left - 8" :y="y(g) + 3" text-anchor="end" class="fill-slate-400 text-[10px]">{{ formato(g) }}</text>
      </g>
      <text v-for="d in datasEixo" :key="d" :x="x(d)" :y="A - 8" text-anchor="middle" class="fill-slate-400 text-[10px]">{{ br(d) }}</text>
      <path v-if="pontos.length > 1" :d="linha(pontos)" fill="none" class="stroke-blue-600" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
      <path v-if="projecao.length > 1" :d="linha(projecao)" fill="none" class="stroke-blue-600" stroke-width="2" stroke-dasharray="5 5" opacity="0.6" />
      <circle v-for="p in pontos" :key="p.data" :cx="x(p.data)" :cy="y(p.valor)" r="4" class="fill-blue-600 stroke-white" stroke-width="2" />
      <template v-if="ativo">
        <line :x1="x(ativo.data)" :x2="x(ativo.data)" :y1="M.top" :y2="A - M.bottom" class="stroke-slate-300" stroke-width="1" />
        <circle :cx="x(ativo.data)" :cy="y(ativo.valor)" r="5" :class="ativo.tipo === 'foto' ? 'fill-blue-600' : 'fill-white stroke-blue-600'" stroke-width="2" />
      </template>
    </svg>
    <div
      v-if="ativo"
      class="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-lg"
      :style="{ left: `${Math.min(88, Math.max(12, (x(ativo.data) / L) * 100))}%` }"
    >
      <p class="text-slate-500">{{ br(ativo.data) }}/{{ ativo.data.slice(0, 4) }} · {{ ativo.tipo === 'foto' ? 'planilha' : 'projeção' }}</p>
      <p class="font-semibold tabular-nums text-slate-900">{{ formato(ativo.valor) }}</p>
    </div>
    <p class="mt-1 flex flex-wrap gap-4 text-[11px] text-slate-500">
      <span class="inline-flex items-center gap-1.5"><span class="h-0.5 w-5 rounded bg-blue-600"></span>{{ rotulo || 'Planilhas importadas' }}</span>
      <span v-if="projecao.length > 1" class="inline-flex items-center gap-1.5"><span class="w-5 border-t-2 border-dashed border-blue-600 opacity-60"></span>Projeção (tendência das últimas fotos)</span>
    </p>
  </div>
</template>
