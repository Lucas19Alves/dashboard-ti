<script setup>
import { computed, ref, watch } from 'vue'
import UiListaItens from './ui/UiListaItens.vue'
import { rupturaEmValor } from '../utils/historicoAuditorias'
import { rotuloMes } from '../utils/analiseHistorica'
import { baixarCsv } from '../utils/csv'

// Ruptura em valor: soma do "Custo Ruptura" dos itens sem presença, por fornecedor, setor e mês.
const props = defineProps({
  auditorias: { type: Array, required: true }
})

const tiposDisponiveis = computed(() => ['Ruptura', 'Presença'].filter(t => props.auditorias.some(a => a.tipo === t)))
// Ruptura é o resultado final (após recuperação); Presença mostra a ruptura inicial.
const base = ref('Ruptura')
watch(tiposDisponiveis, (tipos) => { if (!tipos.includes(base.value)) base.value = tipos[0] || 'Ruptura' }, { immediate: true })
const lista = computed(() => props.auditorias.filter(a => a.tipo === base.value))
const r = computed(() => rupturaEmValor(lista.value))

const moeda = v => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const maiorMes = computed(() => Math.max(1, ...r.value.meses.map(m => m.valor)))
const media = computed(() => (lista.value.length ? r.value.total / lista.value.length : 0))
const rotuloTendencia = { subindo: ['Subindo', 'text-red-700', 'fa-arrow-trend-up'], caindo: ['Caindo', 'text-emerald-700', 'fa-arrow-trend-down'], estavel: ['Estável', 'text-slate-700', 'fa-minus'], indefinida: ['Poucos meses', 'text-slate-500', 'fa-minus'] }

const colunasRanking = [
  { chave: 'chave', titulo: 'Nome', largura: 'max-w-80' },
  { chave: 'valor', titulo: 'Valor (R$)', alinhamento: 'right', valor: x => Math.round(x.valor * 100) / 100, formato: v => moeda(v) },
  { chave: 'itens', titulo: 'Itens', alinhamento: 'right' },
  { chave: 'participacao', titulo: '% do total', alinhamento: 'right', valor: x => Math.round(x.participacao * 10) / 10, formato: v => `${v.toLocaleString('pt-BR')}%` }
]
const colunasProdutos = [
  { chave: 'chave', titulo: 'Código' },
  { chave: 'produto', titulo: 'Produto', largura: 'max-w-72' },
  { chave: 'fornecedor', titulo: 'Fornecedor', largura: 'max-w-56' },
  { chave: 'itens', titulo: 'Vezes', alinhamento: 'right' },
  { chave: 'valor', titulo: 'Valor (R$)', alinhamento: 'right', valor: x => Math.round(x.valor * 100) / 100, formato: v => moeda(v) }
]
const visao = ref('fornecedor')
const exportarMeses = () => baixarCsv(r.value.meses.map(m => ({ mes: rotuloMes(m.chave), valor: m.valor.toFixed(2).replace('.', ','), auditorias: m.auditorias, media: m.mediaPorAuditoria.toFixed(2).replace('.', ',') })),
  [{ chave: 'mes', titulo: 'Mês' }, { chave: 'valor', titulo: 'Valor (R$)' }, { chave: 'auditorias', titulo: 'Auditorias' }, { chave: 'media', titulo: 'Média por auditoria (R$)' }], `ruptura-valor-${base.value.toLowerCase()}`)
</script>

