<script setup>
import { computed, ref } from 'vue'
import { formatarDataBR } from '../utils/busca'
import { rotuloUsuario } from '../utils/usuario'

// Ritmo (linha) e % com problema (barras) de um colaborador por auditoria, com dica no hover.
const props = defineProps({
  usuario: { type: Object, required: true } // item de evolucaoUsuarios()
})
const atual = computed(() => props.usuario)
const fmt = v => (v === null || v === undefined ? '—' : Math.round(v).toLocaleString('pt-BR'))

const W = 760
const H = 220
const PAD = { l: 44, r: 44, t: 16, b: 34 }
const serie = computed(() => atual.value?.serie || [])
const maxRitmo = computed(() => Math.max(10, ...serie.value.map(s => s.ritmo || 0)) * 1.15)
const maxProblema = computed(() => Math.max(5, ...serie.value.map(s => s.percProblema)) * 1.15)
const x = i => PAD.l + (serie.value.length > 1 ? (i * (W - PAD.l - PAD.r)) / (serie.value.length - 1) : (W - PAD.l - PAD.r) / 2)
const yR = v => PAD.t + (1 - v / maxRitmo.value) * (H - PAD.t - PAD.b)
const yP = v => PAD.t + (1 - v / maxProblema.value) * (H - PAD.t - PAD.b)
const linhaRitmo = computed(() => {
  let d = ''
  let aberto = false
  serie.value.forEach((s, i) => {
    if (s.ritmo === null) { aberto = false; return }
    d += `${aberto ? 'L' : 'M'}${x(i).toFixed(1)},${yR(s.ritmo).toFixed(1)} `
    aberto = true
  })
  return d
})
const larguraBarra = computed(() => Math.max(4, Math.min(28, ((W - PAD.l - PAD.r) / Math.max(1, serie.value.length)) * 0.5)))
// Hover: coluna invisível por auditoria, linha guia e dica com os números.
const hover = ref(null)
const pontoHover = computed(() => (hover.value === null ? null : serie.value[hover.value] || null))
const limitesColuna = i => {
  const a = i === 0 ? PAD.l : (x(i - 1) + x(i)) / 2
  const b = i === serie.value.length - 1 ? W - PAD.r : (x(i) + x(i + 1)) / 2
  return { x: a, w: Math.max(1, b - a) }
}
const posicaoDica = computed(() => {
  if (hover.value === null) return {}
  const pct = (x(hover.value) / W) * 100
  return pct > 70 ? { right: `${100 - pct + 2}%` } : { left: `${pct + 2}%` }
})
const comparar = (valor, media) => (valor === null || media === null || media === undefined ? null : Math.round(valor - media) || 0)

const passoRotulo = computed(() => Math.max(1, Math.ceil(serie.value.length / 10)))
</script>

