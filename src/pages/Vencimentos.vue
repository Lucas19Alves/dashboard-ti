<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toPng } from 'html-to-image'
import { useVencimentosStore } from '../stores/vencimentosStore'
import { useAuditoriasStore } from '../stores/auditoriasStore'
import { printTableInNewWindow } from '../utils/print'
import { baixarCsv } from '../utils/csv'
import UiButton from '../components/ui/UiButton.vue'
import UiEmptyState from '../components/ui/UiEmptyState.vue'
import UiModal from '../components/ui/UiModal.vue'
import UiPageHeader from '../components/ui/UiPageHeader.vue'
import UiTabs from '../components/ui/UiTabs.vue'

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
const abas = ['visao', 'explorar', 'analise']
const abasDisplay = { visao: 'Visão Geral', explorar: 'Explorar', analise: 'Análise' }
const iconeAba = (tab) => ({
  visao: 'fas fa-chart-line',
  explorar: 'fas fa-search',
  analise: 'fas fa-chart-bar'
})[tab]
const abasVencimentos = abas.map(tab => ({ value: tab, label: abasDisplay[tab], icon: iconeAba(tab) }))

// Filtros (aba Explorar)
const filtroSetor = ref('')
const filtroFornecedor = ref('')
const filtroStatus = ref('')
const busca = ref('')
const setorFocus = ref('')
const fornecedorSelecionado = ref('')

// Modais
const modalSetorAberto = ref(false)
const setorModalNome = ref('')
const modalFornecedorAberto = ref(false)
const modalAcaoAberto = ref(false)
const itemAcao = ref(null)
const formularioAcao = ref({ acao: 'Verificar na gôndola', responsavel: '' })

// --- Table state ---
const paginaItensFiltrados = ref(1)
const buscaItensFiltrados = ref('')
const ordenacaoItensFiltrados = ref({ coluna: '_diasParaVencer', direcao: 'asc' })
const itensPorPaginaFiltrados = 15

const paginaFornecedoresTab = ref(1)
const buscaFornecedoresTab = ref('')
const ordenacaoFornecedoresTab = ref({ coluna: 'vencidos', direcao: 'desc' })
const itensPorPaginaFornecedores = 10

const paginaSetorModal = ref(1)
const buscaSetorModal = ref('')
const ordenacaoSetorModal = ref({ coluna: '_diasParaVencer', direcao: 'asc' })
const itensPorPaginaSetorModal = 12

const paginaFornecedorModal = ref(1)
const buscaFornecedorModal = ref('')
const ordenacaoFornecedorModal = ref({ coluna: '_diasParaVencer', direcao: 'asc' })
const itensPorPaginaFornecedorModal = 12
const detalhamentoSetorExportRef = ref(null)

// Status filter pills config
const statusPills = [
  { valor: '', label: 'Todos', icone: 'fas fa-layer-group', cor: 'bg-slate-100 text-slate-700 border-slate-200', corAtiva: 'bg-slate-700 text-white border-slate-700' },
  { valor: 'vencidos', label: 'Vencidos', icone: 'fas fa-times-circle', cor: 'bg-red-50 text-red-700 border-red-200', corAtiva: 'bg-red-600 text-white border-red-600' },
  { valor: 'hoje', label: 'Hoje', icone: 'fas fa-clock', cor: 'bg-orange-50 text-orange-700 border-orange-200', corAtiva: 'bg-orange-500 text-white border-orange-500' },
  { valor: 'ate3', label: 'Até 3 dias', icone: 'fas fa-hourglass-half', cor: 'bg-yellow-50 text-yellow-700 border-yellow-200', corAtiva: 'bg-yellow-500 text-white border-yellow-500' },
  { valor: 'futuro', label: 'Futuro', icone: 'fas fa-check-circle', cor: 'bg-green-50 text-green-700 border-green-200', corAtiva: 'bg-green-600 text-white border-green-600' }
]

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

const abrirAcao = item => {
  itemAcao.value = item
  formularioAcao.value = {
    acao: item._acao || 'Verificar na gôndola',
    responsavel: item._responsavel || ''
  }
  modalAcaoAberto.value = true
}

