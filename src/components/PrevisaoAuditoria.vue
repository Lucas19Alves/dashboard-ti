<script setup>
import { computed } from 'vue'
import { previsaoAuditoria } from '../utils/previsao'
import { horaDe } from '../utils/trajetoUsuario'

// Previsão de fechamento: com o ritmo da última hora, a que horas a auditoria bate a meta.
const props = defineProps({
  auditoria: { type: Object, required: true },
  fim: { type: String, default: '20:00' }
})

const p = computed(() => previsaoAuditoria(props.auditoria, { fim: props.fim }))
const fmt = n => Math.round(n || 0).toLocaleString('pt-BR')

const estado = computed(() => ({
  naMeta: { titulo: 'Dentro da meta', texto: 'O pendente já está dentro da meta.', classe: 'bg-emerald-50 text-emerald-800 ring-emerald-200', icone: 'fa-circle-check' },
  noPrazo: { titulo: 'Deve bater a meta', texto: `No ritmo atual, a meta é atingida por volta das ${p.value?.instanteMeta ? horaDe(p.value.instanteMeta) : '—'}.`, classe: 'bg-blue-50 text-blue-800 ring-blue-200', icone: 'fa-flag-checkered' },
  atrasada: { titulo: 'Não bate a meta no ritmo atual', texto: `Previsão às ${props.fim}: ${p.value?.percentualPrevisto.toFixed(2)}% pendente. Meta só por volta das ${p.value?.instanteMeta ? horaDe(p.value.instanteMeta) : '—'}.`, classe: 'bg-red-50 text-red-800 ring-red-200', icone: 'fa-triangle-exclamation' },
  parada: { titulo: 'Sem leituras na última hora', texto: 'Não há ritmo recente para projetar o fechamento.', classe: 'bg-slate-100 text-slate-700 ring-slate-200', icone: 'fa-pause' }
})[p.value?.situacao] || null)

const indicadores = computed(() => {
  const x = p.value
  if (!x) return []
  return [
    { rotulo: 'Última leitura', valor: horaDe(x.ultima), detalhe: `${x.horasRestantes.toFixed(1).replace('.', ',')}h até ${props.fim}` },
    { rotulo: 'Ritmo atual', valor: `${fmt(x.ritmo)}/h`, detalhe: `${x.pessoasAtivas} pessoa(s) na última hora` },
    { rotulo: 'Faltam para a meta', valor: fmt(x.faltam), detalhe: `até ${fmt(x.permitido)} pendentes (${x.meta}%)` },
    { rotulo: `Previsão às ${props.fim}`, valor: `${x.percentualPrevisto.toFixed(2)}%`, detalhe: `${fmt(x.pendentesPrevistos)} pendentes`, alerta: x.percentualPrevisto > x.meta },
    { rotulo: 'Ritmo necessário', valor: Number.isFinite(x.ritmoNecessario) ? `${fmt(x.ritmoNecessario)}/h` : '—', detalhe: x.faltam ? 'para bater a meta no horário' : 'meta já atingida' },
    { rotulo: 'Pessoas necessárias', valor: x.pessoasNecessarias === null ? '—' : String(x.pessoasNecessarias), detalhe: x.ritmoPorPessoa ? `${fmt(x.ritmoPorPessoa)}/h por pessoa` : 'sem ritmo por pessoa', alerta: x.pessoasNecessarias > x.pessoasAtivas }
  ]
})

// ---------- Gráfico ----------
const W = 900
const H = 220
const PAD = { l: 52, r: 16, t: 14, b: 28 }
const pontos = computed(() => [...(p.value?.serie || []), ...(p.value?.projecao || [])])
const t0 = computed(() => pontos.value[0]?.instante ?? 0)
const t1 = computed(() => Math.max(p.value?.fimInstante ?? 0, pontos.value.at(-1)?.instante ?? 0))
const yMax = computed(() => Math.max(1, ...pontos.value.map(x => x.pendentes), p.value?.permitido || 0) * 1.08)
const x = t => PAD.l + ((t - t0.value) / Math.max(1, t1.value - t0.value)) * (W - PAD.l - PAD.r)
const y = v => PAD.t + (1 - v / yMax.value) * (H - PAD.t - PAD.b)
const linha = lista => lista.map((pt, i) => `${i ? 'L' : 'M'}${x(pt.instante).toFixed(1)},${y(pt.pendentes).toFixed(1)}`).join(' ')
const horas = computed(() => {
  const lista = []
  for (let t = Math.ceil(t0.value / 3600000) * 3600000; t <= t1.value; t += 3600000) lista.push(t)
  return lista
})
const ticksY = computed(() => [0, 0.5, 1].map(r => Math.round((yMax.value / 1.08) * r)))
</script>