<template>
  <div>
  <div class="relative mt-3">
  <svg :viewBox="`0 0 ${W} ${H}`" class="w-full" role="img" :aria-label="`Ritmo e problemas de ${rotuloUsuario(atual.usuario)} por auditoria`" @mouseleave="hover = null">
    <line :x1="PAD.l" :x2="W - PAD.r" :y1="H - PAD.b" :y2="H - PAD.b" stroke="#cbd5e1" />
    <text :x="PAD.l - 6" :y="PAD.t + 4" text-anchor="end" font-size="11" fill="#2563eb">{{ Math.round(maxRitmo / 1.15) }}/h</text>
    <text :x="W - PAD.r + 6" :y="PAD.t + 4" font-size="11" fill="#dc2626">{{ (maxProblema / 1.15).toFixed(0) }}%</text>
    <rect v-for="(s, i) in serie" :key="`b${i}`" :x="x(i) - larguraBarra / 2" :y="yP(s.percProblema)" :width="larguraBarra" :height="H - PAD.b - yP(s.percProblema)" fill="#fca5a5" rx="2">
      <title>{{ formatarDataBR(s.data) }} · {{ s.tipo }}: {{ s.percProblema.toFixed(1) }}% com problema</title>
    </rect>
    <path :d="linhaRitmo" fill="none" stroke="#2563eb" stroke-width="3" stroke-linejoin="round" />
    <g v-for="(s, i) in serie" :key="`p${i}`">
      <circle v-if="s.ritmo !== null" :cx="x(i)" :cy="yR(s.ritmo)" r="4.5" fill="#2563eb" stroke="#fff" stroke-width="2">
        <title>{{ formatarDataBR(s.data) }} · {{ s.tipo }}: {{ fmt(s.ritmo) }} leituras/h · {{ s.leituras }} leituras</title>
      </circle>
      <text v-if="i % passoRotulo === 0 || i === serie.length - 1" :x="x(i)" :y="H - PAD.b + 16" text-anchor="middle" font-size="10" fill="#64748b">{{ formatarDataBR(s.data).slice(0, 5) }}</text>
    </g>
    <line v-if="pontoHover" :x1="x(hover)" :x2="x(hover)" :y1="PAD.t" :y2="H - PAD.b" stroke="#0f172a" stroke-dasharray="3 3" opacity="0.4" pointer-events="none" />
    <circle v-if="pontoHover && pontoHover.ritmo !== null" :cx="x(hover)" :cy="yR(pontoHover.ritmo)" r="7" fill="none" stroke="#2563eb" stroke-width="2.5" pointer-events="none" />
    <rect v-for="(s, i) in serie" :key="`h${i}`" :x="limitesColuna(i).x" :y="PAD.t" :width="limitesColuna(i).w" :height="H - PAD.t - PAD.b" fill="transparent"
      tabindex="0" :aria-label="`${formatarDataBR(s.data)}: ${s.ritmo === null ? 'sem ritmo' : fmt(s.ritmo) + ' leituras por hora'}, ${s.percProblema.toFixed(1)}% com problema`"
      @mouseenter="hover = i" @focus="hover = i" @blur="hover = null" />
  </svg>
  <div v-if="pontoHover" class="pointer-events-none absolute top-1 z-10 w-56 rounded-xl bg-slate-900/95 px-3 py-2 text-xs text-white shadow-lg" :style="posicaoDica" role="status">
    <p class="font-bold">{{ formatarDataBR(pontoHover.data) }} · {{ pontoHover.tipo }}</p>
    <div class="mt-1 space-y-0.5">
      <p class="flex justify-between"><span class="text-slate-300">Ritmo</span><b>{{ pontoHover.ritmo === null ? 'sem horário' : `${fmt(pontoHover.ritmo)}/h` }}</b></p>
      <p v-if="comparar(pontoHover.ritmo, atual.ritmoMedio) !== null" class="flex justify-between"><span class="text-slate-300">vs média</span>
        <b :class="comparar(pontoHover.ritmo, atual.ritmoMedio) >= 0 ? 'text-emerald-300' : 'text-red-300'">{{ comparar(pontoHover.ritmo, atual.ritmoMedio) >= 0 ? '+' : '' }}{{ fmt(comparar(pontoHover.ritmo, atual.ritmoMedio)) }}/h</b></p>
      <p class="flex justify-between"><span class="text-slate-300">Leituras</span><b>{{ pontoHover.leituras.toLocaleString('pt-BR') }}</b></p>
      <p class="flex justify-between"><span class="text-slate-300">Com problema</span><b :class="pontoHover.percProblema > 5 ? 'text-red-300' : ''">{{ pontoHover.percProblema.toFixed(1) }}%</b></p>
    </div>
  </div>
  </div>
  <div class="mt-1 flex flex-wrap gap-x-4 text-[11px] text-slate-600">
    <span><i class="mr-1 inline-block h-1 w-5 rounded bg-blue-600 align-middle"></i>Ritmo (leituras/h)</span>
    <span><i class="mr-1 inline-block size-2.5 rounded-sm bg-red-300 align-middle"></i>% com problema</span>
    <span v-if="serie.some(s => s.ritmo === null)">Sem ponto = auditoria sem horário suficiente</span>
  </div>
  </div>
</template>