const salvarAcao = async () => {
  try {
    await store.registrarAcao(itemAcao.value, formularioAcao.value.acao, formularioAcao.value.responsavel)
    toastStore.addToast('Ação registrada no histórico do item.', 'success')
    modalAcaoAberto.value = false
  } catch (error) {
    toastStore.addToast(error?.message || 'Não foi possível registrar a ação.', 'error')
  }
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
  filtroStatus.value = 'vencidos'
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
  paginaSetorModal.value = 1
  buscaSetorModal.value = ''
  ordenacaoSetorModal.value = { coluna: '_diasParaVencer', direcao: 'asc' }
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
  paginaFornecedorModal.value = 1
  buscaFornecedorModal.value = ''
  ordenacaoFornecedorModal.value = { coluna: '_diasParaVencer', direcao: 'asc' }
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

// --- Computed: Filtros (aba Explorar) ---
const itensFiltrados = computed(() => {
  const q = busca.value.toLowerCase().trim()
  const setSel = (filtroSetor.value || setorFocus.value || '').toLowerCase().trim()
  const fornSel = (filtroFornecedor.value || '').toLowerCase().trim()
  const stSel = (filtroStatus.value || '').toLowerCase().trim()
  return store.itens.filter(i => {
    const matchBusca = !q || (String(i._produto).toLowerCase().includes(q) || String(i._codigo).toLowerCase().includes(q))
    const matchSetor = !setSel || String(i._setor).toLowerCase().trim() === setSel
    const matchForn = !fornSel || String(i._fornecedor).toLowerCase().trim() === fornSel
    const matchStatus = !stSel || String(i._prazo) === stSel
    return matchBusca && matchSetor && matchForn && matchStatus
  })
})

const temFiltrosAtivos = computed(() => busca.value || filtroSetor.value || filtroFornecedor.value || filtroStatus.value)

const filtrosAtivos = computed(() => {
  const tags = []
  if (busca.value) tags.push({ tipo: 'busca', label: `Busca: "${busca.value}"`, limpar: () => { busca.value = '' } })
  if (filtroSetor.value) tags.push({ tipo: 'setor', label: `Setor: ${filtroSetor.value}`, limpar: () => { filtroSetor.value = '' } })
  if (filtroFornecedor.value) tags.push({ tipo: 'fornecedor', label: `Fornecedor: ${filtroFornecedor.value}`, limpar: () => { filtroFornecedor.value = '' } })
  if (filtroStatus.value) tags.push({ tipo: 'status', label: `Status: ${prazoBadgeLabel(filtroStatus.value)}`, limpar: () => { filtroStatus.value = '' } })
  return tags
})

const limparTodosFiltros = () => {
  busca.value = ''
  filtroSetor.value = ''
  filtroFornecedor.value = ''
  filtroStatus.value = ''
  setorFocus.value = ''
}

const navegarSetorExplorar = (nomeSetor) => {
  filtroSetor.value = nomeSetor
  abaAtiva.value = 'explorar'
}

// --- Colunas ---
const colunasItens = [
  { chave: '_codigo', titulo: 'Código', sortable: true },
  { chave: '_produto', titulo: 'Produto', sortable: true },
  { chave: '_setor', titulo: 'Setor', sortable: true },
  { chave: '_fornecedor', titulo: 'Fornecedor', sortable: true },
  { chave: '_local', titulo: 'Local', sortable: true },
  { chave: '_validadeISO', titulo: 'Validade', sortable: true },
  { chave: '_diasParaVencer', titulo: 'Dias', sortable: true, alinhamento: 'right' },
  { chave: '_estoque', titulo: 'Estoque', sortable: true, alinhamento: 'right' },
  { chave: '_prazo', titulo: 'Status', sortable: true }
]

const colunasFornecedores = [
  { chave: 'fornecedor', titulo: 'Fornecedor', sortable: true },
  { chave: 'total', titulo: 'Total', sortable: true, alinhamento: 'right' },
  { chave: 'vencidos', titulo: 'Vencidos', sortable: true, alinhamento: 'right' },
  { chave: 'hoje', titulo: 'Hoje', sortable: true, alinhamento: 'right' },
  { chave: 'ate3', titulo: 'Até 3 dias', sortable: true, alinhamento: 'right' }
]

const rowClassPrazo = (item) => {
  if (item._prazo === 'vencidos') return 'bg-red-50'
  if (item._prazo === 'hoje') return 'bg-orange-50'
  if (item._prazo === 'ate3') return 'bg-yellow-50'
  return ''
}

const rowClassResumo = (item) => {
  if ((item.vencidos || 0) > 0 || (item.hoje || 0) > 0) return 'bg-red-50'
  if ((item.ate3 || 0) > 0) return 'bg-yellow-50'
  return ''
}

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

const filtrarBuscaVenc = (lista, termo) => {
  if (!termo) return lista
  const t = termo.toLowerCase()
  return lista.filter(item => Object.values(item).some(v => String(v ?? '').toLowerCase().includes(t)))
}

const atualizarOrdenacaoVenc = (obj, coluna) => {
  if (obj.coluna === coluna) {
    obj.direcao = obj.direcao === 'asc' ? 'desc' : 'asc'
  } else {
    obj.coluna = coluna
    obj.direcao = 'asc'
  }
}

// Itens Filtrados table
const itensFiltradosComISO = computed(() => itensFiltrados.value.map(i => ({ ...i, _validadeISO: formatarData(i._validadeDate) })))
const itensFiltradosBusca = computed(() => filtrarBuscaVenc(itensFiltradosComISO.value, buscaItensFiltrados.value))
const itensFiltradosOrdenados = computed(() => sortVenc(itensFiltradosBusca.value, ordenacaoItensFiltrados.value))
const totalPaginasItensFiltrados = computed(() => Math.max(1, Math.ceil(itensFiltradosOrdenados.value.length / itensPorPaginaFiltrados)))
const itensFiltradosPaginados = computed(() => {
  const p = Math.min(paginaItensFiltrados.value, totalPaginasItensFiltrados.value)
  const i = (p - 1) * itensPorPaginaFiltrados
  return itensFiltradosOrdenados.value.slice(i, i + itensPorPaginaFiltrados)
})

// Fornecedores tab table
const fornecedoresTabBusca = computed(() => filtrarBuscaVenc(linhasFornecedores.value, buscaFornecedoresTab.value))
const fornecedoresTabOrdenados = computed(() => sortVenc(fornecedoresTabBusca.value, ordenacaoFornecedoresTab.value))
const totalPaginasFornecedoresTab = computed(() => Math.max(1, Math.ceil(fornecedoresTabOrdenados.value.length / itensPorPaginaFornecedores)))
const fornecedoresTabPaginados = computed(() => {
  const p = Math.min(paginaFornecedoresTab.value, totalPaginasFornecedoresTab.value)
  const i = (p - 1) * itensPorPaginaFornecedores
  return fornecedoresTabOrdenados.value.slice(i, i + itensPorPaginaFornecedores)
})

// Setor Modal table
const itensSetorModalComISO = computed(() => itensSetorModal.value.map(i => ({ ...i, _validadeISO: formatarData(i._validadeDate) })))
const itensSetorModalBusca = computed(() => filtrarBuscaVenc(itensSetorModalComISO.value, buscaSetorModal.value))
const itensSetorModalOrdenados = computed(() => sortVenc(itensSetorModalBusca.value, ordenacaoSetorModal.value))
const totalPaginasSetorModal = computed(() => Math.max(1, Math.ceil(itensSetorModalOrdenados.value.length / itensPorPaginaSetorModal)))
const itensSetorModalPaginados = computed(() => {
  const p = Math.min(paginaSetorModal.value, totalPaginasSetorModal.value)
  const i = (p - 1) * itensPorPaginaSetorModal
  return itensSetorModalOrdenados.value.slice(i, i + itensPorPaginaSetorModal)
})

// Fornecedor Modal table
const itensFornecedorComISO = computed(() => itensFornecedor.value.map(i => ({ ...i, _validadeISO: formatarData(i._validadeDate) })))
const itensFornecedorBusca = computed(() => filtrarBuscaVenc(itensFornecedorComISO.value, buscaFornecedorModal.value))
const itensFornecedorOrdenados = computed(() => sortVenc(itensFornecedorBusca.value, ordenacaoFornecedorModal.value))
const totalPaginasFornecedorModal = computed(() => Math.max(1, Math.ceil(itensFornecedorOrdenados.value.length / itensPorPaginaFornecedorModal)))
const itensFornecedorPaginados = computed(() => {
  const p = Math.min(paginaFornecedorModal.value, totalPaginasFornecedorModal.value)
  const i = (p - 1) * itensPorPaginaFornecedorModal
  return itensFornecedorOrdenados.value.slice(i, i + itensPorPaginaFornecedorModal)
})

const paginasVisiveisVenc = (total, atual) => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = [1]
  if (atual > 3) pages.push('...')
  for (let i = Math.max(2, atual - 1); i <= Math.min(total - 1, atual + 1); i++) pages.push(i)
  if (atual < total - 2) pages.push('...')
  pages.push(total)
  return pages
}

// --- Watches: reset pagination ---
watch(() => itensFiltradosBusca.value.length, () => { paginaItensFiltrados.value = 1 })
watch(() => fornecedoresTabBusca.value.length, () => { paginaFornecedoresTab.value = 1 })
watch(() => itensSetorModalBusca.value.length, () => { paginaSetorModal.value = 1 })
watch(() => itensFornecedorBusca.value.length, () => { paginaFornecedorModal.value = 1 })

// --- Impressao ---
const imprimir = (alvo) => {
  if (alvo === 'modal-fornecedor') {
    const base = itensFornecedorOrdenados.value
    if (base.length) printTableInNewWindow(base, colunasItens, `Vencimentos - Fornecedor - ${fornecedorSelecionado.value}`)
  } else if (alvo === 'modal-setor') {
    const base = itensSetorModalOrdenados.value
    if (base.length) printTableInNewWindow(base, colunasItens, `Vencimentos - Setor - ${setorModalNome.value || 'Todos'}`)
  } else if (alvo === 'filtrados') {
    const base = itensFiltradosOrdenados.value
    const parts = []
    if (filtroSetor.value) parts.push(`Setor: ${filtroSetor.value}`)
    if (filtroFornecedor.value) parts.push(`Fornecedor: ${filtroFornecedor.value}`)
    if (filtroStatus.value) parts.push(`Status: ${filtroStatus.value}`)
    const title = 'Vencimentos' + (parts.length ? ' - ' + parts.join(' | ') : '')
    if (base.length) printTableInNewWindow(base, colunasItens, title)
  }
}

