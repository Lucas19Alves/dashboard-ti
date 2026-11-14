<script setup>
import { computed, ref, watch } from 'vue'
import { useAnaliseEstoque } from '../../composables/useAnaliseEstoque'
import { useEstoqueTotalStore } from '../../stores/estoqueTotalStore'
import { useAuditoriasStore } from '../../stores/auditoriasStore'
import { SITUACAO_ITEM, formatarQuantidade } from '../../utils/estoqueTotal'
import { TIPOS_PROBLEMA } from '../../utils/estoque'
import { baixarCsv } from '../../utils/csv'
import UiButton from '../ui/UiButton.vue'
import UiEmptyState from '../ui/UiEmptyState.vue'

// Todos os itens da planilha de estoque total, cada um com o que o sistema sabe dele:
// local e leitura (auditorias), validade (validades) e os problemas das outras abas.
const emit = defineEmits(['abrir', 'importar'])
const store = useEstoqueTotalStore()
const toast = (m, t) => useAuditoriasStore().addToast(m, t)
const { itensEstoque, problemasPorCodigo, infoEstoqueTotal, indice } = useAnaliseEstoque()

const br = iso => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—')
const int = v => (Number(v) || 0).toLocaleString('pt-BR')
const dataHora = iso => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '')
const diasDesde = iso => (iso ? Math.floor((Date.now() - Date.parse(iso)) / 86400000) : null)
const antiga = computed(() => (diasDesde(infoEstoqueTotal.value?.importadoEm) ?? 0) >= 2)

// --- Resumo (cada cartão filtra a lista) ---
const FORA = new Set(['foraCiclo', 'nunca'])
// Mesma regra da lista "Fora das auditorias": só quem tem estoque na planilha.
const estaFora = i => FORA.has(i.situacao) && i.estoque > 0
const contagem = computed(() => {
  const c = { total: 0, lido: 0, pendente: 0, fora: 0, validade: 0, problema: 0 }
  for (const i of itensEstoque.value) {
    c.total++
    if (i.situacao === 'lido') c.lido++
    else if (i.situacao === 'pendente') c.pendente++
    else if (estaFora(i)) c.fora++
    if (i.validade) c.validade++
    if (problemasPorCodigo.value.has(i.codigo)) c.problema++
  }
  return c
})
const pct = v => (contagem.value.total ? `${Math.round((v / contagem.value.total) * 100)}%` : '')
const cartoes = computed(() => [
  { chave: '', rotulo: 'Itens na planilha', valor: contagem.value.total, nota: 'estoque total da loja' },
  { chave: 'lido', rotulo: 'Lidos na auditoria', valor: contagem.value.lido, nota: `${pct(contagem.value.lido)} achados na gôndola` },
  { chave: 'pendente', rotulo: 'Não lidos', valor: contagem.value.pendente, nota: 'com estoque e sem leitura na última' },
  { chave: 'fora', rotulo: 'Fora das auditorias', valor: contagem.value.fora, nota: 'não entraram na última Presença' },
  { chave: 'validade', rotulo: 'Com validade', valor: contagem.value.validade, nota: 'monitorados nas validades' },
  { chave: 'problema', rotulo: 'Com problema', valor: contagem.value.problema, nota: 'aparecem em alguma lista' }
])

// --- Filtros ---
const filtros = ref({ busca: '', setor: '', local: '', grupo: '', ordem: 'estoque' })
const opcoes = campo => [...new Set(itensEstoque.value.map(l => l[campo]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }))
const setores = computed(() => opcoes('setor'))
const locais = computed(() => opcoes('local'))
const noGrupo = (i, g) => {
  if (!g) return true
  if (g === 'fora') return estaFora(i)
  if (g === 'validade') return Boolean(i.validade)
  if (g === 'problema') return problemasPorCodigo.value.has(i.codigo)
  if (g.startsWith('tipo:')) return (problemasPorCodigo.value.get(i.codigo) || []).some(p => p.tipo === g.slice(5))
  return i.situacao === g
}
const ORDENS = {
  estoque: (a, b) => b.estoque - a.estoque,
  semVenda: (a, b) => (b.diasSemVenda ?? -1) - (a.diasSemVenda ?? -1),
  ranking: (a, b) => (a.ranking ?? Infinity) - (b.ranking ?? Infinity),
  validade: (a, b) => (a.venceEm ?? Infinity) - (b.venceEm ?? Infinity),
  produto: (a, b) => a.produto.localeCompare(b.produto, 'pt-BR')
}
const filtradas = computed(() => {
  const f = filtros.value
  const termo = f.busca.trim().toLowerCase()
  return itensEstoque.value
    .filter(i => (!f.setor || i.setor === f.setor) && (!f.local || i.local === f.local) && noGrupo(i, f.grupo) &&
      (!termo || `${i.codigo} ${i.produto} ${i.local} ${i.fornecedor}`.toLowerCase().includes(termo)))
    .sort(ORDENS[f.ordem] || ORDENS.estoque)
})
const temFiltro = computed(() => Boolean(filtros.value.busca || filtros.value.setor || filtros.value.local || filtros.value.grupo))
const limpar = () => Object.assign(filtros.value, { busca: '', setor: '', local: '', grupo: '' })
const mostrar = ref(60)
watch(filtradas, () => { mostrar.value = 60 })

