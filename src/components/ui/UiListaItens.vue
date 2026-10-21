<script setup>
import { computed, ref, watch } from 'vue'
import { correspondeBusca } from '../../utils/busca'
import { baixarCsv } from '../../utils/csv'
import { abrirRelatorioTabela } from '../../composables/useRelatorio'

// Lista de itens reutilizada pelos modais: busca, filtros por facetas, agrupamento,
// ordenação, carregamento incremental, exportação CSV e impressão.
const props = defineProps({
  itens: { type: Array, default: () => [] },
  // [{ chave, titulo, alinhamento?, valor?: item => any, formato?: valor => texto, largura?, badge?: valor => classes }]
  colunas: { type: Array, required: true },
  // [{ chave, titulo, valor?: item => string }] — viram filtros e opções de agrupamento.
  facetas: { type: Array, default: () => [] },
  titulo: { type: String, default: 'Itens' },
  ordemInicial: { type: Object, default: () => ({ chave: null, direcao: 'desc' }) },
  passo: { type: Number, default: 50 }
})

const busca = ref('')
const filtros = ref({})
const agrupar = ref('')
const ordem = ref({ ...props.ordemInicial })
const limite = ref(props.passo)
const recolhidos = ref(new Set())

const valorColuna = (item, col) => (col.valor ? col.valor(item) : item?.[col.chave])
// `formato` muda só a exibição; ordenação e exportação usam o valor.
const textoColuna = (item, col) => (col.formato ? col.formato(valorColuna(item, col)) : valorColuna(item, col))
const valorFaceta = (item, f) => String((f.valor ? f.valor(item) : item?.[f.chave]) ?? '').trim() || 'Não informado'

const filtrados = computed(() => {
  const ativos = Object.entries(filtros.value).filter(([, v]) => v)
  return props.itens.filter(item => {
    for (const [chave, v] of ativos) {
      const f = props.facetas.find(x => x.chave === chave)
      if (f && valorFaceta(item, f) !== v) return false
    }
    return correspondeBusca(busca.value, props.colunas.map(c => valorColuna(item, c)))
  })
})

const ordenados = computed(() => {
  const { chave, direcao } = ordem.value
  if (!chave) return filtrados.value
  const col = props.colunas.find(c => c.chave === chave)
  const mult = direcao === 'asc' ? 1 : -1
  return [...filtrados.value].sort((a, b) => {
    const va = col ? valorColuna(a, col) : a[chave]
    const vb = col ? valorColuna(b, col) : b[chave]
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * mult
    return String(va ?? '').localeCompare(String(vb ?? ''), 'pt-BR', { numeric: true }) * mult
  })
})

// Opções de cada faceta com contagem, considerando os demais filtros.
const opcoesFacetas = computed(() => props.facetas.map(f => {
  const contagem = new Map()
  for (const item of props.itens) {
    const v = valorFaceta(item, f)
    contagem.set(v, (contagem.get(v) || 0) + 1)
  }
  return { ...f, opcoes: [...contagem].sort((a, b) => b[1] - a[1]) }
}).filter(f => f.opcoes.length > 1))

const grupos = computed(() => {
  const visiveis = ordenados.value.slice(0, limite.value)
  const f = props.facetas.find(x => x.chave === agrupar.value)
  if (!f) return [{ chave: '', rotulo: '', itens: visiveis, total: filtrados.value.length }]
  const totais = new Map()
  for (const item of filtrados.value) totais.set(valorFaceta(item, f), (totais.get(valorFaceta(item, f)) || 0) + 1)
  const mapa = new Map()
  for (const item of visiveis) {
    const k = valorFaceta(item, f)
    if (!mapa.has(k)) mapa.set(k, [])
    mapa.get(k).push(item)
  }
  return [...mapa].map(([k, itens]) => ({ chave: k, rotulo: k, itens, total: totais.get(k) || itens.length }))
    .sort((a, b) => b.total - a.total)
})
const maiorGrupo = computed(() => Math.max(1, ...grupos.value.map(g => g.total)))

watch([busca, filtros, agrupar, () => props.itens], () => { limite.value = props.passo }, { deep: true })