<template>
  <div class="space-y-5">
    <div v-if="!tiposDisponiveis.length" class="ui-card px-6 py-14 text-center">
      <i class="fas fa-sack-dollar text-3xl text-slate-300"></i>
      <p class="mt-3 font-semibold text-slate-700">Sem auditorias de Presença ou Ruptura no período</p>
      <p class="mt-1 text-sm text-slate-500">O valor vem da coluna "Custo Ruptura" dessas planilhas.</p>
    </div>

    <template v-else>
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-xs font-semibold text-slate-600">Base:</span>
        <div class="flex rounded-xl bg-slate-100 p-1 text-sm" role="group" aria-label="Base do valor">
          <button v-for="t in tiposDisponiveis" :key="t" type="button" class="rounded-lg px-3 py-1.5 font-semibold" :class="base === t ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'" :aria-pressed="base === t" @click="base = t">
            {{ t === 'Ruptura' ? 'Ruptura final' : 'Presença (inicial)' }}
          </button>
        </div>
        <span class="text-xs text-slate-500">{{ lista.length }} auditoria(s)</span>
      </div>

      <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div class="ui-card p-4">
          <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Valor em ruptura</p>
          <p class="mt-1 text-2xl font-black text-red-700">{{ moeda(r.total) }}</p>
          <p class="text-xs text-slate-500">soma no período</p>
        </div>
        <div class="ui-card p-4">
          <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Média por auditoria</p>
          <p class="mt-1 text-2xl font-black text-slate-900">{{ moeda(media) }}</p>
          <p class="text-xs text-slate-500">{{ r.itens.toLocaleString('pt-BR') }} itens com custo</p>
        </div>
        <div class="ui-card p-4">
          <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Maior fornecedor</p>
          <p class="mt-1 truncate text-lg font-black text-slate-900" :title="r.porFornecedor[0]?.chave">{{ r.porFornecedor[0]?.chave || '—' }}</p>
          <p class="text-xs text-slate-500">{{ r.porFornecedor[0] ? `${moeda(r.porFornecedor[0].valor)} · ${r.porFornecedor[0].participacao.toFixed(1)}%` : '' }}</p>
        </div>
        <div class="ui-card p-4">
          <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Tendência mensal</p>
          <p class="mt-1 text-2xl font-black" :class="rotuloTendencia[r.tendencia][1]"><i :class="['fas', rotuloTendencia[r.tendencia][2], 'mr-1 text-lg']"></i>{{ rotuloTendencia[r.tendencia][0] }}</p>
          <p class="text-xs text-slate-500">média por auditoria, mês a mês</p>
        </div>
      </div>

      <!-- Por mês -->
      <section class="ui-card p-5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-base font-bold text-slate-900">Valor em ruptura por mês</h2>
          <button type="button" class="ui-btn-secondary py-1.5 text-xs" @click="exportarMeses"><i class="fas fa-file-csv"></i>CSV</button>
        </div>
        <p v-if="!r.meses.length" class="py-8 text-center text-sm text-slate-500">Sem valores no período.</p>
        <div v-else class="mt-4 flex h-56 items-end gap-2">
          <div v-for="m in r.meses" :key="m.chave" class="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <span class="text-[11px] font-bold text-slate-700">{{ m.valor >= 1000 ? `${(m.valor / 1000).toFixed(1).replace('.', ',')} mil` : Math.round(m.valor) }}</span>
            <span class="w-full max-w-16 rounded-t-lg bg-red-400 transition group-hover:bg-red-500" :style="{ height: `${(m.valor / maiorMes) * 80}%`, minHeight: m.valor ? '3px' : '0' }" :title="`${rotuloMes(m.chave)}: ${moeda(m.valor)} em ${m.auditorias} auditoria(s) · média ${moeda(m.mediaPorAuditoria)}`"></span>
            <span class="truncate text-[11px] font-semibold text-slate-500">{{ rotuloMes(m.chave) }}</span>
          </div>
        </div>
      </section>

      <!-- Rankings -->
      <section class="ui-card p-5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-base font-bold text-slate-900">Onde está o valor</h2>
          <div class="flex rounded-xl bg-slate-100 p-1 text-xs" role="tablist" aria-label="Agrupar por">
            <button v-for="[v, rot] in [['fornecedor', 'Fornecedor'], ['setor', 'Setor'], ['produto', 'Produto']]" :key="v" type="button" role="tab" :aria-selected="visao === v"
              class="rounded-lg px-3 py-1.5 font-semibold" :class="visao === v ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'" @click="visao = v">{{ rot }}</button>
          </div>
        </div>
        <div v-if="visao !== 'produto'" class="mt-4 space-y-2">
          <div v-for="x in (visao === 'fornecedor' ? r.porFornecedor : r.porSetor).slice(0, 12)" :key="x.chave" class="grid grid-cols-[minmax(0,14rem)_1fr_auto] items-center gap-3 text-sm">
            <span class="truncate font-semibold text-slate-800" :title="x.chave">{{ x.chave }}</span>
            <span class="h-3 rounded-full bg-slate-100"><span class="block h-full rounded-full bg-red-400" :style="{ width: `${x.participacao}%` }"></span></span>
            <span class="w-40 text-right tabular-nums"><b class="text-slate-900">{{ moeda(x.valor) }}</b> <span class="text-xs text-slate-500">{{ x.participacao.toFixed(1) }}%</span></span>
          </div>
        </div>
        <div class="mt-5">
          <UiListaItens v-if="visao === 'fornecedor'" :itens="r.porFornecedor" :colunas="colunasRanking" titulo="Ruptura por fornecedor" :ordem-inicial="{ chave: 'valor', direcao: 'desc' }" />
          <UiListaItens v-else-if="visao === 'setor'" :itens="r.porSetor" :colunas="colunasRanking" titulo="Ruptura por setor" :ordem-inicial="{ chave: 'valor', direcao: 'desc' }" />
          <UiListaItens v-else :itens="r.porProduto" :colunas="colunasProdutos" titulo="Produtos com maior valor em ruptura" :ordem-inicial="{ chave: 'valor', direcao: 'desc' }" />
        </div>
      </section>
    </template>
  </div>
</template>
