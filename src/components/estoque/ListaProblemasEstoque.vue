<script setup>
import { computed, ref, watch } from 'vue'
import { TIPOS_PROBLEMA } from '../../utils/estoque'
import { baixarCsv } from '../../utils/csv'
import { abrirRelatorioTabela } from '../../composables/useRelatorio'
import UiButton from '../ui/UiButton.vue'

// Lista de problemas de estoque com filtros, agrupamento por local, CSV e relatório.
// `filtros` é compartilhado entre as abas (clicar num local em "Onde agir" filtra as listas).
const props = defineProps({
  linhas: { type: Array, required: true },
  filtros: { type: Object, default: null },
  compacto: { type: Boolean, default: false },
  limite: { type: Number, default: 0 },
  id: { type: String, default: 'estoque' },
  titulo: { type: String, default: 'Itens' },
  vazio: { type: String, default: 'Nenhum item.' }
})
const emit = defineEmits(['abrir'])

const f = computed(() => props.filtros || {})
const opcoes = campo => [...new Set(props.linhas.map(l => l[campo]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }))
const setores = computed(() => opcoes('setor'))
const locais = computed(() => opcoes('local'))
const fornecedores = computed(() => opcoes('fornecedor'))

const filtradas = computed(() => {
  if (props.compacto) return props.limite ? props.linhas.slice(0, props.limite) : props.linhas
  const termo = (f.value.busca || '').trim().toLowerCase()
  return props.linhas.filter(l =>
    (!f.value.setor || l.setor === f.value.setor) &&
    (!f.value.local || l.local === f.value.local) &&
    (!f.value.fornecedor || l.fornecedor === f.value.fornecedor) &&
    (!termo || `${l.codigo} ${l.produto} ${l.local} ${l.fornecedor}`.toLowerCase().includes(termo)))
})

const agrupar = ref(false)
const mostrar = ref(60)
watch(filtradas, () => { mostrar.value = 60 })
const visiveis = computed(() => filtradas.value.slice(0, mostrar.value))
const grupos = computed(() => {
  const m = new Map()
  for (const l of visiveis.value) m.set(l.local || 'Sem local', [...(m.get(l.local || 'Sem local') || []), l])
  return [...m].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'pt-BR', { numeric: true }))
})

// --- Texto de cada linha ---
const br = iso => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—')
const int = v => (Number(v) || 0).toLocaleString('pt-BR')
const real = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const destaque = l => ({
  reincidencia: `${l.dias} dias sem leitura`,
  semEstoque: l.vezes > 1 ? `Zerado em ${l.vezes} auditorias` : 'Zerado na última',
  parado: `${l.dias} dias sem venda`
})[l.tipo]
const detalhe = (l) => {
  const partes = [`${int(l.estoque)} em estoque`]
  if (l.tipo === 'reincidencia') {
    partes.push(l.nuncaLido ? 'nunca lido' : `lido pela última vez em ${br(l.ultimaLeitura)}`, `${l.auditoriasSemLeitura} auditorias seguidas`)
    if (l.diasSemVenda !== null) partes.push(`sem venda há ${l.diasSemVenda} d`)
    if (l.custoAcumulado) partes.push(`${real(l.custoAcumulado)} em ruptura`)
  } else if (l.tipo === 'semEstoque') {
    partes[0] = `desde ${br(l.desde)}`
    if (l.diasSemVenda !== null) partes.push(`sem venda há ${l.diasSemVenda} d`)
  } else {
    if (l.validade) partes.push(l.venceEm < 0 ? `vencido em ${br(l.validade)}` : `vence em ${br(l.validade)}`)
    if (l.naoAchado) partes.push('não achado na última auditoria')
  }
  return partes.join(', ')
}
const corGravidade = g => (g >= 6 ? 'bg-red-600' : g >= 4 ? 'bg-amber-500' : 'bg-slate-300')

// --- Exportar ---
const COLUNAS = [
  { chave: 'codigo', titulo: 'Código' },
  { chave: 'produto', titulo: 'Produto' },
  { chave: 'tipoRotulo', titulo: 'Problema', valor: l => TIPOS_PROBLEMA[l.tipo]?.rotulo },
  { chave: 'local', titulo: 'Local' },
  { chave: 'setor', titulo: 'Setor' },
  { chave: 'fornecedor', titulo: 'Fornecedor' },
  { chave: 'estoque', titulo: 'Estoque', alinhamento: 'right' },
  { chave: 'destaque', titulo: 'Situação', valor: destaque },
  { chave: 'diagnostico', titulo: 'O que fazer' }
]
const valor = (l, c) => (c.valor ? c.valor(l) : l[c.chave])
const exportarCsv = () => baixarCsv(filtradas.value.map(l => ({ ...Object.fromEntries(COLUNAS.map(c => [c.chave, valor(l, c)])), detalhe: detalhe(l) })), [...COLUNAS.map(c => [c.chave, c.titulo]), ['detalhe', 'Detalhe']], `${props.id}-${new Date().toLocaleDateString('sv-SE')}`)
const relatorio = () => abrirRelatorioTabela({
  id: props.id,
  titulo: props.titulo,
  subtitulo: `${filtradas.value.length} item(ns)`,
  contexto: [
    f.value.local && { rotulo: 'Local', valor: f.value.local },
    f.value.setor && { rotulo: 'Setor', valor: f.value.setor },
    f.value.fornecedor && { rotulo: 'Fornecedor', valor: f.value.fornecedor },
    f.value.busca?.trim() && { rotulo: 'Busca', valor: f.value.busca.trim() }
  ].filter(Boolean),
  colunas: COLUNAS,
  itens: filtradas.value,
  assinaturaPadrao: true,
  agrupamento: agrupar.value ? { nome: 'local', valor: l => l.local || 'Sem local' } : null
})
const limparFiltros = () => Object.assign(props.filtros, { busca: '', setor: '', local: '', fornecedor: '' })
const temFiltro = computed(() => Boolean(f.value.busca || f.value.setor || f.value.local || f.value.fornecedor))
</script>

