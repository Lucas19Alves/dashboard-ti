<script setup>
import { computed, ref, watch } from 'vue'
import { evolucaoUsuarios } from '../utils/historicoAuditorias'
import { correspondeBusca, formatarDataBR } from '../utils/busca'
import { separarUsuario, rotuloUsuario } from '../utils/usuario'
import { baixarCsv } from '../utils/csv'

// Produtividade de cada usuário ao longo das auditorias: ritmo (leituras por hora ativa) e % de problema.
const props = defineProps({
  auditorias: { type: Array, required: true }
})

const usuarios = computed(() => evolucaoUsuarios(props.auditorias))
const busca = ref('')
const filtrados = computed(() => usuarios.value.filter(u => correspondeBusca(busca.value, [u.usuario])))
const selecionado = ref('')
watch(usuarios, (lista) => { if (!lista.some(u => u.usuario === selecionado.value)) selecionado.value = lista[0]?.usuario || '' }, { immediate: true })
const atual = computed(() => usuarios.value.find(u => u.usuario === selecionado.value) || null)

const fmt = v => (v === null || v === undefined ? '—' : Math.round(v).toLocaleString('pt-BR'))
const SETAS = {
  subindo: { icone: 'fa-arrow-trend-up', texto: 'subindo' },
  caindo: { icone: 'fa-arrow-trend-down', texto: 'caindo' },
  estavel: { icone: 'fa-minus', texto: 'estável' },
  indefinida: { icone: 'fa-minus', texto: 'poucas auditorias' }
}
// Ritmo subir é bom; problema subir é ruim.
const corRitmo = t => (t === 'subindo' ? 'text-emerald-700' : t === 'caindo' ? 'text-red-700' : 'text-slate-500')
const corProblema = t => (t === 'subindo' ? 'text-red-700' : t === 'caindo' ? 'text-emerald-700' : 'text-slate-500')

// ---------- Gráfico do usuário ----------
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
const passoRotulo = computed(() => Math.max(1, Math.ceil(serie.value.length / 10)))

const exportar = () => baixarCsv(filtrados.value.map(u => ({
  matricula: separarUsuario(u.usuario).matricula, nome: separarUsuario(u.usuario).nome || u.usuario, auditorias: u.auditorias, leituras: u.leituras,
  ritmoMedio: fmt(u.ritmoMedio), ritmoRecente: fmt(u.ritmoRecente), tendenciaRitmo: SETAS[u.tendenciaRitmo].texto,
  percProblema: u.percProblemaMedio === null ? '' : u.percProblemaMedio.toFixed(2).replace('.', ','), tendenciaProblema: SETAS[u.tendenciaProblema].texto
})), [
  { chave: 'matricula', titulo: 'Matrícula' }, { chave: 'nome', titulo: 'Nome' }, { chave: 'auditorias', titulo: 'Auditorias' }, { chave: 'leituras', titulo: 'Leituras' },
  { chave: 'ritmoMedio', titulo: 'Ritmo médio (/h)' }, { chave: 'ritmoRecente', titulo: 'Ritmo últimas 3 (/h)' }, { chave: 'tendenciaRitmo', titulo: 'Tendência ritmo' },
  { chave: 'percProblema', titulo: '% problema médio' }, { chave: 'tendenciaProblema', titulo: 'Tendência problema' }
], 'evolucao-usuarios')
</script>

