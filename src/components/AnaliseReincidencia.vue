<script setup>
import { computed, ref, watch } from 'vue'
import MapaLoja from './MapaLoja.vue'
import UiModal from './ui/UiModal.vue'
import UiListaItens from './ui/UiListaItens.vue'
import { mapaReincidencia, reincidenciaLocais, reincidenciaProdutos } from '../utils/historicoAuditorias'
import { META_PENDENTE_PERCENTUAL } from '../utils/metricasAuditoria'
import { TIPOS_AREA, interpretarLocal } from '../utils/mapaLoja'
import { correspondeBusca, formatarDataBR } from '../utils/busca'
import { baixarCsv } from '../utils/csv'

// Reincidência no período: locais que ficam fora da meta auditoria após auditoria,
// mapa de calor dessas ocorrências e produtos que se repetem nos pendentes.
const props = defineProps({
  auditorias: { type: Array, required: true }
})
const META = META_PENDENTE_PERCENTUAL

// Situação do local no período (mesma régua do mapa).
const situacao = l => (l.sequencia >= 3 ? 'Em sequência' : l.foraMeta >= 2 ? 'Crônico' : l.foraMeta === 1 ? 'Pontual' : 'Na meta')
const CLASSE_SITUACAO = { 'Em sequência': 'bg-red-100 text-red-700', Crônico: 'bg-orange-100 text-orange-800', Pontual: 'bg-amber-50 text-amber-800', 'Na meta': 'bg-emerald-50 text-emerald-700' }
const tipoArea = l => TIPOS_AREA[interpretarLocal(l.chave).tipo]?.nome || 'Outro local'

const locais = computed(() => reincidenciaLocais(props.auditorias).map(l => ({ ...l, situacao: situacao(l), tipoArea: tipoArea(l) })))
const cronicos = computed(() => locais.value.filter(l => l.foraMeta >= 2))
const emSequencia = computed(() => locais.value.filter(l => l.sequencia >= 3).length)
const produtos = computed(() => reincidenciaProdutos(props.auditorias))
const mapa = computed(() => mapaReincidencia(props.auditorias))

// ---------- Mapa: % das ocorrências (local × auditoria) fora da meta ----------
const percFora = d => { const t = (d?.pendentes || 0) + (d?.lidos || 0); return t ? ((d.pendentes || 0) / t) * 100 : null }
const pintura = {
  rotulo: '% fora da meta',
  icone: 'fas fa-fire',
  semItens: 'Sem auditorias neste local',
  botao: 'Ver locais da área',
  botaoIcone: 'fas fa-table-list',
  classe: (d) => {
    const p = percFora(d)
    if (p === null) return 'bg-slate-100 text-slate-400'
    return p > 50 ? 'bg-red-500 text-white' : p > 25 ? 'bg-amber-400 text-amber-950' : p > 0 ? 'bg-emerald-200 text-emerald-900' : 'bg-emerald-500 text-white'
  },
  texto: d => { const p = percFora(d); return p === null ? '' : `${p.toFixed(0)}%` },
  dica: d => { const p = percFora(d); return p === null ? 'Sem auditorias' : `${d.pendentes} de ${d.pendentes + d.lidos} ocorrência(s) fora da meta (${p.toFixed(0)}%)` },
  resumo: d => [
    { rotulo: 'fora da meta', valor: d.pendentes || 0, classe: 'bg-red-50 text-red-700' },
    { rotulo: 'na meta', valor: d.lidos || 0, classe: 'bg-emerald-50 text-emerald-700' },
    { rotulo: '% fora', valor: percFora(d) === null ? '—' : `${percFora(d).toFixed(0)}%`, classe: percFora(d) > 50 ? 'bg-red-50 text-red-700' : percFora(d) > 25 ? 'bg-amber-50 text-amber-800' : 'bg-slate-50 text-slate-700' }
  ],
  colunasFace: [
    { rotulo: 'Fora', valor: d => d.pendentes || 0, classe: 'text-red-700 font-bold' },
    { rotulo: 'Na meta', valor: d => d.lidos || 0, classe: 'text-emerald-700' },
    { rotulo: '% fora', valor: d => (percFora(d) === null ? '—' : `${percFora(d).toFixed(0)}%`), classe: 'font-bold' }
  ],
  legenda: [
    { classe: 'bg-emerald-500', rotulo: 'Sempre na meta' },
    { classe: 'bg-emerald-200', rotulo: 'Até 25%' },
    { classe: 'bg-amber-400', rotulo: '25–50%' },
    { classe: 'bg-red-500', rotulo: 'Acima de 50%' }
  ]
}
// Painel da área: locais da área, do mais reincidente ao menos.
const locaisDaArea = area => mapa.value.dados
  .filter(l => area.locais.has(l.Local) || interpretarLocal(l.Local).bloco === area.bloco)
  .sort((a, b) => b.foraMeta - a.foraMeta || b.taxaFora - a.taxaFora)