<template>
  <div class="space-y-3">
    <div v-if="!compacto" class="flex flex-wrap items-end gap-3">
      <label class="min-w-48 flex-1"><span class="ui-label">Buscar</span><input v-model="filtros.busca" class="ui-input" placeholder="Código, produto, local ou fornecedor" /></label>
      <label><span class="ui-label">Local</span><select v-model="filtros.local" class="ui-input"><option value="">Todos</option><option v-for="o in locais" :key="o">{{ o }}</option></select></label>
      <label><span class="ui-label">Setor</span><select v-model="filtros.setor" class="ui-input max-w-56"><option value="">Todos</option><option v-for="o in setores" :key="o">{{ o }}</option></select></label>
      <label><span class="ui-label">Fornecedor</span><select v-model="filtros.fornecedor" class="ui-input max-w-56"><option value="">Todos</option><option v-for="o in fornecedores" :key="o">{{ o }}</option></select></label>
    </div>
    <div v-if="!compacto" class="flex flex-wrap items-center gap-2">
      <p class="mr-auto text-sm text-slate-600"><b class="tabular-nums text-slate-900">{{ int(filtradas.length) }}</b> {{ filtradas.length === 1 ? 'item' : 'itens' }}<button v-if="temFiltro" type="button" class="ml-2 text-xs font-semibold text-blue-700 hover:underline" @click="limparFiltros">Limpar filtros</button></p>
      <label class="inline-flex items-center gap-2 text-sm text-slate-700"><input v-model="agrupar" type="checkbox" class="accent-blue-600" />Agrupar por local</label>
      <UiButton variant="secondary" size="sm" :disabled="!filtradas.length" @click="relatorio"><i class="fas fa-file-pdf"></i>Relatório</UiButton>
      <UiButton variant="secondary" size="sm" :disabled="!filtradas.length" @click="exportarCsv"><i class="fas fa-file-csv"></i>CSV</UiButton>
    </div>

    <p v-if="!filtradas.length" class="ui-card px-4 py-10 text-center text-sm text-slate-500">{{ temFiltro ? 'Nenhum item com esses filtros.' : vazio }}</p>
    <div v-else class="space-y-4">
      <section v-for="[grupo, lista] in (agrupar && !compacto ? grupos : [['', visiveis]])" :key="grupo || 'todos'" class="ui-card overflow-hidden">
        <header v-if="grupo" class="flex items-baseline justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-2">
          <h3 class="font-semibold text-slate-900">{{ grupo }}</h3><span class="text-xs text-slate-500">{{ lista.length }} {{ lista.length === 1 ? 'item' : 'itens' }}</span>
        </header>
        <ul class="divide-y divide-slate-100">
          <li v-for="l in lista" :key="l.tipo + l.codigo" class="grid gap-x-4 gap-y-1.5 px-4 py-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.4fr)] lg:items-center">
            <div class="flex min-w-0 items-start gap-2.5">
              <span class="mt-1.5 size-2 shrink-0 rounded-full" :class="corGravidade(l.gravidade)" :title="`Gravidade ${l.gravidade}`"></span>
              <div class="min-w-0">
                <button type="button" class="block max-w-full truncate text-left font-semibold text-slate-900 hover:text-blue-700 hover:underline" :title="`Ver tudo sobre ${l.produto}`" @click="emit('abrir', l.codigo)">{{ l.produto }}</button>
                <p class="truncate text-xs text-slate-500">{{ l.codigo }}<template v-if="l.local">, <b class="font-semibold text-slate-700">{{ l.local }}</b></template>, {{ l.setor }}</p>
              </div>
            </div>
            <div class="min-w-0 text-sm">
              <p class="font-semibold text-slate-800"><span v-if="compacto" class="mr-1 text-xs font-medium text-slate-500">{{ TIPOS_PROBLEMA[l.tipo].curto }} ·</span>{{ destaque(l) }}</p>
              <p class="text-xs text-slate-500">{{ detalhe(l) }}</p>
            </div>
            <p class="text-sm leading-snug text-slate-700">{{ l.diagnostico }}</p>
          </li>
        </ul>
      </section>
      <div v-if="!compacto && filtradas.length > mostrar" class="text-center">
        <UiButton variant="secondary" @click="mostrar += 120">Mostrar mais ({{ int(filtradas.length - mostrar) }} restantes)</UiButton>
      </div>
    </div>
  </div>
</template>
