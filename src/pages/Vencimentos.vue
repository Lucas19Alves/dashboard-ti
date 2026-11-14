<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useVencimentosStore } from '../stores/vencimentosStore'
import { useAuditoriasStore } from '../stores/auditoriasStore'
import { blocoBarras, blocoTabela, selo } from '../utils/print'
import { useRelatorio } from '../composables/useRelatorio'
import { cruzarValidadeRuptura } from '../utils/vencimentosCruzados'
import { formatarDataBR } from '../utils/busca'
import UiButton from '../components/ui/UiButton.vue'
import StatCard from '../components/ui/StatCard.vue'
import ImagemVencimentos from '../components/ImagemVencimentos.vue'
import UiEmptyState from '../components/ui/UiEmptyState.vue'
import UiModal from '../components/ui/UiModal.vue'
import UiListaItens from '../components/ui/UiListaItens.vue'
import UiPageHeader from '../components/ui/UiPageHeader.vue'
import UiTabs from '../components/ui/UiTabs.vue'
import UiTabela from '../components/ui/UiTabela.vue'
import VencimentosMapaRuptura from '../components/VencimentosMapaRuptura.vue'

const router = useRouter()
const route = useRoute()
const store = useVencimentosStore()
const toastStore = useAuditoriasStore()

// --- Estado ---
const arquivo = ref(null)
const carregando = ref(false)
const mostrarUpload = ref(false)
const hoverDrop = ref(false)
const inputRef = ref(null)

// Abas (3 tabs)
const abaAtiva = ref('visao')
const abas = ['visao', 'explorar', 'analise', 'mapa']
const abasDisplay = { visao: 'Visão Geral', explorar: 'Explorar', analise: 'Análise', mapa: 'Mapa e ruptura' }
const iconeAba = (tab) => ({
  visao: 'fas fa-chart-line',
  explorar: 'fas fa-search',
  analise: 'fas fa-chart-bar',
  mapa: 'fas fa-map-location-dot'
})[tab]
const abasVencimentos = abas.map(tab => ({ value: tab, label: abasDisplay[tab], icon: iconeAba(tab) }))

// Filtros que outras telas aplicam na tabela da aba Explorar (setor, situação, busca da rota).
const preFiltroVenc = ref([])
const buscaVenc = ref('')
const fornecedorSelecionado = ref('')

// Modais
const modalSetorAberto = ref(false)
const setorModalNome = ref('')
const modalFornecedorAberto = ref(false)

onMounted(() => {
  if (store.itens.length === 0) {
    mostrarUpload.value = true
  }
})

// --- Upload ---
const escolherArquivo = (e) => { arquivo.value = e.target.files?.[0] || null }
const onDropArquivo = (e) => {
  e.preventDefault()
  const f = e.dataTransfer?.files?.[0]
  if (f) arquivo.value = f
  hoverDrop.value = false
}
const onDragOverArquivo = (e) => { e.preventDefault(); hoverDrop.value = true }
const onDragLeaveArquivo = () => { hoverDrop.value = false }
const dispararSelecao = () => { inputRef.value?.click() }

const carregarPlanilha = async () => {
  if (!arquivo.value) {
    toastStore.addToast('Selecione um arquivo de vencimentos', 'warning')
    return
  }
  carregando.value = true
  try {
    await store.processarExcelVencimentos(arquivo.value)
    toastStore.addToast(`Planilha carregada: ${store.itens.length} itens`, 'success')
    mostrarUpload.value = false
    arquivo.value = null
  } catch (e) {
    toastStore.addToast('Erro ao processar arquivo: ' + (e?.message || 'desconhecido'), 'error')
  } finally {
    carregando.value = false
  }
}

const limparDados = async () => {
  if (!confirm('Tem certeza que deseja remover todos os dados de vencimentos?')) return
  await store.limparVencimentos()
  mostrarUpload.value = true
  abaAtiva.value = 'visao'
  toastStore.addToast('Dados de vencimentos removidos.', 'info')
}

const fecharModalUpload = () => {
  mostrarUpload.value = false

  if (store.itens.length > 0) return

  if (window.history.length > 1) {
    router.back()
    return
  }

  router.push('/')
}

// --- Formatacao ---
const formatarData = (d) => {
  if (!d || !(d instanceof Date) || isNaN(d)) return '—'
  const dia = String(d.getDate()).padStart(2, '0')
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const ano = d.getFullYear()
  return `${dia}/${mes}/${ano}`
}

const prazoBadgeClasses = (prazo) => ({
  'text-red-700 bg-red-50 border-red-200': prazo === 'vencidos',
  'text-orange-700 bg-orange-50 border-orange-200': prazo === 'hoje',
  'text-yellow-700 bg-yellow-50 border-yellow-200': prazo === 'ate3',
  'text-gray-700 bg-gray-50 border-gray-200': prazo === 'futuro'
})

const prazoBadgeLabel = (prazo) =>
  ({ vencidos: 'Vencido', hoje: 'Hoje', ate3: 'Até 3 dias', futuro: 'Futuro' })[prazo] || prazo

// --- Computed: Resumo ---
const resumo = computed(() => store.analise || { total: 0, vencidos: 0, hoje: 0, ate3: 0 })