const modal = ref(null) // { local, itens }
const abrirLocais = ({ local, itens }) => { modal.value = { local, itens: itens.map(l => ({ ...l, situacao: situacao(l), tipoArea: tipoArea(l) })) } }

// ---------- Tabela de locais: busca, filtros e ordenação ----------
const busca = ref('')
const minimo = ref(2)
const filtroSituacao = ref('')
const filtroTipo = ref('')
const tiposDisponiveis = computed(() => [...new Set(locais.value.map(l => l.tipoArea))].sort())
const SITUACOES = ['Em sequência', 'Crônico', 'Pontual', 'Na meta']
const ordem = ref({ chave: 'foraMeta', direcao: 'desc' })
const ordenar = (chave) => {
  ordem.value = ordem.value.chave === chave ? { chave, direcao: ordem.value.direcao === 'desc' ? 'asc' : 'desc' } : { chave, direcao: chave === 'local' ? 'asc' : 'desc' }
}
const iconeOrdem = chave => (ordem.value.chave !== chave ? 'fas fa-sort text-slate-300' : ordem.value.direcao === 'desc' ? 'fas fa-sort-down text-blue-600' : 'fas fa-sort-up text-blue-600')
const listaLocais = computed(() => {
  const { chave, direcao } = ordem.value
  const fator = direcao === 'desc' ? -1 : 1
  return locais.value
    .filter(l => l.foraMeta >= minimo.value)
    .filter(l => !filtroSituacao.value || l.situacao === filtroSituacao.value)
    .filter(l => !filtroTipo.value || l.tipoArea === filtroTipo.value)
    .filter(l => correspondeBusca(busca.value, [l.local, l.chave, l.tipoArea, l.situacao]))
    .sort((a, b) => {
      const va = a[chave]; const vb = b[chave]
      const r = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va ?? '').localeCompare(String(vb ?? ''), 'pt-BR', { numeric: true })
      return r * fator || b.foraMeta - a.foraMeta || String(a.local).localeCompare(String(b.local), 'pt-BR', { numeric: true })
    })
})
const filtrosAtivos = computed(() => Boolean(busca.value || filtroSituacao.value || filtroTipo.value || minimo.value !== 2))
const limparFiltros = () => { busca.value = ''; filtroSituacao.value = ''; filtroTipo.value = ''; minimo.value = 2 }
const pagina = ref(1)
const POR_PAGINA = 15
watch([busca, minimo, filtroSituacao, filtroTipo, ordem], () => { pagina.value = 1 })
const paginaLocais = computed(() => listaLocais.value.slice((pagina.value - 1) * POR_PAGINA, pagina.value * POR_PAGINA))
const totalPaginas = computed(() => Math.max(1, Math.ceil(listaLocais.value.length / POR_PAGINA)))
const COLUNAS_TABELA = [
  { chave: 'local', titulo: 'Local', alinhar: 'left' },
  { chave: 'situacao', titulo: 'Situação', alinhar: 'left' },
  { chave: 'foraMeta', titulo: 'Fora / auditorias', alinhar: 'right' },
  { chave: 'taxaFora', titulo: '% fora', alinhar: 'right' },
  { chave: 'sequencia', titulo: 'Seguidas', alinhar: 'right' },
  { chave: 'percMedio', titulo: '% pendente médio', alinhar: 'right' },
  { chave: null, titulo: 'Histórico', alinhar: 'left' },
  { chave: 'ultimaData', titulo: 'Última', alinhar: 'right' }
]

