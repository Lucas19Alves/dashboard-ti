<script setup>
import { computed, ref, watch } from 'vue'
import { agregarPorArea, carregarLayoutSalvo, gerarLayoutPadrao, interpretarLocal, mesclarLayout, nomeArea } from '../utils/mapaLoja'
import { escalaSugerida, mediana, ritmosDaAuditoria } from '../utils/planoAcao'
import { rotuloUsuario } from '../utils/usuario'

// Escala para a próxima auditoria: quantas pessoas são necessárias para terminar no horário
// e como dividir as áreas (em ordem de caminhada) com carga parecida entre elas.
const props = defineProps({
  auditoria: { type: Object, required: true },
  inicio: { type: String, default: '08:00' },
  fim: { type: String, default: '18:00' }
})

const areasAuditoria = computed(() => agregarPorArea(props.auditoria, () => false))
const areas = computed(() => [...areasAuditoria.value.values()].map(a => ({ bloco: a.bloco, tipo: a.tipo, numero: a.numero, itens: a.total })).filter(a => a.itens > 0))
const ritmos = computed(() => ritmosDaAuditoria(props.auditoria))
const ritmoMediano = computed(() => Math.round(mediana(ritmos.value.map(r => r.ritmo)) || 120))

const pessoas = ref(1)
const horaInicio = ref(props.inicio)
const horaFim = ref(props.fim)
const ritmo = ref(120)
const sugerirNomes = ref(true)
watch(() => props.auditoria?.id, () => {
  pessoas.value = Math.max(1, ritmos.value.length || (props.auditoria?.analise?.usuarios || []).length || 1)
  ritmo.value = ritmoMediano.value
}, { immediate: true })

