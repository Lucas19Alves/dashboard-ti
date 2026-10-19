<script setup>
import { computed, ref } from 'vue'
import MapaLoja from './MapaLoja.vue'
import UiListaItens from './ui/UiListaItens.vue'
import { mapaReincidencia, reincidenciaLocais, reincidenciaProdutos } from '../utils/historicoAuditorias'
import { META_PENDENTE_PERCENTUAL } from '../utils/metricasAuditoria'
import { formatarDataBR } from '../utils/busca'
import { baixarCsv } from '../utils/csv'

// Reincidência no período: locais que ficam fora da meta auditoria após auditoria,
// mapa de calor dessas ocorrências e produtos que se repetem nos pendentes.
const props = defineProps({
  auditorias: { type: Array, required: true }
})
const META = META_PENDENTE_PERCENTUAL

const locais = computed(() => reincidenciaLocais(props.auditorias))
const cronicos = computed(() => locais.value.filter(l => l.foraMeta >= 2))
const emSequencia = computed(() => locais.value.filter(l => l.sequencia >= 3).length)
const produtos = computed(() => reincidenciaProdutos(props.auditorias))
const mapa = computed(() => mapaReincidencia(props.auditorias))
const metricaMapa = { meta: 25, rotulo: '% fora da meta', curto: 'das auditorias fora da meta', pendentes: 'fora da meta', lidos: 'na meta' }

const minimo = ref(2)
const listaLocais = computed(() => locais.value.filter(l => l.foraMeta >= minimo.value))
const pagina = ref(1)
const POR_PAGINA = 15
const paginaLocais = computed(() => listaLocais.value.slice((pagina.value - 1) * POR_PAGINA, pagina.value * POR_PAGINA))
const totalPaginas = computed(() => Math.max(1, Math.ceil(listaLocais.value.length / POR_PAGINA)))

const exportarLocais = () => baixarCsv(listaLocais.value.map(l => ({ ...l, taxaFora: l.taxaFora.toFixed(1).replace('.', ','), percMedio: l.percMedio.toFixed(2).replace('.', ',') })), [
  { chave: 'local', titulo: 'Local' }, { chave: 'auditorias', titulo: 'Auditorias' }, { chave: 'foraMeta', titulo: 'Fora da meta' },
  { chave: 'taxaFora', titulo: '% fora da meta' }, { chave: 'sequencia', titulo: 'Seguidas fora (recentes)' }, { chave: 'percMedio', titulo: '% pendente médio' }, { chave: 'ultimaData', titulo: 'Última auditoria' }
], 'reincidencia-locais')

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
        <p class="text-xs text-slate-500">Cada local conta uma vez por auditoria. Cor = % dessas ocorrências que ficaram acima da meta de {{ META }}% (verde até 25%, amarelo até 50%, vermelho acima).</p>
      </div>
      <MapaLoja :auditoria="mapa" :is-item-lido="() => true" :itens-disponiveis="false" :metrica="metricaMapa" />
    </section>

    <!-- Locais crônicos -->
    <section class="ui-card p-5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-base font-bold text-slate-900">Locais reincidentes</h2>
          <p class="text-xs text-slate-500">Ordenados pelo número de auditorias fora da meta. A faixa mostra as últimas auditorias (vermelho = fora).</p>
        </div>
        <div class="flex items-center gap-2">
          <label class="text-xs font-semibold text-slate-600" for="minimo-reincidencia">Fora da meta em pelo menos</label>
          <select id="minimo-reincidencia" v-model.number="minimo" class="ui-input w-auto py-1.5 text-xs" @change="pagina = 1">
            <option v-for="n in [1, 2, 3, 4, 5]" :key="n" :value="n">{{ n }} auditoria(s)</option>
          </select>
          <button type="button" class="ui-btn-secondary py-1.5 text-xs" @click="exportarLocais"><i class="fas fa-file-csv"></i>CSV</button>
        </div>
      </div>
      <div class="mt-4 overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="text-xs text-slate-500">
            <tr class="border-b-2 border-slate-100">
              <th scope="col" class="px-3 py-2 text-left font-semibold">Local</th>
              <th scope="col" class="px-3 py-2 text-right font-semibold">Fora / auditorias</th>
              <th scope="col" class="px-3 py-2 text-right font-semibold">% fora</th>
              <th scope="col" class="px-3 py-2 text-right font-semibold">Seguidas</th>
              <th scope="col" class="px-3 py-2 text-right font-semibold">% pendente médio</th>
              <th scope="col" class="px-3 py-2 text-left font-semibold">Histórico</th>
              <th scope="col" class="px-3 py-2 text-right font-semibold">Última</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-50">
            <tr v-for="l in paginaLocais" :key="l.local">
              <td class="px-3 py-2 font-bold text-slate-900">{{ l.local }}</td>
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
        <p v-if="!listaLocais.length" class="py-8 text-center text-sm text-slate-500">Nenhum local com essa reincidência no período.</p>
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
  </div>
</template>