<template>
  <section v-if="p" class="rounded-2xl bg-white p-5 shadow-sm">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 class="text-base font-bold text-slate-900"><i class="fas fa-wand-magic-sparkles mr-2 text-blue-600"></i>Previsão de fechamento</h3>
        <p class="text-xs text-slate-500">Ritmo da última hora de leituras aplicado até o fim do expediente ({{ fim }}).</p>
      </div>
      <div v-if="estado" class="flex items-start gap-2 rounded-xl px-3 py-2 text-sm ring-1" :class="estado.classe" role="status">
        <i :class="['fas', estado.icone, 'mt-0.5']"></i>
        <div><p class="font-bold">{{ estado.titulo }}</p><p class="text-xs opacity-90">{{ estado.texto }}</p></div>
      </div>
    </div>

    <div class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <div v-for="k in indicadores" :key="k.rotulo" class="rounded-xl p-3" :class="k.alerta ? 'bg-red-50' : 'bg-slate-50'">
        <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">{{ k.rotulo }}</p>
        <p class="mt-0.5 text-xl font-black" :class="k.alerta ? 'text-red-700' : 'text-slate-900'">{{ k.valor }}</p>
        <p class="text-[11px] text-slate-500">{{ k.detalhe }}</p>
      </div>
    </div>

    <svg :viewBox="`0 0 ${W} ${H}`" class="mt-4 w-full" role="img" aria-label="Pendentes ao longo do dia e projeção até o fim do expediente">
      <g v-for="v in ticksY" :key="v">
        <line :x1="PAD.l" :x2="W - PAD.r" :y1="y(v)" :y2="y(v)" stroke="#e2e8f0" stroke-dasharray="3 4" />
        <text :x="PAD.l - 6" :y="y(v) + 4" text-anchor="end" font-size="11" fill="#64748b">{{ v.toLocaleString('pt-BR') }}</text>
      </g>
      <text v-for="t in horas" :key="t" :x="x(t)" :y="H - 8" text-anchor="middle" font-size="11" fill="#64748b">{{ horaDe(t).slice(0, 2) }}h</text>
      <line :x1="PAD.l" :x2="W - PAD.r" :y1="y(p.permitido)" :y2="y(p.permitido)" stroke="#059669" stroke-width="2" stroke-dasharray="6 5" />
      <text :x="W - PAD.r" :y="y(p.permitido) - 5" text-anchor="end" font-size="11" font-weight="700" fill="#047857">meta {{ p.meta }}%</text>
      <line :x1="x(p.fimInstante)" :x2="x(p.fimInstante)" :y1="PAD.t" :y2="H - PAD.b" stroke="#94a3b8" stroke-dasharray="2 4" />
      <path :d="linha(p.serie)" fill="none" stroke="#2563eb" stroke-width="3" stroke-linejoin="round" />
      <path v-if="p.projecao.length" :d="linha(p.projecao)" fill="none" stroke="#f97316" stroke-width="2.5" stroke-dasharray="7 6" />
      <circle :cx="x(p.ultima)" :cy="y(p.pendentes)" r="5" fill="#2563eb" stroke="#fff" stroke-width="2" />
    </svg>
    <div class="mt-1 flex flex-wrap gap-x-4 text-[11px] text-slate-600">
      <span><i class="mr-1 inline-block h-1 w-5 rounded bg-blue-600 align-middle"></i>Pendentes (real)</span>
      <span><i class="mr-1 inline-block h-1 w-5 rounded bg-orange-500 align-middle"></i>Projeção</span>
      <span><i class="mr-1 inline-block h-1 w-5 rounded bg-emerald-600 align-middle"></i>Limite da meta</span>
    </div>
  </section>
</template>