const minutos = hhmm => { const [h, m] = String(hhmm).split(':').map(Number); return (h || 0) * 60 + (m || 0) }
const horas = computed(() => Math.max(0.5, (minutos(horaFim.value) - minutos(horaInicio.value)) / 60))
const escala = computed(() => escalaSugerida({ areas: areas.value, pessoas: Math.max(1, Number(pessoas.value) || 1), horas: horas.value, ritmoPorPessoa: Math.max(1, Number(ritmo.value) || 1) }))
const horario = h => {
  const total = minutos(horaInicio.value) + Math.round(h * 60)
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

// Nomes: os mais rápidos (nesta auditoria) ficam com os grupos de mais itens.
const nomes = computed(() => {
  if (!sugerirNomes.value) return new Map()
  const porCarga = [...escala.value.grupos].sort((a, b) => b.itens - a.itens)
  return new Map(porCarga.map((g, i) => [g.pessoa, ritmos.value[i]?.usuario || '']))
})

const CORES = ['#3b82f6', '#f97316', '#10b981', '#a855f7', '#ef4444', '#06b6d4', '#eab308', '#ec4899', '#64748b', '#84cc16', '#14b8a6', '#8b5cf6']
const cor = pessoa => CORES[(pessoa - 1) % CORES.length]
const grupoDaArea = computed(() => new Map(escala.value.grupos.flatMap(g => g.areas.map(a => [a.bloco, g.pessoa]))))

const resumirAreas = (lista) => {
  const corredores = lista.filter(a => a.tipo === 'gondola').map(a => a.numero).sort((a, b) => a - b)
  const outras = lista.filter(a => a.tipo !== 'gondola').map(a => nomeArea(a))
  const partes = []
  if (corredores.length) partes.push(corredores.length > 1 ? `Corredores ${String(corredores[0]).padStart(2, '0')}–${String(corredores.at(-1)).padStart(2, '0')}` : `Corredor ${String(corredores[0]).padStart(2, '0')}`)
  return [...partes, ...outras].join(', ')
}

// Mapa
const layout = computed(() => mesclarLayout(gerarLayoutPadrao(areasAuditoria.value.values()), carregarLayoutSalvo()))
const posicoes = computed(() => layout.value.posicoes.filter(p => !p.oculto))
const rotulo = (p) => {
  const area = areasAuditoria.value.get(p.id) || { bloco: p.id, ...interpretarLocal(p.id) }
  return area.tipo === 'gondola' ? p.id.slice(1) : nomeArea(area)
}
</script>

<template>
  <section class="rounded-2xl bg-white p-5 shadow-sm">
    <div>
      <h3 class="text-lg font-bold text-slate-900"><i class="fas fa-people-arrows mr-2 text-blue-600"></i>Escala sugerida para a próxima auditoria</h3>
      <p class="text-xs text-slate-500">Usa o tamanho de cada área nesta auditoria e o ritmo do time. Áreas vizinhas ficam com a mesma pessoa para reduzir deslocamento.</p>
    </div>

    <div class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
      <label class="block"><span class="ui-label">Pessoas</span><input v-model.number="pessoas" type="number" min="1" max="40" class="ui-input"></label>
      <label class="block"><span class="ui-label">Início</span><input v-model="horaInicio" type="time" class="ui-input"></label>
      <label class="block"><span class="ui-label">Fim</span><input v-model="horaFim" type="time" class="ui-input"></label>
      <label class="block"><span class="ui-label">Ritmo por pessoa (/h)</span><input v-model.number="ritmo" type="number" min="1" class="ui-input"></label>
      <label class="flex items-end gap-2 pb-2.5 text-sm text-slate-700"><input v-model="sugerirNomes" type="checkbox" class="size-4 accent-blue-600">Sugerir nomes</label>
    </div>
    <p class="mt-1 text-[11px] text-slate-500">Ritmo mediano nesta auditoria: <b>{{ ritmoMediano }}/h</b> ({{ ritmos.length }} pessoa(s) com horário suficiente).</p>

    <div class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
      <div class="rounded-xl bg-slate-50 p-3"><p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Itens a auditar</p><p class="text-xl font-black text-slate-900">{{ escala.totalItens.toLocaleString('pt-BR') }}</p></div>
      <div class="rounded-xl p-3" :class="escala.pessoasNecessarias > pessoas ? 'bg-red-50' : 'bg-emerald-50'">
        <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Pessoas necessárias</p>
        <p class="text-xl font-black" :class="escala.pessoasNecessarias > pessoas ? 'text-red-700' : 'text-emerald-700'">{{ escala.pessoasNecessarias }}</p>
        <p class="text-[11px] text-slate-500">para {{ horas.toFixed(1).replace('.', ',') }}h a {{ ritmo }}/h</p>
      </div>
      <div class="rounded-xl p-3" :class="escala.cabeNoHorario ? 'bg-emerald-50' : 'bg-red-50'">
        <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Término previsto</p>
        <p class="text-xl font-black" :class="escala.cabeNoHorario ? 'text-emerald-700' : 'text-red-700'">{{ horario(escala.horasNecessarias) }}</p>
        <p class="text-[11px] text-slate-500">com {{ escala.grupos.length }} pessoa(s), maior carga</p>
      </div>
      <div class="rounded-xl bg-slate-50 p-3"><p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Média por pessoa</p><p class="text-xl font-black text-slate-900">{{ Math.round(escala.totalItens / Math.max(1, escala.grupos.length)).toLocaleString('pt-BR') }}</p><p class="text-[11px] text-slate-500">itens</p></div>
    </div>

    <p v-if="!areas.length" class="mt-4 rounded-xl bg-slate-50 py-8 text-center text-sm text-slate-500">Sem contagem por local nesta auditoria.</p>
    <div v-else class="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div class="overflow-x-auto rounded-xl bg-slate-50 p-3">
        <svg :viewBox="`-0.5 -0.5 ${layout.colunas + 1} ${layout.linhas + 1}`" class="w-full min-w-[600px]" role="img" aria-label="Divisão das áreas por pessoa">
          <g v-for="p in posicoes" :key="p.id">
            <rect :x="p.x + 0.08" :y="p.y + 0.08" :width="p.w - 0.16" :height="p.h - 0.16" rx="0.35" :fill="grupoDaArea.has(p.id) ? cor(grupoDaArea.get(p.id)) : '#e2e8f0'" :fill-opacity="grupoDaArea.has(p.id) ? 0.85 : 1" stroke="#fff" stroke-width="0.08">
              <title>{{ rotulo(p) }}{{ grupoDaArea.has(p.id) ? ` · Pessoa ${grupoDaArea.get(p.id)}` : '' }}</title>
            </rect>
            <text :x="p.x + p.w / 2" :y="p.y + p.h / 2 - (grupoDaArea.has(p.id) && p.h > 2 ? 0.45 : 0)" text-anchor="middle" dominant-baseline="central" font-size="0.75" font-weight="800" :fill="grupoDaArea.has(p.id) ? '#fff' : '#64748b'">{{ rotulo(p) }}</text>
            <text v-if="grupoDaArea.has(p.id) && p.h > 2" :x="p.x + p.w / 2" :y="p.y + p.h / 2 + 0.55" text-anchor="middle" dominant-baseline="central" font-size="0.65" font-weight="700" fill="#fff" opacity="0.9">P{{ grupoDaArea.get(p.id) }}</text>
          </g>
        </svg>
      </div>
      <ol class="max-h-[520px] space-y-2 overflow-y-auto">
        <li v-for="g in escala.grupos" :key="g.pessoa" class="rounded-xl p-3 ring-1 ring-slate-200">
          <div class="flex items-center gap-2">
            <span class="inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-black text-white" :style="{ background: cor(g.pessoa) }">P{{ g.pessoa }}</span>
            <p class="min-w-0 flex-1 truncate font-bold text-slate-900">{{ nomes.get(g.pessoa) ? rotuloUsuario(nomes.get(g.pessoa)) : `Pessoa ${g.pessoa}` }}</p>
            <span class="text-xs font-bold" :class="g.horas > horas ? 'text-red-700' : 'text-slate-600'">até {{ horario(g.horas || 0) }}</span>
          </div>
          <p class="mt-1 text-xs text-slate-600">{{ resumirAreas(g.areas) }}</p>
          <p class="text-[11px] text-slate-500">{{ g.itens.toLocaleString('pt-BR') }} itens · {{ (g.horas || 0).toFixed(1).replace('.', ',') }}h</p>
        </li>
      </ol>
    </div>
  </section>
</template>
