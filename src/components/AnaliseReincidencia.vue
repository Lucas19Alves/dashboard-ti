<script setup>
import { computed, ref } from 'vue'
import MapaLoja from './MapaLoja.vue'
import UiModal from './ui/UiModal.vue'
import UiTabela from './ui/UiTabela.vue'
import UiListaItens from './ui/UiListaItens.vue'
import { mapaReincidencia, reincidenciaLocais, reincidenciaProdutos } from '../utils/historicoAuditorias'
import { META_PENDENTE_PERCENTUAL } from '../utils/metricasAuditoria'
import { TIPOS_AREA, interpretarLocal } from '../utils/mapaLoja'
import { formatarDataBR } from '../utils/busca'

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

// ---------- Tabela de locais (tabela padrão: busca, filtros, ordem, paginação, CSV) ----------
const COLUNAS_LOCAIS = [
  { chave: 'local', titulo: 'Local', tipo: 'texto' },
  { chave: 'tipoArea', titulo: 'Tipo de área', tipo: 'categoria', rapido: true, oculta: true },
  { chave: 'situacao', titulo: 'Situação', tipo: 'categoria', rapido: true, badge: v => CLASSE_SITUACAO[v] },
  { chave: 'foraMeta', titulo: 'Fora da meta', tipo: 'numero', formato: (v, l) => `${v} / ${l.auditorias}` },
  { chave: 'auditorias', titulo: 'Auditorias', tipo: 'numero', oculta: true },
  { chave: 'taxaFora', titulo: '% fora', tipo: 'numero', formato: v => `${v.toFixed(0)}%` },
  { chave: 'sequencia', titulo: 'Seguidas', tipo: 'numero' },
  { chave: 'percMedio', titulo: '% pendente médio', tipo: 'numero', formato: v => `${v.toFixed(2)}%` },
  { chave: 'historico', titulo: 'Histórico', tipo: 'texto', ordenavel: false, filtravel: false, busca: false, valor: () => '' },
  { chave: 'ultimaData', titulo: 'Última', tipo: 'data' }
]
const ATALHOS_LOCAIS = [
  { rotulo: 'Fora em 2+ auditorias', icone: 'fas fa-repeat', condicoes: [{ chave: 'foraMeta', op: 'maiorIgual', valor: '2' }] },
  { rotulo: 'Em sequência', icone: 'fas fa-fire', condicoes: [{ chave: 'situacao', op: 'em', valor: ['Em sequência'] }] },
  { rotulo: 'Mais da metade fora', icone: 'fas fa-percent', condicoes: [{ chave: 'taxaFora', op: 'maior', valor: '50' }] }
]

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
        <p class="text-xs font-semibold text-slate-500">Locais analisados</p>
        <p class="mt-1 text-2xl font-black text-slate-900">{{ locais.length.toLocaleString('pt-BR') }}</p>
        <p class="text-xs text-slate-500">em {{ auditorias.length }} auditoria(s)</p>
      </div>
      <div class="ui-card p-4">
        <p class="text-xs font-semibold text-slate-500">Crônicos</p>
        <p class="mt-1 text-2xl font-black" :class="cronicos.length ? 'text-red-700' : 'text-slate-900'">{{ cronicos.length.toLocaleString('pt-BR') }}</p>
        <p class="text-xs text-slate-500">fora da meta em 2+ auditorias</p>
      </div>
      <div class="ui-card p-4">
        <p class="text-xs font-semibold text-slate-500">Em sequência</p>
        <p class="mt-1 text-2xl font-black" :class="emSequencia ? 'text-red-700' : 'text-slate-900'">{{ emSequencia }}</p>
        <p class="text-xs text-slate-500">3+ auditorias seguidas fora (recentes)</p>
      </div>
      <div class="ui-card p-4">
        <p class="text-xs font-semibold text-slate-500">Produtos reincidentes</p>
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
          <p class="text-xs text-slate-500">A faixa mostra as últimas auditorias (vermelho = fora da meta).</p>
        </div>
      </div>

      <div class="mt-4">
        <UiTabela id="reincidencia-locais" titulo="Locais reincidentes" :itens="locais" :colunas="COLUNAS_LOCAIS" :atalhos="ATALHOS_LOCAIS" :filtros-iniciais="[{ chave: 'foraMeta', op: 'maiorIgual', valor: '2' }]" :ordem-inicial="[{ chave: 'foraMeta', direcao: 'desc' }, { chave: 'taxaFora', direcao: 'desc' }]" chave-item="chave" :agrupavel="true" vazio="Nenhum local no período.">
          <template #celula-local="{ item: l }"><p class="font-bold text-slate-900">{{ l.local }}</p><p class="text-[11px] font-normal text-slate-500">{{ l.tipoArea }}</p></template>
          <template #celula-taxaFora="{ item: l, texto }"><span class="font-bold" :class="l.taxaFora > 50 ? 'text-red-700' : l.taxaFora > 25 ? 'text-amber-700' : 'text-emerald-700'">{{ texto }}</span></template>
          <template #celula-sequencia="{ item: l }"><span class="rounded-full px-2 py-0.5 text-xs font-bold" :class="l.sequencia >= 3 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'">{{ l.sequencia }}</span></template>
          <template #celula-historico="{ item: l }">
            <div class="flex gap-0.5" :aria-label="`Histórico de ${l.local}`">
              <span v-for="(h, i) in l.historico" :key="i" class="h-4 w-2 rounded-sm" :class="h.fora ? 'bg-red-500' : 'bg-emerald-400'" :title="`${formatarDataBR(h.data)}: ${h.perc.toFixed(1)}%`"></span>
            </div>
          </template>
        </UiTabela>
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