const alternarOrdem = (col) => {
  if (ordem.value.chave === col.chave) ordem.value = { chave: col.chave, direcao: ordem.value.direcao === 'asc' ? 'desc' : 'asc' }
  else ordem.value = { chave: col.chave, direcao: col.alinhamento === 'right' ? 'desc' : 'asc' }
}
const iconeOrdem = col => (ordem.value.chave !== col.chave ? 'fa-sort text-slate-300' : ordem.value.direcao === 'asc' ? 'fa-sort-up text-blue-600' : 'fa-sort-down text-blue-600')
const alternarGrupo = (chave) => {
  const novo = new Set(recolhidos.value)
  novo.has(chave) ? novo.delete(chave) : novo.add(chave)
  recolhidos.value = novo
}

const filtrosAtivos = computed(() => Object.values(filtros.value).filter(Boolean).length + (busca.value ? 1 : 0))
const limpar = () => { busca.value = ''; filtros.value = {} }

const linhasExport = () => ordenados.value.map(item => Object.fromEntries(props.colunas.map(c => [c.chave, valorColuna(item, c)])))
const exportarCsv = () => baixarCsv(linhasExport(), props.colunas, props.titulo.toLowerCase().replace(/[^a-z0-9]+/gi, '-'))
// Relatório A4 da lista como está na tela (busca, filtros e ordem), com escolha de colunas.
const imprimir = () => {
  const f = props.facetas.find(x => x.chave === agrupar.value) || props.facetas[0]
  const barras = f
    ? [...filtrados.value.reduce((m, i) => m.set(valorFaceta(i, f), (m.get(valorFaceta(i, f)) || 0) + 1), new Map())]
      .sort((a, b) => b[1] - a[1]).slice(0, 15).map(([rotulo, valor]) => ({ rotulo, valor }))
    : []
  const contexto = [
    busca.value && { rotulo: 'Busca', valor: `"${busca.value}"` },
    ...Object.entries(filtros.value).filter(([, v]) => v).map(([k, v]) => ({ rotulo: props.facetas.find(x => x.chave === k)?.titulo || k, valor: v })),
    { rotulo: 'Listados', valor: `${filtrados.value.length.toLocaleString('pt-BR')} de ${props.itens.length.toLocaleString('pt-BR')}` }
  ].filter(Boolean)
  abrirRelatorioTabela({
    id: props.titulo.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').slice(0, 40),
    titulo: props.titulo,
    contexto,
    colunas: props.colunas,
    itens: ordenados.value,
    resumo: f ? { nome: f.titulo.toLowerCase(), barras } : null
  })
}

const copiado = ref('')
const copiar = async (texto) => {
  try {
    await navigator.clipboard.writeText(String(texto))
    copiado.value = String(texto)
    setTimeout(() => { if (copiado.value === String(texto)) copiado.value = '' }, 1200)
  } catch {}
}
</script>