// --- Computed: Alerta Banner ---
const alertaBanner = computed(() => {
  const r = resumo.value
  if (!r.total) return { icone: 'fas fa-info-circle', texto: 'Nenhum dado carregado.', classe: 'bg-slate-50 border-slate-200 text-slate-700', iconeCor: 'text-slate-400' }
  if (r.vencidos > 0) return { icone: 'fas fa-exclamation-circle', texto: `Atenção: ${r.vencidos} itens vencidos requerem ação imediata. ${r.hoje + r.ate3} itens vencem nos próximos 3 dias.`, classe: 'bg-red-50 border-red-200 text-red-800', iconeCor: 'text-red-500' }
  if (r.hoje + r.ate3 > 0) return { icone: 'fas fa-exclamation-triangle', texto: `${r.hoje} itens vencem hoje e ${r.ate3} nos próximos 3 dias. Planeje ações preventivas.`, classe: 'bg-amber-50 border-amber-200 text-amber-800', iconeCor: 'text-amber-500' }
  return { icone: 'fas fa-check-circle', texto: 'Todas as validades estao sob controle. Nenhum item critico encontrado.', classe: 'bg-emerald-50 border-emerald-200 text-emerald-800', iconeCor: 'text-emerald-500' }
})

// --- Computed: Itens Criticos (Visao Geral) ---
const itensCriticosPainel = computed(() => {
  const rank = { vencidos: 0, hoje: 1, ate3: 2 }
  return store.itens
    .filter(i => ['vencidos', 'hoje', 'ate3'].includes(i._prazo))
    .sort((a, b) => {
      const ra = rank[a._prazo] ?? 9
      const rb = rank[b._prazo] ?? 9
      if (ra !== rb) return ra - rb
      return (a._diasParaVencer ?? 9999) - (b._diasParaVencer ?? 9999)
    })
    .slice(0, 10)
})

const verCriticos = () => {
  preFiltroVenc.value = [{ chave: '_prazo', op: 'em', valor: ['Vencido', 'Hoje', 'Até 3 dias'] }]
  abaAtiva.value = 'explorar'
}

// --- Computed: Setores ---
const setores = computed(() => store.setores || [])

const linhasSetores = computed(() => {
  const a = store.analise?.porSetor || {}
  return Object.entries(a).map(([setor, dados]) => ({
    nome: setor,
    total: dados.total || 0,
    vencidos: dados.vencidos || 0,
    hoje: dados.hoje || 0,
    ate3: dados.ate3 || 0
  }))
    .sort((a, b) => b.vencidos - a.vencidos || b.hoje - a.hoje || b.ate3 - a.ate3)
})

const setoresAnalise = computed(() => {
  return linhasSetores.value.map(s => {
    const futuro = s.total - s.vencidos - s.hoje - s.ate3
    const maxVal = Math.max(s.vencidos, s.hoje, s.ate3, futuro, 1)
    return {
      ...s,
      futuro,
      maxVal,
      barVencidos: Math.round((s.vencidos / maxVal) * 100),
      barHoje: Math.round((s.hoje / maxVal) * 100),
      barAte3: Math.round((s.ate3 / maxVal) * 100),
      barFuturo: Math.round((futuro / maxVal) * 100)
    }
  })
})

const abrirModalSetor = (nome) => {
  setorModalNome.value = nome || 'Todos'
  modalSetorAberto.value = true
}
const fecharModalSetor = () => {
  modalSetorAberto.value = false
  setorModalNome.value = ''
}
const itensSetorModal = computed(() => {
  if (!setorModalNome.value || setorModalNome.value === 'Todos') return store.itens
  return store.itens.filter(i => i._setor === setorModalNome.value)
})

// Listas dos modais de setor e fornecedor.
const coresPrazo = { vencidos: 'bg-red-50 text-red-700', hoje: 'bg-orange-50 text-orange-700', ate3: 'bg-amber-50 text-amber-700', futuro: 'bg-slate-100 text-slate-600' }
const colunasListaVenc = [
  { chave: '_codigo', titulo: 'Código' },
  { chave: '_produto', titulo: 'Produto', largura: 'max-w-72' },
  { chave: '_setor', titulo: 'Setor', largura: 'max-w-40' },
  { chave: '_fornecedor', titulo: 'Fornecedor', largura: 'max-w-40' },
  { chave: '_local', titulo: 'Local' },
  { chave: '_validadeISO', titulo: 'Validade', valor: i => formatarDataBR(i._validadeISO) },
  { chave: '_diasParaVencer', titulo: 'Dias', alinhamento: 'right' },
  { chave: '_estoque', titulo: 'Estoque', alinhamento: 'right' },
  { chave: 'prazo', titulo: 'Status', alinhamento: 'center', valor: i => prazoBadgeLabel(i._prazo), badge: v => coresPrazo[Object.keys(coresPrazo).find(k => prazoBadgeLabel(k) === v)] || coresPrazo.futuro }
]
const facetasListaVenc = [
  { chave: 'prazo', titulo: 'Status', valor: i => prazoBadgeLabel(i._prazo) },
  { chave: '_setor', titulo: 'Setor' },
  { chave: '_fornecedor', titulo: 'Fornecedor' }
]
const resumoPrazos = lista => [
  ['vencidos', 'Vencidos', 'bg-red-50 text-red-800'],
  ['hoje', 'Vencem hoje', 'bg-orange-50 text-orange-800'],
  ['ate3', 'Até 3 dias', 'bg-amber-50 text-amber-800'],
  ['futuro', 'Futuros', 'bg-slate-50 text-slate-800']
].map(([chave, rotulo, fundo]) => ({ chave, rotulo, fundo, valor: lista.filter(i => i._prazo === chave).length }))

// --- Computed: Fornecedores ---
const fornecedores = computed(() => {
  const set = new Set()
  store.itens.forEach(i => { if (i._fornecedor) set.add(i._fornecedor) })
  return Array.from(set).sort()
})

const linhasFornecedores = computed(() => {
  const mapa = {}
  store.itens.forEach(i => {
    const f = i._fornecedor || '—'
    if (!mapa[f]) mapa[f] = { fornecedor: f, total: 0, vencidos: 0, hoje: 0, ate3: 0 }
    mapa[f].total++
    if (i._prazo === 'vencidos') mapa[f].vencidos++
    else if (i._prazo === 'hoje') mapa[f].hoje++
    else if (i._prazo === 'ate3') mapa[f].ate3++
  })
  return Object.values(mapa).sort((a, b) => b.vencidos - a.vencidos || b.hoje - a.hoje || b.ate3 - a.ate3)
})

