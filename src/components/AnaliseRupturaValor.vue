<script setup>
import { computed, ref, watch } from 'vue'
import UiTabela from './ui/UiTabela.vue'
import { rupturaEmValor } from '../utils/historicoAuditorias'
import { rotuloMes } from '../utils/analiseHistorica'

// Ruptura em valor: "Custo Ruptura" dos itens sem presença. Cada auditoria é uma foto do quanto estava
// faltando naquele dia; o histórico mostra as fotos, a média de cada mês e a última, sem somar semanas.
const props = defineProps({
  auditorias: { type: Array, required: true }
})

const tiposDisponiveis = computed(() => ['Ruptura', 'Presença'].filter(t => props.auditorias.some(a => a.tipo === t)))
// Ruptura é o resultado final (após recuperação); Presença mostra a ruptura inicial.
// Um tipo por vez: a Ruptura repete os pendentes da Presença da mesma semana.
const base = ref('Ruptura')
watch(tiposDisponiveis, (tipos) => { if (!tipos.includes(base.value)) base.value = tipos[0] || 'Ruptura' }, { immediate: true })
const lista = computed(() => props.auditorias.filter(a => a.tipo === base.value))
const r = computed(() => rupturaEmValor(lista.value))

const moeda = v => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const mil = v => (v >= 1000 ? `${(v / 1000).toFixed(1).replace('.', ',')} mil` : String(Math.round(v)))
const br = iso => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}` : '—')
const rotuloTendencia = { subindo: ['Subindo', 'text-red-700', 'fa-arrow-trend-up'], caindo: ['Caindo', 'text-emerald-700', 'fa-arrow-trend-down'], estavel: ['Estável', 'text-slate-700', 'fa-minus'], indefinida: ['Poucos meses', 'text-slate-500', 'fa-minus'] }

// Gráfico do mês: média das fotos do mês ou a última foto do mês.
const metricaMes = ref('valor')
const maiorMes = computed(() => Math.max(1, ...r.value.meses.map(m => m[metricaMes.value])))

const COLUNAS_MESES = [
  { chave: 'chave', titulo: 'Mês', tipo: 'texto', formato: v => rotuloMes(v) },
  { chave: 'valor', titulo: 'Média do mês', tipo: 'numero', formato: moeda },
  { chave: 'ultima', titulo: 'Última auditoria do mês', tipo: 'numero', formato: (v, m) => `${moeda(v)} (${br(m.ultimaData)})` },
  { chave: 'pico', titulo: 'Pior auditoria do mês', tipo: 'numero', formato: moeda },
  { chave: 'itens', titulo: 'Itens em ruptura (média)', tipo: 'numero', formato: v => Math.round(v).toLocaleString('pt-BR') },
  { chave: 'auditorias', titulo: 'Auditorias', tipo: 'numero' }
]
const COLUNAS_FOTOS = [
  { chave: 'data', titulo: 'Data', tipo: 'data' },
  { chave: 'id', titulo: 'Nº', tipo: 'numero', formato: v => `#${v}` },
  { chave: 'mes', titulo: 'Mês', tipo: 'categoria', rapido: true, valor: f => rotuloMes(f.mes) },
  { chave: 'valor', titulo: 'Valor em ruptura', tipo: 'numero', formato: moeda },
  { chave: 'itens', titulo: 'Itens em ruptura', tipo: 'numero' }
]
const COLUNAS_RANKING = [
  { chave: 'chave', titulo: 'Nome', tipo: 'texto' },
  { chave: 'valor', titulo: 'Média por auditoria', tipo: 'numero', formato: moeda },
  { chave: 'ultima', titulo: 'Na última auditoria', tipo: 'numero', formato: moeda },
  { chave: 'itens', titulo: 'Itens (média)', tipo: 'numero', formato: v => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) },
  { chave: 'participacao', titulo: '% do valor', tipo: 'numero', formato: v => `${v.toFixed(1)}%` }
]
const COLUNAS_PRODUTOS = [
  { chave: 'chave', titulo: 'Código', tipo: 'texto' },
  { chave: 'produto', titulo: 'Produto', tipo: 'texto' },
  { chave: 'setor', titulo: 'Setor', tipo: 'categoria', rapido: true },
  { chave: 'fornecedor', titulo: 'Fornecedor', tipo: 'categoria', rapido: true },
  { chave: 'vezes', titulo: 'Auditorias em ruptura', tipo: 'numero' },
  { chave: 'valorMedio', titulo: 'Valor médio', tipo: 'numero', formato: moeda },
  { chave: 'ultimoValor', titulo: 'Último valor', tipo: 'numero', formato: moeda },
  { chave: 'ultimaData', titulo: 'Última vez', tipo: 'data' },
  { chave: 'naUltima', titulo: 'Na última auditoria', tipo: 'booleano' }
]
const ATALHOS_PRODUTOS = [
  { rotulo: 'Na última auditoria', icone: 'fas fa-clock', condicoes: [{ chave: 'naUltima', op: 'sim' }] },
  { rotulo: 'Em ruptura 3+ vezes', icone: 'fas fa-repeat', condicoes: [{ chave: 'vezes', op: 'maiorIgual', valor: '3' }] }
]
const visao = ref('fornecedor')
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
        <span class="text-xs text-slate-500">{{ lista.length }} auditoria(s). Cada auditoria é uma foto: o valor do estoque (quantidade × custo, coluna Custo Ruptura) dos itens não achados naquele dia. As fotos não são somadas.</span>
      </div>

      <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div class="ui-card p-4">
          <p class="text-xs font-semibold text-slate-500">Na última auditoria</p>
          <p class="mt-1 text-2xl font-black text-red-700">{{ moeda(r.ultima?.valor) }}</p>
          <p class="text-xs text-slate-500">{{ r.ultima ? `${br(r.ultima.data)} · ${r.ultima.itens.toLocaleString('pt-BR')} itens` : '' }}</p>
        </div>
        <div class="ui-card p-4">
          <p class="text-xs font-semibold text-slate-500">Média por auditoria</p>
          <p class="mt-1 text-2xl font-black text-slate-900">{{ moeda(r.media) }}</p>
          <p class="text-xs text-slate-500">no período · {{ Math.round(r.itensMedia).toLocaleString('pt-BR') }} itens em média</p>
        </div>
        <div class="ui-card p-4">
          <p class="text-xs font-semibold text-slate-500">Pior auditoria</p>
          <p class="mt-1 text-2xl font-black text-slate-900">{{ moeda(r.pico?.valor) }}</p>
          <p class="text-xs text-slate-500">{{ r.pico ? br(r.pico.data) : '' }}</p>
        </div>
        <div class="ui-card p-4">
          <p class="text-xs font-semibold text-slate-500">Tendência mensal</p>
          <p class="mt-1 text-2xl font-black" :class="rotuloTendencia[r.tendencia][1]"><i :class="['fas', rotuloTendencia[r.tendencia][2], 'mr-1 text-lg']"></i>{{ rotuloTendencia[r.tendencia][0] }}</p>
          <p class="text-xs text-slate-500">média de cada mês</p>
        </div>
      </div>

      <!-- Por mês -->
      <section class="ui-card space-y-4 p-5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 class="text-base font-bold text-slate-900">Quanto estava a ruptura em cada mês</h2>
            <p class="text-xs text-slate-500">Média das auditorias do mês (o valor típico faltando) ou a última auditoria do mês (como o mês terminou).</p>
          </div>
          <div class="flex rounded-xl bg-slate-100 p-1 text-xs" role="group" aria-label="Valor do mês">
            <button v-for="[v, rot] in [['valor', 'Média do mês'], ['ultima', 'Última do mês']]" :key="v" type="button" class="rounded-lg px-3 py-1.5 font-semibold" :class="metricaMes === v ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'" :aria-pressed="metricaMes === v" @click="metricaMes = v">{{ rot }}</button>
          </div>
        </div>
        <p v-if="!r.meses.length" class="py-8 text-center text-sm text-slate-500">Sem valores no período.</p>
        <div v-else class="flex h-56 items-end gap-2">
          <div v-for="m in r.meses" :key="m.chave" class="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <span class="text-[11px] font-bold text-slate-700">{{ mil(m[metricaMes]) }}</span>
            <span class="w-full max-w-16 rounded-t-lg bg-red-400 transition group-hover:bg-red-500" :style="{ height: `${(m[metricaMes] / maiorMes) * 80}%`, minHeight: m[metricaMes] ? '3px' : '0' }" :title="`${rotuloMes(m.chave)}: média ${moeda(m.valor)} em ${m.auditorias} auditoria(s) · última ${moeda(m.ultima)} (${br(m.ultimaData)}) · pior ${moeda(m.pico)}`"></span>
            <span class="truncate text-[11px] font-semibold text-slate-500">{{ rotuloMes(m.chave) }}</span>
          </div>
        </div>
        <UiTabela id="ruptura-meses" titulo="Ruptura por mês" :itens="r.meses" :colunas="COLUNAS_MESES" :ordem-inicial="{ chave: 'chave', direcao: 'desc' }" chave-item="chave" :tamanho-pagina="10" :agrupavel="false" />
      </section>

      <!-- Cada auditoria -->
      <section class="ui-card space-y-3 p-5">
        <div>
          <h2 class="text-base font-bold text-slate-900">Cada auditoria</h2>
          <p class="text-xs text-slate-500">O valor em ruptura no dia de cada auditoria do período.</p>
        </div>
        <UiTabela id="ruptura-fotos" titulo="Ruptura por auditoria" :itens="r.auditorias" :colunas="COLUNAS_FOTOS" :ordem-inicial="{ chave: 'data', direcao: 'desc' }" chave-item="id" :tamanho-pagina="10" :agrupavel="false" />
      </section>

      <!-- Rankings -->
      <section class="ui-card p-5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 class="text-base font-bold text-slate-900">Onde está o valor</h2>
            <p class="text-xs text-slate-500">Média por auditoria no período e o valor na última auditoria.</p>
          </div>
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
          <UiTabela v-if="visao === 'fornecedor'" id="ruptura-fornecedor" titulo="Ruptura por fornecedor" :itens="r.porFornecedor" :colunas="COLUNAS_RANKING" :ordem-inicial="{ chave: 'valor', direcao: 'desc' }" chave-item="chave" :agrupavel="false" />
          <UiTabela v-else-if="visao === 'setor'" id="ruptura-setor" titulo="Ruptura por setor" :itens="r.porSetor" :colunas="COLUNAS_RANKING" :ordem-inicial="{ chave: 'valor', direcao: 'desc' }" chave-item="chave" :agrupavel="false" />
          <UiTabela v-else id="ruptura-produto" titulo="Produtos em ruptura" :itens="r.porProduto" :colunas="COLUNAS_PRODUTOS" :atalhos="ATALHOS_PRODUTOS" :ordem-inicial="[{ chave: 'naUltima', direcao: 'desc' }, { chave: 'ultimoValor', direcao: 'desc' }]" chave-item="chave" />
        </div>
      </section>
    </template>
  </div>
</template>
