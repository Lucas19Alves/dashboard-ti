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

// ---------- Filtros ----------
const busca = ref('')
const filtroTipo = ref('todos')
const filtroRitmo = ref('todos')
const filtroProblema = ref('todos')
const minimoAuditorias = ref(1)
const tiposDisponiveis = computed(() => ['Etiqueta', 'Presença', 'Ruptura'].filter(t => props.auditorias.some(a => a.tipo === t)))
const auditoriasDoTipo = computed(() => (filtroTipo.value === 'todos' ? props.auditorias : props.auditorias.filter(a => a.tipo === filtroTipo.value)))
const usuarios = computed(() => evolucaoUsuarios(auditoriasDoTipo.value))
const LIMITES_PROBLEMA = { acima2: 2, acima5: 5 }
const filtrados = computed(() => usuarios.value.filter(u => {
  const { nome, matricula } = separarUsuario(u.usuario)
  if (!correspondeBusca(busca.value, [u.usuario, nome, matricula])) return false
  if (u.auditorias < minimoAuditorias.value) return false
  if (filtroRitmo.value !== 'todos' && u.tendenciaRitmo !== filtroRitmo.value) return false
  if (filtroProblema.value !== 'todos' && !((u.percProblemaMedio ?? 0) > LIMITES_PROBLEMA[filtroProblema.value])) return false
  return true
}))
const filtrosAtivos = computed(() => Boolean(busca.value) || filtroTipo.value !== 'todos' || filtroRitmo.value !== 'todos' || filtroProblema.value !== 'todos' || minimoAuditorias.value > 1)
const limparFiltros = () => {
  busca.value = ''
  filtroTipo.value = 'todos'
  filtroRitmo.value = 'todos'
  filtroProblema.value = 'todos'
  minimoAuditorias.value = 1
}

// ---------- Ordenação e paginação ----------
const ordem = ref({ coluna: 'leituras', direcao: 'desc' })
const COLUNAS = [
  { chave: 'usuario', titulo: 'Usuário', alinhamento: 'left' },
  { chave: 'auditorias', titulo: 'Aud.', alinhamento: 'right' },
  { chave: 'ritmoMedio', titulo: 'Ritmo médio', alinhamento: 'right' },
  { chave: 'ritmoRecente', titulo: 'Últimas 3', alinhamento: 'right' },
  { chave: 'percProblemaMedio', titulo: '% problema', alinhamento: 'right' }
]
const ordenar = (coluna) => {
  ordem.value = ordem.value.coluna === coluna
    ? { coluna, direcao: ordem.value.direcao === 'asc' ? 'desc' : 'asc' }
    : { coluna, direcao: coluna === 'usuario' ? 'asc' : 'desc' }
}
const valorOrdem = (u, coluna) => (coluna === 'usuario' ? (separarUsuario(u.usuario).nome || u.usuario) : u[coluna])
const ordenados = computed(() => {
  const { coluna, direcao } = ordem.value
  const mult = direcao === 'asc' ? 1 : -1
  return [...filtrados.value].sort((a, b) => {
    const va = valorOrdem(a, coluna)
    const vb = valorOrdem(b, coluna)
    // Sem valor (ex.: sem ritmo) sempre no fim.
    if (va === null || va === undefined) return 1
    if (vb === null || vb === undefined) return -1
    return (typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'pt-BR')) * mult
  })
})
const iconeOrdem = coluna => (ordem.value.coluna !== coluna ? 'fa-sort text-slate-300' : ordem.value.direcao === 'asc' ? 'fa-sort-up text-blue-600' : 'fa-sort-down text-blue-600')
const POR_PAGINA = 10
const pagina = ref(1)
const totalPaginas = computed(() => Math.max(1, Math.ceil(ordenados.value.length / POR_PAGINA)))
const paginaAtual = computed(() => ordenados.value.slice((pagina.value - 1) * POR_PAGINA, pagina.value * POR_PAGINA))
watch([busca, filtroTipo, filtroRitmo, filtroProblema, minimoAuditorias, ordem], () => { pagina.value = 1 })
const selecionado = ref('')
watch(ordenados, (lista) => { if (!lista.some(u => u.usuario === selecionado.value)) selecionado.value = lista[0]?.usuario || '' }, { immediate: true })
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