// --- Texto de cada linha ---
const COR_SITUACAO = { lido: 'text-emerald-700', pendente: 'text-red-700', lidoSemEstoque: 'text-amber-700', semEstoque: 'text-slate-500', foraCiclo: 'text-blue-700', nunca: 'text-blue-700' }
const textoValidade = i => (!i.validade ? '' : i.venceEm !== null && i.venceEm < 0 ? `vencido em ${br(i.validade)}` : `vence em ${br(i.validade)}${i.venceEm !== null ? ` (${i.venceEm} d)` : ''}`)
const problemas = i => problemasPorCodigo.value.get(i.codigo) || []

// --- Ações ---
const exportarCsv = () => baixarCsv(filtradas.value.map(i => ({
  ...i,
  estoqueTxt: formatarQuantidade(i.estoque, i.unidade),
  situacaoTxt: SITUACAO_ITEM[i.situacao],
  gerenciadoTxt: i.gerenciado ? 'Sim' : 'Não',
  problemasTxt: problemas(i).map(p => TIPOS_PROBLEMA[p.tipo].rotulo).join(', '),
  oQueFazer: problemas(i).map(p => p.diagnostico).join(' | ')
})), [
  ['codigo', 'Código'], ['produto', 'Produto'], ['setor', 'Setor'], ['fornecedor', 'Fornecedor'], ['estoqueTxt', 'Estoque'],
  ['diasSemVenda', 'Dias sem venda'], ['ultimaVenda', 'Última venda'], ['ultimaCompra', 'Última compra'], ['ranking', 'Ranking'], ['gerenciadoTxt', 'Gerenciado'],
  ['local', 'Local'], ['situacaoTxt', 'Situação na auditoria'], ['ultimaLeitura', 'Última leitura'], ['validade', 'Validade'], ['venceEm', 'Dias p/ vencer'],
  ['problemasTxt', 'Problemas'], ['oQueFazer', 'O que fazer']
], `estoque-total-${new Date().toLocaleDateString('sv-SE')}`)
const apagar = async () => {
  if (!confirm('Apagar a planilha de estoque total? As análises voltam a usar só as auditorias.')) return
  await store.limpar()
  toast('Planilha de estoque total apagada.', 'info')
}
</script>

