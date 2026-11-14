<script setup>
import { computed, ref, shallowRef, watch } from 'vue'
import { useAnaliseEstoque } from '../../composables/useAnaliseEstoque'
import { useEstoqueTotalStore } from '../../stores/estoqueTotalStore'
import { useAuditoriasStore } from '../../stores/auditoriasStore'
import { GRUPOS, temCabecalhoDeAba, usarAcoesDaAba } from '../../composables/useAcoes'
import { custosDoIndice, diasEntre, giroDosItens, projetar, serieDoHistorico } from '../../utils/historicoEstoque'
import { formatarQuantidade } from '../../utils/estoqueTotal'
import UiAcoes from '../ui/UiAcoes.vue'
import UiEmptyState from '../ui/UiEmptyState.vue'
import UiMenu from '../ui/UiMenu.vue'
import UiTabela from '../ui/UiTabela.vue'
import GraficoSerieProjecao from '../ui/GraficoSerieProjecao.vue'

// Histórico do estoque: uma foto por planilha importada (na data da última venda dela),
// a evolução com projeção para as próximas 4 semanas e o giro estimado de cada item.
const emit = defineEmits(['abrir', 'importar'])
const store = useEstoqueTotalStore()
const toast = (m, t) => useAuditoriasStore().addToast(m, t)
const { indice, total, limiarParado } = useAnaliseEstoque()

// Itens das fotos: carregados quando a aba abre e quando entra/sai uma foto.
const fotos = shallowRef([])
const carregando = ref(true)
const carregar = async () => {
  carregando.value = true
  try { fotos.value = await store.itensDasFotos() } finally { carregando.value = false }
}
watch(() => store.fotos.map(f => `${f.id}:${f.importadoEm}`).join('|'), carregar, { immediate: true })

const custos = computed(() => custosDoIndice(indice.value))
const serie = computed(() => serieDoHistorico(fotos.value, { custos: custos.value, limiarParado: limiarParado.value }))
const ultima = computed(() => serie.value.at(-1) || null)
const anterior = computed(() => serie.value.at(-2) || null)