<template>
  <section class="ui-card p-5 md:p-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-base font-bold text-slate-900">Evolução ao longo das auditorias</h2>
        <p class="text-xs text-slate-500">Ritmo = leituras por hora de tempo ativo (pausas de 15+ min não contam). Precisa da coluna "Auditado em" com horário.</p>
      </div>
      <div class="flex items-center gap-2">
        <div class="relative w-full sm:w-56">
          <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" aria-hidden="true"></i>
          <input v-model="busca" type="search" class="ui-input py-2 pl-8 text-xs" placeholder="Buscar usuário..." aria-label="Buscar usuário">
        </div>
        <button type="button" class="ui-btn-secondary py-2 text-xs" @click="exportar"><i class="fas fa-file-csv"></i>CSV</button>
      </div>
    </div>

    <p v-if="!usuarios.length" class="py-10 text-center text-sm text-slate-500">Sem dados por usuário no período.</p>

    <div v-else class="mt-4 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <!-- Lista -->
      <div class="max-h-[420px] overflow-auto rounded-xl ring-1 ring-slate-200">
        <table class="w-full text-xs">
          <thead class="sticky top-0 bg-slate-50 text-slate-500">
            <tr>
              <th scope="col" class="px-3 py-2 text-left font-semibold">Usuário</th>
              <th scope="col" class="px-3 py-2 text-right font-semibold">Aud.</th>
              <th scope="col" class="px-3 py-2 text-right font-semibold">Ritmo médio</th>
              <th scope="col" class="px-3 py-2 text-right font-semibold">Últimas 3</th>
              <th scope="col" class="px-3 py-2 text-right font-semibold">% problema</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-50">
            <tr v-for="u in filtrados" :key="u.usuario" class="cursor-pointer" :class="u.usuario === selecionado ? 'bg-blue-50' : 'hover:bg-slate-50'"
              tabindex="0" :aria-selected="u.usuario === selecionado" @click="selecionado = u.usuario" @keydown.enter="selecionado = u.usuario">
              <td class="px-3 py-2">
                <p class="font-semibold text-slate-800">{{ separarUsuario(u.usuario).nome || u.usuario }}</p>
                <p v-if="separarUsuario(u.usuario).matricula" class="text-[10px] text-slate-500">{{ separarUsuario(u.usuario).matricula }}</p>
              </td>
              <td class="px-3 py-2 text-right text-slate-600">{{ u.auditorias }}</td>
              <td class="px-3 py-2 text-right font-semibold text-slate-800">{{ fmt(u.ritmoMedio) }}/h</td>
              <td class="px-3 py-2 text-right font-semibold" :class="corRitmo(u.tendenciaRitmo)">
                {{ fmt(u.ritmoRecente) }}/h <i :class="['fas', SETAS[u.tendenciaRitmo].icone, 'ml-0.5 text-[10px]']" :title="`Ritmo ${SETAS[u.tendenciaRitmo].texto}`"></i>
              </td>
              <td class="px-3 py-2 text-right" :class="corProblema(u.tendenciaProblema)">
                {{ u.percProblemaMedio === null ? '—' : `${u.percProblemaMedio.toFixed(1)}%` }} <i :class="['fas', SETAS[u.tendenciaProblema].icone, 'ml-0.5 text-[10px]']" :title="`Problema ${SETAS[u.tendenciaProblema].texto}`"></i>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Gráfico -->
      <div v-if="atual" class="rounded-xl bg-slate-50 p-4">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <p class="font-bold text-slate-900">{{ rotuloUsuario(atual.usuario) }}</p>
          <p class="text-xs text-slate-500">{{ atual.auditorias }} auditoria(s) · {{ atual.leituras.toLocaleString('pt-BR') }} leituras</p>
        </div>
        <svg :viewBox="`0 0 ${W} ${H}`" class="mt-3 w-full" role="img" :aria-label="`Ritmo e problemas de ${rotuloUsuario(atual.usuario)} por auditoria`">
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
        </svg>
        <div class="mt-1 flex flex-wrap gap-x-4 text-[11px] text-slate-600">
          <span><i class="mr-1 inline-block h-1 w-5 rounded bg-blue-600 align-middle"></i>Ritmo (leituras/h)</span>
          <span><i class="mr-1 inline-block size-2.5 rounded-sm bg-red-300 align-middle"></i>% com problema</span>
          <span v-if="serie.some(s => s.ritmo === null)">Sem ponto = auditoria sem horário suficiente</span>
        </div>
      </div>
    </div>
  </section>
</template>