const exportarFiltradosCsv = () => {
  const base = itensFiltradosOrdenados.value
  if (!base.length) return
  const linhas = base.map(item => ({ ...item, _prazo: prazoBadgeLabel(item._prazo) }))
  const colunas = [...colunasItens, { chave: '_acao', titulo: 'Ação' }, { chave: '_responsavel', titulo: 'Responsável' }]
  baixarCsv(linhas, colunas, `vencimentos-${new Date().toISOString().slice(0, 10)}`)
  toastStore.addToast(`${base.length} itens exportados em CSV.`, 'success')
}

// Links externos (ex.: busca global) podem abrir a aba Explorar já filtrada.
const aplicarFiltrosDaRota = () => {
  const { busca: termo, prazo, setor } = route.query
  if (!termo && !prazo && !setor) return
  if (typeof termo === 'string') busca.value = termo
  if (typeof prazo === 'string') filtroStatus.value = prazo
  if (typeof setor === 'string') filtroSetor.value = setor
  abaAtiva.value = 'explorar'
}
watch(() => route.query, aplicarFiltrosDaRota, { immediate: true })

const imprimirAnalise = (alvo) => {
  if (alvo === 'setores') {
    const dados = setoresAnalise.value.map(s => ({
      nome: s.nome,
      total: s.total,
      vencidos: s.vencidos,
      hoje: s.hoje,
      ate3: s.ate3
    }))
    const colunas = [
      { chave: 'nome', titulo: 'Setor' },
      { chave: 'total', titulo: 'Total', alinhamento: 'right' },
      { chave: 'vencidos', titulo: 'Vencidos', alinhamento: 'right' },
      { chave: 'hoje', titulo: 'Hoje', alinhamento: 'right' },
      { chave: 'ate3', titulo: 'Até 3 dias', alinhamento: 'right' }
    ]
    if (dados.length) printTableInNewWindow(dados, colunas, 'Vencimentos - Análise por Setor')
  } else if (alvo === 'fornecedores') {
    const dados = fornecedoresRanking.value.map(f => ({
      fornecedor: f.fornecedor,
      criticos: f.criticos,
      vencidos: f.vencidos,
      hoje: f.hoje,
      ate3: f.ate3,
      total: f.total
    }))
    const colunas = [
      { chave: 'fornecedor', titulo: 'Fornecedor' },
      { chave: 'criticos', titulo: 'Críticos', alinhamento: 'right' },
      { chave: 'vencidos', titulo: 'Vencidos', alinhamento: 'right' },
      { chave: 'hoje', titulo: 'Hoje', alinhamento: 'right' },
      { chave: 'ate3', titulo: 'Até 3 dias', alinhamento: 'right' },
      { chave: 'total', titulo: 'Total', alinhamento: 'right' }
    ]
    if (dados.length) printTableInNewWindow(dados, colunas, 'Vencimentos - Ranking de Fornecedores')
  }
}

const normalizarNomeArquivo = (texto) => {
  return String(texto || 'imagem')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\-_ ]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
}

const exportarDetalhamentoSetor = async () => {
  if (!detalhamentoSetorExportRef.value || typeof window === 'undefined') return

  try {
    const elemento = detalhamentoSetorExportRef.value
    const rect = elemento.getBoundingClientRect?.() || {}
    const largura = Math.max(Math.round(rect.width || elemento.scrollWidth || elemento.clientWidth || 1200), 1)
    const altura = Math.max(Math.round(rect.height || elemento.scrollHeight || elemento.clientHeight || 700), 1)

    const botoesOcultos = elemento.querySelectorAll('.export-button-hidden')
    botoesOcultos.forEach(botao => {
      botao.style.display = 'none'
    })

    const dataUrl = await toPng(elemento, {
      cacheBust: true,
      pixelRatio: 4,
      backgroundColor: '#f8fafc',
      width: largura,
      height: altura,
      skipFonts: false,
      style: {
        margin: '0',
        padding: '0',
        boxSizing: 'border-box',
        transform: 'none',
        maxWidth: 'none',
        maxHeight: 'none'
      }
    })

    botoesOcultos.forEach(botao => {
      botao.style.display = ''
    })

    const link = document.createElement('a')
    link.download = `${normalizarNomeArquivo('vencimentos-atencao-detalhamento-setor')}.png`
    link.href = dataUrl
    document.body.appendChild(link)
    link.click()
    link.remove()
  } catch (error) {
    console.error('Erro ao exportar imagem do detalhamento por setor:', error)
    window.alert('Não foi possível gerar a imagem do detalhamento por setor. Tente novamente.')
  }
}
</script>