const fornecedoresRanking = computed(() => {
  return linhasFornecedores.value
    .map(f => {
      const criticos = f.vencidos + f.hoje + f.ate3
      return { ...f, criticos }
    })
    .filter(f => f.criticos > 0)
    .slice(0, 15)
})

const abrirItensFornecedor = (row) => {
  fornecedorSelecionado.value = row.fornecedor
  modalFornecedorAberto.value = true
}
const limparFornecedor = () => {
  modalFornecedorAberto.value = false
  fornecedorSelecionado.value = ''
}
const itensFornecedor = computed(() => {
  if (!fornecedorSelecionado.value) return []
  return store.itens.filter(i => i._fornecedor === fornecedorSelecionado.value)
})

// --- Aba Explorar: itens que a tabela está mostrando (filtros da tabela padrão) ---
const itensFiltrados = ref([])

const navegarSetorExplorar = (nomeSetor) => {
  preFiltroVenc.value = [{ chave: '_setor', op: 'em', valor: [nomeSetor] }]
  abaAtiva.value = 'explorar'
}

// --- Estoque baixo (aba Explorar) ---
// Itens com menos de 10 unidades: pouco a perder, candidatos a sair do controle de validade.
const LIMITE_ESTOQUE_BAIXO = 10
const itensEstoqueBaixo = computed(() => itensFiltrados.value
  .filter(i => (Number(i._estoque) || 0) < LIMITE_ESTOQUE_BAIXO)
  .sort((a, b) => (Number(a._estoque) || 0) - (Number(b._estoque) || 0) || (a._diasParaVencer ?? 9999) - (b._diasParaVencer ?? 9999)))
const estoqueBaixoResumo = computed(() => {
  const lista = itensEstoqueBaixo.value
  return {
    total: lista.length,
    zerados: lista.filter(i => !(Number(i._estoque) > 0)).length,
    unidades: lista.reduce((t, i) => t + Math.max(0, Number(i._estoque) || 0), 0),
    parcela: itensFiltrados.value.length ? (lista.length / itensFiltrados.value.length) * 100 : 0
  }
})
const modalEstoqueBaixo = ref(false)

// --- Colunas da tabela padrão ---
const ROTULO_PRAZO = { vencidos: 'Vencido', hoje: 'Hoje', ate3: 'Até 3 dias', futuro: 'Futuro', desconhecido: 'Sem data' }
const COR_PRAZO = { Vencido: 'bg-red-100 text-red-700', Hoje: 'bg-orange-100 text-orange-700', 'Até 3 dias': 'bg-yellow-100 text-yellow-700', Futuro: 'bg-slate-100 text-slate-600', 'Sem data': 'bg-slate-100 text-slate-500' }
const colunasExplorar = [
  { chave: '_codigo', titulo: 'Código', tipo: 'texto' },
  { chave: '_produto', titulo: 'Produto', tipo: 'texto', largura: 'max-w-72' },
  { chave: '_setor', titulo: 'Setor', tipo: 'categoria', rapido: true },
  { chave: '_fornecedor', titulo: 'Fornecedor', tipo: 'categoria', rapido: true },
  { chave: '_local', titulo: 'Local', tipo: 'categoria', rapido: true },
  { chave: '_validadeISO', titulo: 'Validade', tipo: 'data' },
  { chave: '_diasParaVencer', titulo: 'Dias', tipo: 'numero' },
  { chave: '_estoque', titulo: 'Estoque', tipo: 'numero' },
  { chave: '_prazo', titulo: 'Status', tipo: 'categoria', valor: i => ROTULO_PRAZO[i._prazo] || i._prazo, badge: v => COR_PRAZO[v] || COR_PRAZO.Futuro },
  { chave: '_usuario', titulo: 'Usuário', tipo: 'categoria', oculta: true },
  { chave: '_situacao', titulo: 'Situação na planilha', tipo: 'categoria', oculta: true },
  { chave: '_ultimaCompraDate', titulo: 'Última compra', tipo: 'data', oculta: true }
]
const atalhosExplorar = [
  { rotulo: 'Vencidos', icone: 'fas fa-times-circle', condicoes: [{ chave: '_prazo', op: 'em', valor: ['Vencido'] }] },
  { rotulo: 'Hoje', icone: 'fas fa-clock', condicoes: [{ chave: '_prazo', op: 'em', valor: ['Hoje'] }] },
  { rotulo: 'Até 3 dias', icone: 'fas fa-hourglass-half', condicoes: [{ chave: '_prazo', op: 'em', valor: ['Até 3 dias'] }] },
  { rotulo: 'Próximos 7 dias', icone: 'fas fa-calendar-week', condicoes: [{ chave: '_diasParaVencer', op: 'entre', valor: '0', valor2: '7' }] },
  { rotulo: 'Estoque < 10', icone: 'fas fa-box-open', condicoes: [{ chave: '_estoque', op: 'menor', valor: '10' }] }
]
const colunasFornecedores = [
  { chave: 'fornecedor', titulo: 'Fornecedor', tipo: 'texto' },
  { chave: 'total', titulo: 'Total', tipo: 'numero' },
  { chave: 'vencidos', titulo: 'Vencidos', tipo: 'numero', badge: v => (v ? 'bg-red-100 text-red-700' : 'text-slate-400') },
  { chave: 'hoje', titulo: 'Hoje', tipo: 'numero', badge: v => (v ? 'bg-orange-100 text-orange-700' : 'text-slate-400') },
  { chave: 'ate3', titulo: 'Até 3 dias', tipo: 'numero', badge: v => (v ? 'bg-yellow-100 text-yellow-700' : 'text-slate-400') },
  { chave: 'criticos', titulo: 'Críticos', tipo: 'numero', valor: f => f.vencidos + f.hoje + f.ate3 }
]
const colunasSetores = [
  { chave: 'nome', titulo: 'Setor', tipo: 'texto' },
  { chave: 'total', titulo: 'Total', tipo: 'numero' },
  { chave: 'vencidos', titulo: 'Vencidos', tipo: 'numero', badge: v => (v ? 'bg-red-100 text-red-700' : 'text-slate-400') },
  { chave: 'hoje', titulo: 'Hoje', tipo: 'numero', badge: v => (v ? 'bg-orange-100 text-orange-700' : 'text-slate-400') },
  { chave: 'ate3', titulo: 'Até 3d', tipo: 'numero', badge: v => (v ? 'bg-yellow-100 text-yellow-700' : 'text-slate-400') },
  { chave: 'futuro', titulo: 'Futuros', tipo: 'numero' }
]