<template>
  <section class="space-y-4">
    <UiEmptyState v-if="!store.itens.length" title="Nenhuma planilha de estoque total" description="Importe o relatório de produtos com estoque do sistema. Cada item é cruzado com as auditorias (local, leituras), as validades e os não vinculados, e as listas de reincidência, zerados e parados passam a usar o estoque dela." icon="fas fa-warehouse">
      <template #actions><UiButton @click="emit('importar')"><i class="fas fa-file-upload"></i>Importar estoque total</UiButton></template>
    </UiEmptyState>

    <template v-else>
      <div class="flex flex-wrap items-center gap-2">
        <p class="mr-auto text-sm text-slate-600">
          <i class="fas fa-file-excel mr-1 text-green-600"></i><b class="text-slate-900">{{ infoEstoqueTotal?.arquivo || 'Planilha' }}</b>, importada em {{ dataHora(infoEstoqueTotal?.importadoEm) }}
          <span v-if="!indice.auditorias" class="ml-1 text-amber-700">· sem auditorias para cruzar</span>
        </p>
        <UiButton variant="secondary" size="sm" @click="emit('importar')"><i class="fas fa-rotate"></i>Atualizar planilha</UiButton>
        <UiButton variant="secondary" size="sm" :disabled="!filtradas.length" @click="exportarCsv"><i class="fas fa-file-csv"></i>CSV</UiButton>
        <UiButton variant="dangerSoft" size="sm" @click="apagar"><i class="fas fa-trash-alt"></i>Apagar</UiButton>
      </div>
      <p v-if="antiga" class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        A planilha é de {{ diasDesde(infoEstoqueTotal?.importadoEm) }} dias atrás. Importe a de hoje para o estoque e os dias sem venda baterem com o sistema.
      </p>

      <section class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label="Cobertura">
        <button v-for="c in cartoes" :key="c.rotulo" type="button" class="ui-card ui-card-hover p-4 text-left" :class="filtros.grupo === c.chave && c.chave ? 'border-blue-300 bg-blue-50/60' : ''" @click="filtros.grupo = filtros.grupo === c.chave ? '' : c.chave">
          <span class="block text-[13px] font-semibold text-slate-600">{{ c.rotulo }}</span>
          <span class="mt-2 block text-[1.75rem] font-semibold leading-none tabular-nums text-slate-900">{{ int(c.valor) }}</span>
          <span class="mt-2 block text-xs leading-relaxed text-slate-500">{{ c.nota }}</span>
        </button>
      </section>

      <div class="flex flex-wrap items-end gap-3">
        <label class="min-w-48 flex-1"><span class="ui-label">Buscar</span><input v-model="filtros.busca" class="ui-input" placeholder="Código, produto, local ou fornecedor" /></label>
        <label><span class="ui-label">Mostrar</span>
          <select v-model="filtros.grupo" class="ui-input max-w-56">
            <option value="">Todos</option>
            <optgroup label="Situação na auditoria"><option v-for="(r, v) in SITUACAO_ITEM" :key="v" :value="v">{{ r }}</option><option value="fora">Fora das auditorias (todos)</option></optgroup>
            <optgroup label="Problemas"><option value="problema">Com algum problema</option><option v-for="(t, v) in TIPOS_PROBLEMA" :key="v" :value="`tipo:${v}`">{{ t.rotulo }}</option></optgroup>
            <option value="validade">Com validade monitorada</option>
          </select>
        </label>
        <label><span class="ui-label">Setor</span><select v-model="filtros.setor" class="ui-input max-w-52"><option value="">Todos</option><option v-for="o in setores" :key="o">{{ o }}</option></select></label>
        <label><span class="ui-label">Local</span><select v-model="filtros.local" class="ui-input"><option value="">Todos</option><option v-for="o in locais" :key="o">{{ o }}</option></select></label>
        <label><span class="ui-label">Ordenar por</span>
          <select v-model="filtros.ordem" class="ui-input"><option value="estoque">Maior estoque</option><option value="semVenda">Mais dias sem venda</option><option value="ranking">Mais vendidos</option><option value="validade">Validade mais próxima</option><option value="produto">Produto (A-Z)</option></select>
        </label>
      </div>
      <p class="text-sm text-slate-600"><b class="tabular-nums text-slate-900">{{ int(filtradas.length) }}</b> {{ filtradas.length === 1 ? 'item' : 'itens' }}<button v-if="temFiltro" type="button" class="ml-2 text-xs font-semibold text-blue-700 hover:underline" @click="limpar">Limpar filtros</button></p>

      <p v-if="!filtradas.length" class="ui-card px-4 py-10 text-center text-sm text-slate-500">Nenhum item com esses filtros.</p>
      <ul v-else class="ui-card divide-y divide-slate-100">
        <li v-for="i in filtradas.slice(0, mostrar)" :key="i.codigo" class="grid gap-x-4 gap-y-1.5 px-4 py-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.2fr)] lg:items-center">
          <div class="min-w-0">
            <button type="button" class="block max-w-full truncate text-left font-semibold text-slate-900 hover:text-blue-700 hover:underline" :title="`Ver tudo sobre ${i.produto}`" @click="emit('abrir', i.codigo)">{{ i.produto }}</button>
            <p class="truncate text-xs text-slate-500">{{ i.codigo }}, {{ i.setor }}<template v-if="i.fornecedor">, {{ i.fornecedor }}</template></p>
          </div>
          <div class="text-sm">
            <p><b class="tabular-nums text-slate-900">{{ formatarQuantidade(i.estoque, i.unidade) }}</b> <span class="text-xs text-slate-500">em estoque</span></p>
            <p class="text-xs text-slate-500">{{ i.diasSemVenda === null ? 'sem venda registrada' : i.diasSemVenda <= 1 ? 'vendeu ontem ou hoje' : `sem venda há ${i.diasSemVenda} d` }}</p>
          </div>
          <div class="min-w-0 text-sm">
            <p class="truncate"><b class="text-slate-900">{{ i.local || 'Sem local' }}</b> <span class="text-xs font-medium" :class="COR_SITUACAO[i.situacao]">{{ SITUACAO_ITEM[i.situacao] }}</span></p>
            <p class="text-xs text-slate-500">{{ i.ultimaLeitura ? `lido em ${br(i.ultimaLeitura)}` : i.ultimaData ? 'nunca lido' : 'nunca auditado' }}<template v-if="textoValidade(i)">, <span :class="i.venceEm !== null && i.venceEm <= 3 ? 'font-semibold text-red-700' : ''">{{ textoValidade(i) }}</span></template></p>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <button v-for="p in problemas(i)" :key="p.tipo" type="button" class="ui-badge border-amber-200 bg-amber-50 text-[11px] text-amber-800 hover:bg-amber-100" :title="p.diagnostico" @click="emit('abrir', i.codigo)"><i :class="[TIPOS_PROBLEMA[p.tipo].icone, 'mr-1']"></i>{{ TIPOS_PROBLEMA[p.tipo].curto }}</button>
            <span v-if="!problemas(i).length" class="text-xs text-slate-400">Sem problemas</span>
          </div>
        </li>
      </ul>
      <div v-if="filtradas.length > mostrar" class="text-center">
        <UiButton variant="secondary" @click="mostrar += 120">Mostrar mais ({{ int(filtradas.length - mostrar) }} restantes)</UiButton>
      </div>
    </template>
  </section>
</template>