const exportarLocais = () => baixarCsv(listaLocais.value.map(l => ({ ...l, taxaFora: l.taxaFora.toFixed(1).replace('.', ','), percMedio: l.percMedio.toFixed(2).replace('.', ',') })), [
  { chave: 'local', titulo: 'Local' }, { chave: 'tipoArea', titulo: 'Tipo de área' }, { chave: 'situacao', titulo: 'Situação' }, { chave: 'auditorias', titulo: 'Auditorias' }, { chave: 'foraMeta', titulo: 'Fora da meta' },
  { chave: 'taxaFora', titulo: '% fora da meta' }, { chave: 'sequencia', titulo: 'Seguidas fora (recentes)' }, { chave: 'percMedio', titulo: '% pendente médio' }, { chave: 'ultimaData', titulo: 'Última auditoria' }
], 'reincidencia-locais')

const colunasModal = [
  { chave: 'local', titulo: 'Local' },
  { chave: 'situacao', titulo: 'Situação', alinhamento: 'center', badge: v => CLASSE_SITUACAO[v] },
  { chave: 'foraMeta', titulo: 'Fora da meta', alinhamento: 'right' },
  { chave: 'auditorias', titulo: 'Auditorias', alinhamento: 'right' },
  { chave: 'taxaFora', titulo: '% fora', alinhamento: 'right', valor: l => Math.round(l.taxaFora * 10) / 10, formato: v => `${String(v).replace('.', ',')}%` },
  { chave: 'sequencia', titulo: 'Seguidas', alinhamento: 'right' },
  { chave: 'percMedio', titulo: '% pend. médio', alinhamento: 'right', valor: l => Math.round(l.percMedio * 100) / 100, formato: v => `${String(v).replace('.', ',')}%` },
  { chave: 'ultimaData', titulo: 'Última', formato: v => formatarDataBR(v) }
]

const colunasProdutos = [
  { chave: 'codigo', titulo: 'Código' },
  { chave: 'produto', titulo: 'Produto', largura: 'max-w-72' },
  { chave: 'setor', titulo: 'Setor', largura: 'max-w-44' },
  { chave: 'local', titulo: 'Último local' },
  { chave: 'vezes', titulo: 'Vezes pendente', alinhamento: 'right' },
  { chave: 'ultimaData', titulo: 'Última', valor: p => formatarDataBR(p.ultimaData) }
]
const facetasProdutos = [{ chave: 'setor', titulo: 'Setor' }, { chave: 'vezes', titulo: 'Vezes' }]
</script>