// --- Sort / Filter / Paginate helpers ---
const sortVenc = (lista, ordenacao) => {
  const col = ordenacao.coluna
  const dir = ordenacao.direcao
  return [...lista].sort((a, b) => {
    const va = a[col]; const vb = b[col]
    if (typeof va === 'number' && typeof vb === 'number') return dir === 'asc' ? va - vb : vb - va
    return dir === 'asc' ? String(va ?? '').localeCompare(String(vb ?? ''), 'pt-BR', { numeric: true }) : String(vb ?? '').localeCompare(String(va ?? ''), 'pt-BR', { numeric: true })
  })
}

// --- Impressao ---
const { abrir: abrirSeletor } = useRelatorio()
const colunasRelatorio = [
  { chave: '_codigo', titulo: 'Código' }, { chave: '_produto', titulo: 'Produto' }, { chave: '_setor', titulo: 'Setor' },
  { chave: '_fornecedor', titulo: 'Fornecedor' }, { chave: '_local', titulo: 'Local' },
  { chave: '_validadeISO', titulo: 'Validade', valor: i => formatarDataBR(i._validadeISO) },
  { chave: '_diasParaVencer', titulo: 'Dias', alinhamento: 'right' }, { chave: '_estoque', titulo: 'Estoque', alinhamento: 'right' },
  { chave: '_prazo', titulo: 'Situação', valor: i => prazoBadgeLabel(i._prazo) }
]
// Relatório geral de validades para a liderança.
const imprimirRelatorio = () => {
  const r = resumo.value
  const itensComData = store.itens.map(i => ({ ...i, _validadeISO: i._validadeISO || formatarData(i._validadeDate) }))
  const criticos = sortVenc(itensComData.filter(i => ['vencidos', 'hoje'].includes(i._prazo)), { coluna: '_diasParaVencer', direcao: 'asc' })
  const proximos = sortVenc(itensComData.filter(i => i._prazo === 'ate3'), { coluna: '_diasParaVencer', direcao: 'asc' })
  const cruzamento = cruzarValidadeRuptura(store.itens, toastStore.auditorias || [])
  const int = v => (Number(v) || 0).toLocaleString('pt-BR')
  const tabelaItens = (lista, colunas) => blocoTabela({
    colunas: colunasRelatorio.filter(c => colunas.includes(c.chave)).map(c => ({ chave: c.chave, titulo: c.titulo, alinhamento: c.alinhamento })),
    linhas: lista.map(item => Object.fromEntries(colunasRelatorio.map(c => [c.chave, c.valor ? c.valor(item) : item[c.chave] ?? '—'])))
  })
  const tomSetor = s => (s.vencidos ? 'ruim' : s.hoje ? 'alerta' : 'bom')
  abrirSeletor({
    id: 'vencimentos',
    titulo: 'Relatório de vencimentos',
    subtitulo: `Situação em ${new Date().toLocaleDateString('pt-BR')}`,
    contexto: [
      { rotulo: 'Itens monitorados', valor: int(r.total) },
      { rotulo: 'Setores', valor: int(linhasSetores.value.length) },
      { rotulo: 'Fornecedores', valor: int(fornecedores.value.length) },
    ],
    indicadores: [
      { rotulo: 'Vencidos', valor: int(r.vencidos), detalhe: 'retirar da venda', tom: r.vencidos ? 'ruim' : 'bom' },
      { rotulo: 'Vencem hoje', valor: int(r.hoje), detalhe: 'ação imediata', tom: r.hoje ? 'alerta' : 'bom' },
      { rotulo: 'Até 3 dias', valor: int(r.ate3), detalhe: 'rebaixa / exposição', tom: r.ate3 ? 'alerta' : 'bom' },
      { rotulo: 'Total', valor: int(r.total), tom: 'neutro' }
    ],
    assinaturaPadrao: true,
    colunas: { lista: colunasRelatorio.map(c => ({ chave: c.chave, titulo: c.titulo })), padrao: ['_codigo', '_produto', '_setor', '_local', '_validadeISO', '_diasParaVencer', '_estoque'] },
    secoes: [
      { id: 'tabela', titulo: `Vencidos e vencem hoje (${criticos.length})`, descricao: 'Itens para retirar ou tratar hoje, do mais antigo ao mais recente.', gerar: ({ colunas }) => tabelaItens(criticos, colunas) || '<p class="nota">Nenhum item vencido ou vencendo hoje.</p>' },
      { id: 'proximos', titulo: `Vencem em até 3 dias (${proximos.length})`, descricao: 'Itens para rebaixa ou reforço de exposição.', padrao: false, gerar: ({ colunas }) => tabelaItens(proximos, colunas) },
      { id: 'setores', titulo: 'Por setor', descricao: 'Quantidade por situação em cada setor.', gerar: () => blocoTabela({
        colunas: [
          { chave: 'nome', titulo: 'Setor' }, { chave: 'total', titulo: 'Itens', alinhamento: 'right' },
          { chave: 'vencidos', titulo: 'Vencidos', alinhamento: 'right', html: (v, l) => (v ? selo(int(v), tomSetor(l)) : '0') },
          { chave: 'hoje', titulo: 'Hoje', alinhamento: 'right' }, { chave: 'ate3', titulo: 'Até 3 dias', alinhamento: 'right' }, { chave: 'futuro', titulo: 'Futuros', alinhamento: 'right' }
        ],
        linhas: setoresAnalise.value
      }) },
      ...(fornecedoresRanking.value.length ? [{ id: 'fornecedores', titulo: 'Fornecedores com itens críticos', descricao: 'Top 15 por vencidos, hoje e até 3 dias.', gerar: () => blocoBarras({
        titulo: 'Itens críticos por fornecedor',
        barras: fornecedoresRanking.value.map(f => ({ rotulo: f.fornecedor, valor: f.criticos, texto: `${f.criticos} · ${f.vencidos} venc. · ${f.hoje} hoje · ${f.ate3} até 3d`, tom: f.vencidos ? 'ruim' : 'alerta' }))
      }) }] : []),
      ...(cruzamento.length ? [{ id: 'cruzamento', titulo: 'Vence no estoque, falta na gôndola', descricao: 'Produtos com validade próxima que já faltaram na gôndola em auditorias de Presença/Ruptura.', padrao: false, gerar: () => blocoTabela({
        colunas: [
          { chave: 'codigo', titulo: 'Código' }, { chave: 'produto', titulo: 'Produto' }, { chave: 'setor', titulo: 'Setor' },
          { chave: 'validade', titulo: 'Validade', format: v => formatarDataBR(v) }, { chave: 'estoque', titulo: 'Estoque', alinhamento: 'right' },
          { chave: 'vezesRuptura', titulo: 'Faltou (vezes)', alinhamento: 'right' }, { chave: 'diagnostico', titulo: 'Diagnóstico' }
        ],
        linhas: cruzamento.slice(0, 60)
      }) }] : [])
    ]
  })
}