<template>
  <div class="space-y-3">
    <!-- Ferramentas -->
    <div class="flex flex-wrap items-center gap-2">
      <div class="relative min-w-0 flex-1 basis-56">
        <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400"></i>
        <input v-model="busca" type="search" class="ui-input py-2 pl-8 text-sm" placeholder="Buscar código, produto, local...">
      </div>
      <select
        v-for="f in opcoesFacetas"
        :key="f.chave"
        v-model="filtros[f.chave]"
        class="ui-input w-auto max-w-48 py-2 text-sm"
        :class="filtros[f.chave] ? '!border-blue-400 !bg-blue-50 text-blue-800' : ''"
        :aria-label="`Filtrar por ${f.titulo}`"
      >
        <option :value="undefined">{{ f.titulo }}: todos</option>
        <option v-for="[v, n] in f.opcoes" :key="v" :value="v">{{ v }} ({{ n }})</option>
      </select>
      <select v-if="opcoesFacetas.length" v-model="agrupar" class="ui-input w-auto py-2 text-sm" aria-label="Agrupar">
        <option value="">Sem agrupar</option>
        <option v-for="f in opcoesFacetas" :key="f.chave" :value="f.chave">Agrupar por {{ f.titulo.toLowerCase() }}</option>
      </select>
      <div class="ml-auto flex items-center gap-1">
        <button v-if="filtrosAtivos" type="button" class="rounded-lg px-2 py-2 text-xs font-semibold text-slate-500 hover:text-red-600" @click="limpar">
          <i class="fas fa-rotate-left mr-1"></i>Limpar
        </button>
        <button type="button" class="ui-btn-secondary px-3 py-2 text-xs" :disabled="!filtrados.length" @click="exportarCsv"><i class="fas fa-file-csv"></i>CSV</button>
        <button type="button" class="ui-btn-secondary px-3 py-2 text-xs" :disabled="!filtrados.length" @click="imprimir"><i class="fas fa-print"></i>Imprimir</button>
      </div>
    </div>

    <p class="text-xs text-slate-500">
      <b class="text-slate-800">{{ filtrados.length.toLocaleString('pt-BR') }}</b>
      <template v-if="filtrados.length !== itens.length"> de {{ itens.length.toLocaleString('pt-BR') }}</template>
      itens<template v-if="ordenados.length > limite"> · mostrando {{ limite }}</template>
    </p>

    <div v-if="!filtrados.length" class="rounded-xl bg-slate-50 py-12 text-center">
      <i class="fas fa-inbox text-2xl text-slate-300"></i>
      <p class="mt-2 text-sm font-medium text-slate-600">{{ itens.length ? 'Nenhum item com esses filtros.' : 'Nenhum item nesta lista.' }}</p>
    </div>

    <div v-else class="overflow-hidden rounded-xl ring-1 ring-slate-200">
      <div class="max-h-[55vh] overflow-auto">
        <table class="w-full text-sm">
          <thead class="sticky top-0 z-10 bg-slate-50 text-xs text-slate-500 shadow-[0_1px_0_#e2e8f0]">
            <tr>
              <th
                v-for="col in colunas"
                :key="col.chave"
                class="cursor-pointer select-none whitespace-nowrap px-3 py-2.5 font-semibold hover:text-blue-600"
                :class="col.alinhamento === 'right' ? 'text-right' : col.alinhamento === 'center' ? 'text-center' : 'text-left'"
                @click="alternarOrdem(col)"
              >{{ col.titulo }} <i class="fas text-[10px]" :class="iconeOrdem(col)"></i></th>
            </tr>
          </thead>
          <tbody>
            <template v-for="grupo in grupos" :key="grupo.chave">
              <tr v-if="grupo.rotulo" class="cursor-pointer bg-white hover:bg-slate-50" @click="alternarGrupo(grupo.chave)">
                <td :colspan="colunas.length" class="border-t border-slate-100 px-3 py-2">
                  <div class="flex items-center gap-3">
                    <i class="fas fa-chevron-down text-[10px] text-slate-400 transition" :class="recolhidos.has(grupo.chave) ? '-rotate-90' : ''"></i>
                    <span class="min-w-0 truncate text-sm font-bold text-slate-800">{{ grupo.rotulo }}</span>
                    <span class="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-slate-100"><span class="block h-full rounded-full bg-blue-500" :style="{ width: `${(grupo.total / maiorGrupo) * 100}%` }"></span></span>
                    <span class="ml-auto shrink-0 text-xs font-semibold text-slate-500">{{ grupo.total }}</span>
                  </div>
                </td>
              </tr>
              <template v-if="!recolhidos.has(grupo.chave)">
                <tr v-for="(item, i) in grupo.itens" :key="grupo.chave + i" class="border-t border-slate-100 hover:bg-blue-50/40">
                  <td
                    v-for="(col, ci) in colunas"
                    :key="col.chave"
                    class="px-3 py-2"
                    :class="[col.alinhamento === 'right' ? 'text-right tabular-nums' : col.alinhamento === 'center' ? 'text-center' : 'text-left', ci === 0 ? 'font-semibold text-slate-800' : 'text-slate-600', col.largura || '']"
                  >
                    <span v-if="col.badge" class="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold" :class="col.badge(valorColuna(item, col))">{{ valorColuna(item, col) }}</span>
                    <button v-else-if="ci === 0" type="button" class="group/c inline-flex items-center gap-1 hover:text-blue-700" title="Copiar" @click="copiar(valorColuna(item, col))">
                      {{ valorColuna(item, col) }}
                      <i class="text-[10px]" :class="copiado === String(valorColuna(item, col)) ? 'fas fa-check text-emerald-600' : 'far fa-copy opacity-0 group-hover/c:opacity-60'"></i>
                    </button>
                    <span v-else class="block truncate" :title="String(textoColuna(item, col) ?? '')">{{ textoColuna(item, col) ?? '—' }}</span>
                  </td>
                </tr>
              </template>
            </template>
          </tbody>
        </table>
      </div>
      <button v-if="ordenados.length > limite" type="button" class="w-full border-t border-slate-100 bg-slate-50 py-2.5 text-xs font-semibold text-blue-600 hover:bg-blue-50" @click="limite += passo">
        Mostrar mais {{ Math.min(passo, ordenados.length - limite) }} ({{ (ordenados.length - limite).toLocaleString('pt-BR') }} restantes)
      </button>
    </div>
  </div>
</template>