<template>
  <div class="space-y-5">
    <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
      <div class="ui-card p-4">
        <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Locais analisados</p>
        <p class="mt-1 text-2xl font-black text-slate-900">{{ locais.length.toLocaleString('pt-BR') }}</p>
        <p class="text-xs text-slate-500">em {{ auditorias.length }} auditoria(s)</p>
      </div>
      <div class="ui-card p-4">
        <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Crônicos</p>
        <p class="mt-1 text-2xl font-black" :class="cronicos.length ? 'text-red-700' : 'text-slate-900'">{{ cronicos.length.toLocaleString('pt-BR') }}</p>
        <p class="text-xs text-slate-500">fora da meta em 2+ auditorias</p>
      </div>
      <div class="ui-card p-4">
        <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Em sequência</p>
        <p class="mt-1 text-2xl font-black" :class="emSequencia ? 'text-red-700' : 'text-slate-900'">{{ emSequencia }}</p>
        <p class="text-xs text-slate-500">3+ auditorias seguidas fora (recentes)</p>
      </div>
      <div class="ui-card p-4">
        <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Produtos reincidentes</p>
        <p class="mt-1 text-2xl font-black text-slate-900">{{ produtos.length.toLocaleString('pt-BR') }}</p>
        <p class="text-xs text-slate-500">pendentes em 2+ auditorias</p>
      </div>
    </div>

    <!-- Mapa de calor da reincidência -->
    <section class="space-y-2">
      <div>
        <h2 class="text-base font-bold text-slate-900"><i class="fas fa-fire mr-2 text-red-500"></i>Onde a auditoria mais trava</h2>
        <p class="text-xs text-slate-500">Cada local conta uma vez por auditoria. Cor e número = % dessas ocorrências acima da meta de {{ META }}%. Clique numa área para ver os locais e o histórico de cada um.</p>
      </div>
      <MapaLoja :auditoria="mapa" :is-item-lido="() => false" :itens-disponiveis="true" :modos="['pendente']" :laterais="false" :pintura="pintura" @ver-itens="abrirLocais">
        <template #area="{ area }">
          <div v-if="locaisDaArea(area).length" class="mt-4">
            <p class="text-xs font-bold text-slate-700">Locais desta área</p>
            <ul class="mt-2 space-y-2">
              <li v-for="l in locaisDaArea(area).slice(0, 6)" :key="l.Local" class="text-xs">
                <div class="flex items-center justify-between gap-2">
                  <span class="truncate font-semibold text-slate-800">{{ l.local }}</span>
                  <span class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" :class="CLASSE_SITUACAO[situacao(l)]">{{ situacao(l) }}</span>
                  <span class="w-12 shrink-0 text-right font-bold tabular-nums" :class="l.foraMeta ? 'text-red-700' : 'text-emerald-700'">{{ l.foraMeta }}/{{ l.auditorias }}</span>
                </div>
                <div class="mt-1 flex gap-0.5" :aria-label="`Histórico de ${l.local}`">
                  <span v-for="(h, i) in l.historico" :key="i" class="h-2.5 flex-1 rounded-sm" :class="h.fora ? 'bg-red-500' : 'bg-emerald-400'" :title="`${formatarDataBR(h.data)}: ${h.perc.toFixed(1)}%`"></span>
                </div>
              </li>
            </ul>
            <p v-if="locaisDaArea(area).length > 6" class="mt-2 text-[11px] text-slate-500">+ {{ locaisDaArea(area).length - 6 }} local(is)</p>
          </div>
        </template>
      </MapaLoja>
    </section>

    <!-- Locais reincidentes -->
    <section class="ui-card p-5">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-base font-bold text-slate-900">Locais reincidentes</h2>
          <p class="text-xs text-slate-500">Clique no título da coluna para ordenar. A faixa mostra as últimas auditorias (vermelho = fora da meta).</p>
        </div>
        <button type="button" class="ui-btn-secondary py-1.5 text-xs" :disabled="!listaLocais.length" @click="exportarLocais"><i class="fas fa-file-csv"></i>CSV</button>
      </div>

      <div class="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_auto]">
        <label class="relative block">
          <span class="sr-only">Buscar local</span>
          <i class="fas fa-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" aria-hidden="true"></i>
          <input v-model="busca" type="search" class="ui-input py-2 pl-8 text-sm" placeholder="Buscar local, área ou situação...">
        </label>
        <label class="block">
          <span class="sr-only">Situação</span>
          <select v-model="filtroSituacao" class="ui-input py-2 text-sm">
            <option value="">Todas as situações</option>
            <option v-for="s in SITUACOES" :key="s" :value="s">{{ s }}</option>
          </select>
        </label>
        <label class="block">
          <span class="sr-only">Tipo de área</span>
          <select v-model="filtroTipo" class="ui-input py-2 text-sm">
            <option value="">Todos os tipos de área</option>
            <option v-for="t in tiposDisponiveis" :key="t" :value="t">{{ t }}</option>
          </select>
        </label>
        <label class="block">
          <span class="sr-only">Fora da meta em pelo menos</span>
          <select v-model.number="minimo" class="ui-input py-2 text-sm">
            <option :value="0">Todos os locais</option>
            <option v-for="n in [1, 2, 3, 4, 5]" :key="n" :value="n">Fora em {{ n }}+ auditoria(s)</option>
          </select>
        </label>
        <button type="button" class="ui-btn-secondary py-2 text-xs" :disabled="!filtrosAtivos" @click="limparFiltros"><i class="fas fa-filter-circle-xmark"></i>Limpar</button>
      </div>
      <p class="mt-2 text-xs text-slate-500">{{ listaLocais.length.toLocaleString('pt-BR') }} de {{ locais.length.toLocaleString('pt-BR') }} locais</p>

      <div class="mt-2 overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="text-xs text-slate-500">
            <tr class="border-b-2 border-slate-100">
              <th v-for="c in COLUNAS_TABELA" :key="c.titulo" scope="col" class="px-3 py-2 font-semibold" :class="c.alinhar === 'right' ? 'text-right' : 'text-left'" :aria-sort="c.chave && ordem.chave === c.chave ? (ordem.direcao === 'desc' ? 'descending' : 'ascending') : undefined">
                <button v-if="c.chave" type="button" class="inline-flex items-center gap-1.5 hover:text-slate-800" @click="ordenar(c.chave)">{{ c.titulo }}<i :class="iconeOrdem(c.chave)" aria-hidden="true"></i></button>
                <template v-else>{{ c.titulo }}</template>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-50">
            <tr v-for="l in paginaLocais" :key="l.chave">
              <td class="px-3 py-2"><p class="font-bold text-slate-900">{{ l.local }}</p><p class="text-[11px] text-slate-500">{{ l.tipoArea }}</p></td>
              <td class="px-3 py-2"><span class="rounded-full px-2 py-0.5 text-xs font-bold" :class="CLASSE_SITUACAO[l.situacao]">{{ l.situacao }}</span></td>
              <td class="px-3 py-2 text-right tabular-nums">{{ l.foraMeta }} / {{ l.auditorias }}</td>
              <td class="px-3 py-2 text-right font-bold tabular-nums" :class="l.taxaFora > 50 ? 'text-red-700' : l.taxaFora > 25 ? 'text-amber-700' : 'text-emerald-700'">{{ l.taxaFora.toFixed(0) }}%</td>
              <td class="px-3 py-2 text-right"><span class="rounded-full px-2 py-0.5 text-xs font-bold" :class="l.sequencia >= 3 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'">{{ l.sequencia }}</span></td>
              <td class="px-3 py-2 text-right tabular-nums text-slate-600">{{ l.percMedio.toFixed(2) }}%</td>
              <td class="px-3 py-2">
                <div class="flex gap-0.5" :aria-label="`Histórico de ${l.local}`">
                  <span v-for="(h, i) in l.historico" :key="i" class="h-4 w-2 rounded-sm" :class="h.fora ? 'bg-red-500' : 'bg-emerald-400'" :title="`${formatarDataBR(h.data)}: ${h.perc.toFixed(1)}%`"></span>
                </div>
              </td>
              <td class="px-3 py-2 text-right text-xs text-slate-500">{{ formatarDataBR(l.ultimaData) }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="!listaLocais.length" class="py-8 text-center text-sm text-slate-500">Nenhum local com esses filtros.</p>
      </div>
      <div v-if="totalPaginas > 1" class="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
        <span>Página {{ pagina }} de {{ totalPaginas }}</span>
        <div class="flex gap-1">
          <button type="button" class="ui-btn-secondary px-3 py-1.5" :disabled="pagina === 1" aria-label="Página anterior" @click="pagina--"><i class="fas fa-angle-left"></i></button>
          <button type="button" class="ui-btn-secondary px-3 py-1.5" :disabled="pagina === totalPaginas" aria-label="Próxima página" @click="pagina++"><i class="fas fa-angle-right"></i></button>
        </div>
      </div>
    </section>

    <!-- Produtos -->
    <section class="ui-card p-5">
      <h2 class="text-base font-bold text-slate-900">Produtos que se repetem nos pendentes</h2>
      <p class="mb-3 text-xs text-slate-500">Mesmo código pendente em 2 ou mais auditorias do período.</p>
      <UiListaItens :itens="produtos" :colunas="colunasProdutos" :facetas="facetasProdutos" titulo="Produtos reincidentes" :ordem-inicial="{ chave: 'vezes', direcao: 'desc' }" />
    </section>

    <UiModal v-if="modal" :title="`Locais · ${modal.local}`" :subtitle="`${modal.itens.length} local(is) nesta área no período`" width="max-w-5xl" @close="modal = null">
      <UiListaItens :itens="modal.itens" :colunas="colunasModal" :facetas="[{ chave: 'situacao', titulo: 'Situação' }]" :titulo="`Reincidência · ${modal.local}`" :ordem-inicial="{ chave: 'foraMeta', direcao: 'desc' }" />
    </UiModal>
  </div>
</template>