// Links externos (ex.: busca global) podem abrir a aba Explorar já filtrada.
const aplicarFiltrosDaRota = () => {
  const { busca: termo, prazo, setor } = route.query
  if (!termo && !prazo && !setor) return
  if (typeof termo === 'string') buscaVenc.value = termo
  const conds = []
  if (typeof prazo === 'string') conds.push({ chave: '_prazo', op: 'em', valor: [ROTULO_PRAZO[prazo] || prazo] })
  if (typeof setor === 'string') conds.push({ chave: '_setor', op: 'em', valor: [setor] })
  if (conds.length) preFiltroVenc.value = conds
  abaAtiva.value = 'explorar'
}
watch(() => route.query, aplicarFiltrosDaRota, { immediate: true })

// Imagem quadrada para o WhatsApp (mesmo formato da imagem do relatório de auditoria).
const imagemVencimentos = ref(null)
const gerandoImagemVenc = ref(false)
const exportarDetalhamentoSetor = async () => {
  if (!imagemVencimentos.value) return
  gerandoImagemVenc.value = true
  try {
    await imagemVencimentos.value.salvar()
  } catch (error) {
    toastStore.addToast(`Não foi possível gerar a imagem: ${error?.message || error}`, 'error')
  } finally {
    gerandoImagemVenc.value = false
  }
}
</script>