const exportar = () => baixarCsv(ordenados.value.map(u => ({
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
      <button type="button" class="ui-btn-secondary py-2 text-xs" :disabled="!ordenados.length" @click="exportar"><i class="fas fa-file-csv"></i>CSV</button>
    </div>

    <!-- Pesquisa e filtros -->
    <div class="mt-4 flex flex-wrap items-center gap-2">
      <div class="relative min-w-0 flex-1 sm:max-w-64">
        <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" aria-hidden="true"></i>
        <input v-model="busca" type="search" class="ui-input py-2 pl-8 text-xs" placeholder="Nome ou matrícula..." aria-label="Buscar por nome ou matrícula">
      </div>
      <select v-model="filtroTipo" class="ui-input w-auto py-2 text-xs" aria-label="Tipo de auditoria">
        <option value="todos">Todos os tipos</option>
        <option v-for="t in tiposDisponiveis" :key="t" :value="t">{{ t }}</option>
      </select>
      <select v-model="filtroRitmo" class="ui-input w-auto py-2 text-xs" aria-label="Tendência do ritmo">
        <option value="todos">Ritmo: qualquer tendência</option>
        <option value="subindo">Ritmo subindo</option>
        <option value="caindo">Ritmo caindo</option>
        <option value="estavel">Ritmo estável</option>
      </select>
      <select v-model="filtroProblema" class="ui-input w-auto py-2 text-xs" aria-label="Percentual de problema">
        <option value="todos">% problema: todos</option>
        <option value="acima2">Problema acima de 2%</option>
        <option value="acima5">Problema acima de 5%</option>
      </select>
      <select v-model.number="minimoAuditorias" class="ui-input w-auto py-2 text-xs" aria-label="Mínimo de auditorias">
        <option v-for="n in [1, 2, 3, 5, 10]" :key="n" :value="n">{{ n === 1 ? 'Qualquer nº de auditorias' : `${n}+ auditorias` }}</option>
      </select>
      <button v-if="filtrosAtivos" type="button" class="rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100" @click="limparFiltros"><i class="fas fa-xmark mr-1" aria-hidden="true"></i>Limpar</button>
      <span class="ml-auto text-xs text-slate-500" aria-live="polite">{{ ordenados.length }} de {{ usuarios.length }} usuário(s)</span>
    </div>

    <p v-if="!usuarios.length" class="py-10 text-center text-sm text-slate-500">Sem dados por usuário no período.</p>

    <div v-else class="mt-4 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <!-- Lista -->
      <div class="flex flex-col">
      <div class="overflow-x-auto rounded-xl ring-1 ring-slate-200">
        <table class="w-full text-xs">
          <thead class="sticky top-0 bg-slate-50 text-slate-500">
            <tr>
              <th v-for="c in COLUNAS" :key="c.chave" scope="col" class="px-3 py-2 font-semibold" :class="c.alinhamento === 'right' ? 'text-right' : 'text-left'"
                :aria-sort="ordem.coluna === c.chave ? (ordem.direcao === 'asc' ? 'ascending' : 'descending') : 'none'">
                <button type="button" class="inline-flex items-center gap-1 hover:text-blue-600" @click="ordenar(c.chave)">{{ c.titulo }} <i :class="['fas text-[10px]', iconeOrdem(c.chave)]" aria-hidden="true"></i></button>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-50">
            <tr v-for="u in paginaAtual" :key="u.usuario" class="cursor-pointer" :class="u.usuario === selecionado ? 'bg-blue-50' : 'hover:bg-slate-50'"
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
        <p v-if="!ordenados.length" class="py-8 text-center text-xs text-slate-500">Nenhum usuário com esses filtros.</p>
      </div>
      <div v-if="totalPaginas > 1" class="mt-2 flex items-center justify-between text-xs text-slate-500">
        <span>Página {{ pagina }} de {{ totalPaginas }}</span>
        <div class="flex gap-1">
          <button type="button" class="ui-btn-secondary px-2.5 py-1.5" :disabled="pagina === 1" aria-label="Primeira página" @click="pagina = 1"><i class="fas fa-angles-left"></i></button>
          <button type="button" class="ui-btn-secondary px-2.5 py-1.5" :disabled="pagina === 1" aria-label="Página anterior" @click="pagina--"><i class="fas fa-angle-left"></i></button>
          <button type="button" class="ui-btn-secondary px-2.5 py-1.5" :disabled="pagina === totalPaginas" aria-label="Próxima página" @click="pagina++"><i class="fas fa-angle-right"></i></button>
          <button type="button" class="ui-btn-secondary px-2.5 py-1.5" :disabled="pagina === totalPaginas" aria-label="Última página" @click="pagina = totalPaginas"><i class="fas fa-angles-right"></i></button>
        </div>
      </div>
      </div>

      <!-- Gráfico -->
      <div v-if="atual" class="rounded-xl bg-slate-50 p-4">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <p class="font-bold text-slate-900">{{ rotuloUsuario(atual.usuario) }}</p>
          <p class="text-xs text-slate-500">{{ atual.auditorias }} auditoria(s) · {{ atual.leituras.toLocaleString('pt-BR') }} leituras</p>
        </div>
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
    </div>
  </section>
</template>