// --- Formatação ---
const int = v => Math.round(Number(v) || 0).toLocaleString('pt-BR')
const real = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const br = iso => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—')
const pct = v => `${Math.round((Number(v) || 0) * 100)}%`
const sinal = (v, f) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${f(Math.abs(v))}`

// --- Indicadores (com variação desde a foto anterior e projeção em 4 semanas) ---
const METRICAS = [
  { chave: 'parados', rotulo: 'Itens parados', nota: () => `${limiarParado.value}+ dias sem venda, com estoque`, formato: int, subirEhRuim: true },
  { chave: 'valorParado', rotulo: 'Valor parado (estimado)', nota: () => 'custo das auditorias × estoque dos parados', formato: real, subirEhRuim: true },
  { chave: 'semVenda90', rotulo: 'Sem venda há 90+ dias', nota: () => 'com estoque', formato: int, subirEhRuim: true },
  { chave: 'comEstoque', rotulo: 'Itens com estoque', nota: () => 'sem os insumos', formato: int, subirEhRuim: false },
  { chave: 'valor', rotulo: 'Valor do estoque (estimado)', nota: () => `custo conhecido de ${pct(ultima.value?.coberturaCusto)} dos itens`, formato: real, subirEhRuim: false }
]
const metrica = ref('parados')
const metricaAtual = computed(() => METRICAS.find(m => m.chave === metrica.value))
const cartoes = computed(() => METRICAS.map((m) => {
  const atual = ultima.value?.[m.chave] ?? 0
  const delta = anterior.value ? atual - anterior.value[m.chave] : null
  const proj = projetar(serie.value, m.chave)
  return { ...m, atual, delta, proj, ruim: delta !== null && delta !== 0 && (delta > 0) === m.subirEhRuim }
}))
const projecaoGrafico = computed(() => projetar(serie.value, metrica.value)?.pontos || [])
const pontosGrafico = computed(() => serie.value.map(p => ({ data: p.data, valor: p[metrica.value] })))
const periodo = computed(() => (serie.value.length > 1 ? diasEntre(serie.value[0].data, ultima.value.data) : 0))

// --- Fotos (uma por planilha) ---
const COLUNAS_FOTOS = [
  { chave: 'data', titulo: 'Estoque em', tipo: 'data' },
  { chave: 'arquivo', titulo: 'Arquivo', tipo: 'texto' },
  { chave: 'importadoEm', titulo: 'Importada em', tipo: 'data', formato: v => (v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—') },
  { chave: 'comEstoque', titulo: 'Com estoque', tipo: 'numero' },
  { chave: 'parados', titulo: 'Parados', tipo: 'numero' },
  { chave: 'semVenda90', titulo: 'Sem venda 90+', tipo: 'numero' },
  { chave: 'valor', titulo: 'Valor estimado', tipo: 'numero', formato: v => real(v) },
  { chave: 'valorParado', titulo: 'Valor parado', tipo: 'numero', formato: v => real(v) },
  { chave: 'menu', titulo: '', filtravel: false, ordenavel: false, valor: () => '' }
]
const linhasFotos = computed(() => [...serie.value].reverse())
const acoesDaFoto = f => [
  { id: 'apagar', rotulo: 'Apagar esta foto', detalhe: `Estoque em ${br(f.data)}`, icone: 'fas fa-trash-alt', perigo: true, confirmar: `Apagar a foto do estoque de ${br(f.data)} do histórico?${f.data === store.info?.data ? ' A planilha atual continua valendo nas análises.' : ''}`, executar: async () => { await store.apagarFoto(f.id); toast(`Foto de ${br(f.data)} apagada do histórico.`, 'info') } }
]

// --- Giro estimado de cada item ---
const giro = computed(() => giroDosItens({ total: total.value, fotos: fotos.value, custos: custos.value, dataBase: ultima.value?.data }))
const COLUNAS_GIRO = [
  { chave: 'produto', titulo: 'Produto', tipo: 'texto' },
  { chave: 'codigo', titulo: 'Código', tipo: 'texto' },
  { chave: 'setor', titulo: 'Setor', tipo: 'categoria', rapido: true },
  { chave: 'fornecedor', titulo: 'Fornecedor', tipo: 'categoria', oculta: true },
  { chave: 'situacao', titulo: 'Cobertura', tipo: 'categoria', rapido: true },
  { chave: 'estoque', titulo: 'Estoque', tipo: 'numero', formato: (v, i) => formatarQuantidade(v, i.unidade) },
  { chave: 'vendaSemana', titulo: 'Venda/semana (est.)', tipo: 'numero', formato: (v, i) => formatarQuantidade(Math.round(v * 100) / 100, i.unidade) },
  { chave: 'cobertura', titulo: 'Dura (dias)', tipo: 'numero', formato: v => (v === null ? 'sem giro' : int(v)) },
  { chave: 'zeraEm', titulo: 'Zera em', tipo: 'data' },
  { chave: 'diasObservados', titulo: 'Dias observados', tipo: 'numero' },
  { chave: 'diasSemVenda', titulo: 'Dias sem venda', tipo: 'numero', oculta: true },
  { chave: 'valor', titulo: 'Valor (est.)', tipo: 'numero', formato: v => (v ? real(v) : '—') }
]
const ATALHOS_GIRO = [
  { rotulo: 'Acaba em até 7 dias', icone: 'fas fa-hourglass-end', condicoes: [{ chave: 'cobertura', op: 'menorIgual', valor: '7' }], ordem: [{ chave: 'cobertura', direcao: 'asc' }] },
  { rotulo: 'Sem giro', icone: 'fas fa-pause', condicoes: [{ chave: 'situacao', op: 'em', valor: ['Sem giro'] }], ordem: [{ chave: 'valor', direcao: 'desc' }] },
  { rotulo: 'Dura mais de 90 dias', icone: 'fas fa-boxes-stacked', condicoes: [{ chave: 'cobertura', op: 'maior', valor: '90' }], ordem: [{ chave: 'valor', direcao: 'desc' }] }
]

// --- Ações (no cabeçalho da página Estoque) ---
const noCabecalho = temCabecalhoDeAba()
const acoes = computed(() => [
  { id: 'hist-importar', rotulo: 'Importar planilha', detalhe: 'De hoje ou de dias anteriores', icone: 'fas fa-file-import', nivel: 'principal', grupo: GRUPOS.dados, termos: 'historico foto estoque antiga', executar: () => emit('importar') }
])
usarAcoesDaAba(() => acoes.value)
</script>

<template>
  <section class="space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <p class="max-w-[80ch] text-sm leading-relaxed text-slate-600">Cada planilha de estoque total importada vira uma foto, na data da última venda registrada nela. Com as fotos dá para ver se o estoque parado cresce ou diminui, projetar as próximas semanas e estimar quanto cada item vende pela queda do estoque entre fotos sem compra.</p>
      <UiAcoes v-if="!noCabecalho" :acoes="acoes" contexto="Histórico do estoque" />
    </div>

    <p v-if="carregando && !fotos.length" class="py-10 text-center text-sm text-slate-500"><i class="fas fa-spinner fa-spin mr-2"></i>Carregando o histórico...</p>
    <UiEmptyState v-else-if="!serie.length" title="Nenhuma foto do estoque ainda" description="Importe a planilha de estoque total. Planilhas de dias anteriores também podem ser importadas: entram só no histórico." icon="fas fa-clock-rotate-left" />

    <template v-else>
      <p v-if="serie.length < 3" class="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <i class="fas fa-circle-info mr-1 text-blue-600"></i>
        {{ serie.length === 1 ? 'Só há uma foto, de' : `Há ${serie.length} fotos, até` }} {{ br(ultima.data) }}. A projeção precisa de pelo menos 3 fotos em 7 dias ou mais, e o giro dos itens de 2 fotos. Importe a planilha toda semana (ou planilhas antigas que você tiver).
      </p>

      <!-- Indicadores -->
      <section class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" aria-label="Indicadores">
        <button v-for="c in cartoes" :key="c.chave" type="button" class="ui-card ui-card-hover p-4 text-left" :class="metrica === c.chave ? 'border-blue-300 ring-1 ring-blue-200' : ''" :aria-pressed="metrica === c.chave" title="Ver no gráfico" @click="metrica = c.chave">
          <span class="block text-[13px] font-semibold text-slate-600">{{ c.rotulo }}</span>
          <span class="mt-2 block text-[1.6rem] font-semibold leading-none tabular-nums text-slate-900">{{ c.formato(c.atual) }}</span>
          <span v-if="c.delta !== null" class="mt-2 block text-xs font-semibold" :class="c.delta === 0 ? 'text-slate-500' : c.ruim ? 'text-red-700' : 'text-emerald-700'">
            <i :class="c.delta > 0 ? 'fas fa-arrow-up' : c.delta < 0 ? 'fas fa-arrow-down' : 'fas fa-equals'" class="mr-0.5 text-[10px]"></i>{{ sinal(c.delta, c.formato) }} desde {{ br(anterior.data).slice(0, 5) }}
          </span>
          <span v-if="c.proj" class="mt-1 block text-xs text-slate-500">em 4 semanas: <b class="text-slate-700">{{ c.formato(c.proj.final) }}</b> ({{ sinal(c.proj.porSemana, c.formato) }}/sem.)</span>
          <span class="mt-1 block text-[11px] leading-snug text-slate-400">{{ c.nota() }}</span>
        </button>
      </section>

      <!-- Gráfico -->
      <section class="ui-card p-5">
        <div class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 class="font-semibold text-slate-900">{{ metricaAtual.rotulo }}</h2>
          <span class="text-xs text-slate-500">{{ serie.length }} foto(s){{ periodo ? ` em ${periodo} dias` : '' }} · clique num indicador para trocar</span>
        </div>
        <GraficoSerieProjecao :pontos="pontosGrafico" :projecao="projecaoGrafico" :formato="metricaAtual.formato" :rotulo="metricaAtual.rotulo" />
        <p class="mt-2 text-xs text-slate-500">A projeção segue a tendência das últimas fotos (até 8). É uma estimativa: compras grandes, promoções e inventários mudam o rumo.</p>
      </section>

      <!-- Giro -->
      <section class="space-y-3">
        <div>
          <h2 class="text-lg font-semibold text-slate-900">Quanto tempo o estoque dura</h2>
          <p class="max-w-[80ch] text-xs leading-relaxed text-slate-500">Venda estimada pela queda do estoque entre fotos seguidas sem compra no meio (a planilha não traz a venda). "Sem giro": o estoque não caiu em 7 dias ou mais de observação. Clique num item para ver a ficha.</p>
        </div>
        <p v-if="serie.length < 2" class="ui-card px-4 py-8 text-center text-sm text-slate-500">Precisa de pelo menos 2 fotos para estimar o giro.</p>
        <UiTabela v-else id="estoque-giro" titulo="Giro estimado dos itens" :itens="giro" :colunas="COLUNAS_GIRO" :atalhos="ATALHOS_GIRO" :ordem-inicial="{ chave: 'cobertura', direcao: 'asc' }" chave-item="codigo" clicavel vazio="Nenhum item com estoque em duas fotos seguidas sem compra." @linha="emit('abrir', $event.codigo)" />
      </section>

      <!-- Fotos -->
      <section class="space-y-3">
        <h2 class="text-lg font-semibold text-slate-900">Fotos do estoque</h2>
        <UiTabela id="estoque-fotos" titulo="Fotos do estoque" :itens="linhasFotos" :colunas="COLUNAS_FOTOS" :ordem-inicial="{ chave: 'data', direcao: 'desc' }" chave-item="id" :agrupavel="false">
          <template #celula-menu="{ item }"><UiMenu :acoes="acoesDaFoto(item)" rotulo="" estilo="ferramenta" titulo="Ações da foto" /></template>
          <template #celula-data="{ item }"><span class="font-semibold text-slate-800">{{ br(item.data) }}</span><span v-if="item.data === store.info?.data" class="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">atual</span></template>
        </UiTabela>
      </section>
    </template>
  </section>
</template>