<template>
  <div class="min-h-[calc(100vh-4rem)]">
    <div class="ui-page">

      <!-- ===== HEADER ===== -->
      <UiPageHeader title="Vencimentos" subtitle="Controle de validades e itens críticos." icon="fas fa-calendar-alt" tone="orange">
        <template #actions>
          <UiButton v-if="store.itens.length > 0" @click="mostrarUpload = true">
            <i class="fas fa-file-upload mr-2"></i>Nova Importação
          </UiButton>
          <UiButton v-if="store.itens.length > 0" variant="secondary" @click="imprimirRelatorio">
            <i class="fas fa-file-pdf mr-2"></i>Relatório
          </UiButton>
          <UiButton v-if="store.itens.length > 0" variant="dangerSoft" @click="limparDados">
            <i class="fas fa-trash-alt mr-1"></i>Limpar
          </UiButton>
        </template>
      </UiPageHeader>

      <!-- ===== UPLOAD MODAL ===== -->
      <UiModal v-if="mostrarUpload" title="Importar planilha de vencimentos" subtitle="Arraste ou selecione um arquivo .xlsx ou .csv" @close="fecharModalUpload">
          <div class="space-y-4">
            <div
              class="rounded-xl border border-dashed border-slate-300 p-8 flex flex-col items-center justify-center text-center transition cursor-pointer"
              :class="hoverDrop ? 'bg-blue-50' : 'hover:bg-slate-50'"
              @dragover="onDragOverArquivo" @dragleave="onDragLeaveArquivo" @drop="onDropArquivo"
              @click="dispararSelecao">
              <i class="fas fa-file-excel text-4xl text-green-600 mb-3"></i>
              <p class="text-gray-700 font-medium" v-if="!arquivo">Solte o arquivo aqui ou clique para selecionar</p>
              <p class="text-gray-700 font-medium" v-else>{{ arquivo.name }} ({{ Math.ceil(arquivo.size / 1024) }} KB)
              </p>
              <input ref="inputRef" type="file" accept=".xlsx,.csv" class="hidden" @change="escolherArquivo" />
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <UiButton @click="carregarPlanilha" :disabled="!arquivo || carregando">
                <i v-if="!carregando" class="fas fa-file-import mr-2"></i>
                <i v-else class="fas fa-spinner fa-spin mr-2"></i>
                {{ carregando ? 'Processando...' : 'Importar' }}
              </UiButton>
              <UiButton v-if="store.itens.length === 0" variant="secondary" @click="fecharModalUpload">
                Dispensar
              </UiButton>
              <UiButton variant="ghost" @click="arquivo = null" :disabled="carregando">
                Limpar
              </UiButton>
            </div>
          </div>
      </UiModal>

      <!-- ===== EMPTY STATE ===== -->
      <UiEmptyState v-if="store.itens.length === 0 && !mostrarUpload" title="Nenhum dado de vencimento carregado" description="Importe uma planilha para começar a monitorar as validades." icon="fas fa-box-open">
        <template #actions>
          <UiButton @click="mostrarUpload = true"><i class="fas fa-file-upload"></i>Importar planilha</UiButton>
        </template>
      </UiEmptyState>

      <!-- ===== TAB BAR ===== -->
      <UiTabs v-if="store.itens.length > 0" v-model="abaAtiva" :items="abasVencimentos" sticky />

      <!-- ============================================================ -->
      <!-- ===== TAB 1: VISAO GERAL ===== -->
      <!-- ============================================================ -->
      <template v-if="store.itens.length > 0 && abaAtiva === 'visao'">
        <div class="space-y-4">
          <!-- Alert Banner -->
          <div class="rounded-xl border p-4 flex items-center gap-4" :class="alertaBanner.classe">
            <div class="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" :class="alertaBanner.iconeCor">
              <i :class="alertaBanner.icone" class="text-xl"></i>
            </div>
            <p class="text-sm font-medium flex-1">{{ alertaBanner.texto }}</p>
            <button v-if="resumo.vencidos > 0" @click="verCriticos"
              class="px-3 py-1.5 rounded-lg bg-white text-sm font-semibold shadow-sm hover:bg-white transition shrink-0 border border-red-300 text-red-700">
              Ver itens
            </button>
          </div>
  
          <!-- Números do dia -->
          <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard title="Itens monitorados" :value="resumo.total" description="Com validade cadastrada." icon="fas fa-boxes" tone="blue" />
            <StatCard title="Vencidos" :value="resumo.vencidos" description="Retirar da venda hoje." icon="fas fa-triangle-exclamation" tone="red" :critical="resumo.vencidos > 0" />
            <StatCard title="Vencem hoje" :value="resumo.hoje" description="Rebaixar e expor na frente." icon="fas fa-sun" tone="amber" />
            <StatCard title="Vencem em até 3 dias" :value="resumo.ate3" description="Planejar rebaixa e giro." icon="fas fa-hourglass-half" tone="amber" />
          </div>

          <!-- Sector Breakdown (Table) -->
          <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div class="px-5 pt-5 md:px-6 md:pt-6 pb-3 flex items-center justify-between gap-3">
              <div>
                <h2 class="text-base font-bold text-gray-900">Detalhamento por Setor</h2>
                <p class="text-xs text-slate-500 mt-0.5">Distribuicao de itens por status em cada setor. Clique para ver
                  detalhes.</p>
              </div>
              <div class="flex items-center gap-2">
                <button type="button" :disabled="gerandoImagemVenc" title="Imagem quadrada para compartilhar no WhatsApp" @click="exportarDetalhamentoSetor"
                  class="ui-btn-secondary py-1.5 text-xs print:hidden">
                  <i :class="gerandoImagemVenc ? 'fas fa-spinner fa-spin' : 'fas fa-image'"></i>
                  Salvar imagem
                </button>
                <span class="text-xs text-slate-400 font-medium">{{ setoresAnalise.length }} setores</span>
              </div>
            </div>
            <div class="px-5 pb-5 md:px-6">
              <UiTabela id="vencimentos-setores" titulo="Vencimentos por setor" :itens="setoresAnalise" :colunas="colunasSetores" :ordem-inicial="[{ chave: 'vencidos', direcao: 'desc' }, { chave: 'hoje', direcao: 'desc' }, { chave: 'ate3', direcao: 'desc' }]" chave-item="nome" clicavel :agrupavel="false" @linha="abrirModalSetor($event.nome)" />
            </div>
          </div>
        </div>

        <!-- Critical Items (Timeline Style) -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-100 p-5 md:p-6">
          <div class="flex items-center justify-between mb-5">
            <div>
              <h2 class="text-base font-bold text-gray-900">Itens mais urgentes</h2>
              <p class="text-xs text-slate-500">Os 10 com validade mais próxima.</p>
            </div>
            <button @click="verCriticos"
              class="text-xs text-orange-600 hover:text-orange-800 font-semibold flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-orange-50 transition">
              Ver todos
            </button>
          </div>

          <div v-if="itensCriticosPainel.length === 0" class="text-center py-10 text-gray-400">
            <i class="fas fa-check-circle text-4xl mb-3 text-emerald-400"></i>
            <p class="text-sm font-medium">Nenhum item critico encontrado</p>
          </div>

          <ul v-else class="-mx-5 divide-y divide-slate-100 border-t border-slate-100 md:-mx-6">
            <li v-for="(item, idx) in itensCriticosPainel" :key="item._codigo + item._validadeISO + idx" class="flex items-center gap-3 px-5 py-2.5 md:px-6">
              <span class="w-20 shrink-0 rounded-md border px-2 py-0.5 text-center text-xs font-semibold" :class="prazoBadgeClasses(item._prazo)">{{ prazoBadgeLabel(item._prazo) }}</span>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-semibold text-slate-900">{{ item._produto }}</p>
                <p class="truncate text-xs text-slate-500">{{ item._codigo }}, {{ item._setor }}<template v-if="item._fornecedor">, {{ item._fornecedor }}</template></p>
              </div>
              <div class="shrink-0 text-right">
                <p class="text-sm font-semibold tabular-nums" :class="item._prazo === 'vencidos' ? 'text-red-700' : item._prazo === 'hoje' ? 'text-orange-700' : 'text-amber-700'">
                  {{ item._diasParaVencer === 0 ? 'Hoje' : item._diasParaVencer < 0 ? `há ${Math.abs(item._diasParaVencer)} dia(s)` : `em ${item._diasParaVencer} dia(s)` }}
                </p>
                <p class="text-xs text-slate-400">{{ formatarData(item._validadeDate) }}</p>
              </div>
            </li>
          </ul>
        </div>

      </template>

      <!-- ============================================================ -->
      <!-- ===== TAB 2: EXPLORAR ===== -->
      <!-- ============================================================ -->
      <template v-if="store.itens.length > 0 && abaAtiva === 'explorar'">

        <!-- Estoque baixo: candidatos a sair do controle de validade -->
        <section v-if="itensEstoqueBaixo.length" class="flex flex-col gap-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100 sm:flex-row sm:items-center">
          <span class="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><i class="fas fa-box-open text-lg" aria-hidden="true"></i></span>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-bold text-slate-900">{{ estoqueBaixoResumo.total.toLocaleString('pt-BR') }} item(ns) com menos de {{ LIMITE_ESTOQUE_BAIXO }} unidades podem sair do controle de validade</p>
            <p class="text-xs text-slate-500">
              {{ estoqueBaixoResumo.parcela.toFixed(0) }}% da lista atual, {{ estoqueBaixoResumo.unidades.toLocaleString('pt-BR') }} unidades no total<template v-if="estoqueBaixoResumo.zerados">, {{ estoqueBaixoResumo.zerados }} sem estoque</template>.
              Pouco a perder: conferir na gôndola e excluir da planilha de validade.
            </p>
          </div>
          <button type="button" class="ui-btn-secondary shrink-0 py-2 text-xs" @click="modalEstoqueBaixo = true"><i class="fas fa-list-check"></i>Ver itens para excluir</button>
        </section>

        <div class="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <UiTabela id="vencimentos-explorar" titulo="Vencimentos" :itens="store.itens" :colunas="colunasExplorar" :atalhos="atalhosExplorar" :filtros-iniciais="preFiltroVenc" :busca-inicial="buscaVenc" :ordem-inicial="{ chave: '_diasParaVencer', direcao: 'asc' }" :chave-item="i => i._codigo + '|' + i._validadeISO + '|' + i.id" placeholder="Buscar código, produto, setor, fornecedor ou local..." @filtrados="itensFiltrados = $event" />
        </div>

        <div class="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <div class="mb-3">
            <h2 class="text-base font-bold text-gray-900">Resumo por fornecedor</h2>
            <p class="text-xs text-slate-500">Clique em um fornecedor para ver os itens dele.</p>
          </div>
          <UiTabela id="vencimentos-fornecedores" titulo="Vencimentos por fornecedor" :itens="linhasFornecedores" :colunas="colunasFornecedores" :ordem-inicial="[{ chave: 'vencidos', direcao: 'desc' }, { chave: 'hoje', direcao: 'desc' }, { chave: 'ate3', direcao: 'desc' }]" chave-item="fornecedor" :tamanho-pagina="10" clicavel :agrupavel="false" @linha="abrirItensFornecedor" />
        </div>
      </template>

      <!-- ============================================================ -->
      <!-- ===== TAB 3: ANALISE ===== -->
      <!-- ============================================================ -->
      <VencimentosMapaRuptura v-if="store.itens.length > 0 && abaAtiva === 'mapa'" :itens="store.itens" :auditorias="toastStore.auditorias" />

      <template v-if="store.itens.length > 0 && abaAtiva === 'analise'">

        <!-- Sector Breakdown (List) -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-100 p-5 md:p-6">
          <div class="flex items-center justify-between mb-5">
            <div>
              <h2 class="text-base font-bold text-gray-900">Detalhamento por Setor</h2>
              <p class="text-xs text-slate-500">Distribuicao de itens por status em cada setor. Clique para ver
                detalhes.</p>
            </div>
          </div>

          <div class="space-y-3">
            <div v-for="setor in setoresAnalise" :key="setor.nome" @click="abrirModalSetor(setor.nome)"
              class="flex items-center gap-4 px-4 py-3.5 rounded-xl border cursor-pointer hover:border-orange-300 hover:shadow-sm transition-all group"
              :class="setor.vencidos > 0 ? 'bg-red-50/70 border-red-200' : setor.hoje > 0 ? 'bg-orange-50/70 border-orange-200' : setor.ate3 > 0 ? 'bg-yellow-50/70 border-yellow-200' : 'bg-white border-slate-200'">

              <!-- Sector name + total -->
              <div class="flex-1 min-w-0">
                <p class="text-sm font-bold text-gray-900 truncate group-hover:text-orange-600 transition-colors">{{
                  setor.nome }}</p>
                <p class="text-[11px] text-slate-400 mt-0.5">{{ setor.total }} itens</p>
              </div>

              <!-- Status badges -->
              <div class="flex items-center gap-2 shrink-0">
                <div
                  class="flex flex-col items-center px-2.5 py-1 rounded-lg bg-red-50 border border-red-200 min-w-[52px]">
                  <span class="text-sm font-bold text-red-700 tabular-nums">{{ setor.vencidos }}</span>
                  <span class="text-[9px] text-red-500 font-medium">Vencidos</span>
                </div>
                <div
                  class="flex flex-col items-center px-2.5 py-1 rounded-lg bg-orange-50 border border-orange-200 min-w-[52px]">
                  <span class="text-sm font-bold text-orange-700 tabular-nums">{{ setor.hoje }}</span>
                  <span class="text-[9px] text-orange-500 font-medium">Hoje</span>
                </div>
                <div
                  class="flex flex-col items-center px-2.5 py-1 rounded-lg bg-yellow-50 border border-yellow-200 min-w-[52px]">
                  <span class="text-sm font-bold text-yellow-700 tabular-nums">{{ setor.ate3 }}</span>
                  <span class="text-[9px] text-yellow-600 font-medium">Até 3d</span>
                </div>
              </div>

              <i class="fas fa-chevron-right text-slate-300 group-hover:text-orange-400 transition-colors shrink-0"></i>
            </div>
          </div>
        </div>

        <!-- Supplier Ranking (Leaderboard) -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-100 p-5 md:p-6">
          <div class="flex items-center justify-between mb-5">
            <div>
              <h2 class="text-base font-bold text-gray-900">Ranking de Fornecedores</h2>
              <p class="text-xs text-slate-500">Fornecedores com mais itens criticos (vencidos + hoje + ate 3 dias)</p>
            </div>
          </div>

          <div v-if="fornecedoresRanking.length === 0" class="text-center py-8 text-slate-400">
            <i class="fas fa-trophy text-3xl mb-2 text-emerald-400"></i>
            <p class="text-sm">Nenhum fornecedor com itens criticos</p>
          </div>

          <div v-else class="space-y-3">
            <div v-for="(forn, idx) in fornecedoresRanking" :key="forn.fornecedor" @click="abrirItensFornecedor(forn)"
              class="flex items-center gap-4 px-4 py-3 rounded-xl bg-white border border-slate-200 cursor-pointer hover:border-slate-300 hover:shadow-sm transition-all">

              <span class="text-lg font-extrabold tabular-nums shrink-0 w-8 text-center"
                :class="idx === 0 ? 'text-red-600' : idx === 1 ? 'text-orange-500' : idx === 2 ? 'text-yellow-500' : 'text-slate-400'">
                {{ idx + 1 }}
              </span>

              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-gray-900 truncate">{{ forn.fornecedor }}</p>
                <div class="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden mt-1.5 flex">
                  <div v-if="forn.vencidos > 0" class="h-full bg-red-500 transition-all duration-500"
                    :style="{ width: (forn.vencidos / forn.criticos * 100) + '%' }"></div>
                  <div v-if="forn.hoje > 0" class="h-full bg-orange-400 transition-all duration-500"
                    :style="{ width: (forn.hoje / forn.criticos * 100) + '%' }"></div>
                  <div v-if="forn.ate3 > 0" class="h-full bg-yellow-400 transition-all duration-500"
                    :style="{ width: (forn.ate3 / forn.criticos * 100) + '%' }"></div>
                </div>
              </div>

              <div class="flex items-center gap-2 shrink-0 text-xs">
                <span class="px-2 py-0.5 rounded-md bg-red-50 text-red-700 font-bold border border-red-200"
                  title="Vencidos">{{ forn.vencidos }}</span>
                <span class="px-2 py-0.5 rounded-md bg-orange-50 text-orange-700 font-bold border border-orange-200"
                  title="Hoje">{{ forn.hoje }}</span>
                <span class="px-2 py-0.5 rounded-md bg-yellow-50 text-yellow-700 font-bold border border-yellow-200"
                  title="Ate 3 dias">{{ forn.ate3 }}</span>
                <span class="font-extrabold text-sm text-slate-700">{{ forn.criticos }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- ===== MODAL SETOR ===== -->
      <UiModal v-if="modalSetorAberto" :title="setorModalNome === 'Todos' ? 'Todos os setores' : setorModalNome" :subtitle="`${itensSetorModal.length} itens com validade monitorada`" width="max-w-6xl" @close="fecharModalSetor">
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div v-for="f in resumoPrazos(itensSetorModal)" :key="f.chave" class="rounded-xl p-3" :class="f.fundo">
              <p class="text-xs font-semibold opacity-80">{{ f.rotulo }}</p>
              <p class="text-xl font-bold">{{ f.valor }}</p>
            </div>
          </div>
          <UiListaItens :itens="itensSetorModal" :colunas="colunasListaVenc" :facetas="facetasListaVenc" :titulo="`Vencimentos - ${setorModalNome}`" :ordem-inicial="{ chave: '_diasParaVencer', direcao: 'asc' }" />
        </div>
      </UiModal>
      <!-- ===== MODAL FORNECEDOR ===== -->
      <UiModal v-if="modalFornecedorAberto && fornecedorSelecionado" :title="fornecedorSelecionado" :subtitle="`${itensFornecedor.length} itens deste fornecedor`" width="max-w-6xl" @close="limparFornecedor">
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div v-for="f in resumoPrazos(itensFornecedor)" :key="f.chave" class="rounded-xl p-3" :class="f.fundo">
              <p class="text-xs font-semibold opacity-80">{{ f.rotulo }}</p>
              <p class="text-xl font-bold">{{ f.valor }}</p>
            </div>
          </div>
          <UiListaItens :itens="itensFornecedor" :colunas="colunasListaVenc" :facetas="facetasListaVenc" :titulo="`Vencimentos - ${fornecedorSelecionado}`" :ordem-inicial="{ chave: '_diasParaVencer', direcao: 'asc' }" />
        </div>
      </UiModal>

    <UiModal v-if="modalEstoqueBaixo" title="Itens para excluir da validade" :subtitle="`${itensEstoqueBaixo.length} item(ns) com menos de ${LIMITE_ESTOQUE_BAIXO} unidades nos filtros atuais`" width="max-w-6xl" @close="modalEstoqueBaixo = false">
      <UiListaItens :itens="itensEstoqueBaixo" :colunas="colunasListaVenc" :facetas="facetasListaVenc" titulo="Itens para excluir da validade (estoque baixo)" :ordem-inicial="{ chave: '_estoque', direcao: 'asc' }" />
    </UiModal>
    <ImagemVencimentos ref="imagemVencimentos" :resumo="resumo" :setores="setoresAnalise" :urgentes="itensCriticosPainel" />
    </div>
  </div>
</template>