<template>
  <div class="min-h-[calc(100vh-4rem)] px-4 py-6 md:px-8 md:py-8">
    <div class="max-w-7xl mx-auto space-y-6">

      <!-- ===== HEADER ===== -->
      <UiPageHeader title="Vencimentos" subtitle="Controle de validades e itens críticos." icon="fas fa-calendar-alt" tone="orange">
        <template #actions>
          <UiButton v-if="store.itens.length > 0" @click="mostrarUpload = true">
            <i class="fas fa-file-upload mr-2"></i>Nova Importação
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
        <div ref="detalhamentoSetorExportRef" class="space-y-4">
          <!-- Alert Banner -->
          <div class="rounded-2xl border p-4 flex items-center gap-4" :class="alertaBanner.classe">
            <div class="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" :class="alertaBanner.iconeCor">
              <i :class="alertaBanner.icone" class="text-xl"></i>
            </div>
            <p class="text-sm font-medium flex-1">{{ alertaBanner.texto }}</p>
            <button v-if="resumo.vencidos > 0" @click="verCriticos"
              class="px-3 py-1.5 rounded-lg bg-white/80 text-sm font-semibold shadow-sm hover:bg-white transition shrink-0 border border-red-300 text-red-700">
              Ver itens <i class="fas fa-arrow-right ml-1 text-xs"></i>
            </button>
          </div>
  
          <!-- Hero Metrics Row -->
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <!-- Total -->
            <div
              class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
              <div class="flex items-start justify-between">
                <div>
                  <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total de Itens</p>
                  <p class="mt-2 text-3xl lg:text-4xl font-extrabold text-blue-700 tabular-nums">{{ resumo.total }}</p>
                  <p class="mt-1.5 text-xs text-slate-400">Itens com validade monitorada</p>
                </div>
                <div
                  class="h-11 w-11 rounded-xl bg-blue-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <i class="fas fa-boxes text-lg text-blue-500"></i>
                </div>
              </div>
            </div>
            <!-- Vencidos -->
            <div
              class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
              <div class="flex items-start justify-between">
                <div>
                  <p class="text-xs font-semibold text-red-600 uppercase tracking-wider">Vencidos</p>
                  <p class="mt-2 text-3xl lg:text-4xl font-extrabold text-red-700 tabular-nums">{{ resumo.vencidos }}</p>
                  <p class="mt-1.5 text-xs text-red-400">Requer ação imediata</p>
                </div>
                <div
                  class="h-11 w-11 rounded-xl bg-red-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <i class="fas fa-exclamation-triangle text-lg text-red-500"></i>
                </div>
              </div>
            </div>
            <!-- Hoje -->
            <div
              class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
              <div class="flex items-start justify-between">
                <div>
                  <p class="text-xs font-semibold text-orange-600 uppercase tracking-wider">Vencem Hoje</p>
                  <p class="mt-2 text-3xl lg:text-4xl font-extrabold text-orange-600 tabular-nums">{{ resumo.hoje }}</p>
                  <p class="mt-1.5 text-xs text-orange-400">Planejar acoes promocionais</p>
                </div>
                <div
                  class="h-11 w-11 rounded-xl bg-orange-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <i class="fas fa-sun text-lg text-orange-500"></i>
                </div>
              </div>
            </div>
            <!-- Ate 3 dias -->
            <div
              class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
              <div class="flex items-start justify-between">
                <div>
                  <p class="text-xs font-semibold text-yellow-600 uppercase tracking-wider">Até 3 Dias</p>
                  <p class="mt-2 text-3xl lg:text-4xl font-extrabold text-yellow-700 tabular-nums">{{ resumo.ate3 }}</p>
                  <p class="mt-1.5 text-xs text-yellow-500">Remarcação e giro de estoque</p>
                </div>
                <div
                  class="h-11 w-11 rounded-xl bg-yellow-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <i class="fas fa-hourglass-half text-lg text-yellow-500"></i>
                </div>
              </div>
            </div>
          </div>
  
          <!-- Sector Breakdown (Table) -->
          <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div class="px-5 pt-5 md:px-6 md:pt-6 pb-3 flex items-center justify-between gap-3">
              <div>
                <h2 class="text-base font-bold text-gray-900">Detalhamento por Setor</h2>
                <p class="text-xs text-slate-500 mt-0.5">Distribuicao de itens por status em cada setor. Clique para ver
                  detalhes.</p>
              </div>
              <div class="flex items-center gap-2">
                <button @click="exportarDetalhamentoSetor"
                  class="export-button-hidden inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-600 text-white hover:bg-orange-700 transition text-xs font-semibold shadow-sm print:hidden">
                  <i class="fas fa-image"></i>
                  Salvar imagem
                </button>
                <span class="text-xs text-slate-400 font-medium">{{ setoresAnalise.length }} setores</span>
              </div>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
              <thead>
                <tr class="bg-slate-50 border-y border-slate-200">
                  <th class="px-5 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Setor
                  </th>
                  <th class="px-4 py-3 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider w-20">
                    Total</th>
                  <th class="px-4 py-3 text-center text-[11px] font-bold text-red-500 uppercase tracking-wider w-24">
                    Vencidos</th>
                  <th class="px-4 py-3 text-center text-[11px] font-bold text-orange-500 uppercase tracking-wider w-20">
                    Hoje</th>
                  <th class="px-4 py-3 text-center text-[11px] font-bold text-yellow-600 uppercase tracking-wider w-20">
                    Até 3d</th>
                  <th class="w-10"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="setor in setoresAnalise" :key="setor.nome" @click="abrirModalSetor(setor.nome)"
                  class="cursor-pointer hover:bg-orange-50/60 transition-colors group"
                  :class="setor.vencidos > 0 ? 'bg-red-50/60' : setor.hoje > 0 ? 'bg-orange-50/50' : setor.ate3 > 0 ? 'bg-yellow-50/50' : ''">
                  <td class="px-5 py-3.5">
                    <p class="font-semibold text-gray-900 group-hover:text-orange-600 transition-colors">{{ setor.nome
                      }}</p>
                  </td>
                  <td class="px-4 py-3.5 text-center">
                    <span class="font-bold text-slate-700 tabular-nums">{{ setor.total }}</span>
                  </td>
                  <td class="px-4 py-3.5 text-center">
                    <span v-if="setor.vencidos > 0"
                      class="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-md bg-red-100 text-red-700 font-bold text-xs tabular-nums">
                      {{ setor.vencidos }}
                    </span>
                    <span v-else class="text-slate-300 text-xs">—</span>
                  </td>
                  <td class="px-4 py-3.5 text-center">
                    <span v-if="setor.hoje > 0"
                      class="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-md bg-orange-100 text-orange-700 font-bold text-xs tabular-nums">
                      {{ setor.hoje }}
                    </span>
                    <span v-else class="text-slate-300 text-xs">—</span>
                  </td>
                  <td class="px-4 py-3.5 text-center">
                    <span v-if="setor.ate3 > 0"
                      class="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-md bg-yellow-100 text-yellow-700 font-bold text-xs tabular-nums">
                      {{ setor.ate3 }}
                    </span>
                    <span v-else class="text-slate-300 text-xs">—</span>
                  </td>
                  <td class="px-2 py-3.5 text-center">
                    <i
                      class="fas fa-chevron-right text-slate-300 group-hover:text-orange-400 transition-colors text-xs"></i>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

        <!-- Critical Items (Timeline Style) -->
        <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 p-5 md:p-6">
          <div class="flex items-center justify-between mb-5">
            <div>
              <h2 class="text-base font-bold text-gray-900">Itens Mais Críticos</h2>
              <p class="text-xs text-slate-500">Top 10 itens com validade mais urgente</p>
            </div>
            <button @click="verCriticos"
              class="text-xs text-orange-600 hover:text-orange-800 font-semibold flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-orange-50 transition">
              Ver todos <i class="fas fa-arrow-right"></i>
            </button>
          </div>

          <div v-if="itensCriticosPainel.length === 0" class="text-center py-10 text-gray-400">
            <i class="fas fa-check-circle text-4xl mb-3 text-emerald-400"></i>
            <p class="text-sm font-medium">Nenhum item critico encontrado</p>
          </div>

          <div v-else class="space-y-2.5">
            <div v-for="(item, idx) in itensCriticosPainel" :key="item._codigo + item._validadeISO + idx"
              class="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xs transition-shadow hover:shadow-sm">
              <span class="px-2.5 py-1 text-[10px] rounded-lg border font-bold uppercase tracking-wide shrink-0"
                :class="prazoBadgeClasses(item._prazo)">
                {{ prazoBadgeLabel(item._prazo) }}
              </span>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-gray-900 truncate">{{ item._produto }}</p>
                <p class="text-[11px] text-gray-500 mt-0.5">
                  <span class="font-medium text-gray-600">{{ item._codigo }}</span>
                  <span class="mx-1.5 text-slate-300">|</span>
                  {{ item._setor }}
                  <span v-if="item._fornecedor" class="mx-1.5 text-slate-300">|</span>
                  <span v-if="item._fornecedor">{{ item._fornecedor }}</span>
                </p>
              </div>
              <div class="text-right shrink-0">
                <span class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold" :class="{
                  'bg-red-100 text-red-700': item._prazo === 'vencidos',
                  'bg-orange-100 text-orange-700': item._prazo === 'hoje',
                  'bg-yellow-100 text-yellow-700': item._prazo === 'ate3'
                }">
                  {{ item._diasParaVencer === 0 ? 'HOJE' : item._diasParaVencer < 0 ?
                    `${Math.abs(item._diasParaVencer)}d atras` : `${item._diasParaVencer}d` }} </span>
                    <p class="text-[10px] text-gray-400 mt-1">{{ formatarData(item._validadeDate) }}</p>
              </div>
            </div>
          </div>
        </div>

      </template>

      <!-- ============================================================ -->
      <!-- ===== TAB 2: EXPLORAR ===== -->
      <!-- ============================================================ -->
      <template v-if="store.itens.length > 0 && abaAtiva === 'explorar'">

        <!-- Smart Filter Bar -->
        <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-2">Status:</span>
            <button v-for="pill in statusPills" :key="pill.valor" @click="filtroStatus = pill.valor"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
              :class="filtroStatus === pill.valor ? pill.corAtiva : pill.cor">
              <i :class="pill.icone" class="text-[10px]"></i>
              {{ pill.label }}
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div class="relative">
              <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
              <input v-model="busca" placeholder="Buscar por codigo ou produto..."
                class="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition bg-white" />
            </div>
            <select v-model="filtroSetor"
              class="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition">
              <option value="">Todos os setores</option>
              <option v-for="s in setores" :key="s" :value="s">{{ s }}</option>
            </select>
            <select v-model="filtroFornecedor"
              class="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition">
              <option value="">Todos os fornecedores</option>
              <option v-for="f in fornecedores" :key="f" :value="f">{{ f }}</option>
            </select>
          </div>

          <div v-if="filtrosAtivos.length > 0" class="flex flex-wrap items-center gap-2">
            <span class="text-xs text-slate-400">Filtros ativos:</span>
            <span v-for="tag in filtrosAtivos" :key="tag.tipo"
              class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-50 text-orange-700 text-xs font-medium border border-orange-200">
              {{ tag.label }}
              <button @click="tag.limpar" class="ml-0.5 hover:text-red-600 transition">
                <i class="fas fa-times text-[10px]"></i>
              </button>
            </span>
            <button @click="limparTodosFiltros" class="text-xs text-red-500 hover:text-red-700 font-medium ml-2">
              <i class="fas fa-times-circle mr-0.5"></i>Limpar todos
            </button>
          </div>
        </div>

        <!-- Data Table -->
        <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div class="p-4 border-b border-slate-100 flex items-center justify-between">
            <p class="text-sm text-slate-600">
              <span class="font-bold text-gray-900">{{ itensFiltrados.length }}</span> itens encontrados
            </p>
            <div class="flex items-center gap-2">
              <button @click="exportarFiltradosCsv" :disabled="!itensFiltrados.length"
                class="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-medium border border-emerald-200 transition disabled:opacity-50">
                <i class="fas fa-file-csv mr-1.5"></i>CSV
              </button>
              <button @click="imprimir('filtrados')"
                class="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium border border-slate-200 transition">
                <i class="fas fa-print mr-1.5"></i>Imprimir
              </button>
            </div>
          </div>

          <!-- Search -->
          <div class="px-4 pt-3">
            <div class="relative">
              <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
              <input v-model="buscaItensFiltrados" placeholder="Buscar na tabela..."
                class="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition bg-white" />
            </div>
          </div>

          <!-- Table -->
          <div class="overflow-x-auto">
            <table class="w-full text-xs">
              <thead>
                <tr class="border-b-2 border-slate-100">
                  <th v-for="col in colunasItens" :key="col.chave"
                    class="px-3 py-2.5 font-semibold text-slate-500 uppercase tracking-wider text-[11px] whitespace-nowrap"
                    :class="[col.alinhamento === 'right' ? 'text-right' : 'text-left', col.sortable ? 'cursor-pointer select-none hover:text-indigo-600 transition-colors' : '']"
                    @click="col.sortable && atualizarOrdenacaoVenc(ordenacaoItensFiltrados, col.chave)">
                    {{ col.titulo }}
                    <template v-if="col.sortable">
                      <i v-if="ordenacaoItensFiltrados.coluna !== col.chave"
                        class="fas fa-sort text-slate-300 ml-1"></i>
                      <i v-else-if="ordenacaoItensFiltrados.direcao === 'asc'"
                        class="fas fa-sort-up text-indigo-600 ml-1"></i>
                      <i v-else class="fas fa-sort-down text-indigo-600 ml-1"></i>
                    </template>
                  </th>
                  <th class="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Ação</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="itensFiltradosPaginados.length === 0">
                  <td :colspan="colunasItens.length + 1" class="text-center py-10 text-slate-400">
                    <i class="fas fa-inbox text-3xl mb-2 block"></i>
                    <p class="text-sm">Nenhum item encontrado</p>
                  </td>
                </tr>
                <tr v-for="(item, idx) in itensFiltradosPaginados" :key="item._codigo + item._validadeISO + idx"
                  :class="item._prazo === 'vencidos' ? 'bg-red-50/60 hover:bg-indigo-50/40' : item._prazo === 'hoje' ? 'bg-orange-50/60 hover:bg-indigo-50/40' : item._prazo === 'ate3' ? 'bg-yellow-50/60 hover:bg-indigo-50/40' : idx % 2 === 0 ? 'bg-white hover:bg-indigo-50/40' : 'bg-slate-50/60 hover:bg-indigo-50/40'">
                  <td class="px-3 py-2">{{ item._codigo }}</td>
                  <td class="px-3 py-2">{{ item._produto }}</td>
                  <td class="px-3 py-2">{{ item._setor }}</td>
                  <td class="px-3 py-2">{{ item._fornecedor }}</td>
                  <td class="px-3 py-2">{{ item._local }}</td>
                  <td class="px-3 py-2">{{ item._validadeISO }}</td>
                  <td class="px-3 py-2 text-right tabular-nums">{{ item._diasParaVencer }}</td>
                  <td class="px-3 py-2 text-right tabular-nums">{{ item._estoque }}</td>
                  <td class="px-3 py-2">
                    <span class="px-2 py-0.5 text-xs rounded-full border font-medium"
                      :class="prazoBadgeClasses(item._prazo)">
                      {{ prazoBadgeLabel(item._prazo) }}
                    </span>
                  </td>
                  <td class="px-3 py-2">
                    <button type="button" class="ui-btn-secondary !px-2.5 !py-1.5 !text-xs whitespace-nowrap" @click="abrirAcao(item)">
                      <i class="fas fa-clipboard-check"></i>
                      {{ item._acao ? 'Atualizar' : 'Registrar' }}
                    </button>
                    <p v-if="item._responsavel" class="mt-1 max-w-28 truncate text-[10px] text-slate-500" :title="item._acao">
                      {{ item._responsavel }} · {{ item._acao }}
                    </p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          <div v-if="totalPaginasItensFiltrados > 1"
            class="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <p class="text-xs text-slate-500">Pagina {{ Math.min(paginaItensFiltrados, totalPaginasItensFiltrados) }} de
              {{
              totalPaginasItensFiltrados }}</p>
            <div class="flex items-center gap-1">
              <button @click="paginaItensFiltrados = Math.max(1, paginaItensFiltrados - 1)"
                :disabled="paginaItensFiltrados <= 1"
                class="px-2.5 py-1 rounded text-xs font-medium border transition disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 border-slate-200 text-slate-600">
                <i class="fas fa-chevron-left"></i>
              </button>
              <template
                v-for="p in paginasVisiveisVenc(totalPaginasItensFiltrados, Math.min(paginaItensFiltrados, totalPaginasItensFiltrados))"
                :key="'pif' + p">
                <span v-if="p === '...'" class="px-2 text-xs text-slate-400">...</span>
                <button v-else @click="paginaItensFiltrados = p"
                  class="px-2.5 py-1 rounded text-xs font-medium border transition"
                  :class="p === Math.min(paginaItensFiltrados, totalPaginasItensFiltrados) ? 'bg-indigo-600 text-white border-indigo-600' : 'hover:bg-slate-100 border-slate-200 text-slate-600'">
                  {{ p }}
                </button>
              </template>
              <button @click="paginaItensFiltrados = Math.min(totalPaginasItensFiltrados, paginaItensFiltrados + 1)"
                :disabled="paginaItensFiltrados >= totalPaginasItensFiltrados"
                class="px-2.5 py-1 rounded text-xs font-medium border transition disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 border-slate-200 text-slate-600">
                <i class="fas fa-chevron-right"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- Supplier Summary with Drill-Down -->
        <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div class="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 class="text-base font-bold text-gray-900">Resumo por Fornecedor</h2>
              <p class="text-xs text-slate-500">Clique em um fornecedor para ver seus itens</p>
            </div>
          </div>
          <!-- Search -->
          <div class="px-4 pt-3">
            <div class="relative">
              <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
              <input v-model="buscaFornecedoresTab" placeholder="Buscar fornecedor..."
                class="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition bg-white" />
            </div>
          </div>

          <!-- Table -->
          <div class="overflow-x-auto">
            <table class="w-full text-xs">
              <thead>
                <tr class="border-b-2 border-slate-100">
                  <th v-for="col in colunasFornecedores" :key="col.chave"
                    class="px-3 py-2.5 font-semibold text-slate-500 uppercase tracking-wider text-[11px] whitespace-nowrap"
                    :class="[col.alinhamento === 'right' ? 'text-right' : 'text-left', col.sortable ? 'cursor-pointer select-none hover:text-indigo-600 transition-colors' : '']"
                    @click="col.sortable && atualizarOrdenacaoVenc(ordenacaoFornecedoresTab, col.chave)">
                    {{ col.titulo }}
                    <template v-if="col.sortable">
                      <i v-if="ordenacaoFornecedoresTab.coluna !== col.chave"
                        class="fas fa-sort text-slate-300 ml-1"></i>
                      <i v-else-if="ordenacaoFornecedoresTab.direcao === 'asc'"
                        class="fas fa-sort-up text-indigo-600 ml-1"></i>
                      <i v-else class="fas fa-sort-down text-indigo-600 ml-1"></i>
                    </template>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="fornecedoresTabPaginados.length === 0">
                  <td :colspan="colunasFornecedores.length" class="text-center py-10 text-slate-400">
                    <i class="fas fa-inbox text-3xl mb-2 block"></i>
                    <p class="text-sm">Nenhum fornecedor encontrado</p>
                  </td>
                </tr>
                <tr v-for="(item, idx) in fornecedoresTabPaginados" :key="item.fornecedor"
                  @click="abrirItensFornecedor(item)" class="cursor-pointer transition-colors"
                  :class="(item.vencidos > 0 || item.hoje > 0) ? 'bg-red-50/60 hover:bg-indigo-50/40' : item.ate3 > 0 ? 'bg-yellow-50/60 hover:bg-indigo-50/40' : idx % 2 === 0 ? 'bg-white hover:bg-indigo-50/40' : 'bg-slate-50/60 hover:bg-indigo-50/40'">
                  <td class="px-3 py-2 font-medium">{{ item.fornecedor }}</td>
                  <td class="px-3 py-2 text-right tabular-nums">{{ item.total }}</td>
                  <td class="px-3 py-2 text-right">
                    <span
                      class="px-2 py-0.5 text-xs rounded-full border text-red-700 bg-red-50 border-red-200 font-medium">{{
                      item.vencidos }}</span>
                  </td>
                  <td class="px-3 py-2 text-right">
                    <span
                      class="px-2 py-0.5 text-xs rounded-full border text-orange-700 bg-orange-50 border-orange-200 font-medium">{{
                      item.hoje }}</span>
                  </td>
                  <td class="px-3 py-2 text-right">
                    <span
                      class="px-2 py-0.5 text-xs rounded-full border text-yellow-700 bg-yellow-50 border-yellow-200 font-medium">{{
                      item.ate3 }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          <div v-if="totalPaginasFornecedoresTab > 1"
            class="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <p class="text-xs text-slate-500">Pagina {{ Math.min(paginaFornecedoresTab, totalPaginasFornecedoresTab) }}
              de {{
              totalPaginasFornecedoresTab }}</p>
            <div class="flex items-center gap-1">
              <button @click="paginaFornecedoresTab = Math.max(1, paginaFornecedoresTab - 1)"
                :disabled="paginaFornecedoresTab <= 1"
                class="px-2.5 py-1 rounded text-xs font-medium border transition disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 border-slate-200 text-slate-600">
                <i class="fas fa-chevron-left"></i>
              </button>
              <template
                v-for="p in paginasVisiveisVenc(totalPaginasFornecedoresTab, Math.min(paginaFornecedoresTab, totalPaginasFornecedoresTab))"
                :key="'pft' + p">
                <span v-if="p === '...'" class="px-2 text-xs text-slate-400">...</span>
                <button v-else @click="paginaFornecedoresTab = p"
                  class="px-2.5 py-1 rounded text-xs font-medium border transition"
                  :class="p === Math.min(paginaFornecedoresTab, totalPaginasFornecedoresTab) ? 'bg-indigo-600 text-white border-indigo-600' : 'hover:bg-slate-100 border-slate-200 text-slate-600'">
                  {{ p }}
                </button>
              </template>
              <button @click="paginaFornecedoresTab = Math.min(totalPaginasFornecedoresTab, paginaFornecedoresTab + 1)"
                :disabled="paginaFornecedoresTab >= totalPaginasFornecedoresTab"
                class="px-2.5 py-1 rounded text-xs font-medium border transition disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 border-slate-200 text-slate-600">
                <i class="fas fa-chevron-right"></i>
              </button>
            </div>
          </div>
        </div>
      </template>

      <!-- ============================================================ -->
      <!-- ===== TAB 3: ANALISE ===== -->
      <!-- ============================================================ -->
      <template v-if="store.itens.length > 0 && abaAtiva === 'analise'">

        <!-- Print Actions Bar -->
        <div class="flex items-center justify-end gap-2">
          <button @click="imprimirAnalise('setores')"
            class="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium border border-slate-200 transition">
            <i class="fas fa-print mr-1.5"></i>Imprimir Setores
          </button>
          <button @click="imprimirAnalise('fornecedores')"
            class="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium border border-slate-200 transition">
            <i class="fas fa-print mr-1.5"></i>Imprimir Fornecedores
          </button>
        </div>

        <!-- Sector Breakdown (List) -->
        <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 p-5 md:p-6">
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
        <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 p-5 md:p-6">
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
      <div v-if="modalSetorAberto"
        class="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-8"
        @click="fecharModalSetor">
        <div class="relative bg-white rounded-lg shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[90vh]"
          @click.stop>
          <div
            class="bg-orange-700 text-white p-4 md:p-5 flex items-center justify-between shrink-0">
            <div>
              <h2 class="text-xl font-bold">{{ setorModalNome }}</h2>
              <p class="text-orange-100 text-sm mt-1">{{ itensSetorModal.length }} itens neste setor</p>
            </div>
            <button @click="fecharModalSetor" class="text-white hover:opacity-80 transition">
              <i class="fas fa-times text-xl"></i>
            </button>
          </div>
          <div class="p-4 overflow-y-auto flex-1">
            <!-- Search -->
            <div class="mb-3">
              <div class="relative max-w-xs">
                <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                <input v-model="buscaSetorModal" placeholder="Buscar por codigo ou produto..."
                  class="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition bg-white" />
              </div>
            </div>

            <!-- Table -->
            <div class="overflow-x-auto">
              <table class="w-full text-xs">
                <thead>
                  <tr class="border-b-2 border-slate-100">
                    <th v-for="col in colunasItens" :key="col.chave"
                      class="px-3 py-2.5 font-semibold text-slate-500 uppercase tracking-wider text-[11px] whitespace-nowrap"
                      :class="[col.alinhamento === 'right' ? 'text-right' : 'text-left', col.sortable ? 'cursor-pointer select-none hover:text-indigo-600 transition-colors' : '']"
                      @click="col.sortable && atualizarOrdenacaoVenc(ordenacaoSetorModal, col.chave)">
                      {{ col.titulo }}
                      <template v-if="col.sortable">
                        <i v-if="ordenacaoSetorModal.coluna !== col.chave" class="fas fa-sort text-slate-300 ml-1"></i>
                        <i v-else-if="ordenacaoSetorModal.direcao === 'asc'"
                          class="fas fa-sort-up text-indigo-600 ml-1"></i>
                        <i v-else class="fas fa-sort-down text-indigo-600 ml-1"></i>
                      </template>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="itensSetorModalPaginados.length === 0">
                    <td :colspan="colunasItens.length" class="text-center py-10 text-slate-400">
                      <i class="fas fa-inbox text-3xl mb-2 block"></i>
                      <p class="text-sm">Nenhum item encontrado</p>
                    </td>
                  </tr>
                  <tr v-for="(item, idx) in itensSetorModalPaginados" :key="item._codigo + item._validadeISO + idx"
                    :class="item._prazo === 'vencidos' ? 'bg-red-50/60 hover:bg-indigo-50/40' : item._prazo === 'hoje' ? 'bg-orange-50/60 hover:bg-indigo-50/40' : item._prazo === 'ate3' ? 'bg-yellow-50/60 hover:bg-indigo-50/40' : idx % 2 === 0 ? 'bg-white hover:bg-indigo-50/40' : 'bg-slate-50/60 hover:bg-indigo-50/40'">
                    <td class="px-3 py-2">{{ item._codigo }}</td>
                    <td class="px-3 py-2">{{ item._produto }}</td>
                    <td class="px-3 py-2">{{ item._setor }}</td>
                    <td class="px-3 py-2">{{ item._fornecedor }}</td>
                    <td class="px-3 py-2">{{ item._local }}</td>
                    <td class="px-3 py-2">{{ item._validadeISO }}</td>
                    <td class="px-3 py-2 text-right tabular-nums">{{ item._diasParaVencer }}</td>
                    <td class="px-3 py-2 text-right tabular-nums">{{ item._estoque }}</td>
                    <td class="px-3 py-2">
                      <span class="px-2 py-0.5 text-xs rounded-full border font-medium"
                        :class="prazoBadgeClasses(item._prazo)">
                        {{ prazoBadgeLabel(item._prazo) }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Pagination -->
            <div v-if="totalPaginasSetorModal > 1"
              class="flex items-center justify-between px-4 py-3 border-t border-slate-100">
              <p class="text-xs text-slate-500">Pagina {{ Math.min(paginaSetorModal, totalPaginasSetorModal) }} de {{
                totalPaginasSetorModal }}</p>
              <div class="flex items-center gap-1">
                <button @click="paginaSetorModal = Math.max(1, paginaSetorModal - 1)" :disabled="paginaSetorModal <= 1"
                  class="px-2.5 py-1 rounded text-xs font-medium border transition disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 border-slate-200 text-slate-600">
                  <i class="fas fa-chevron-left"></i>
                </button>
                <template
                  v-for="p in paginasVisiveisVenc(totalPaginasSetorModal, Math.min(paginaSetorModal, totalPaginasSetorModal))"
                  :key="'psm' + p">
                  <span v-if="p === '...'" class="px-2 text-xs text-slate-400">...</span>
                  <button v-else @click="paginaSetorModal = p"
                    class="px-2.5 py-1 rounded text-xs font-medium border transition"
                    :class="p === Math.min(paginaSetorModal, totalPaginasSetorModal) ? 'bg-indigo-600 text-white border-indigo-600' : 'hover:bg-slate-100 border-slate-200 text-slate-600'">
                    {{ p }}
                  </button>
                </template>
                <button @click="paginaSetorModal = Math.min(totalPaginasSetorModal, paginaSetorModal + 1)"
                  :disabled="paginaSetorModal >= totalPaginasSetorModal"
                  class="px-2.5 py-1 rounded text-xs font-medium border transition disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 border-slate-200 text-slate-600">
                  <i class="fas fa-chevron-right"></i>
                </button>
              </div>
            </div>
          </div>
          <div class="bg-gray-50 px-4 py-3 flex justify-end gap-2 shrink-0 border-t">
            <button @click="fecharModalSetor"
              class="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300 transition font-medium text-sm">
              Fechar
            </button>
            <button @click="imprimir('modal-setor')"
              class="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm shadow-sm transition">
              <i class="fas fa-print mr-2"></i>Imprimir
            </button>
          </div>
        </div>
      </div>

      <div v-if="modalAcaoAberto" class="ui-modal-backdrop" @click.self="modalAcaoAberto = false">
        <form class="ui-modal p-6" @submit.prevent="salvarAcao">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h2 class="text-lg font-bold text-slate-900">Registrar ação operacional</h2>
              <p class="mt-1 text-sm text-slate-500">{{ itemAcao?._codigo }} · {{ itemAcao?._produto }}</p>
            </div>
            <button type="button" class="text-slate-400 hover:text-slate-700" aria-label="Fechar" @click="modalAcaoAberto = false"><i class="fas fa-times"></i></button>
          </div>
          <div class="mt-5 space-y-4">
            <div>
              <label class="ui-label">Ação</label>
              <select v-model="formularioAcao.acao" class="ui-input">
                <option>Verificar na gôndola</option>
                <option>Aplicar desconto</option>
                <option>Separar para quebra</option>
                <option>Devolver ao fornecedor</option>
                <option>Resolvido</option>
              </select>
            </div>
            <div>
              <label class="ui-label">Responsável</label>
              <input v-model.trim="formularioAcao.responsavel" class="ui-input" required maxlength="80" placeholder="Nome ou matrícula" />
            </div>
          </div>
          <div class="mt-6 flex justify-end gap-2">
            <button type="button" class="ui-btn-secondary" @click="modalAcaoAberto = false">Cancelar</button>
            <button type="submit" class="ui-btn-primary"><i class="fas fa-check"></i>Salvar ação</button>
          </div>
        </form>
      </div>

      <!-- ===== MODAL FORNECEDOR ===== -->
      <div v-if="modalFornecedorAberto && fornecedorSelecionado"
        class="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-8"
        @click="limparFornecedor">
        <div class="relative bg-white rounded-lg shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[90vh]"
          @click.stop>
          <div
            class="bg-blue-700 text-white p-4 md:p-5 flex items-center justify-between shrink-0">
            <div>
              <h2 class="text-xl font-bold"><i class="fas fa-truck mr-2"></i>{{ fornecedorSelecionado }}</h2>
              <p class="text-blue-100 text-sm mt-1">{{ itensFornecedor.length }} itens deste fornecedor</p>
            </div>
            <button @click="limparFornecedor" class="text-white hover:opacity-80 transition">
              <i class="fas fa-times text-xl"></i>
            </button>
          </div>
          <div class="p-4 overflow-y-auto flex-1">
            <!-- Search -->
            <div class="mb-3">
              <div class="relative max-w-xs">
                <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                <input v-model="buscaFornecedorModal" placeholder="Buscar por codigo ou produto..."
                  class="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition bg-white" />
              </div>
            </div>

            <!-- Table -->
            <div class="overflow-x-auto">
              <table class="w-full text-xs">
                <thead>
                  <tr class="border-b-2 border-slate-100">
                    <th v-for="col in colunasItens" :key="col.chave"
                      class="px-3 py-2.5 font-semibold text-slate-500 uppercase tracking-wider text-[11px] whitespace-nowrap"
                      :class="[col.alinhamento === 'right' ? 'text-right' : 'text-left', col.sortable ? 'cursor-pointer select-none hover:text-indigo-600 transition-colors' : '']"
                      @click="col.sortable && atualizarOrdenacaoVenc(ordenacaoFornecedorModal, col.chave)">
                      {{ col.titulo }}
                      <template v-if="col.sortable">
                        <i v-if="ordenacaoFornecedorModal.coluna !== col.chave"
                          class="fas fa-sort text-slate-300 ml-1"></i>
                        <i v-else-if="ordenacaoFornecedorModal.direcao === 'asc'"
                          class="fas fa-sort-up text-indigo-600 ml-1"></i>
                        <i v-else class="fas fa-sort-down text-indigo-600 ml-1"></i>
                      </template>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="itensFornecedorPaginados.length === 0">
                    <td :colspan="colunasItens.length" class="text-center py-10 text-slate-400">
                      <i class="fas fa-inbox text-3xl mb-2 block"></i>
                      <p class="text-sm">Nenhum item encontrado</p>
                    </td>
                  </tr>
                  <tr v-for="(item, idx) in itensFornecedorPaginados" :key="item._codigo + item._validadeISO + idx"
                    :class="item._prazo === 'vencidos' ? 'bg-red-50/60 hover:bg-indigo-50/40' : item._prazo === 'hoje' ? 'bg-orange-50/60 hover:bg-indigo-50/40' : item._prazo === 'ate3' ? 'bg-yellow-50/60 hover:bg-indigo-50/40' : idx % 2 === 0 ? 'bg-white hover:bg-indigo-50/40' : 'bg-slate-50/60 hover:bg-indigo-50/40'">
                    <td class="px-3 py-2">{{ item._codigo }}</td>
                    <td class="px-3 py-2">{{ item._produto }}</td>
                    <td class="px-3 py-2">{{ item._setor }}</td>
                    <td class="px-3 py-2">{{ item._fornecedor }}</td>
                    <td class="px-3 py-2">{{ item._local }}</td>
                    <td class="px-3 py-2">{{ item._validadeISO }}</td>
                    <td class="px-3 py-2 text-right tabular-nums">{{ item._diasParaVencer }}</td>
                    <td class="px-3 py-2 text-right tabular-nums">{{ item._estoque }}</td>
                    <td class="px-3 py-2">
                      <span class="px-2 py-0.5 text-xs rounded-full border font-medium"
                        :class="prazoBadgeClasses(item._prazo)">
                        {{ prazoBadgeLabel(item._prazo) }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Pagination -->
            <div v-if="totalPaginasFornecedorModal > 1"
              class="flex items-center justify-between px-4 py-3 border-t border-slate-100">
              <p class="text-xs text-slate-500">Pagina {{ Math.min(paginaFornecedorModal, totalPaginasFornecedorModal)
                }} de
                {{ totalPaginasFornecedorModal }}</p>
              <div class="flex items-center gap-1">
                <button @click="paginaFornecedorModal = Math.max(1, paginaFornecedorModal - 1)"
                  :disabled="paginaFornecedorModal <= 1"
                  class="px-2.5 py-1 rounded text-xs font-medium border transition disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 border-slate-200 text-slate-600">
                  <i class="fas fa-chevron-left"></i>
                </button>
                <template
                  v-for="p in paginasVisiveisVenc(totalPaginasFornecedorModal, Math.min(paginaFornecedorModal, totalPaginasFornecedorModal))"
                  :key="'pfm' + p">
                  <span v-if="p === '...'" class="px-2 text-xs text-slate-400">...</span>
                  <button v-else @click="paginaFornecedorModal = p"
                    class="px-2.5 py-1 rounded text-xs font-medium border transition"
                    :class="p === Math.min(paginaFornecedorModal, totalPaginasFornecedorModal) ? 'bg-indigo-600 text-white border-indigo-600' : 'hover:bg-slate-100 border-slate-200 text-slate-600'">
                    {{ p }}
                  </button>
                </template>
                <button
                  @click="paginaFornecedorModal = Math.min(totalPaginasFornecedorModal, paginaFornecedorModal + 1)"
                  :disabled="paginaFornecedorModal >= totalPaginasFornecedorModal"
                  class="px-2.5 py-1 rounded text-xs font-medium border transition disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 border-slate-200 text-slate-600">
                  <i class="fas fa-chevron-right"></i>
                </button>
              </div>
            </div>
          </div>
          <div class="bg-gray-50 px-4 py-3 flex justify-end gap-2 shrink-0 border-t">
            <button @click="limparFornecedor"
              class="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300 transition font-medium text-sm">
              Fechar
            </button>
            <button @click="imprimir('modal-fornecedor')"
              class="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm shadow-sm transition">
              <i class="fas fa-print mr-2"></i>Imprimir
            </button>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
