<script setup>
import { ref, computed, onMounted } from 'vue'
import { toPng } from 'html-to-image'
import { useRouter, useRoute } from 'vue-router'
import { useAuditoriasStore } from '../stores/auditoriasStore'
import UploadAnaliseAuditoria from '../components/UploadAnaliseAuditoria.vue'
import ModalMetrica from '../components/ModalMetrica.vue'
import ModalSetorLocal from '../components/ModalSetorLocal.vue'
import UiTabs from '../components/ui/UiTabs.vue'
import { printTableInNewWindow, printHtmlInNewWindow } from '../utils/print'

const normalizar = (valor) => {
  if (valor == null) return ''
  try {
    return String(valor).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
  } catch {
    return String(valor).toLowerCase()
  }
}

// Column Definitions
const colunasSetor = [
  { chave: 'nome', titulo: 'Setor', sortable: true },
  { chave: 'total', titulo: 'Total', sortable: true, alinhamento: 'right' },
  { chave: 'lidos', titulo: 'Lidos', sortable: true, alinhamento: 'right', classeCell: 'text-green-600 font-medium' },
  { chave: 'pendentes', titulo: 'Pendentes', sortable: true, alinhamento: 'right', classeCell: 'text-orange-600 font-medium' },
  { chave: 'percentualConclusao', titulo: 'Conclusão', sortable: true, alinhamento: 'right', format: (v) => v.toFixed(2) + '%' },
  { chave: 'classificacao', titulo: 'Classificação', sortable: true, alinhamento: 'center' }
]

const colunasLocal = [
  { chave: 'nome', titulo: 'Local', sortable: true },
  { chave: 'lidos', titulo: 'Lidos', sortable: true, alinhamento: 'right', classeCell: 'text-green-600' },
  { chave: 'pendentes', titulo: 'Pendentes', sortable: true, alinhamento: 'right', classeCell: 'text-orange-600' },
  { chave: 'comProblema', titulo: 'Problema', sortable: true, alinhamento: 'right', classeCell: 'text-red-600' },
  { chave: 'total', titulo: 'Total', sortable: true, alinhamento: 'right', classeCell: 'text-blue-600' },
  { chave: 'percentualLido', titulo: '% Lido', sortable: true, alinhamento: 'right', format: (v) => v.toFixed(2) + '%', classeCell: 'font-bold' }
]

const colunasModalBase = [
  { chave: 'Código', titulo: 'Código', sortable: true, classeCell: 'font-bold' },
  { chave: 'Produto', titulo: 'Produto', sortable: true },
  { chave: 'Local', titulo: 'Local', sortable: true, classeHeader: 'hidden pdf-only', classeCell: 'hidden pdf-only' },
  { chave: 'Estoque atual', titulo: 'Estoque', sortable: true, alinhamento: 'right' },
  { chave: 'Dias sem venda', titulo: 'Dias sem Venda', sortable: true, alinhamento: 'right' },
  { chave: 'status', titulo: 'Status', sortable: true, alinhamento: 'center' }
]

const colunasUsuario = [
  { chave: 'nome', titulo: 'Usuário', sortable: true },
  { chave: 'lidos', titulo: 'Lidos Corretamente', sortable: true, alinhamento: 'right', classeCell: 'text-green-600 font-semibold' },
  { chave: 'comProblema', titulo: 'Com Problema', sortable: true, alinhamento: 'right', classeCell: 'text-red-600 font-semibold' },
  { chave: 'totalLidos', titulo: 'Total Lidos', sortable: true, alinhamento: 'right', classeCell: 'text-blue-600 font-semibold' },
  { chave: 'percentualAuditoria', titulo: '% Auditoria', sortable: true, alinhamento: 'right', format: (v) => v.toFixed(1) + '%' },
  { chave: 'statusBadge', titulo: 'Status', sortable: false, alinhamento: 'center' },
  { chave: 'acoes', titulo: 'Detalhes', sortable: false, alinhamento: 'center' }
]

const colunasRuptura = [
  { chave: 'codigo', titulo: 'Código', sortable: true },
  { chave: 'produto', titulo: 'Produto', sortable: true },
  { chave: 'estoque', titulo: 'Qtd Estoque', sortable: true, alinhamento: 'right' },
  { chave: 'custo', titulo: 'Custo', sortable: true, alinhamento: 'right', format: (v) => 'R$ ' + parseFloat(v).toFixed(2) },
  { chave: 'fornecedor', titulo: 'Fornecedor', sortable: true }
]

const colunasFornecedor = [
  { chave: 'codigo', titulo: 'Código', sortable: true },
  { chave: 'produto', titulo: 'Produto', sortable: true },
  { chave: 'setor', titulo: 'Setor', sortable: true },
  { chave: 'estoque', titulo: 'Estoque', sortable: true, alinhamento: 'right' },
  { chave: 'statusTexto', titulo: 'Status', sortable: true, alinhamento: 'center' }
]

const colunasEstoqueZero = [
  { chave: 'codigo', titulo: 'Código', sortable: true },
  { chave: 'produto', titulo: 'Produto', sortable: true },
  { chave: 'local', titulo: 'Local', sortable: true },
  { chave: 'usuario', titulo: 'Usuário', sortable: true }
]

const colunasLocalErrado = [
  { chave: 'codigo', titulo: 'Código', sortable: true },
  { chave: 'produto', titulo: 'Produto', sortable: true },
  { chave: 'local', titulo: 'Local', sortable: true },
  { chave: 'usuario', titulo: 'Usuário', sortable: true }
]

const colunasGrandeEstoque = [
  { chave: 'codigo', titulo: 'Código', sortable: true },
  { chave: 'produto', titulo: 'Produto', sortable: true },
  { chave: 'estoque', titulo: 'Estoque', sortable: true, alinhamento: 'right' }
]

const colunasDadosBase = [
    { chave: 'Código', titulo: 'Código', sortable: true },
    { chave: 'Produto', titulo: 'Produto', sortable: true },
    { chave: 'Classe de Produto Raiz', titulo: 'Setor', sortable: true },
    { chave: 'Local', titulo: 'Local', sortable: true },
    { chave: 'Usuário', titulo: 'Usuário', sortable: true },
    { chave: 'Presença confirmada', titulo: 'Presença', sortable: true },
    { chave: 'Estoque Atual', titulo: 'Estoque', sortable: true, alinhamento: 'right' },
    { chave: 'Dias sem Venda', titulo: 'Dias sem Venda', sortable: true, alinhamento: 'right' }
]


const router = useRouter()
const route = useRoute()
const store = useAuditoriasStore()

const auditoria = computed(() => {
  return store.auditorias.find(a => a.id === parseInt(route.params.id))
})

const ehBackupRegional = computed(() => auditoria.value?.origem === 'backup-regional' || Boolean(auditoria.value?.analise?.regional))

const colunasModal = computed(() => {
  if (auditoria.value?.tipo === 'Etiqueta') {
    return colunasModalBase.filter(c => c.chave !== 'Dias sem venda')
  }
  return colunasModalBase
})

const colunasDados = computed(() => {
  if (auditoria.value?.tipo === 'Etiqueta') {
    return colunasDadosBase.filter(c => c.chave !== 'Dias sem Venda')
  }
  return colunasDadosBase
})

const abaAtiva = ref('dashboard')
const filtroUsuario = ref('')
const filtroDados = ref('')
const filtroFornecedor = ref('')
const filtroStatusFornecedor = ref('todos')
const filtroSetorFornecedor = ref('todos')
const filtroSetorEstoqueZero = ref('todos')
const filtroSetorLocalErrado = ref('todos')
const filtroSetorGrandeEstoque = ref('todos')
const filtroSetorRuptura = ref('todos')
const filtroUsuarioEstoqueZero = ref('todos')
const filtroUsuarioLocalErrado = ref('todos')
const modalMetricaAberto = ref(false)
const metricaSelecionada = ref(null)
const modalSetorLocalAberto = ref(false)
const tipoModalSetorLocal = ref(null)
const itemsModalSetorLocal = ref([])
const viewModeLocais = ref('grid') // 'grid' ou 'list'
const modalRelatorioAberto = ref(false)
const filtroItens = ref('')
const ordenacaoUsuarios = ref({ coluna: 'totalLidos', direcao: 'desc' })
const paginaUsuariosTab = ref(1)
const itensPorPaginaUsuariosTab = 10
const buscaUsuariosTab = ref('')
const ordenacaoItens = ref({ coluna: 'Código', direcao: 'asc' })
const filtroStatusItens = ref('todos')
const modalUsuarioAberto = ref(false)
const usuarioSelecionado = ref(null)
const mostrarUploadSubstituir = ref(false)
const skuSubstituir = ref('')
const modalItensAberto = ref(false)
const itensModal = ref([])
const tituloModalItens = ref('')
const printAreaItens = ref(null)
const printAreaRelatorio = ref(null)
const resultadoGeralSetorExportRef = ref(null)
const topLocaisPendentesExportRef = ref(null)
const editandoSku = ref(false)
const skuEditavel = ref('')
const filtroHorarioUsuario = ref('todos')
const filtroHorarioSetor = ref('todos')

// Paginação/ordenação das tabelas de dados críticos
const paginaDadosEstoqueZero = ref(1)
const paginaDadosLocalErrado = ref(1)
const paginaDadosGrandeEstoque = ref(1)
const paginaDadosRuptura = ref(1)
const itensPorPaginaDados = 10
const buscaDadosEstoqueZero = ref('')
const buscaDadosLocalErrado = ref('')
const buscaDadosGrandeEstoque = ref('')
const buscaDadosRuptura = ref('')
const ordenacaoDadosEstoqueZero = ref({ coluna: 'codigo', direcao: 'asc' })
const ordenacaoDadosLocalErrado = ref({ coluna: 'codigo', direcao: 'asc' })
const ordenacaoDadosGrandeEstoque = ref({ coluna: 'estoque', direcao: 'desc' })
const ordenacaoDadosRuptura = ref({ coluna: 'custo', direcao: 'desc' })

// Fornecedor table state
const paginaFornecedorTab = ref(1)
const buscaFornecedorTab = ref('')
const ordenacaoFornecedorTab = ref({ coluna: 'codigo', direcao: 'asc' })
const itensPorPaginaFornecedorTab = 10

// Modal Itens table state
const paginaModalItens = ref(1)
const buscaModalItens = ref('')
const ordenacaoModalItens = ref({ coluna: 'Código', direcao: 'asc' })
const itensPorPaginaModalItens = 10

// Paginação/ordenação das tabelas de estatísticas
const paginaSetores = ref(1)
const paginaLocais = ref(1)
const itensPorPaginaSetores = 10
const itensPorPaginaLocais = 12
const buscaSetores = ref('')
const buscaLocais = ref('')
const ordenacaoSetores = ref({ coluna: 'percentualPendente', direcao: 'desc' })
const ordenacaoLocais = ref({ coluna: 'pendentes', direcao: 'desc' })

const iniciarEdicaoSku = () => {
  skuEditavel.value = String(auditoria.value?.sku || '')
  editandoSku.value = true
}

const salvarSku = async () => {
  const novoSku = parseInt(skuEditavel.value) || 0
  if (novoSku > 0 && auditoria.value) {
    await store.updateAuditoria(auditoria.value.id, {
      sku: novoSku,
      total: novoSku
    })
    store.addToast('SKU atualizado com sucesso!', 'success')
  }
  editandoSku.value = false
  skuEditavel.value = ''
}

const cancelarEdicaoSku = () => {
  editandoSku.value = false
  skuEditavel.value = ''
}

// UI/UX Improvements - Collapse states
const collapsedSections = ref({
  resumoHistorico: true, // Dashboard: Resumo Histórico starts collapsed
  estoqueZero: false,    // Data: Estoque Zero starts expanded
  lidoWrong: false,      // Data: Local Errado starts expanded
  grandeEstoque: true,   // Data: Grande Estoque starts collapsed
  tempoSemLeitura: true  // Data: Tempo sem Leitura starts collapsed
})

// UI/UX Improvements - Filter states
const filtroPerformanceUser = ref('all')   // Users tab performance filter

const abasDetalhes = [
  { value: 'dashboard', label: 'Dashboard', icon: 'fas fa-chart-line' },
  { value: 'usuarios', label: 'Usuários', icon: 'fas fa-users-cog' },
  { value: 'dados', label: 'Dados', icon: 'fas fa-database' },
  { value: 'estatisticas', label: 'Estatísticas', icon: 'fas fa-chart-bar' }
]

const readOnly = computed(() => auditoria.value?.status === 'fechada')
const statusBadge = computed(() => {
  if (!auditoria.value) return null
  const fechada = auditoria.value.status === 'fechada'
  const dentroMeta = (auditoria.value.analise?.parcialPercentual || 0) <= 3.0
  return { fechada, dentroMeta }
})

const dataAuditoriaBR = computed(() => {
  if (!auditoria.value?.data) return ''
  const valor = String(auditoria.value.data)
  const partes = valor.split('-')
  if (partes.length === 3) {
    const [ano, mes, dia] = partes
    return `${dia.padStart(2, '0')}/${mes.padStart(2, '0')}/${ano}`
  }
  return valor
})

onMounted(() => {
  if (!auditoria.value) {
    router.push('/auditorias')
  }
  try {
    if (route.query?.print === 'relatorio') {
      modalRelatorioAberto.value = true
    }
  } catch {}
})

const handleUploadCompleto = async ({ dados, analise }) => {
  if (auditoria.value) {
    const updateData = {
      dados: dados,
      analise: analise,
      parcial: analise.parcialPercentual,
      total: analise.totalItens
    }
    const novoSku = parseInt(skuSubstituir.value) || 0
    if (novoSku > 0) {
      updateData.sku = novoSku
      updateData.total = novoSku
    }
    await store.updateAuditoria(auditoria.value.id, updateData)
    store.addToast('Dados importados com sucesso!', 'success')
    mostrarUploadSubstituir.value = false
    skuSubstituir.value = ''
  }
}

// =========== DASHBOARD ===========
const metricasGerais = computed(() => {
  if (!auditoria.value?.analise) return null
  const a = auditoria.value.analise
  // Usar SKU da auditoria como base de cálculo
  const sku = auditoria.value.sku || a.totalItens || 0
  const itensPendentes = a.itensPendentes || 0
  const itensDesatualizados = a.itensDesatualizados || 0

  const totalItens = sku
  const totalLidos = Math.max(0, totalItens - itensPendentes)
  const itensAtualizados = Math.max(0, totalLidos - itensDesatualizados)
  const pendentes = itensPendentes
  // Itens com problema: lidos sem estoque + lido não pertence (apenas exibição)
  const comProblema = a.itensLidosComProblema != null
    ? a.itensLidosComProblema
    : ((a.itensLidoNaoPertence || 0) + (a.itensComEstoqueZero || 0))
  const percentualConclusao = totalItens > 0 ? (totalLidos / totalItens) * 100 : 0
  const percentualPendente = totalItens > 0 ? (pendentes / totalItens) * 100 : 0

  return {
    totalItens,
    lidosCorretamente: itensAtualizados || totalLidos,
    pendentes,
    comProblema,
    totalLidos,
    atualizados: itensAtualizados,
    desatualizados: itensDesatualizados,
    percentualConclusao,
    percentualPendente,
    metaConclusao: 97.0,
    metaPendente: 3.0,
    faltaParaMeta: Math.max(0, percentualPendente - 3.0),
    setoresParados: a.setoresParados?.length || 0,
    locaisCriticos: a.locaisSemLeitura?.length || 0
  }
})

const insights = computed(() => {
  if (!auditoria.value?.dados || !auditoria.value?.analise) return []
  
  const insights = []
  const a = auditoria.value.analise
  const dados = auditoria.value.dados
  const metricas = metricasGerais.value
  const totalLidos = metricas?.totalLidos ?? 0
  const totalAuditaveis = metricas?.totalItens ?? 0
  const percentualConclusao = metricas?.percentualConclusao ?? 0
  const percentualPendente = metricas?.percentualPendente ?? 0

  // Insight 1: Status da Meta
  if (percentualPendente <= 3.0) {
    insights.push({
      tipo: 'sucesso',
      titulo: '🎯 Meta Atingida!',
      mensagem: `Pendente: ${percentualPendente.toFixed(2)}% (Meta: 3%)`,
      detalhes: [`✅ Auditoria dentro da meta estabelecida`]
    })
  } else {
    const falta = percentualPendente - 3.0
    const itensFaltam = Math.ceil((falta / 100) * totalAuditaveis)
    insights.push({
      tipo: 'critico',
      titulo: '⚠️ Meta Não Atingida',
      mensagem: `Pendente: ${percentualPendente.toFixed(2)}% (Meta: 3%)`,
      detalhes: [
        `Faltam ${falta.toFixed(2)}% para atingir a meta`,
        `Aproximadamente ${itensFaltam} itens precisam ser lidos`
      ]
    })
  }

  // Insight 2: Setores críticos
  if (a.setoresParados?.length > 0) {
    insights.push({
      tipo: 'critico',
      titulo: '🚨 Setores Parados',
      mensagem: `${a.setoresParados.length} setor(es) sem nenhuma leitura`,
      detalhes: a.setoresParados.slice(0, 5)
    })
  }

  // Insight 3: Itens com Problema
  if (a.itensLidosComProblema > 0) {
    const detalhes = []
    if (a.itensComEstoqueZero > 0) detalhes.push(`${a.itensComEstoqueZero} com estoque zerado`)
    if (a.itensLidoNaoPertence > 0) detalhes.push(`${a.itensLidoNaoPertence} em local errado`)
    insights.push({
      tipo: 'aviso',
      titulo: '⚠️ Ítens Requerem Atenção',
      mensagem: `${a.itensLidosComProblema} itens lidos mas com problemas`,
      detalhes: detalhes
    })
  }

  // Insight 4: Progresso Geral
  if (percentualConclusao >= 95) {
    insights.push({
      tipo: 'sucesso',
      titulo: '🎯 Excelente Progresso!',
      mensagem: `${percentualConclusao.toFixed(2)}% de conclusão`,
      detalhes: [`${totalLidos} de ${totalAuditaveis} itens lidos`]
    })
  } else if (percentualConclusao >= 80) {
    insights.push({
      tipo: 'info',
      titulo: '⚡ Bom Progresso',
      mensagem: `${percentualConclusao.toFixed(2)}% de conclusão`,
      detalhes: [`Ainda restam ${metricasGerais.value?.pendentes ?? a.itensPendentes ?? 0} itens pendentes`]
    })
  } else {
    insights.push({
      tipo: 'aviso',
      titulo: '📊 Progresso em Andamento',
      mensagem: `${percentualConclusao.toFixed(2)}% de conclusão`,
      detalhes: [`Faltam ${metricasGerais.value?.pendentes ?? a.itensPendentes ?? 0} itens para completar`]
    })
  }

  // Insight 5: Usuário mais produtivo
  if (Object.keys(a.porUsuario).length > 0) {
    const usuarioTopProdutivo = Object.entries(a.porUsuario)
      .map(([nome, dados]) => ({
        nome,
        total: (dados.lidos || 0) + (dados.comProblema || 0)
      }))
      .sort((a, b) => b.total - a.total)[0]
    if (usuarioTopProdutivo && usuarioTopProdutivo.total > 0) {
      insights.push({
        tipo: 'info',
        titulo: '⭐ Melhor Desempenho',
        mensagem: `${usuarioTopProdutivo.nome} leu ${usuarioTopProdutivo.total} itens`,
        detalhes: []
      })
    }
  }

  // Insight 6: Locais críticos
  if (a.locaisSemLeitura?.length > 0) {
    insights.push({
      tipo: 'aviso',
      titulo: '📍 Locais Sem Leitura',
      mensagem: `${a.locaisSemLeitura.length} local(is) ainda precisam de atenção`,
      detalhes: a.locaisSemLeitura.slice(0, 5)
    })
  }

  // Insight 7: Distribuição de leituras
  const usuariosAtivos = Object.keys(a.porUsuario).length
  if (usuariosAtivos > 0) {
    const mediaPorUsuario = Math.round(totalLidos / usuariosAtivos)
    insights.push({
      tipo: 'info',
      titulo: '👥 Equipe em Ação',
      mensagem: `${usuariosAtivos} usuário(s) ativo(s)`,
      detalhes: [`Média de ${mediaPorUsuario} itens lidos por usuário`]
    })
  }

  // Onde focar: top 3 setores por % pendente
  const setoresOrdenados = Object.entries(a.porSetor || {}).map(([nome, v]) => {
    const total = (v.lidos || 0) + (v.pendentes || 0) + (v.comProblema || 0)
    const perc = total > 0 ? (v.pendentes / total) * 100 : 0
    return { nome, pend: v.pendentes || 0, perc }
  }).sort((x, y) => (y.perc - x.perc) || (y.pend - x.pend)).slice(0, 3)
  if (setoresOrdenados.length > 0) {
    insights.push({
      tipo: 'critico',
      titulo: '🎯 Onde Focar',
      mensagem: 'Setores com maior % pendente',
      detalhes: setoresOrdenados.map(s => `${s.nome}: ${s.perc.toFixed(1)}% (${s.pend})`)
    })
  }

  // Ritmo mais lento: usuário com menor volume de leitura
  const usuariosLista = Object.entries(a.porUsuario || {}).map(([nome, v]) => ({
    nome, total: (v.lidos || 0) + (v.comProblema || 0)
  })).sort((x, y) => x.total - y.total)
  if (usuariosLista.length > 0) {
    const lento = usuariosLista[0]
    insights.push({
      tipo: 'aviso',
      titulo: '🐢 Ritmo Mais Lento',
      mensagem: `${lento.nome} com ${lento.total} leituras`,
      detalhes: []
    })
  }

  // Locais há muito tempo sem ler
  const qtdMuitoTempo = (itensMuitoTempoNaoLidos?.value || []).length
  if (qtdMuitoTempo > 0) {
    insights.push({
      tipo: 'aviso',
      titulo: '⏳ Muito Tempo Sem Leitura',
      mensagem: `${qtdMuitoTempo} item(ns) lidos há muito tempo`,
      detalhes: []
    })
  }

  return insights
})

// =========== ANÁLISES INTELIGENTES ===========
const horarioInicio = computed(() => {
  const tipo = auditoria.value?.tipo
  return tipo === 'Etiqueta' ? '08:00' : '08:00'
})
const horarioFim = computed(() => {
  const tipo = auditoria.value?.tipo
  return tipo === 'Etiqueta' ? '20:00' : '18:00'
})

const parseHoraHoje = (hhmm) => {
  try {
    const [h, m] = String(hhmm).split(':').map(n => parseInt(n, 10))
    const d = new Date()
    d.setHours(isNaN(h) ? 0 : h, isNaN(m) ? 0 : m, 0, 0)
    return d
  } catch {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }
}

const horasEntre = (inicio, fim) => {
  const ms = Math.max(0, fim.getTime() - inicio.getTime())
  return ms / 36e5
}

const projecoes = computed(() => {
  if (!auditoria.value?.analise) return null
  const a = auditoria.value.analise
  const sku = auditoria.value.sku || a.totalItens || 0
  const totalLidos = Math.max(0, sku - (a.itensPendentes || 0))
  const totalAuditaveis = sku

  const agora = new Date()
  const ini = parseHoraHoje(horarioInicio.value)
  const fim = parseHoraHoje(horarioFim.value)

  const horasDecorridas = Math.max(0, Math.min(horasEntre(ini, agora), horasEntre(ini, fim)))
  const horasRestantes = Math.max(0, horasEntre(agora, fim))
  const ritmoHora = totalLidos / Math.max(0.25, horasDecorridas || 0) // evita divisão por zero
  const projItens = Math.floor(ritmoHora * horasRestantes)
  const projPercentualFinal = totalAuditaveis > 0
    ? Math.min(100, ((totalLidos + projItens) / totalAuditaveis) * 100)
    : 0

  return {
    horasDecorridas,
    horasRestantes,
    ritmoHora,
    projItens,
    projPercentualFinal,
    totalLidos,
    totalAuditaveis
  }
})

const formatHoras = (valor) => {
  if (valor == null || isNaN(valor)) return '00:00'
  const totalMinutos = Math.round(Math.max(0, valor) * 60)
  const horas = Math.floor(totalMinutos / 60)
  const minutos = totalMinutos % 60
  const hStr = String(horas).padStart(2, '0')
  const mStr = String(minutos).padStart(2, '0')
  return `${hStr}:${mStr}`
}

const toHour = (valor) => {
  if (!valor) return null
  if (typeof valor === 'string') {
    const d = new Date(valor)
    if (!isNaN(d.getTime())) return d.getHours()
    const m = valor.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/)
    if (m) return Math.max(0, Math.min(23, parseInt(m[1], 10)))
    return null
  }
  if (typeof valor === 'number') {
    if (valor > 1e12) {
      const d = new Date(valor)
      return isNaN(d.getTime()) ? null : d.getHours()
    }
    const base = new Date(Date.UTC(1899, 11, 30))
    const d = new Date(base.getTime() + valor * 864e5)
    return isNaN(d.getTime()) ? null : d.getUTCHours()
  }
  if (valor instanceof Date) return valor.getHours()
  return null
}

// Extrai a hora de trabalho de um item, tentando todas as colunas "Auditado em" (incluindo _1, _2, etc.)
const getItemHour = (item) => {
  // Primeiro, tentar o valor principal
  let h = toHour(getHoraValor(item))
  if (h != null && h > 0) return h

  // Se a hora é 0 (meia-noite) ou null, a coluna pode ter o valor de DATA e não de HORA.
  // XLSX renomeia colunas duplicadas com sufixos _1, _2, etc.
  // Tentar todas as variações de "Auditado em" para encontrar a coluna de horário.
  const chaves = Object.keys(item).filter(k => {
    const n = k.toLowerCase()
    return n.startsWith('auditado em') || n.startsWith('auditado_em')
  })
  for (const chave of chaves) {
    const tentativa = toHour(item[chave])
    if (tentativa != null && tentativa > 0) return tentativa
  }
  return h
}

// Converte serial Excel ou valor para data ISO YYYY-MM-DD (seguro para timezone)
const serialToDateISO = (valor) => {
  if (typeof valor === 'number' && valor > 100 && valor < 200000) {
    // Serial Excel (dias desde 1899-12-30) - usar UTC para evitar offset de timezone
    const d = new Date(Date.UTC(1899, 11, 30) + valor * 864e5)
    if (!isNaN(d.getTime())) {
      const ano = d.getUTCFullYear()
      if (ano >= 2020 && ano <= 2040) {
        return `${ano}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
      }
    }
    return null
  }
  if (typeof valor === 'string') {
    const d = parseDataValor(valor)
    if (d) {
      const ano = d.getFullYear()
      if (ano >= 2020 && ano <= 2040) {
        return `${ano}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      }
    }
  }
  if (valor instanceof Date && !isNaN(valor.getTime())) {
    const ano = valor.getFullYear()
    if (ano >= 2020 && ano <= 2040) {
      return `${ano}-${String(valor.getMonth() + 1).padStart(2, '0')}-${String(valor.getDate()).padStart(2, '0')}`
    }
  }
  return null
}

// Extrai a data ISO (YYYY-MM-DD) de um item, tentando todas as colunas "Auditado em"
const getItemDateISO = (item) => {
  // Tentar todas as variações "Auditado em" (incluindo _1, _2 do XLSX)
  const chaves = Object.keys(item).filter(k => {
    const n = k.toLowerCase()
    return n.startsWith('auditado em') || n.startsWith('auditado_em')
  })
  for (const chave of chaves) {
    const resultado = serialToDateISO(item[chave])
    if (resultado) return resultado
  }
  // Fallback: tentar getHoraValor
  const horaValor = getHoraValor(item)
  return serialToDateISO(horaValor)
}

const isItemLido = (item) => {
  if (item._temPresenca) return true
  const valor = item['Lido não pertence']
  if (valor === undefined || valor === null) return false
  if (valor === true) return true
  if (typeof valor === 'string') return valor.toLowerCase().includes('sim')
  return false
}

const leituraPorHora = computed(() => {
  if (!auditoria.value?.dados) return null
  const dados = auditoria.value.dados

  const contagem = {}
  for (let h = 8; h <= 18; h++) contagem[h] = 0

  dados.forEach(item => {
    if (!isItemLido(item)) return
    const h = getItemHour(item)
    if (h != null && h >= 8 && h <= 18) {
      contagem[h] = (contagem[h] || 0) + 1
    }
  })

  const serie = []
  for (let h = 8; h <= 18; h++) {
    const label = String(h).padStart(2, '0') + ':00'
    serie.push({ hora: label, valor: contagem[h] || 0 })
  }
  const max = serie.reduce((m, p) => Math.max(m, p.valor), 0)
  return { serie, max }
})

const leituraPorHoraFiltrada = computed(() => {
  if (!auditoria.value?.dados) return null
  const dados = auditoria.value.dados
  const auditoriaDia = auditoria.value.data // ISO string YYYY-MM-DD

  const contagem = {}
  for (let h = 6; h <= 22; h++) contagem[h] = 0

  let totalLeituras = 0

  dados.forEach(item => {
    if (!isItemLido(item)) return

    // Filtro de data: somente itens auditados no dia da auditoria
    if (auditoriaDia) {
      const dataItemISO = getItemDateISO(item)
      if (dataItemISO && dataItemISO !== auditoriaDia) return
    }

    // Filtro de usuário
    if (filtroHorarioUsuario.value !== 'todos') {
      const usuario = (item['Usuário'] || item['Usuario'] || '').toString().trim()
      if (usuario !== filtroHorarioUsuario.value) return
    }

    // Filtro de setor
    if (filtroHorarioSetor.value !== 'todos') {
      const setor = getSetorItem(item)
      if (setor !== filtroHorarioSetor.value) return
    }

    const h = getItemHour(item)
    if (h != null && h >= 6 && h <= 22) {
      contagem[h] = (contagem[h] || 0) + 1
      totalLeituras++
    }
  })

  // Construir série e calcular variações
  const serie = []
  let horasComLeitura = 0
  for (let h = 6; h <= 22; h++) {
    const valor = contagem[h] || 0
    if (valor > 0) horasComLeitura++
    const label = String(h).padStart(2, '0') + ':00'
    serie.push({ hora: label, horaNum: h, valor, variacao: 0 })
  }

  // Calcular variação % entre horas consecutivas
  for (let i = 1; i < serie.length; i++) {
    const anterior = serie[i - 1].valor
    const atual = serie[i].valor
    if (anterior > 0 && atual > 0) {
      serie[i].variacao = Math.round(((atual - anterior) / anterior) * 100)
    } else if (anterior === 0 && atual > 0) {
      serie[i].variacao = 100
    } else if (anterior > 0 && atual === 0) {
      serie[i].variacao = -100
    }
  }

  const max = serie.reduce((m, p) => Math.max(m, p.valor), 0)
  const media = horasComLeitura > 0 ? Math.round(totalLeituras / horasComLeitura) : 0

  // Filtrar série para exibir somente horários relevantes (com dados OU entre horários com dados)
  let primeiroIdx = serie.findIndex(s => s.valor > 0)
  let ultimoIdx = serie.length - 1
  for (let i = serie.length - 1; i >= 0; i--) {
    if (serie[i].valor > 0) { ultimoIdx = i; break }
  }
  const serieVisivel = primeiroIdx >= 0 ? serie.slice(Math.max(0, primeiroIdx - 1), ultimoIdx + 2) : serie

  // Insights
  const comLeitura = serie.filter(s => s.valor > 0)
  const pico = comLeitura.length > 0 ? comLeitura.reduce((a, b) => a.valor >= b.valor ? a : b) : null
  const baixa = comLeitura.length > 0 ? comLeitura.reduce((a, b) => a.valor <= b.valor ? a : b) : null

  let maiorSubida = null
  let maiorQueda = null
  for (let i = 1; i < serie.length; i++) {
    if (serie[i].valor === 0 && serie[i - 1].valor === 0) continue
    if (serie[i].variacao > 0 && (!maiorSubida || serie[i].variacao > maiorSubida.variacao)) {
      maiorSubida = { de: serie[i - 1].hora, para: serie[i].hora, variacao: serie[i].variacao }
    }
    if (serie[i].variacao < 0 && (!maiorQueda || serie[i].variacao < maiorQueda.variacao)) {
      maiorQueda = { de: serie[i - 1].hora, para: serie[i].hora, variacao: serie[i].variacao }
    }
  }

  return {
    serie: serieVisivel,
    max,
    totalLeituras,
    media,
    pico,
    baixa,
    maiorSubida,
    maiorQueda
  }
})

const getHoraValor = (item) => {
  let v = item['Auditado em'] || item['Data'] || item['Hora'] || item['Lido em'] || item['Carimbo de data/hora']
  if (v == null) {
    const key = Object.keys(item).find(k => {
      const n = String(k).toLowerCase()
      return (n.includes('audit') || n.includes('lido') || n.includes('hora')) && item[k]
    })
    if (key) v = item[key]
  }
  if (v == null) v = item['Presença confirmada'] || item['Presença'] || null
  return v
}

const parseDataValor = (valor) => {
  if (!valor) return null
  if (valor instanceof Date) return valor
  if (typeof valor === 'number') {
    if (valor > 2000000000000) return new Date(valor) // Timestamp ms
    return new Date(Date.UTC(1899, 11, 30) + valor * 864e5) // Excel serial
  }
  if (typeof valor === 'string') {
    // Tentar formato DD/MM/YYYY HH:mm:ss
    try {
      const partesDataHora = valor.split(' ')
      const partesData = partesDataHora[0].split('/')
      if (partesData.length === 3) {
        const dia = parseInt(partesData[0])
        const mes = parseInt(partesData[1]) - 1
        const ano = parseInt(partesData[2])
        
        let hora = 0, min = 0, seg = 0
        if (partesDataHora[1]) {
          const partesHora = partesDataHora[1].split(':')
          if (partesHora.length >= 2) {
            hora = parseInt(partesHora[0])
            min = parseInt(partesHora[1])
            seg = partesHora[2] ? parseInt(partesHora[2]) : 0
          }
        }
        const d = new Date(ano, mes, dia, hora, min, seg)
        if (!isNaN(d.getTime())) return d
      }
      // Fallback para construtor padrão
      const d = new Date(valor)
      if (!isNaN(d.getTime())) return d
    } catch (e) {
      return null
    }
  }
  return null
}

const improvementInsights = computed(() => {
  if (auditoria.value?.status !== 'fechada') return null
  
  const insights = []
  
  // 1. Análise de Horários (Pico e Baixa)
  if (leituraPorHora.value) {
    const { serie } = leituraPorHora.value
    const sortedHours = [...serie].sort((a, b) => b.valor - a.valor)
    const pico = sortedHours[0]
    const baixa = sortedHours.filter(h => h.valor > 0).pop() // Menor valor maior que zero
    
    if (pico && pico.valor > 0) {
      insights.push({
        titulo: '⏰ Picos de Produtividade',
        valor: `${pico.hora}`,
        descricao: `Horário com maior volume: ${pico.valor} leituras`,
        tipo: 'sucesso',
        icon: 'fas fa-chart-line'
      })
    }
    
    if (baixa) {
      insights.push({
        titulo: '📉 Horário de Baixa',
        valor: `${baixa.hora}`,
        descricao: `Menor fluxo registrado: ${baixa.valor} leituras`,
        tipo: 'aviso',
        icon: 'fas fa-level-down-alt'
      })
    }
  }

  // 2. Análise de Problemas
  const a = auditoria.value?.analise
  if (a) {
    const totalLidos = (a.totalLidos != null)
      ? a.totalLidos
      : ((a.itensLidosCorretamente || 0) + (a.itensLidosComProblema || 0))
    if (totalLidos > 0) {
      const percProblema = (a.itensLidosComProblema / totalLidos) * 100
      if (percProblema > 5) {
        insights.push({
          titulo: '⚠️ Índice de Problemas',
          valor: `${percProblema.toFixed(1)}%`,
          descricao: 'Alto índice de itens com problema. Verificar qualidade das etiquetas ou treinamento.',
          tipo: 'critico',
          icon: 'fas fa-exclamation-triangle'
        })
      } else {
        insights.push({
          titulo: '✅ Qualidade da Leitura',
          valor: `${(100 - percProblema).toFixed(1)}%`,
          descricao: 'Excelente índice de leituras corretas.',
          tipo: 'sucesso',
          icon: 'fas fa-check-circle'
        })
      }
    }

    // 3. Setores Gargalo
    if (a.porSetor) {
      const setoresLentos = Object.entries(a.porSetor)
        .map(([nome, dados]) => ({
          nome,
          pendente: dados.pendentes,
          total: dados.lidos + dados.pendentes + dados.comProblema
        }))
        .filter(s => s.pendente > 0)
        .sort((a, b) => b.pendente - a.pendente)
        .slice(0, 1)

      if (setoresLentos.length > 0) {
        insights.push({
          titulo: '🐢 Maior Gargalo',
          valor: setoresLentos[0].nome,
          descricao: `${setoresLentos[0].pendente} itens ficaram pendentes neste setor.`,
          tipo: 'aviso',
          icon: 'fas fa-shipping-fast'
        })
      }
    }
  }

  return insights
})

const historicoResumo = computed(() => {
  const outros = (store.auditorias || []).filter(a => a.id !== auditoria.value?.id && a.analise)
  if (outros.length === 0) return null

  const media = (arr) => arr.length ? (arr.reduce((s, n) => s + n, 0) / arr.length) : 0

  const percentuais = outros.map(a => a.analise.percentualConclusao || 0)
  const usuariosAgg = {}
  const setoresAgg = {}

  outros.forEach(a => {
    const porUsuario = a.analise.porUsuario || {}
    Object.entries(porUsuario).forEach(([nome, dados]) => {
      usuariosAgg[nome] = usuariosAgg[nome] || { lidos: 0, count: 0 }
      usuariosAgg[nome].lidos += (dados.lidos || 0) + (dados.comProblema || 0)
      usuariosAgg[nome].count += 1
    })
    const porSetor = a.analise.porSetor || {}
    Object.entries(porSetor).forEach(([setor, dados]) => {
      setoresAgg[setor] = setoresAgg[setor] || { pendentes: 0, count: 0 }
      setoresAgg[setor].pendentes += (dados.pendentes || 0)
      setoresAgg[setor].count += 1
    })
  })

  const usuariosMedios = Object.entries(usuariosAgg)
    .map(([nome, v]) => ({ nome, media: v.lidos / v.count }))
    .sort((a, b) => b.media - a.media)
    .slice(0, 3)

  const setoresCriticos = Object.entries(setoresAgg)
    .map(([nome, v]) => ({ nome, mediaPend: v.pendentes / v.count }))
    .sort((a, b) => b.mediaPend - a.mediaPend)
    .slice(0, 3)

  return {
    mediaPercentualConclusao: media(percentuais),
    topUsuarios: usuariosMedios,
    setoresCriticos
  }
})

// =========== USUÁRIOS ===========
const dadosUsuarios = computed(() => {
  if (!auditoria.value?.analise) return []
  const analise = auditoria.value.analise
  if (!Array.isArray(analise.usuarios)) return []
  const porUsuario = analise.porUsuario || {}

  return analise.usuarios.map(u => {
      const lidos = porUsuario[u]?.lidos || 0
      const comProblema = porUsuario[u]?.comProblema || 0
      const pendentes = porUsuario[u]?.pendentes || 0
      const totalLidos = lidos + comProblema
      const total = lidos + pendentes + comProblema

      let performance = '⭐'
      let performanceClass = 'text-gray-500'
      let score = 0
      if (total > 0) {
        const percentualLido = (totalLidos / total) * 100
        score = percentualLido
        if (percentualLido >= 95) {
          performance = '⭐⭐⭐'
          performanceClass = 'text-green-600'
        } else if (percentualLido >= 80) {
          performance = '⭐⭐'
          performanceClass = 'text-yellow-600'
        } else if (percentualLido >= 60) {
          performance = '⭐'
          performanceClass = 'text-orange-600'
        } else {
          performance = '⚠️'
          performanceClass = 'text-red-600'
        }
      }

      // Get overall % contribution from percentualPorUsuario
      const percentualAuditoria = percentualPorUsuario.value[u]?.percentualGeral || 0
      const percentualProblema = totalLidos > 0 ? Math.round((comProblema / totalLidos) * 1000) / 10 : 0

      return {
        nome: u,
        lidos,
        comProblema,
        totalLidos,
        total,
        performance,
        performanceClass,
        score,
        percentualAuditoria,
        percentualProblema
      }
    })
})

const usuariosFiltrados = computed(() => {
  let lista = [...dadosUsuarios.value]
  if (buscaUsuariosTab.value) {
    const termo = buscaUsuariosTab.value.toLowerCase()
    lista = lista.filter(u => u.nome.toLowerCase().includes(termo))
  }
  const col = ordenacaoUsuarios.value.coluna
  const dir = ordenacaoUsuarios.value.direcao
  lista.sort((a, b) => {
    const va = a[col]
    const vb = b[col]
    if (typeof va === 'number' && typeof vb === 'number') return dir === 'asc' ? va - vb : vb - va
    return dir === 'asc' ? String(va ?? '').localeCompare(String(vb ?? '')) : String(vb ?? '').localeCompare(String(va ?? ''))
  })
  return lista
})

const totalPaginasUsuariosTab = computed(() => Math.ceil(usuariosFiltrados.value.length / itensPorPaginaUsuariosTab))
const usuariosPaginados = computed(() => {
  const inicio = (paginaUsuariosTab.value - 1) * itensPorPaginaUsuariosTab
  return usuariosFiltrados.value.slice(inicio, inicio + itensPorPaginaUsuariosTab)
})

const atualizarOrdenacaoUsuarios = (coluna) => {
  if (ordenacaoUsuarios.value.coluna === coluna) {
    ordenacaoUsuarios.value.direcao = ordenacaoUsuarios.value.direcao === 'asc' ? 'desc' : 'asc'
  } else {
    ordenacaoUsuarios.value.coluna = coluna
    ordenacaoUsuarios.value.direcao = 'asc'
  }
  paginaUsuariosTab.value = 1
}

const analiseUsuarios = computed(() => {
  if (!auditoria.value?.analise) return null
  const usuarios = auditoria.value.analise.usuarios
  if (!Array.isArray(usuarios) || usuarios.length === 0) return null

  const porUsuario = auditoria.value.analise.porUsuario || {}
  const totalLidos = usuarios.reduce((sum, u) => sum + (porUsuario[u]?.lidos || 0), 0)
  const mediaLidosPorUsuario = Math.round(totalLidos / usuarios.length)
  const usuarioMaisProdutivo = [...usuarios].sort((a, b) =>
    (porUsuario[b]?.lidos || 0) - (porUsuario[a]?.lidos || 0)
  )[0]

  return {
    totalUsuarios: usuarios.length,
    mediaLidasPorUsuario: mediaLidosPorUsuario,
    usuarioDestaque: usuarioMaisProdutivo,
    lidasDestaque: porUsuario[usuarioMaisProdutivo]?.lidos || 0
  }
})

// User-Sector Matrix: For each user, track performance in each sector
const porUsuarioSetor = computed(() => {
  if (!auditoria.value?.dados || !auditoria.value?.analise) return {}

  const usuarios = auditoria.value.analise.usuarios || []
  const setores = Object.keys(auditoria.value.analise.porSetor || {})
  const matriz = {}

  // Initialize matrix
  usuarios.forEach(u => {
    matriz[u] = {}
    setores.forEach(s => {
      matriz[u][s] = { lidos: 0, pendentes: 0, comProblema: 0, total: 0 }
    })
  })

  // Helper to check presence
  const temPresenca = (item) => {
    if (item._temPresenca !== undefined) return !!item._temPresenca
    const val = item['Presença confirmada']
    if (val === undefined || val === null) return false
    if (val === true) return true
    if (typeof val === 'string') return val.toLowerCase().includes('sim')
    return false
  }

  // Helper to check problems
  const temProblema = (item) => {
    const estoque = item._estoque ?? parseFloat(item['Estoque atual'] || 0)
    const lnp = item._lidoNaoPertence ?? (item['Lido não pertence'] === true ||
      (typeof item['Lido não pertence'] === 'string' && item['Lido não pertence'].toLowerCase().includes('sim')))
    return estoque <= 0 || lnp
  }

  // Count items by user and sector
  auditoria.value.dados.forEach(item => {
    const usuario = (item['Usuário'] || '').toString().trim()
    if (!usuario || !matriz[usuario]) return

    const setor = (item['Classe de Produto Raiz'] || item['Setor'] || 'Outro').toString().trim()
    if (!setores.includes(setor)) return

    const presence = temPresenca(item)
    matriz[usuario][setor].total++

    if (presence) {
      if (temProblema(item)) {
        matriz[usuario][setor].comProblema++
      } else {
        matriz[usuario][setor].lidos++
      }
    } else {
      matriz[usuario][setor].pendentes++
    }
  })

  // Calculate percentages and filter empty entries
  const resultado = {}
  usuarios.forEach(u => {
    resultado[u] = {}
    setores.forEach(s => {
      const dados = matriz[u][s]
      if (dados.total === 0) return // Skip empty combinations

      const totalLidos = dados.lidos + dados.comProblema
      const percentualConclusao = dados.total > 0 ? (totalLidos / dados.total) * 100 : 0

      // Calculate what % of this sector was done by this user
      const totalSetorGlobal = auditoria.value.analise.porSetor[s]?.lidos +
                              auditoria.value.analise.porSetor[s]?.comProblema || 1
      const percentualDoSetor = (totalLidos / totalSetorGlobal) * 100

      resultado[u][s] = {
        ...dados,
        percentualConclusao: Math.round(percentualConclusao * 100) / 100,
        percentualDoSetor: Math.round(percentualDoSetor * 100) / 100
      }
    })
  })

  return resultado
})

// Overall % contribution per user
const percentualPorUsuario = computed(() => {
  if (!auditoria.value?.analise) return {}

  const usuarios = auditoria.value.analise.usuarios || []
  const porUsuario = auditoria.value.analise.porUsuario || {}
  const totalLidosGlobal = usuarios.reduce((sum, u) =>
    sum + (porUsuario[u]?.lidos || 0), 0
  )

  const resultado = {}
  usuarios.forEach(u => {
    const lidos = porUsuario[u]?.lidos || 0
    const percentual = totalLidosGlobal > 0 ? (lidos / totalLidosGlobal) * 100 : 0
    resultado[u] = {
      totalLidos: lidos,
      percentualGeral: Math.round(percentual * 100) / 100
    }
  })

  return resultado
})

// Sectors with user breakdown for pie charts
const setoresComUsuarios = computed(() => {
  if (!auditoria.value?.analise) return []

  const porSetor = auditoria.value.analise.porSetor || {}
  const usuarios = auditoria.value.analise.usuarios || []

  return Object.entries(porSetor)
    .filter(([_, dados]) => (dados.lidos || 0) + (dados.comProblema || 0) > 0)
    .map(([setor, dadosSetor]) => {
      const totalLidosNoSetor = (dadosSetor.lidos || 0) + (dadosSetor.comProblema || 0)

      // Get user breakdown for this sector from porUsuarioSetor
      const usuariosDoSetor = usuarios
        .filter(u => porUsuarioSetor.value[u] && porUsuarioSetor.value[u][setor])
        .map(u => {
          const dados = porUsuarioSetor.value[u][setor]
          const lidos = dados.lidos + dados.comProblema
          const percentual = totalLidosNoSetor > 0 ? (lidos / totalLidosNoSetor) * 100 : 0
          return {
            usuario: u,
            lidos,
            percentual: Math.round(percentual * 100) / 100
          }
        })
        .sort((a, b) => b.lidos - a.lidos)

      return {
        setor,
        totalLidos: totalLidosNoSetor,
        usuarios: usuariosDoSetor
      }
    })
    .sort((a, b) => b.totalLidos - a.totalLidos)
})

const leiturasPorUsuarioHora = computed(() => {
  if (!auditoria.value?.dados || !auditoria.value?.analise) return null
  const usuarios = auditoria.value.analise.usuarios || []
  if (usuarios.length === 0) return null
  const labels = []
  for (let h = 8; h <= 18; h++) labels.push(String(h).padStart(2, '0') + ':00')
  const cont = {}
  usuarios.forEach(u => {
    cont[u] = {}
    for (let h = 8; h <= 18; h++) cont[u][h] = 0
  })
  auditoria.value.dados.forEach(item => {
    const u = (item['Usuário'] || '').toString().trim()
    if (!u || !cont[u]) return
    if (!isItemLido(item)) return
    const h = getItemHour(item)
    if (h != null && h >= 8 && h <= 18) {
      cont[u][h] = (cont[u][h] || 0) + 1
    }
  })
  const rows = Object.keys(cont)
    .filter(u => u.toLowerCase().includes(filtroUsuario.value.toLowerCase()))
    .map(u => {
      const horas = []
      let total = 0
      for (let h = 8; h <= 18; h++) {
        const v = cont[u][h] || 0
        horas.push(v)
        total += v
      }
      return { nome: u, horas, total }
    })
    .sort((a, b) => b.total - a.total)
  return { labels, usuarios: rows }
})

const locaisMaisLidosPorUsuario = computed(() => {
  if (!auditoria.value?.dados || !auditoria.value?.analise) return []
  const usuarios = auditoria.value.analise.usuarios || []
  if (usuarios.length === 0) return []
  const mapa = {}
  usuarios.forEach(u => { mapa[u] = {} })
  auditoria.value.dados.forEach(item => {
    const u = (item['Usuário'] || '').toString().trim()
    if (!u || !(u in mapa)) return
    if (!isItemLido(item)) return
    const local = (item['Local'] || 'Não especificado').toString().trim()
    mapa[u][local] = (mapa[u][local] || 0) + 1
  })
  const result = Object.keys(mapa)
    .filter(u => u.toLowerCase().includes(filtroUsuario.value.toLowerCase()))
    .map(u => {
      const top = Object.entries(mapa[u])
        .map(([local, contagem]) => ({ local, contagem }))
        .sort((a, b) => b.contagem - a.contagem)
        .slice(0, 3)
      return { nome: u, top }
    })
    .sort((a, b) => (b.top[0]?.contagem || 0) - (a.top[0]?.contagem || 0))
  return result
})

const usuarioDetalhes = computed(() => {
  if (!auditoria.value?.analise || !usuarioSelecionado.value) return null
  const analise = auditoria.value.analise
  const nome = usuarioSelecionado.value
  const base = analise.porUsuario[nome] || { lidos: 0, pendentes: 0, comProblema: 0 }

  let picoHora = null
  let picoQtd = 0
  if (leiturasPorUsuarioHora.value) {
    const { labels, usuarios } = leiturasPorUsuarioHora.value
    const linha = usuarios.find(u => u.nome === nome)
    if (linha && linha.horas && linha.horas.length > 0) {
      let max = 0
      let idxMax = -1
      linha.horas.forEach((v, idx) => {
        if (v > max) {
          max = v
          idxMax = idx
        }
      })
      if (idxMax >= 0 && max > 0) {
        picoHora = labels[idxMax]
        picoQtd = max
      }
    }
  }

  let locaisTop = []
  if (locaisMaisLidosPorUsuario.value && locaisMaisLidosPorUsuario.value.length > 0) {
    const registro = locaisMaisLidosPorUsuario.value.find(u => u.nome === nome)
    if (registro && registro.top) {
      locaisTop = registro.top
    }
  }

  const itensEstoqueZero = (analise.itensComEstoqueZeroDetalhes || []).filter(d => d.usuario === nome)
  const itensLidoNaoPertence = (analise.itensLidoNaoPertenceDetalhes || []).filter(d => d.usuario === nome)

  return {
    nome,
    lidos: base.lidos || 0,
    pendentes: base.pendentes || 0,
    comProblema: base.comProblema || 0,
    estoqueZeroQtd: itensEstoqueZero.length,
    estoqueZero: itensEstoqueZero.slice(0, 10),
    lidoNaoPertenceQtd: itensLidoNaoPertence.length,
    lidoNaoPertence: itensLidoNaoPertence.slice(0, 10),
    picoHora,
    picoQtd,
    locaisTop
  }
})

const abrirModalUsuario = (nome) => {
  usuarioSelecionado.value = nome
  modalUsuarioAberto.value = true
}

const fecharModalUsuario = () => {
  modalUsuarioAberto.value = false
  usuarioSelecionado.value = null
}

// =========== DADOS ===========
const mapaSeteores = computed(() => {
  if (!auditoria.value?.dados || !auditoria.value?.analise) return {}
  
  const analise = auditoria.value.analise
  if (!analise.porSetor) return {}
  const setores = {}

  Object.entries(analise.porSetor).forEach(([setor, dados]) => {
    const lidos = Number(dados?.lidos || 0)
    const pendentes = Number(dados?.pendentes || 0)
    const comProblema = Number(dados?.comProblema || 0)
    const total = lidos + pendentes + comProblema
    const percentualConclusao = total > 0 ? Math.round((lidos / total) * 100) : 0
    const percentualPendente = total > 0 ? parseFloat(((pendentes / total) * 100).toFixed(2)) : 0

    setores[setor] = {
      nome: setor,
      lidos,
      pendentes,
      comProblema,
      total,
      percentualConclusao,
      percentualPendente,
      percentualLido: percentualConclusao
    }
  })

  return setores
})

const itensComEstoqueZero = computed(() => {
  if (!auditoria.value?.analise) return []
  return auditoria.value.analise.itensComEstoqueZeroDetalhes || []
})

const itensLidoNaoPertence = computed(() => {
  if (!auditoria.value?.analise) return []
  return auditoria.value.analise.itensLidoNaoPertenceDetalhes || []
})

const itensLidoNaoPertenceFiltrados = computed(() => {
  let items = itensLidoNaoPertence.value || []
  if (filtroSetorLocalErrado.value !== 'todos') {
    items = items.filter(i => getSetorDetalhe(i) === filtroSetorLocalErrado.value)
  }
  if (filtroUsuarioLocalErrado.value !== 'todos') {
    items = items.filter(i => String(i.usuario || '').trim() === filtroUsuarioLocalErrado.value)
  }
  return items
})

const handlePrintPDFItens = async () => {
  if (!colunasModal.value.length) return
  const base = modalItensOrdenado.value
  if (!base || !base.length) return
  const partesNome = [
    auditoria.value?.tipo || 'Auditoria',
    tituloModalItens.value || 'Itens do Local'
  ].filter(Boolean)
  const titulo = partesNome.join(' - ')
  printTableInNewWindow(base, colunasModal.value, titulo)
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

const exportarElementoComoImagem = async (elemento, nomeArquivo, descricao = 'imagem') => {
  if (!elemento || typeof window === 'undefined') return

  try {
    const rect = elemento.getBoundingClientRect?.() || {}
    const largura = Math.max(Math.round(rect.width || elemento.scrollWidth || elemento.clientWidth || 1200), 1)
    const altura = Math.max(Math.round(rect.height || elemento.scrollHeight || elemento.clientHeight || 700), 1)

    const botoesOcultos = elemento.querySelectorAll('.export-button-hidden')
    botoesOcultos.forEach(botao => {
      botao.style.display = 'none'
    })

    const dataUrl = await toPng(elemento, {
      cacheBust: true,
      pixelRatio: 1,
      backgroundColor: '#ffffff',
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
    link.download = `${normalizarNomeArquivo(nomeArquivo)}.png`
    link.href = dataUrl
    document.body.appendChild(link)
    link.click()
    link.remove()
  } catch (error) {
    console.error(`Erro ao exportar ${descricao}:`, error)
    window.alert(`Não foi possível gerar a imagem de ${descricao}. Tente novamente.`)
  }
}

const exportarResultadoGeralSetor = async () => {
  const nome = `${auditoria.value?.tipo || 'auditoria'}-resultado-geral-setor-${dataAuditoriaBR.value || 'data'}`
  await exportarElementoComoImagem(resultadoGeralSetorExportRef.value, nome, 'Resultado Geral e Análise por Setor')
}

const exportarTopLocaisPendentes = async () => {
  const nome = `${auditoria.value?.tipo || 'auditoria'}-top-locais-pendentes-${dataAuditoriaBR.value || 'data'}`
  await exportarElementoComoImagem(topLocaisPendentesExportRef.value, nome, 'Top 10 Locais com Mais Pendentes')
}

const handlePrintRelatorio = () => {
  if (typeof window === 'undefined') return
  if (!dadosRelatorio.value || !auditoria.value) return
  const win = window.open('', '_blank')
  if (!win) return
  const doc = win.document
  const titulo = `Relatorio_Auditoria_${auditoria.value.tipo || ''}_${dataAuditoriaBR.value || ''}`
  const safeTitle = titulo.replace(/\s+/g, '_')
  const escapeHtml = (v) => {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }
  const rg = dadosRelatorio.value.resultadoGeral || {}
  const setores = dadosRelatorio.value.setores || []
  const locais = dadosRelatorio.value.topLocaisPendentes || []
  const locaisSemLeitura = dadosRelatorio.value.locaisSemLeitura || []
  const setoresRows = setores.map(setor => {
    return `<tr>
      <td>${escapeHtml(setor.nome)}</td>
      <td style="text-align:right;">${escapeHtml(setor.pendentes)}</td>
      <td style="text-align:right;">${escapeHtml(setor.desatualizados || 0)}</td>
      <td style="text-align:right;">${escapeHtml(setor.percentualPendente != null ? setor.percentualPendente.toFixed(2) + '%' : '')}</td>
      <td>${escapeHtml(setor.classificacao)}</td>
    </tr>`
  }).join('')
  const locaisRows = locais.map((local, i) => {
    return `<tr>
      <td style="text-align:center;">${i + 1}</td>
      <td>${escapeHtml(local.nome)}</td>
      <td style="text-align:right;">${escapeHtml(local.pendentes)}</td>
      <td style="text-align:right;">${escapeHtml(local.total)}</td>
      <td style="text-align:right;">${escapeHtml(local.percentualPendente != null ? local.percentualPendente.toFixed(2) + '%' : '')}</td>
    </tr>`
  }).join('')
  const locaisSemLeituraChips = locaisSemLeitura.map(local => {
    return `<span style="display:inline-block;margin:2px 4px;padding:2px 6px;border-radius:9999px;background:#fee2e2;color:#b91c1c;font-size:11px;">${escapeHtml(local)}</span>`
  }).join('')
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(safeTitle)}</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 10mm;
          }
          body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            font-size: 11px;
            color: #111827;
            margin: 0;
            padding: 0;
          }
          h1 {
            font-size: 18px;
            margin: 0 0 12px 0;
          }
          h2 {
            font-size: 14px;
            margin: 16px 0 8px 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th, td {
            border: 1px solid #e5e7eb;
            padding: 4px 6px;
            text-align: left;
            vertical-align: middle;
          }
          th {
            background: #f3f4f6;
            font-weight: 600;
          }
          tr:nth-child(even) td {
            background: #f9fafb;
          }
          .section {
            margin-bottom: 14px;
          }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(`Relatório de Auditoria - ${auditoria.value.tipo || ''} - ${dataAuditoriaBR.value || ''}`)}</h1>
        <div class="section">
          <h2>Resultado Geral</h2>
          <table>
            <tbody>
              <tr><th>Total Auditável</th><td>${escapeHtml(rg.totalAuditaveis)}</td></tr>
              <tr><th>Total Lidos</th><td>${escapeHtml(rg.totalLidos)}</td></tr>
              <tr><th>Pendentes</th><td>${escapeHtml(rg.pendentes)}</td></tr>
              <tr><th>Desatualizados</th><td>${escapeHtml(rg.desatualizados || 0)}</td></tr>
              <tr><th>% Pendente</th><td>${escapeHtml(rg.percentualPendente != null ? rg.percentualPendente.toFixed(2) + '%' : '')}</td></tr>
              <tr><th>Meta</th><td>3%</td></tr>
            </tbody>
          </table>
        </div>
        <div class="section">
          <h2>Análise por Setor</h2>
          <table>
            <thead>
              <tr>
                <th>Setor</th>
                <th>Pendentes</th>
                <th>Desat.</th>
                <th>% Pend</th>
                <th>Classif.</th>
              </tr>
            </thead>
            <tbody>
              ${setoresRows}
            </tbody>
          </table>
        </div>
        <div class="section">
          <h2>Top 20 Locais com Mais Pendentes</h2>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Local</th>
                <th>Pend</th>
                <th>Total</th>
                <th>% Pend</th>
              </tr>
            </thead>
            <tbody>
              ${locaisRows}
            </tbody>
          </table>
        </div>
        <div class="section">
          <h2>Locais Sem Leitura</h2>
          <div>
            ${locaisSemLeituraChips || '<span>Nenhum local sem leitura.</span>'}
          </div>
        </div>
      </body>
    </html>
  `
  doc.open()
  doc.write(html)
  doc.close()
  win.document.title = safeTitle
  win.onafterprint = () => { win.close() }
  setTimeout(() => { win.focus(); win.print() }, 300)
}

// Funções auxiliares para processar dados da planilha
// (Versões simplificadas para uso nos componentes - os dados já vêm normalizados do store)

const isPlaceholder = (valor) => {
  if (!valor) return true
  if (typeof valor === 'string') {
    const limpo = valor.trim()
    return limpo.startsWith('###') || 
           limpo === '' || 
           limpo.toLowerCase() === 'undefined' || 
           limpo.toLowerCase() === 'null' ||
           limpo.toLowerCase() === 'não' ||
           limpo.toLowerCase() === 'nao'
  }
  return false
}

const getSetorItem = (item) => {
  const setor = item?.['Classe de Produto Raiz'] ?? item?.['Setor'] ?? 'Não especificado'
  return String(setor || 'Não especificado').trim()
}

const setoresUnicosDados = computed(() => {
  if (!auditoria.value?.dados) return []
  const set = new Set()
  auditoria.value.dados.forEach(item => {
    const s = getSetorItem(item)
    if (s) set.add(s)
  })
  return Array.from(set).sort()
})

const usuariosUnicosDados = computed(() => {
  const base = auditoria.value?.analise?.usuarios || []
  const set = new Set(base.map(u => String(u || '').trim()).filter(Boolean))
  return Array.from(set).sort()
})

const setorPorCodigo = computed(() => {
  const map = new Map()
  const dados = auditoria.value?.dados || []
  dados.forEach(item => {
    const codigo = item?.['Código']
    if (codigo == null) return
    map.set(String(codigo).trim(), getSetorItem(item))
  })
  return map
})

const getSetorDetalhe = (detalhe) => {
  const direto = detalhe?.setor
  if (direto != null && String(direto).trim() !== '') return String(direto).trim()
  const codigo = detalhe?.codigo
  if (codigo == null) return 'Não especificado'
  return setorPorCodigo.value.get(String(codigo).trim()) || 'Não especificado'
}

const extrairEstoque = (item) => {
  // Se já tem valor normalizado, usa ele
  if (item._estoque !== undefined) {
    return item._estoque
  }
  
  // Senão, tenta extrair manualmente (fallback)
  const colunasEstoque = ['Estoque atual', 'oque atual', 'Estoque Leitura']
  for (const coluna of colunasEstoque) {
    if (item[coluna] !== undefined && item[coluna] !== null) {
      const valor = item[coluna]
      if (typeof valor === 'number') {
        return valor > 0 ? valor : 0
      }
      if (typeof valor === 'string') {
        let limpo = valor.replace(/^###\s*/, '').trim()
        limpo = limpo.replace(/KG/gi, '').replace(/\s+/g, ' ')
        const match = limpo.match(/(\d+)[,.]?(\d*)/)
        if (match) {
          const parteInteira = match[1] || '0'
          const parteDecimal = match[2] || '0'
          const numero = parseFloat(parteInteira + '.' + parteDecimal)
          if (!isNaN(numero) && numero > 0) {
            return numero
          }
        }
      }
    }
  }
  return 0
}

const temPresencaConfirmada = (item) => {
  // Se já tem valor normalizado, usa ele
  if (item._temPresenca !== undefined) {
    return item._temPresenca
  }
  
  // Senão, tenta determinar manualmente (fallback)
  const situacao = item['Situação'] || item['Situação atual da auditoria'] || ''
  if (situacao) {
    const sitLower = situacao.toString().toLowerCase()
    if (sitLower.includes('com prese') || sitLower.includes('com presença')) {
      return true
    }
    if (sitLower.includes('sem prese') || sitLower.includes('sem presença')) {
      return false
    }
  }
  
  const presenca = item['Presença confirmada'] || item['Presença'] || ''
  if (presenca) {
    if (isPlaceholder(presenca)) {
      return false
    }
    if (typeof presenca === 'number') {
      return true
    }
    if (typeof presenca === 'string' && presenca.trim() !== '') {
      return !isPlaceholder(presenca)
    }
  }
  
  return false
}

const itensVendidosOjeSemLeitura = computed(() => {
  if (!auditoria.value?.dados) return 0
  return auditoria.value.dados.filter(item => {
    const temPresenca = item._temPresenca !== undefined ? item._temPresenca : temPresencaConfirmada(item)
    const vendidoHoje = item['Dias sem venda'] === '0' || item['Dias sem venda'] === 0 || item['Dias sem venda'] === '0'
    return vendidoHoje && !temPresenca
  }).length
})

const itensLidosEstoqueZero = computed(() => {
  if (!auditoria.value?.analise) return []
  return (auditoria.value.analise.itensComEstoqueZeroDetalhes || [])
})

const itensLidosEstoqueZeroFiltrados = computed(() => {
  let items = itensLidosEstoqueZero.value || []
  if (filtroSetorEstoqueZero.value !== 'todos') {
    items = items.filter(i => getSetorDetalhe(i) === filtroSetorEstoqueZero.value)
  }
  if (filtroUsuarioEstoqueZero.value !== 'todos') {
    items = items.filter(i => String(i.usuario || '').trim() === filtroUsuarioEstoqueZero.value)
  }
  return items
})

const itensGrandeEstoqueNaoLidos = computed(() => {
  if (!auditoria.value?.dados) return []
  return auditoria.value.dados.filter(item => {
    const temPresenca = item._temPresenca !== undefined ? item._temPresenca : temPresencaConfirmada(item)
    const estoque = item._estoque !== undefined ? item._estoque : extrairEstoque(item)
    const setorOk = filtroSetorGrandeEstoque.value === 'todos' ? true : getSetorItem(item) === filtroSetorGrandeEstoque.value
    return !temPresenca && estoque > 100 && setorOk
  })
    .sort((a, b) => {
      const estoqueA = a._estoque !== undefined ? a._estoque : extrairEstoque(a)
      const estoqueB = b._estoque !== undefined ? b._estoque : extrairEstoque(b)
      return estoqueB - estoqueA
    })
})

const itensGrandeEstoqueFormatados = computed(() => {
  return itensGrandeEstoqueNaoLidos.value.map(item => ({
    codigo: item['Código'],
    produto: item['Produto'],
    estoque: item._estoque !== undefined ? item._estoque : extrairEstoque(item)
  }))
})

// Helper genérico para ordenar/filtrar/paginar tabelas de dados
const sortDados = (lista, ordenacao) => {
  const col = ordenacao.coluna
  const dir = ordenacao.direcao
  return [...lista].sort((a, b) => {
    const va = a[col]; const vb = b[col]
    if (typeof va === 'number' && typeof vb === 'number') return dir === 'asc' ? va - vb : vb - va
    return dir === 'asc' ? String(va ?? '').localeCompare(String(vb ?? '')) : String(vb ?? '').localeCompare(String(va ?? ''))
  })
}

const filtrarBuscaDados = (lista, termo) => {
  if (!termo) return lista
  const t = termo.toLowerCase()
  return lista.filter(item => Object.values(item).some(v => String(v).toLowerCase().includes(t)))
}

const atualizarOrdenacaoDados = (obj, coluna) => {
  if (obj.coluna === coluna) {
    obj.direcao = obj.direcao === 'asc' ? 'desc' : 'asc'
  } else {
    obj.coluna = coluna
    obj.direcao = 'asc'
  }
}

const paginasVisiveisFn = (total, atual) => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = [1]
  if (atual > 3) pages.push('...')
  for (let i = Math.max(2, atual - 1); i <= Math.min(total - 1, atual + 1); i++) pages.push(i)
  if (atual < total - 2) pages.push('...')
  pages.push(total)
  return pages
}

// Fornecedor tab table computeds
const fornecedorTabBusca = computed(() => filtrarBuscaDados(itensFornecedorFormatados.value, buscaFornecedorTab.value))
const fornecedorTabOrdenado = computed(() => sortDados(fornecedorTabBusca.value, ordenacaoFornecedorTab.value))
const totalPaginasFornecedorTab = computed(() => Math.max(1, Math.ceil(fornecedorTabOrdenado.value.length / itensPorPaginaFornecedorTab)))
const fornecedorTabPaginado = computed(() => {
  const p = Math.min(paginaFornecedorTab.value, totalPaginasFornecedorTab.value)
  const i = (p - 1) * itensPorPaginaFornecedorTab
  return fornecedorTabOrdenado.value.slice(i, i + itensPorPaginaFornecedorTab)
})

// Modal Itens table computeds
const modalItensBusca = computed(() => filtrarBuscaDados(itensModalFormatados.value, buscaModalItens.value))
const modalItensOrdenado = computed(() => sortDados(modalItensBusca.value, ordenacaoModalItens.value))
const totalPaginasModalItens = computed(() => Math.max(1, Math.ceil(modalItensOrdenado.value.length / itensPorPaginaModalItens)))
const modalItensPaginado = computed(() => {
  const p = Math.min(paginaModalItens.value, totalPaginasModalItens.value)
  const i = (p - 1) * itensPorPaginaModalItens
  return modalItensOrdenado.value.slice(i, i + itensPorPaginaModalItens)
})

// Estoque Zero: filtrado + ordenado + paginado
const estoqueZeroFiltradoOrdenado = computed(() => {
  let lista = itensLidosEstoqueZeroFiltrados.value.map(i => ({
    codigo: i.codigo || i['Código'] || '',
    produto: i.produto || i['Produto'] || '',
    local: i.local || i['Local'] || '',
    usuario: i.usuario || ''
  }))
  lista = filtrarBuscaDados(lista, buscaDadosEstoqueZero.value)
  return sortDados(lista, ordenacaoDadosEstoqueZero.value)
})
const totalPaginasEstoqueZero = computed(() => Math.ceil(estoqueZeroFiltradoOrdenado.value.length / itensPorPaginaDados))
const estoqueZeroPaginado = computed(() => {
  const inicio = (paginaDadosEstoqueZero.value - 1) * itensPorPaginaDados
  return estoqueZeroFiltradoOrdenado.value.slice(inicio, inicio + itensPorPaginaDados)
})

// Local Errado: filtrado + ordenado + paginado
const localErradoFiltradoOrdenado = computed(() => {
  let lista = itensLidoNaoPertenceFiltrados.value.map(i => ({
    codigo: i.codigo || i['Código'] || '',
    produto: i.produto || i['Produto'] || '',
    local: i.local || i['Local'] || '',
    usuario: i.usuario || ''
  }))
  lista = filtrarBuscaDados(lista, buscaDadosLocalErrado.value)
  return sortDados(lista, ordenacaoDadosLocalErrado.value)
})
const totalPaginasLocalErrado = computed(() => Math.ceil(localErradoFiltradoOrdenado.value.length / itensPorPaginaDados))
const localErradoPaginado = computed(() => {
  const inicio = (paginaDadosLocalErrado.value - 1) * itensPorPaginaDados
  return localErradoFiltradoOrdenado.value.slice(inicio, inicio + itensPorPaginaDados)
})

// Grande Estoque: filtrado + ordenado + paginado
const grandeEstoqueFiltradoOrdenado = computed(() => {
  let lista = [...itensGrandeEstoqueFormatados.value]
  lista = filtrarBuscaDados(lista, buscaDadosGrandeEstoque.value)
  return sortDados(lista, ordenacaoDadosGrandeEstoque.value)
})
const totalPaginasGrandeEstoque = computed(() => Math.ceil(grandeEstoqueFiltradoOrdenado.value.length / itensPorPaginaDados))
const grandeEstoquePaginado = computed(() => {
  const inicio = (paginaDadosGrandeEstoque.value - 1) * itensPorPaginaDados
  return grandeEstoqueFiltradoOrdenado.value.slice(inicio, inicio + itensPorPaginaDados)
})

// Ruptura: filtrado + ordenado + paginado (will link after itensRupturaFormatados is defined)
const rupturaFiltradoOrdenado = computed(() => {
  let lista = [...(itensRupturaFormatados.value || [])]
  lista = filtrarBuscaDados(lista, buscaDadosRuptura.value)
  return sortDados(lista, ordenacaoDadosRuptura.value)
})
const totalPaginasRuptura = computed(() => Math.ceil(rupturaFiltradoOrdenado.value.length / itensPorPaginaDados))
const rupturaPaginado = computed(() => {
  const inicio = (paginaDadosRuptura.value - 1) * itensPorPaginaDados
  return rupturaFiltradoOrdenado.value.slice(inicio, inicio + itensPorPaginaDados)
})

const isSemPresencaSemEstoque = (item) => {
  const sit = item['Situação'] || item['Situação atual da auditoria'] || ''
  const s = String(sit).toLowerCase()
  if (s.includes('sem prese') && s.includes('sem esto')) return true
  const tem = item._temPresenca !== undefined ? item._temPresenca : temPresencaConfirmada(item)
  const est = item._estoque !== undefined ? item._estoque : extrairEstoque(item)
  return !tem && (Number(est) || 0) === 0
}

const getStatusItem = (item) => {
  const tem = item._temPresenca !== undefined ? item._temPresenca : temPresencaConfirmada(item)
  if (tem) {
    return { texto: '✓ Lido', classe: 'text-xs bg-green-100 text-green-800 px-2 py-1 rounded' }
  }
  if (isSemPresencaSemEstoque(item)) {
    return { texto: 'Sem estoque', classe: 'text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded' }
  }
  return { texto: '⏳ Pendente', classe: 'text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded' }
}

const itensRupturaMenorCusto = computed(() => {
  if (!auditoria.value?.dados) return []
  return auditoria.value.dados.filter(item => {
    const custo = parseFloat(item['Custo Ruptura']) || 0
    return custo > 0 && custo <= 50
  })
    .sort((a, b) => parseFloat(a['Custo Ruptura']) - parseFloat(b['Custo Ruptura']))
})

const fornecedoresUnicos = computed(() => {
  if (!auditoria.value?.dados) return []
  const fornecedores = new Set()
  auditoria.value.dados.forEach(item => {
    if (item['Fornecedor']) fornecedores.add(item['Fornecedor'])
  })
  return Array.from(fornecedores).sort()
})

const itensPorFornecedor = computed(() => {
  if (!auditoria.value?.dados || !filtroFornecedor.value) return []
  return auditoria.value.dados.filter(item => {
    // Filtro de Fornecedor
    if (item['Fornecedor'] !== filtroFornecedor.value) return false

    if (filtroSetorFornecedor.value !== 'todos' && getSetorItem(item) !== filtroSetorFornecedor.value) return false
    
    // Filtro de Status
    if (filtroStatusFornecedor.value !== 'todos') {
      const tem = item._temPresenca !== undefined ? item._temPresenca : temPresencaConfirmada(item)
      if (filtroStatusFornecedor.value === 'lido' && !tem) return false
      if (filtroStatusFornecedor.value === 'pendente' && tem) return false
    }
    
    return true
  })
})

// =========== ESTATÍSTICAS ===========
const setoresComAnalise = computed(() => {
  if (!auditoria.value?.analise || !auditoria.value.analise.porSetor) return []
  const analise = auditoria.value.analise

  return Object.entries(analise.porSetor)
    .map(([setor, dados]) => {
      const lidos = dados.lidos || 0
      const pendentes = dados.pendentes || 0
      const comProblema = dados.comProblema || 0
      let desatualizados = dados.desatualizados || 0
      if (desatualizados === 0 && Array.isArray(auditoria.value?.dados)) {
        const soma = (auditoria.value.dados || []).reduce((acc, item) => {
          const s = normalizar(item['Situação'] || item['Situação atual da auditoria'] || item._situacao || '')
          const set = String(item['Classe de Produto Raiz'] || 'Não especificado').trim()
          return acc + ((set === setor && s.includes('desatualizad')) ? 1 : 0)
        }, 0)
        if (soma > 0) desatualizados = soma
      }
      const totalLidos = lidos + comProblema // Total lidos (corretos + problemas)
      const total = lidos + pendentes + comProblema
      const percentualPendente = total > 0 ? parseFloat(((pendentes / total) * 100).toFixed(2)) : 0
      const percentualConclusao = total > 0 ? parseFloat(((totalLidos / total) * 100).toFixed(2)) : 0
      
      // Classificação baseada na meta de 3% pendente
      let classificacao = 'Excelente'
      let classificacaoClass = 'text-green-600'
      if (percentualPendente <= 3.0) {
        classificacao = 'Excelente'
        classificacaoClass = 'text-green-600'
      } else if (percentualPendente <= 5.0) {
        classificacao = 'Bom'
        classificacaoClass = 'text-yellow-600'
      } else if (percentualPendente <= 10.0) {
        classificacao = 'Regular'
        classificacaoClass = 'text-orange-600'
      } else {
        classificacao = 'Crítico'
        classificacaoClass = 'text-red-600'
      }
      
      return {
        nome: setor,
        lidos: lidos,
        pendentes: pendentes,
        comProblema: comProblema,
        desatualizados: desatualizados,
        totalLidos: totalLidos,
        total: total,
        percentualPendente: percentualPendente,
        percentualConclusao: percentualConclusao,
        classificacao: classificacao,
        classificacaoClass: classificacaoClass
      }
    })
    .filter(setor => setor.total > 0) // Filtrar apenas setores com itens
    .sort((a, b) => b.percentualPendente - a.percentualPendente) // Ordenar por maior % pendente
})

const locaisComAnalise = computed(() => {
  if (!auditoria.value?.analise || !auditoria.value.analise.porLocal) return []
  const analise = auditoria.value.analise
  const dadosCompletos = auditoria.value.dados || []

  const locais = Object.entries(analise.porLocal)
    .map(([local, dados]) => {
      const lidos = dados.lidos || 0
      const pendentes = dados.pendentes || 0
      const nomeLocal = (local || 'Não especificado').toString().trim()
      const comProblema = dados.comProblema || 0
      const totalLidos = lidos + comProblema
      const total = lidos + pendentes + comProblema

      // Contar desatualizados por local
      let desatualizados = 0
      if (Array.isArray(dadosCompletos)) {
        desatualizados = dadosCompletos.reduce((acc, item) => {
          const s = normalizar(item['Situação'] || item['Situação atual da auditoria'] || item._situacao || '')
          const itemLocal = (item['Local'] || 'Não especificado').toString().trim()
          return acc + ((itemLocal === nomeLocal && s.includes('desatualizad')) ? 1 : 0)
        }, 0)
      }

      const itensDoLocal = dadosCompletos.filter(item => {
        const itemLocal = (item['Local'] || 'Não especificado').toString().trim()
        return itemLocal === nomeLocal
      })
      return {
        nome: nomeLocal,
        lidos: lidos,
        pendentes: pendentes,
        comProblema: comProblema,
        desatualizados: desatualizados,
        totalLidos: totalLidos,
        total: total,
        percentualPendente: total > 0 ? parseFloat(((pendentes / total) * 100).toFixed(2)) : 0,
        percentualLido: total > 0 ? parseFloat(((totalLidos / total) * 100).toFixed(2)) : 0,
        itens: itensDoLocal
      }
    })
    .filter(local => local.total > 0)
    .sort((a, b) => b.pendentes - a.pendentes)

  return locais
})

// Setores: filtrado + ordenado + paginado
const setoresFiltradoOrdenado = computed(() => {
  let lista = [...setoresComAnalise.value]
  if (buscaSetores.value) {
    const t = buscaSetores.value.toLowerCase()
    lista = lista.filter(s => s.nome.toLowerCase().includes(t) || s.classificacao.toLowerCase().includes(t))
  }
  return sortDados(lista, ordenacaoSetores.value)
})
const totalPaginasSetores = computed(() => Math.ceil(setoresFiltradoOrdenado.value.length / itensPorPaginaSetores))
const setoresPaginados = computed(() => {
  const inicio = (paginaSetores.value - 1) * itensPorPaginaSetores
  return setoresFiltradoOrdenado.value.slice(inicio, inicio + itensPorPaginaSetores)
})

// Locais: filtrado + ordenado + paginado
const locaisFiltradoOrdenado = computed(() => {
  let lista = [...locaisComAnalise.value]
  if (buscaLocais.value) {
    const t = buscaLocais.value.toLowerCase()
    lista = lista.filter(l => l.nome.toLowerCase().includes(t))
  }
  return sortDados(lista, ordenacaoLocais.value)
})
const totalPaginasLocais = computed(() => Math.ceil(locaisFiltradoOrdenado.value.length / itensPorPaginaLocais))
const locaisPaginados = computed(() => {
  const inicio = (paginaLocais.value - 1) * itensPorPaginaLocais
  return locaisFiltradoOrdenado.value.slice(inicio, inicio + itensPorPaginaLocais)
})

// Dados para o relatório
const dadosRelatorio = computed(() => {
  if (!auditoria.value?.analise) return null
  
  const metricas = metricasGerais.value
  if (!metricas) return null
  const totalAuditaveis = metricas.totalItens
  const totalLidos = metricas.totalLidos
  const percentualConclusao = metricas.percentualConclusao
  const percentualPendente = metricas.percentualPendente
  const pendentesExibidos = metricas.pendentes
  
  // Top 20 locais com mais itens pendentes
  const topLocaisPendentes = locaisComAnalise.value
    .sort((a, b) => b.pendentes - a.pendentes)
    .slice(0, 20)
  
  // Locais sem leitura
  const locaisSemLeitura = auditoria.value.analise.locaisSemLeitura || []
  
  // Quantidade que falta para meta
  const faltaParaMeta = Math.max(0, percentualPendente - 3.0)
  const itensFaltam = Math.ceil((faltaParaMeta / 100) * totalAuditaveis)
  
  return {
    setores: setoresComAnalise.value,
    topLocaisPendentes: topLocaisPendentes,
    locaisSemLeitura: locaisSemLeitura,
    resultadoGeral: {
      totalAuditaveis: totalAuditaveis,
      totalLidos: totalLidos,
      pendentes: pendentesExibidos,
      desatualizados: metricas.desatualizados,
      percentualConclusao: percentualConclusao,
      percentualPendente: percentualPendente,
      metaConclusao: 97.0,
      metaPendente: 3.0,
      faltaParaMeta: faltaParaMeta,
      itensFaltam: itensFaltam
    }
  }
})

const voltar = () => {
  router.push('/auditorias')
}

const abrirModalMetrica = (tipo) => {
  metricaSelecionada.value = tipo
  modalMetricaAberto.value = true
}

const fecharModalMetrica = () => {
  modalMetricaAberto.value = false
  metricaSelecionada.value = null
}

const normalizeSetor = (valor) => {
  if (valor == null) return ''
  try {
    return String(valor).trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
  } catch {
    return String(valor).trim().toLowerCase()
  }
}

const abrirModalSetorLocal = (tipo, items) => {
  tipoModalSetorLocal.value = tipo
  itemsModalSetorLocal.value = items
  modalSetorLocalAberto.value = true
}

const fecharModalSetorLocal = () => {
  modalSetorLocalAberto.value = false
  tipoModalSetorLocal.value = null
  itemsModalSetorLocal.value = []
}

const abrirLocaisDoSetor = ({ setor, locais }) => {
  const dados = auditoria.value?.dados || []
  const alvo = normalizeSetor(setor)
  const agregados = {}
  
  dados.forEach(item => {
    const sRaw = item['Classe de Produto Raiz'] || item['Setor'] || 'Não especificado'
    if (normalizeSetor(sRaw) !== alvo) return
    const localNome = (item['Local'] || 'Não especificado').toString().trim()
    if (!agregados[localNome]) {
      agregados[localNome] = { nome: localNome, lidos: 0, pendentes: 0, comProblema: 0, total: 0 }
    }
    const tem = !!(item._temPresenca)
    const est = Number(item._estoque || 0)
    if (tem && est > 0) agregados[localNome].lidos++
    else if (!tem && est > 0) agregados[localNome].pendentes++
    else if (tem && est === 0) agregados[localNome].comProblema++
    agregados[localNome].total++
  })
  
  const locaisCalc = Object.values(agregados).map(l => {
    const total = l.total || 0
    return {
      ...l,
      percentualPendente: total > 0 ? parseFloat(((l.pendentes / total) * 100).toFixed(2)) : 0,
      percentualLido: total > 0 ? parseFloat((((l.lidos + l.comProblema) / total) * 100).toFixed(2)) : 0
    }
  }).sort((a, b) => b.pendentes - a.pendentes)
  
  tipoModalSetorLocal.value = 'local'
  itemsModalSetorLocal.value = locaisCalc
  modalSetorLocalAberto.value = true
}

const abrirItensDoLocal = ({ local, itens }) => {
  fecharModalSetorLocal()
  tituloModalItens.value = `Itens do Local: ${local}`
  itensModal.value = itens
  modalItensAberto.value = true
}

const fecharModalItens = () => {
  modalItensAberto.value = false
  itensModal.value = []
  tituloModalItens.value = ''
  filtroItens.value = ''
  filtroStatusItens.value = 'todos'
  ordenacaoItens.value = { coluna: 'Código', direcao: 'asc' }
}

const itensModalFormatados = computed(() => {
  let filtrados = itensModal.value || []
  
  // Remover completamente itens "Sem estoque"
  filtrados = filtrados.filter(item => !isSemPresencaSemEstoque(item))
  
  // Filtrar por status (Lido/Pendente)
  if (filtroStatusItens.value !== 'todos') {
    filtrados = filtrados.filter(item => {
      const tem = item._temPresenca !== undefined ? item._temPresenca : temPresencaConfirmada(item)
      if (filtroStatusItens.value === 'lido') return !!tem
      if (filtroStatusItens.value === 'pendente') return !tem
      return true
    })
  }
  
  return filtrados.map(item => {
      const estoque = item._estoque !== undefined ? item._estoque : (extrairEstoque(item) || 0)
      const diasSemVenda = item['Dias sem venda'] || 0
      const statusObj = getStatusItem(item)
      const lido = (item._temPresenca !== undefined ? item._temPresenca : (item['Presença confirmada'] || false))

      return {
          ...item,
          'Estoque atual': estoque,
          'Dias sem venda': diasSemVenda,
          'status': statusObj.texto,
          'statusClass': statusObj.classe,
          'lido': lido
      }
  })
})

const itensRupturaFiltrados = computed(() => {
  return itensRupturaMenorCusto.value.filter(item => {
    const tem = item._temPresenca !== undefined ? item._temPresenca : temPresencaConfirmada(item)
    if (tem) return false
    if (filtroSetorRuptura.value !== 'todos' && getSetorItem(item) !== filtroSetorRuptura.value) return false
    return true
  })
})

const itensRupturaFormatados = computed(() => {
  return itensRupturaFiltrados.value.map(item => {
    return {
      codigo: item['Código'],
      produto: item['Produto'],
      estoque: item._estoque !== undefined ? item._estoque : (extrairEstoque(item) || 0),
      custo: parseFloat(item['Custo Ruptura']),
      fornecedor: item['Fornecedor']
    }
  })
})

const itensFornecedorFormatados = computed(() => {
  if (!itensPorFornecedor.value) return []
  return itensPorFornecedor.value.map(item => {
    const lido = item._temPresenca !== undefined ? item._temPresenca : (item['Presença confirmada'] || false)
    return {
        ...item,
        produto: item['Produto'],
        codigo: item['Código'],
        setor: item['Setor'] || item['Classe de Produto Raiz'],
        estoque: item._estoque !== undefined ? item._estoque : (extrairEstoque(item) || '0'),
        lido: lido,
        statusTexto: lido ? '✓ Lido' : '⏳ Pendente',
        statusClass: lido ? 'text-xs bg-green-100 text-green-800 px-2 py-1 rounded' : 'text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded'
    }
  })
})

const handlePrintCard = (dados, colunas, tituloCard) => {
  if (!dados || dados.length === 0) return
  const titulo = `Relatório - ${tituloCard} - ${auditoria.value.tipo} - ${dataAuditoriaBR.value}`
  printTableInNewWindow(dados, colunas, titulo)
}

const colunasSetoresEstat = [
  { chave: 'nome', titulo: 'Setor', sortable: true },
  { chave: 'total', titulo: 'Total', sortable: true, alinhamento: 'right' },
  { chave: 'lidos', titulo: 'Lidos', sortable: true, alinhamento: 'right' },
  { chave: 'pendentes', titulo: 'Pendentes', sortable: true, alinhamento: 'right' },
  { chave: 'comProblema', titulo: 'Problemas', sortable: true, alinhamento: 'right' },
  { chave: 'desatualizados', titulo: 'Desatualizados', sortable: true, alinhamento: 'right' },
  { chave: 'percentualConclusao', titulo: '% Conclusão', sortable: true, alinhamento: 'right', format: (v) => v.toFixed(2) + '%' },
  { chave: 'classificacao', titulo: 'Classificação', sortable: true, alinhamento: 'center' }
]

const handlePrintSetores = () => {
  handlePrintCard(setoresFiltradoOrdenado.value, colunasSetoresEstat, 'Parcial por Setor')
}

const colunasLocaisEstat = [
  { chave: 'nome', titulo: 'Local', sortable: true },
  { chave: 'lidos', titulo: 'Lidos', sortable: true, alinhamento: 'right' },
  { chave: 'pendentes', titulo: 'Pendentes', sortable: true, alinhamento: 'right' },
  { chave: 'comProblema', titulo: 'Problemas', sortable: true, alinhamento: 'right' },
  { chave: 'desatualizados', titulo: 'Desatualizados', sortable: true, alinhamento: 'right' },
  { chave: 'total', titulo: 'Total', sortable: true, alinhamento: 'right' },
  { chave: 'percentualLido', titulo: '% Lido', sortable: true, alinhamento: 'right', format: (v) => v.toFixed(2) + '%' }
]

const handlePrintLocais = () => {
  handlePrintCard(locaisFiltradoOrdenado.value, colunasLocaisEstat, 'Locais')
}

const handlePrintUsuarios = () => {
  const dadosBase = usuariosFiltrados.value
  if (!dadosBase || dadosBase.length === 0) return

  const escapeHtml = (v) => {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  const colunasPrint = colunasUsuario.filter(c => c.chave !== 'acoes' && c.chave !== 'statusBadge')

  const headers = colunasPrint
    .map(c => `<th style="text-align:${c.alinhamento || 'left'};">${escapeHtml(c.titulo)}</th>`)
    .join('')

  const rows = dadosBase.map(u => {
    const cells = colunasPrint.map(c => {
      let val = u[c.chave]
      if (c.format && val != null) val = c.format(val)
      return `<td style="text-align:${c.alinhamento || 'left'};">${escapeHtml(val)}</td>`
    }).join('')
    return `<tr>${cells}</tr>`
  }).join('')

  const cores = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#ec4899', '#06b6d4', '#f97316']

  const setores = setoresComUsuarios.value
  let setoresHtml = ''
  if (setores.length > 0) {
    const setorCards = setores.map(setorData => {
      const barSegments = setorData.usuarios.map((u, idx) => {
        const cor = cores[idx % cores.length]
        return `<div style="width:${u.percentual}%;background:${cor};height:100%;display:inline-block;" title="${escapeHtml(u.usuario)}: ${u.percentual}%"></div>`
      }).join('')

      const legendItems = setorData.usuarios.map((u, idx) => {
        const cor = cores[idx % cores.length]
        return `<div style="display:flex;align-items:center;gap:6px;justify-content:space-between;font-size:11px;margin-bottom:3px;">
          <div style="display:flex;align-items:center;gap:5px;min-width:0;">
            <div style="width:10px;height:10px;border-radius:50%;background:${cor};flex-shrink:0;"></div>
            <span style="font-weight:600;color:#374151;">${escapeHtml(u.usuario)}</span>
          </div>
          <span style="color:#6b7280;flex-shrink:0;">${u.percentual}% (${u.lidos})</span>
        </div>`
      }).join('')

      return `<div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;background:#fff;break-inside:avoid;">
        <div style="font-weight:700;font-size:13px;color:#1f2937;margin-bottom:2px;">${escapeHtml(setorData.setor)}</div>
        <div style="font-size:11px;color:#6b7280;margin-bottom:8px;">Total: ${setorData.totalLidos} itens lidos</div>
        <div style="height:20px;border-radius:6px;overflow:hidden;border:1px solid #e5e7eb;margin-bottom:10px;font-size:0;line-height:0;white-space:nowrap;">${barSegments}</div>
        ${legendItems}
      </div>`
    }).join('')

    setoresHtml = `
      <div class="section">
        <h2>Contribuição por Setor</h2>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          ${setorCards}
        </div>
      </div>`
  }

  const titulo = `Relatório de Usuários - ${auditoria.value.tipo} - ${dataAuditoriaBR.value}`

  const bodyHtml = `
    <h1>${escapeHtml(titulo)}</h1>
    <div class="section">
      <h2>Usuários</h2>
      <table>
        <thead><tr>${headers}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${setoresHtml}
  `

  printHtmlInNewWindow(titulo, bodyHtml)
}

const abrirRelatorio = () => {
  modalRelatorioAberto.value = true
}

const fecharRelatorio = () => {
  modalRelatorioAberto.value = false
}
</script>

<template>
  <div v-if="auditoria" class="min-h-screen bg-slate-50">
    <!-- Header -->
    <div class="bg-blue-700 text-white p-6 shadow-lg">
      <div class="max-w-7xl mx-auto flex items-center justify-between">
        <div>
          <button 
            @click="voltar" 
            class="mb-3 px-3 py-1.5 flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition text-white text-sm font-medium backdrop-blur-sm"
          >
            <i class="fas fa-arrow-left"></i> 
            <span>Voltar</span>
          </button>
          <h1 class="text-4xl font-bold">{{ auditoria.tipo }}</h1>
          <p class="text-blue-100 mt-2 flex items-center flex-wrap gap-2">
            <span><i class="fas fa-calendar mr-2"></i>{{ dataAuditoriaBR }}</span>
            <span>|</span>
            <span class="flex items-center gap-1">
              <i class="fas fa-boxes mr-1"></i>SKU:
              <template v-if="editandoSku">
                <input
                  v-model="skuEditavel"
                  type="number"
                  min="1"
                  class="w-24 px-2 py-0.5 rounded text-gray-800 text-sm font-bold"
                  @keyup.enter="salvarSku"
                  @keyup.escape="cancelarEdicaoSku"
                />
                <button @click="salvarSku" class="text-green-300 hover:text-white ml-1" title="Salvar"><i class="fas fa-check"></i></button>
                <button @click="cancelarEdicaoSku" class="text-red-300 hover:text-white ml-1" title="Cancelar"><i class="fas fa-times"></i></button>
              </template>
              <template v-else>
                <span class="font-bold">{{ auditoria.sku }}</span>
                <button v-if="!readOnly" @click="iniciarEdicaoSku" class="text-blue-200 hover:text-white ml-1" title="Editar SKU"><i class="fas fa-pencil-alt text-xs"></i></button>
              </template>
            </span>
          </p>
          <div v-if="statusBadge?.fechada" class="mt-3 inline-flex items-center gap-2">
            <span
              :class="[
                'px-3 py-1 rounded-full text-xs font-semibold',
                statusBadge?.dentroMeta ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              ]"
            >
              {{ statusBadge?.dentroMeta ? 'Fechada • Dentro da Meta' : 'Fechada • Fora da Meta' }}
            </span>
          </div>
        </div>
        <div class="text-right flex flex-col items-end gap-3">
          <div class="flex items-center gap-3">
            <button
              @click="abrirRelatorio"
              class="px-4 py-2 bg-white text-blue-600 hover:bg-blue-50 rounded-lg transition font-medium shadow-lg"
            >
              <i class="fas fa-file-alt mr-2"></i>Relatório
            </button>
            <button
              v-if="!readOnly"
              @click="skuSubstituir = String(auditoria?.sku || ''); mostrarUploadSubstituir = true"
              class="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition font-medium"
            >
              <i class="fas fa-upload mr-2"></i>Atualizar dados
            </button>
          </div>
          <div>
            <div class="text-5xl font-bold">{{ (metricasGerais?.percentualPendente ?? auditoria.analise?.parcialPercentual ?? 0).toFixed(2) }}%</div>
            <p class="text-blue-100">Pendente</p>
            <div class="mt-2">
              <span
                :class="[
                  'px-3 py-1 rounded-full text-xs font-semibold',
                  (metricasGerais?.percentualPendente ?? auditoria.analise?.parcialPercentual ?? 0) <= 3.0
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                ]"
              >
                {{
                  (metricasGerais?.percentualPendente ?? auditoria.analise?.parcialPercentual ?? 0) <= 3.0
                    ? 'Dentro da Meta'
                    : 'Fora da Meta'
                }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="ehBackupRegional" class="mx-auto mt-4 max-w-7xl px-4 md:px-6">
      <div class="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900 ring-1 ring-blue-100">
        <i class="fas fa-building mr-2 text-blue-600"></i>
        Dados migrados do backup regional {{ auditoria.analise?.regional?.regiao || '' }}. Os registros desta auditoria representam lojas consolidadas.
      </div>
    </div>

    <div class="mx-auto mt-4 max-w-7xl px-4 md:px-6">
      <UiTabs v-model="abaAtiva" :items="abasDetalhes" sticky />
    </div>

    <!-- Conteúdo -->
    <div class="max-w-7xl mx-auto p-6">
      <!-- DASHBOARD -->
      <div v-if="abaAtiva === 'dashboard'" class="space-y-8">
        <div v-if="(!auditoria.dados || auditoria.dados.length === 0) && !readOnly" class="bg-blue-50 border-2 border-blue-300 rounded-lg p-12">
          <div class="text-center">
            <i class="fas fa-cloud-upload-alt text-6xl text-blue-500 mb-6"></i>
            <h3 class="text-2xl font-bold text-gray-800 mb-3">Nenhum dado carregado</h3>
            <p class="text-gray-600 mb-8 text-lg">Faça upload de um arquivo Excel para começar a análise</p>
            <UploadAnaliseAuditoria 
              :auditoria="auditoria"
              @analiseCompleta="handleUploadCompleto"
            />
          </div>
        </div>

        <!-- Métricas Gerais -->
        <template v-else>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              @click="abrirModalMetrica('total')"
              class="bg-white/80 backdrop-blur rounded-2xl p-5 shadow-sm cursor-pointer hover:shadow-md transition flex flex-col gap-2"
            >
              <div class="flex items-center justify-between">
                <p class="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Total Auditável</p>
                <span class="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-blue-50 text-blue-600">
                  <i class="fas fa-clipboard-list text-sm"></i>
                </span>
              </div>
              <p class="text-3xl font-bold text-blue-700">{{ metricasGerais?.totalItens }}</p>
              <p class="text-[11px] text-slate-400">Itens para auditar</p>
            </div>
            <div
              @click="abrirModalMetrica('lidos')"
              class="bg-white/80 backdrop-blur rounded-2xl p-5 shadow-sm cursor-pointer hover:shadow-md transition flex flex-col gap-2"
            >
              <div class="flex items-center justify-between">
                <p class="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Total Lidos</p>
                <span class="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600">
                  <i class="fas fa-check-circle text-sm"></i>
                </span>
              </div>
              <p class="text-3xl font-bold text-emerald-700">{{ metricasGerais?.totalLidos }}</p>
              <p class="text-[11px] text-slate-400">{{ metricasGerais?.percentualConclusao?.toFixed(2) }}% concluído  |  Meta: {{ metricasGerais?.metaConclusao }}%</p>
            </div>
            <div
              @click="abrirModalMetrica('pendentes')"
              class="bg-white/80 backdrop-blur rounded-2xl p-5 shadow-sm cursor-pointer hover:shadow-md transition flex flex-col gap-2"
            >
              <div class="flex items-center justify-between">
                <p class="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Pendentes</p>
                <span class="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-amber-50 text-amber-600">
                  <i class="fas fa-hourglass-half text-sm"></i>
                </span>
              </div>
              <p class="text-3xl font-bold text-amber-700">{{ metricasGerais?.pendentes }}</p>
              <p class="text-[11px]" :class="metricasGerais?.percentualPendente <= 3 ? 'text-emerald-500' : 'text-red-500'">
                {{ metricasGerais?.percentualPendente?.toFixed(2) }}% pendente  |  Meta: {{ metricasGerais?.metaPendente }}%
                <span v-if="metricasGerais?.faltaParaMeta > 0"> (+{{ metricasGerais?.faltaParaMeta.toFixed(2) }}%)</span>
              </p>
            </div>
            <div
              @click="abrirModalMetrica('problema')"
              class="bg-white/80 backdrop-blur rounded-2xl p-5 shadow-sm cursor-pointer hover:shadow-md transition flex flex-col gap-2"
            >
              <div class="flex items-center justify-between">
                <p class="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Com Problema</p>
                <span class="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-red-50 text-red-600">
                  <i class="fas fa-exclamation-triangle text-sm"></i>
                </span>
              </div>
              <p class="text-3xl font-bold text-red-700">{{ metricasGerais?.comProblema }}</p>
              <p class="text-[11px] text-slate-400">Requer atenção</p>
            </div>
          </div>

          <div v-if="auditoria?.tipo === 'Etiqueta'" class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div class="bg-white/80 backdrop-blur rounded-2xl p-5 shadow-sm flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <p class="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Atualizado</p>
                <span class="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600">
                  <i class="fas fa-sync-alt text-sm"></i>
                </span>
              </div>
              <p class="text-3xl font-bold text-emerald-700">{{ metricasGerais?.atualizados || 0 }}</p>
              <p class="text-[11px] text-slate-400">Lidos e corretos</p>
            </div>
            <div
              @click="abrirModalMetrica('desatualizado')"
              class="bg-white/80 backdrop-blur rounded-2xl p-5 shadow-sm cursor-pointer hover:shadow-md transition flex flex-col gap-2"
            >
              <div class="flex items-center justify-between">
                <p class="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Desatualizado</p>
                <span class="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-yellow-50 text-yellow-600">
                  <i class="fas fa-history text-sm"></i>
                </span>
              </div>
              <p class="text-3xl font-bold text-yellow-600">{{ metricasGerais?.desatualizados || 0 }}</p>
              <p class="text-[11px] text-slate-400">Lidos mas desatualizados</p>
            </div>
          </div>

          <!-- Progress Geral -->
          <div class="bg-white/80 backdrop-blur rounded-2xl p-6 shadow-sm">
            <h3 class="font-bold text-lg text-gray-800 mb-4">Progresso Geral da Auditoria</h3>
            <div class="space-y-3">
              <div class="space-y-4">
                <!-- Conclusão -->
                <div>
                  <div class="flex justify-between text-sm mb-2">
                    <span class="text-gray-700 font-medium">Concluído (Lidos + Problemas)</span>
                    <span class="font-bold text-green-600">{{ metricasGerais?.percentualConclusao?.toFixed(2) }}%</span>
                  </div>
                  <div class="w-full h-6 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      :style="{ width: Math.min(metricasGerais?.percentualConclusao || 0, 100) + '%' }"
                      class="h-full bg-green-600 transition-all duration-500"
                    />
                  </div>
                  <p class="text-xs text-gray-600 mt-1">
                    {{ metricasGerais?.totalLidos }} de {{ metricasGerais?.totalItens }} itens lidos | Meta: {{ metricasGerais?.metaConclusao }}%
                  </p>
                </div>
                
                <!-- Pendente -->
                <div>
                  <div class="flex justify-between text-sm mb-2">
                    <span class="text-gray-700 font-medium">Pendente</span>
                    <span class="font-bold" :class="metricasGerais?.percentualPendente <= 3 ? 'text-green-600' : 'text-orange-600'">
                      {{ metricasGerais?.percentualPendente?.toFixed(2) }}%
                    </span>
                  </div>
                  <div class="w-full h-6 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      :style="{ width: Math.min(metricasGerais?.percentualPendente || 0, 100) + '%' }"
                      class="h-full bg-orange-600 transition-all duration-500"
                    />
                  </div>
                  <p class="text-xs mt-1" :class="metricasGerais?.percentualPendente <= 3 ? 'text-green-600' : 'text-orange-600'">
                    {{ metricasGerais?.pendentes }} itens pendentes | Meta: {{ metricasGerais?.metaPendente }}%
                    <span v-if="metricasGerais?.faltaParaMeta > 0" class="font-bold">
                      (Faltam {{ metricasGerais?.faltaParaMeta.toFixed(2) }}% para meta)
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Análises Inteligentes -->
          <div class="bg-white/80 backdrop-blur rounded-2xl p-6 shadow-sm space-y-6">
            <h3 class="font-bold text-lg text-gray-800 flex items-center gap-2">
              <span class="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-violet-50 text-violet-600">
                <i class="fas fa-brain text-sm"></i>
              </span>
              Análises Inteligentes
            </h3>

            <!-- Auditoria em Andamento -->
            <template v-if="!readOnly">
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="rounded-2xl bg-indigo-50/70 p-4 flex flex-col gap-2">
                  <div class="flex items-center justify-between">
                    <p class="text-[11px] font-semibold text-indigo-500 uppercase tracking-wide">Ritmo Atual</p>
                    <span class="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-indigo-100 text-indigo-600">
                      <i class="fas fa-tachometer-alt text-xs"></i>
                    </span>
                  </div>
                  <p class="text-3xl font-bold text-indigo-700">{{ projecoes?.ritmoHora?.toFixed(1) || 0 }} <span class="text-sm font-medium text-indigo-400">itens/h</span></p>
                  <p class="text-[11px] text-indigo-400">Desde {{ horarioInicio }} até agora</p>
                </div>
                <div class="rounded-2xl bg-blue-50/70 p-4 flex flex-col gap-2">
                  <div class="flex items-center justify-between">
                    <p class="text-[11px] font-semibold text-blue-500 uppercase tracking-wide">Horas Restantes</p>
                    <span class="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-blue-100 text-blue-600">
                      <i class="fas fa-clock text-xs"></i>
                    </span>
                  </div>
                  <p class="text-3xl font-bold text-blue-700">{{ projecoes ? formatHoras(projecoes.horasRestantes) : '00:00' }}</p>
                  <p class="text-[11px] text-blue-400">Fim programado: {{ horarioFim }}</p>
                </div>
                <div class="rounded-2xl bg-emerald-50/70 p-4 flex flex-col gap-2">
                  <div class="flex items-center justify-between">
                    <p class="text-[11px] font-semibold text-emerald-500 uppercase tracking-wide">Projeção</p>
                    <span class="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-emerald-100 text-emerald-600">
                      <i class="fas fa-chart-line text-xs"></i>
                    </span>
                  </div>
                  <p class="text-3xl font-bold text-emerald-700">+{{ projecoes?.projItens || 0 }} <span class="text-sm font-medium text-emerald-400">itens</span></p>
                  <p class="text-[11px] text-emerald-400">Percentual final: {{ projecoes?.projPercentualFinal?.toFixed(2) || 0 }}%</p>
                </div>
              </div>

              <!-- Mapa de Leituras por Horário (movido para fora do v-if) -->
            </template>

            <!-- Auditoria Fechada (Insights de Melhoria) -->
            <template v-else>
              <div v-if="improvementInsights && improvementInsights.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div
                  v-for="(insight, idx) in improvementInsights"
                  :key="idx"
                  class="rounded-2xl p-4 flex items-start gap-3"
                  :class="insight.tipo === 'sucesso' ? 'bg-emerald-50/70' : insight.tipo === 'critico' ? 'bg-red-50/70' : 'bg-amber-50/70'"
                >
                  <span
                    class="inline-flex items-center justify-center h-8 w-8 rounded-lg shrink-0"
                    :class="insight.tipo === 'sucesso' ? 'bg-emerald-100 text-emerald-600' : insight.tipo === 'critico' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'"
                  >
                    <i :class="insight.icon" class="text-sm"></i>
                  </span>
                  <div class="min-w-0">
                    <p class="text-[11px] font-semibold uppercase tracking-wide" :class="insight.tipo === 'sucesso' ? 'text-emerald-500' : insight.tipo === 'critico' ? 'text-red-500' : 'text-amber-500'">{{ insight.titulo }}</p>
                    <p class="text-xl font-bold mt-0.5" :class="insight.tipo === 'sucesso' ? 'text-emerald-700' : insight.tipo === 'critico' ? 'text-red-700' : 'text-amber-700'">
                      {{ insight.valor }}
                    </p>
                    <p class="text-[11px] mt-1 leading-relaxed" :class="insight.tipo === 'sucesso' ? 'text-emerald-400' : insight.tipo === 'critico' ? 'text-red-400' : 'text-amber-400'">
                      {{ insight.descricao }}
                    </p>
                  </div>
                </div>
              </div>
              <div v-else class="text-center text-gray-500 py-4">
                <p>Nenhum insight de melhoria disponível para esta auditoria.</p>
              </div>
            </template>

            <!-- Mapa de Leituras por Horário - Avançado -->
            <div class="mt-2">
              <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <h4 class="font-semibold text-gray-800">
                  <i class="fas fa-clock text-blue-600 mr-2"></i>Mapa de Leituras por Horário
                </h4>
                <div class="flex flex-wrap gap-2">
                  <select
                    v-model="filtroHorarioUsuario"
                    class="px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="todos">Todos os usuários</option>
                    <option v-for="u in (auditoria?.analise?.usuarios || [])" :key="u" :value="u">{{ u }}</option>
                  </select>
                  <select
                    v-model="filtroHorarioSetor"
                    class="px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="todos">Todos os setores</option>
                    <option v-for="s in Object.keys(auditoria?.analise?.porSetor || {})" :key="s" :value="s">{{ s }}</option>
                  </select>
                </div>
              </div>

              <div v-if="leituraPorHoraFiltrada && leituraPorHoraFiltrada.totalLeituras > 0">
                <!-- Cards Resumo -->
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                  <div class="rounded-2xl bg-blue-50/70 p-3 text-center">
                    <p class="text-[10px] font-semibold text-blue-500 uppercase tracking-wide">Total Leituras</p>
                    <p class="text-2xl font-bold text-blue-700 mt-1">{{ leituraPorHoraFiltrada.totalLeituras.toLocaleString() }}</p>
                  </div>
                  <div class="rounded-2xl bg-emerald-50/70 p-3 text-center">
                    <p class="text-[10px] font-semibold text-emerald-500 uppercase tracking-wide">Horário de Pico</p>
                    <p class="text-2xl font-bold text-emerald-700 mt-1">{{ leituraPorHoraFiltrada.pico?.hora || '--' }}</p>
                    <p class="text-[10px] text-emerald-500">{{ leituraPorHoraFiltrada.pico?.valor || 0 }} leituras</p>
                  </div>
                  <div class="rounded-2xl bg-indigo-50/70 p-3 text-center">
                    <p class="text-[10px] font-semibold text-indigo-500 uppercase tracking-wide">Média/Hora</p>
                    <p class="text-2xl font-bold text-indigo-700 mt-1">{{ leituraPorHoraFiltrada.media }}</p>
                  </div>
                  <div class="rounded-2xl bg-amber-50/70 p-3 text-center">
                    <p class="text-[10px] font-semibold text-amber-500 uppercase tracking-wide">Horário de Baixa</p>
                    <p class="text-2xl font-bold text-amber-700 mt-1">{{ leituraPorHoraFiltrada.baixa?.hora || '--' }}</p>
                    <p class="text-[10px] text-amber-500">{{ leituraPorHoraFiltrada.baixa?.valor || 0 }} leituras</p>
                  </div>
                </div>

                <!-- Barras Horizontais -->
                <div class="space-y-1.5">
                  <div v-for="(p, idx) in leituraPorHoraFiltrada.serie" :key="p.hora" class="flex items-center gap-2">
                    <div class="w-12 text-[11px] font-medium text-gray-600 text-right">{{ p.hora }}</div>
                    <div class="flex-1 h-5 bg-gray-100 rounded-md overflow-hidden relative">
                      <div
                        class="h-5 rounded-md transition-all duration-300"
                        :class="[
                          p.valor === leituraPorHoraFiltrada.max ? 'bg-green-500' :
                          p.valor === leituraPorHoraFiltrada.baixa?.valor && p.valor > 0 ? 'bg-orange-400' :
                          'bg-blue-500'
                        ]"
                        :style="{ width: leituraPorHoraFiltrada.max > 0 ? ((p.valor / leituraPorHoraFiltrada.max) * 100) + '%' : '0%' }"
                      />
                      <span v-if="p.valor > 0" class="absolute inset-y-0 left-2 flex items-center text-[10px] font-bold text-white drop-shadow">
                        {{ p.valor }}
                      </span>
                    </div>
                    <div class="w-14 text-right">
                      <span
                        v-if="idx > 0 && p.variacao !== 0 && p.valor > 0"
                        class="text-[10px] font-semibold px-1 py-0.5 rounded"
                        :class="p.variacao > 0 ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100'"
                      >
                        {{ p.variacao > 0 ? '+' : '' }}{{ p.variacao }}%
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Insights de Variação -->
                <div v-if="leituraPorHoraFiltrada.maiorSubida || leituraPorHoraFiltrada.maiorQueda" class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div v-if="leituraPorHoraFiltrada.maiorSubida" class="flex items-center gap-3 rounded-2xl bg-emerald-50/70 p-3">
                    <span class="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-100 text-emerald-600 shrink-0">
                      <i class="fas fa-arrow-up text-sm"></i>
                    </span>
                    <div>
                      <p class="text-[11px] font-semibold text-emerald-500 uppercase tracking-wide">Maior Subida</p>
                      <p class="text-xs text-emerald-700 font-medium">
                        {{ leituraPorHoraFiltrada.maiorSubida.de }} → {{ leituraPorHoraFiltrada.maiorSubida.para }}
                        <span class="font-bold">(+{{ leituraPorHoraFiltrada.maiorSubida.variacao }}%)</span>
                      </p>
                    </div>
                  </div>
                  <div v-if="leituraPorHoraFiltrada.maiorQueda" class="flex items-center gap-3 rounded-2xl bg-red-50/70 p-3">
                    <span class="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-red-100 text-red-600 shrink-0">
                      <i class="fas fa-arrow-down text-sm"></i>
                    </span>
                    <div>
                      <p class="text-[11px] font-semibold text-red-500 uppercase tracking-wide">Maior Queda</p>
                      <p class="text-xs text-red-700 font-medium">
                        {{ leituraPorHoraFiltrada.maiorQueda.de }} → {{ leituraPorHoraFiltrada.maiorQueda.para }}
                        <span class="font-bold">({{ leituraPorHoraFiltrada.maiorQueda.variacao }}%)</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="text-sm text-gray-500 py-4 text-center">
                <i class="fas fa-chart-bar text-gray-300 text-2xl mb-2"></i>
                <p>Não há dados de horário suficientes para montar o mapa.</p>
              </div>
            </div>

            <!-- Resumo Histórico (Collapsible) -->
            <div v-if="historicoResumo" class="mt-8">
              <button
                @click="collapsedSections.resumoHistorico = !collapsedSections.resumoHistorico"
                class="flex items-center gap-2 mb-4 text-gray-800 font-semibold hover:text-blue-600 transition"
              >
                <i :class="collapsedSections.resumoHistorico ? 'fas fa-chevron-right' : 'fas fa-chevron-down'"></i>
                <span>📊 Métricas Avançadas</span>
              </button>

              <div v-show="!collapsedSections.resumoHistorico" class="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div class="bg-gray-50 rounded p-4">
                <p class="text-sm text-gray-600">Média de conclusão em outras auditorias</p>
                <p class="text-3xl font-bold text-gray-800 mt-1">
                  {{ historicoResumo.mediaPercentualConclusao.toFixed(2) }}%
                </p>
              </div>
              <div class="bg-gray-50 rounded p-4">
                <p class="text-sm text-gray-600 mb-2">Top usuários (média de lidos)</p>
                <div v-for="u in historicoResumo.topUsuarios" :key="u.nome" class="text-sm text-gray-800">
                  • {{ u.nome }} — {{ u.media.toFixed(1) }}
                </div>
              </div>
              <div class="bg-gray-50 rounded p-4 lg:col-span-2">
                <p class="text-sm text-gray-600 mb-2">Setores mais críticos (pendentes médios)</p>
                <div v-for="s in historicoResumo.setoresCriticos" :key="s.nome" class="text-sm text-gray-800">
                  • {{ s.nome }} — {{ s.mediaPend.toFixed(1) }} pendentes
                </div>
              </div>
            </div>
            </div>
          </div>
        </template>
      </div>

      <!-- USUÁRIOS -->
      <div v-if="abaAtiva === 'usuarios'" class="space-y-6">
        <!-- Análises Rápidas -->
        <div v-if="analiseUsuarios" class="flex flex-col gap-6">
          <div class="flex justify-end">
            <button
              @click="handlePrintUsuarios"
              class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium shadow-sm hover:bg-indigo-700 transition"
            >
              <i class="fas fa-print"></i> Imprimir Lista
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <p class="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Total de Usuários</p>
                <span class="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-blue-50 text-blue-600">
                  <i class="fas fa-users text-sm"></i>
                </span>
              </div>
              <p class="text-3xl font-bold text-blue-700">{{ analiseUsuarios.totalUsuarios }}</p>
            </div>
            <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <p class="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Média de Lidos/Usuário</p>
                <span class="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600">
                  <i class="fas fa-chart-bar text-sm"></i>
                </span>
              </div>
              <p class="text-3xl font-bold text-emerald-700">{{ analiseUsuarios.mediaLidasPorUsuario }}</p>
            </div>
            <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <p class="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Melhor Desempenho</p>
                <span class="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-purple-50 text-purple-600">
                  <i class="fas fa-trophy text-sm"></i>
                </span>
              </div>
              <p class="text-2xl font-bold text-purple-700">{{ analiseUsuarios.usuarioDestaque }}</p>
              <p class="text-[11px] text-slate-500">{{ analiseUsuarios.lidasDestaque }} lidos</p>
            </div>
          </div>
        </div>

        <!-- Tabela de Usuários -->
        <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 p-5 space-y-3">
          <div class="flex items-center gap-2 flex-wrap">
            <div class="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <i class="fas fa-users text-indigo-600 text-sm"></i>
            </div>
            <h2 class="text-sm font-bold text-slate-800">Desempenho por Usuário</h2>
            <span v-if="dadosUsuarios.length" class="text-[10px] text-slate-400 font-medium">{{ dadosUsuarios.length }} usuário(s)</span>
            <div class="ml-auto flex items-center gap-2">
              <div class="relative">
                <i class="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[11px]"></i>
                <input
                  v-model="buscaUsuariosTab"
                  type="text"
                  placeholder="Buscar usuário..."
                  class="pl-7 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-44"
                  @input="paginaUsuariosTab = 1"
                />
              </div>
            </div>
          </div>
          <div v-if="dadosUsuarios.length === 0" class="flex flex-col items-center justify-center py-8 text-slate-400">
            <i class="fas fa-users text-3xl mb-2"></i>
            <p class="text-xs">Nenhuma informação de usuários encontrada.</p>
          </div>
          <div v-else class="overflow-x-auto">
            <table class="w-full text-xs">
              <thead>
                <tr class="border-b-2 border-slate-100">
                  <th class="px-3 py-2.5 text-left font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors" @click="atualizarOrdenacaoUsuarios('nome')">
                    <span class="inline-flex items-center gap-1">
                      Usuário
                      <i class="fas text-[10px]" :class="ordenacaoUsuarios.coluna === 'nome' ? (ordenacaoUsuarios.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" />
                    </span>
                  </th>
                  <th class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors" @click="atualizarOrdenacaoUsuarios('lidos')">
                    <span class="inline-flex items-center gap-1">
                      Lidos Corretamente
                      <i class="fas text-[10px]" :class="ordenacaoUsuarios.coluna === 'lidos' ? (ordenacaoUsuarios.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" />
                    </span>
                  </th>
                  <th class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors" @click="atualizarOrdenacaoUsuarios('comProblema')">
                    <span class="inline-flex items-center gap-1">
                      Com Problema
                      <i class="fas text-[10px]" :class="ordenacaoUsuarios.coluna === 'comProblema' ? (ordenacaoUsuarios.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" />
                    </span>
                  </th>
                  <th class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors" @click="atualizarOrdenacaoUsuarios('percentualProblema')">
                    <span class="inline-flex items-center gap-1">
                      % Problemas
                      <i class="fas text-[10px]" :class="ordenacaoUsuarios.coluna === 'percentualProblema' ? (ordenacaoUsuarios.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" />
                    </span>
                  </th>
                  <th class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors" @click="atualizarOrdenacaoUsuarios('totalLidos')">
                    <span class="inline-flex items-center gap-1">
                      Total Lidos
                      <i class="fas text-[10px]" :class="ordenacaoUsuarios.coluna === 'totalLidos' ? (ordenacaoUsuarios.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" />
                    </span>
                  </th>
                  <th class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors" @click="atualizarOrdenacaoUsuarios('percentualAuditoria')">
                    <span class="inline-flex items-center gap-1">
                      % Auditoria
                      <i class="fas text-[10px]" :class="ordenacaoUsuarios.coluna === 'percentualAuditoria' ? (ordenacaoUsuarios.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" />
                    </span>
                  </th>
                  <th class="px-3 py-2.5 text-center font-semibold text-slate-600">Detalhes</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-50">
                <tr
                  v-for="(u, idx) in usuariosPaginados"
                  :key="u.nome"
                  class="transition-colors"
                  :class="idx % 2 === 0 ? 'bg-white hover:bg-indigo-50/40' : 'bg-slate-50/60 hover:bg-indigo-50/40'"
                >
                  <td class="px-3 py-2.5 text-slate-700 font-medium">{{ u.nome }}</td>
                  <td class="px-3 py-2.5 text-right text-emerald-700 font-semibold">{{ u.lidos.toLocaleString('pt-BR') }}</td>
                  <td class="px-3 py-2.5 text-right text-red-600 font-semibold">{{ u.comProblema.toLocaleString('pt-BR') }}</td>
                  <td class="px-3 py-2.5 text-right">
                    <div class="flex items-center justify-end gap-2">
                      <div class="w-12 bg-slate-100 rounded-full h-1.5 hidden sm:block">
                        <div class="h-1.5 rounded-full transition-all" :class="u.percentualProblema > 5 ? 'bg-red-400' : u.percentualProblema > 0 ? 'bg-amber-400' : 'bg-slate-200'" :style="{ width: Math.min(u.percentualProblema, 100) + '%' }"></div>
                      </div>
                      <span class="font-semibold" :class="u.percentualProblema > 5 ? 'text-red-700' : u.percentualProblema > 0 ? 'text-amber-700' : 'text-slate-400'">{{ u.percentualProblema.toFixed(1) }}%</span>
                    </div>
                  </td>
                  <td class="px-3 py-2.5 text-right text-blue-700 font-semibold">{{ u.totalLidos.toLocaleString('pt-BR') }}</td>
                  <td class="px-3 py-2.5 text-right">
                    <div class="flex items-center justify-end gap-2">
                      <div class="w-12 bg-slate-100 rounded-full h-1.5 hidden sm:block">
                        <div class="h-1.5 rounded-full bg-indigo-400 transition-all" :style="{ width: Math.min(u.percentualAuditoria, 100) + '%' }"></div>
                      </div>
                      <span class="text-indigo-700 font-semibold">{{ u.percentualAuditoria.toFixed(1) }}%</span>
                    </div>
                  </td>
                  <td class="px-3 py-2.5 text-center">
                    <button
                      class="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-[11px] font-semibold hover:bg-indigo-100 transition"
                      @click="abrirModalUsuario(u.nome)"
                    >
                      Ver detalhes
                    </button>
                  </td>
                </tr>
                <tr v-if="usuariosFiltrados.length === 0">
                  <td colspan="7" class="px-3 py-8 text-center text-slate-400">
                    <i class="fas fa-search text-2xl mb-2"></i>
                    <p class="text-xs">Nenhum usuário encontrado.</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <!-- Paginação -->
          <div v-if="totalPaginasUsuariosTab > 1" class="flex items-center justify-between pt-2 border-t border-slate-100">
            <p class="text-[11px] text-slate-500">
              Mostrando {{ ((paginaUsuariosTab - 1) * itensPorPaginaUsuariosTab) + 1 }} a {{ Math.min(paginaUsuariosTab * itensPorPaginaUsuariosTab, usuariosFiltrados.length) }} de {{ usuariosFiltrados.length }}
            </p>
            <div class="flex items-center gap-1">
              <button
                @click="paginaUsuariosTab = 1"
                :disabled="paginaUsuariosTab === 1"
                class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"
              >
                <i class="fas fa-angle-double-left"></i>
              </button>
              <button
                @click="paginaUsuariosTab--"
                :disabled="paginaUsuariosTab === 1"
                class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"
              >
                <i class="fas fa-angle-left"></i>
              </button>
              <template v-for="p in totalPaginasUsuariosTab" :key="p">
                <button
                  v-if="p === 1 || p === totalPaginasUsuariosTab || (p >= paginaUsuariosTab - 1 && p <= paginaUsuariosTab + 1)"
                  @click="paginaUsuariosTab = p"
                  class="min-w-[28px] px-2 py-1 rounded text-[11px] font-semibold transition"
                  :class="p === paginaUsuariosTab ? 'bg-indigo-600 text-white shadow-sm' : 'hover:bg-slate-100 text-slate-600'"
                >
                  {{ p }}
                </button>
                <span
                  v-else-if="p === paginaUsuariosTab - 2 || p === paginaUsuariosTab + 2"
                  class="text-slate-400 text-[11px] px-1"
                >...</span>
              </template>
              <button
                @click="paginaUsuariosTab++"
                :disabled="paginaUsuariosTab === totalPaginasUsuariosTab"
                class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"
              >
                <i class="fas fa-angle-right"></i>
              </button>
              <button
                @click="paginaUsuariosTab = totalPaginasUsuariosTab"
                :disabled="paginaUsuariosTab === totalPaginasUsuariosTab"
                class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"
              >
                <i class="fas fa-angle-double-right"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- Contribuição por Setor -->
        <div v-if="setoresComUsuarios.length > 0" class="mt-8">
          <h3 class="text-2xl font-bold text-gray-800 mb-6">
            <i class="fas fa-chart-pie text-indigo-600 mr-2"></i>Contribuição por Setor
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div
              v-for="setorData in setoresComUsuarios"
              :key="setorData.setor"
              class="bg-white rounded-lg p-6 shadow hover:shadow-lg transition"
            >
              <h4 class="text-lg font-bold text-gray-800 mb-4">{{ setorData.setor }}</h4>
              <p class="text-sm text-gray-600 mb-4">Total: {{ setorData.totalLidos }} itens lidos</p>

              <!-- Stacked Progress Bar -->
              <div class="mb-4">
                <div class="flex h-8 rounded-lg overflow-hidden border border-gray-200">
                  <div
                    v-for="(usuario, idx) in setorData.usuarios"
                    :key="usuario.usuario"
                    :style="{ width: usuario.percentual + '%' }"
                    class="transition-all duration-300"
                    :class="[
                      'flex items-center justify-center text-xs font-bold text-white',
                      ['bg-blue-500', 'bg-green-500', 'bg-amber-500', 'bg-red-500', 'bg-purple-500', 'bg-pink-500', 'bg-cyan-500', 'bg-orange-500'][idx % 8]
                    ]"
                    :title="`${usuario.usuario}: ${usuario.percentual}%`"
                  >
                    <span v-if="usuario.percentual > 8">{{ usuario.lidos }}</span>
                  </div>
                </div>
              </div>

              <!-- Legend -->
              <div class="space-y-2">
                <div
                  v-for="(usuario, idx) in setorData.usuarios"
                  :key="usuario.usuario"
                  class="flex items-center gap-2 justify-between text-xs"
                >
                  <div class="flex items-center gap-2 flex-1 min-w-0">
                    <div
                      class="w-3 h-3 rounded-full shrink-0"
                      :class="[
                        'bg-blue-500', 'bg-green-500', 'bg-amber-500', 'bg-red-500', 'bg-purple-500', 'bg-pink-500', 'bg-cyan-500', 'bg-orange-500'
                      ][idx % 8]"
                    />
                    <span class="font-semibold text-gray-700 truncate">{{ usuario.usuario }}</span>
                  </div>
                  <span class="text-gray-600 shrink-0 ml-2">{{ usuario.percentual }}% ({{ usuario.lidos }})</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- Modal de Atualizar Dados (Disponível em Todas as Abas) -->
      <div
        v-if="mostrarUploadSubstituir && !readOnly"
        class="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        @click.stop="mostrarUploadSubstituir = false"
      >
        <div
          class="bg-white rounded-lg shadow-2xl w-full max-w-2xl p-6"
          @click.stop
        >
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-xl font-bold text-gray-800">Substituir Planilha</h3>
            <button
              @click="mostrarUploadSubstituir = false"
              class="text-gray-500 hover:text-gray-700"
            >
              <i class="fas fa-times text-xl"></i>
            </button>
          </div>
          <p class="text-gray-600 mb-4">
            Ao carregar uma nova planilha, os dados atuais serão substituídos completamente.
          </p>
          <div class="mb-5 bg-slate-50 rounded-xl p-4 border border-slate-200">
            <label class="block text-sm font-semibold text-gray-700 mb-2">
              <i class="fas fa-barcode text-blue-600 mr-1.5"></i>SKU da Loja
            </label>
            <div class="relative">
              <input
                v-model="skuSubstituir"
                type="number"
                min="1"
                placeholder="Quantidade de SKUs"
                class="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              />
            </div>
            <p class="text-[11px] text-slate-400 mt-1.5">Deixe vazio para manter o SKU atual</p>
          </div>
          <UploadAnaliseAuditoria
            :auditoria="auditoria"
            @analiseCompleta="handleUploadCompleto"
          />
          <div class="mt-4 flex justify-end">
            <button
              @click="mostrarUploadSubstituir = false"
              class="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>

      <!-- DADOS -->
      <div v-if="abaAtiva === 'dados'" class="space-y-8">
        <!-- Mapa de Setores e Corredores -->
        <div>
          <h2 class="text-2xl font-bold text-gray-800 mb-6">
            <i class="fas fa-map text-blue-600 mr-2"></i>Mapa de Setores e Corredores
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <div
              v-for="(setor, nome) in mapaSeteores"
              :key="nome"
              @click="abrirModalSetorLocal('setor', [setor])"
              class="group bg-white rounded-xl p-5 cursor-pointer transition-all duration-200 hover:shadow-lg border border-gray-100 hover:border-gray-200"
            >
              <!-- Nome e seta -->
              <div class="flex items-center justify-between mb-4">
                <h3 class="font-semibold text-gray-800 text-[15px] truncate mr-2">{{ setor.nome }}</h3>
                <i class="fas fa-arrow-right text-xs text-gray-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all"></i>
              </div>

              <!-- Progresso circular + métricas -->
              <div class="flex items-center gap-4">
                <!-- Círculo de progresso -->
                <div class="relative flex-shrink-0">
                  <svg class="w-16 h-16 -rotate-90" viewBox="0 0 60 60">
                    <circle cx="30" cy="30" r="25" fill="none" stroke="#f1f5f9" stroke-width="5"/>
                    <circle
                      cx="30" cy="30" r="25" fill="none" stroke-width="5" stroke-linecap="round"
                      :stroke="setor.percentualConclusao >= 75 ? '#10b981' : setor.percentualConclusao >= 50 ? '#f59e0b' : '#ef4444'"
                      :stroke-dasharray="157"
                      :stroke-dashoffset="157 - (157 * setor.percentualConclusao / 100)"
                    />
                  </svg>
                  <div class="absolute inset-0 flex items-center justify-center">
                    <span class="text-sm font-bold text-gray-700">{{ setor.percentualConclusao }}%</span>
                  </div>
                </div>

                <!-- Números -->
                <div class="flex-1 space-y-1.5 min-w-0">
                  <div class="flex items-center justify-between">
                    <span class="text-xs text-gray-400">Total</span>
                    <span class="text-sm font-semibold text-gray-700">{{ setor.total }}</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-xs text-emerald-500">Lidos</span>
                    <span class="text-sm font-semibold text-emerald-600">{{ setor.lidos }}</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-xs text-orange-400">Pendentes</span>
                    <span class="text-sm font-semibold text-orange-500">{{ setor.pendentes }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Filtro de Fornecedor -->
        <div v-if="fornecedoresUnicos.length > 0" class="bg-white rounded-lg p-6 shadow">
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
             <h3 class="text-xl font-bold text-gray-800 flex items-center">
               <i class="fas fa-truck text-blue-600 mr-2"></i>Filtrar por Fornecedor
             </h3>
             <button
               v-if="filtroFornecedor && itensFornecedorFormatados.length > 0"
               @click="handlePrintCard(fornecedorTabOrdenado, colunasFornecedor, `Fornecedor ${filtroFornecedor}`)"
               class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium shadow-sm flex items-center gap-2"
             >
               <i class="fas fa-print"></i> Imprimir Lista
             </button>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Fornecedor</label>
              <select 
                v-model="filtroFornecedor"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 bg-white"
              >
                <option value="">Selecione um fornecedor...</option>
                <option v-for="fornecedor in fornecedoresUnicos" :key="fornecedor" :value="fornecedor">
                  {{ fornecedor }}
                </option>
              </select>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Setor</label>
              <select 
                v-model="filtroSetorFornecedor"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 bg-white"
                :disabled="!filtroFornecedor"
              >
                <option value="todos">Todos os setores</option>
                <option v-for="setor in setoresUnicosDados" :key="setor" :value="setor">
                  {{ setor }}
                </option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select 
                v-model="filtroStatusFornecedor"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 bg-white"
                :disabled="!filtroFornecedor"
              >
                <option value="todos">Todos os itens</option>
                <option value="pendente">Apenas Pendentes</option>
                <option value="lido">Apenas Lidos</option>
              </select>
            </div>
          </div>

          <!-- Itens do Fornecedor Selecionado -->
          <div v-if="filtroFornecedor" class="mt-4">
            <div v-if="itensFornecedorFormatados.length > 0">
              <p class="text-sm text-gray-600 mb-3">
                Exibindo <span class="font-bold">{{ itensFornecedorFormatados.length }}</span> itens 
                <span v-if="filtroStatusFornecedor !== 'todos'">({{ filtroStatusFornecedor }})</span>
              </p>
              <!-- Search -->
              <div class="relative mb-3">
                <i class="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[11px]"></i>
                <input v-model="buscaFornecedorTab" type="text" placeholder="Buscar..." class="pl-7 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64" @input="paginaFornecedorTab = 1" />
              </div>
              <div v-if="fornecedorTabOrdenado.length === 0" class="flex flex-col items-center justify-center py-8 text-slate-400">
                <i class="fas fa-inbox text-3xl mb-2"></i>
                <p class="text-xs">Nenhum item encontrado.</p>
              </div>
              <div v-else class="overflow-x-auto">
                <table class="w-full text-xs">
                  <thead>
                    <tr class="border-b-2 border-slate-100">
                      <th class="px-3 py-2.5 text-left font-semibold text-slate-600 cursor-pointer select-none hover:text-blue-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoFornecedorTab, 'codigo'); paginaFornecedorTab = 1">
                        <span class="inline-flex items-center gap-1">Código <i class="fas text-[10px]" :class="ordenacaoFornecedorTab.coluna === 'codigo' ? (ordenacaoFornecedorTab.direcao === 'asc' ? 'fa-sort-up text-blue-600' : 'fa-sort-down text-blue-600') : 'fa-sort text-slate-300'" /></span>
                      </th>
                      <th class="px-3 py-2.5 text-left font-semibold text-slate-600 cursor-pointer select-none hover:text-blue-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoFornecedorTab, 'produto'); paginaFornecedorTab = 1">
                        <span class="inline-flex items-center gap-1">Produto <i class="fas text-[10px]" :class="ordenacaoFornecedorTab.coluna === 'produto' ? (ordenacaoFornecedorTab.direcao === 'asc' ? 'fa-sort-up text-blue-600' : 'fa-sort-down text-blue-600') : 'fa-sort text-slate-300'" /></span>
                      </th>
                      <th class="px-3 py-2.5 text-left font-semibold text-slate-600 cursor-pointer select-none hover:text-blue-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoFornecedorTab, 'setor'); paginaFornecedorTab = 1">
                        <span class="inline-flex items-center gap-1">Setor <i class="fas text-[10px]" :class="ordenacaoFornecedorTab.coluna === 'setor' ? (ordenacaoFornecedorTab.direcao === 'asc' ? 'fa-sort-up text-blue-600' : 'fa-sort-down text-blue-600') : 'fa-sort text-slate-300'" /></span>
                      </th>
                      <th class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-blue-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoFornecedorTab, 'estoque'); paginaFornecedorTab = 1">
                        <span class="inline-flex items-center gap-1 justify-end">Estoque <i class="fas text-[10px]" :class="ordenacaoFornecedorTab.coluna === 'estoque' ? (ordenacaoFornecedorTab.direcao === 'asc' ? 'fa-sort-up text-blue-600' : 'fa-sort-down text-blue-600') : 'fa-sort text-slate-300'" /></span>
                      </th>
                      <th class="px-3 py-2.5 text-center font-semibold text-slate-600 cursor-pointer select-none hover:text-blue-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoFornecedorTab, 'statusTexto'); paginaFornecedorTab = 1">
                        <span class="inline-flex items-center gap-1">Status <i class="fas text-[10px]" :class="ordenacaoFornecedorTab.coluna === 'statusTexto' ? (ordenacaoFornecedorTab.direcao === 'asc' ? 'fa-sort-up text-blue-600' : 'fa-sort-down text-blue-600') : 'fa-sort text-slate-300'" /></span>
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-50">
                    <tr v-for="(item, idx) in fornecedorTabPaginado" :key="idx" class="transition-colors" :class="idx % 2 === 0 ? 'bg-white hover:bg-blue-50/40' : 'bg-slate-50/60 hover:bg-blue-50/40'">
                      <td class="px-3 py-2.5 text-slate-700 font-semibold">{{ item.codigo }}</td>
                      <td class="px-3 py-2.5 text-slate-700">{{ item.produto }}</td>
                      <td class="px-3 py-2.5 text-slate-600">{{ item.setor }}</td>
                      <td class="px-3 py-2.5 text-right font-mono text-slate-700">{{ item.estoque }}</td>
                      <td class="px-3 py-2.5 text-center"><span :class="item.statusClass">{{ item.statusTexto }}</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <!-- Pagination -->
              <div v-if="totalPaginasFornecedorTab > 1" class="flex items-center justify-between pt-2 border-t border-slate-100 mt-3">
                <p class="text-[11px] text-slate-500">Mostrando {{ ((paginaFornecedorTab - 1) * itensPorPaginaFornecedorTab) + 1 }} a {{ Math.min(paginaFornecedorTab * itensPorPaginaFornecedorTab, fornecedorTabOrdenado.length) }} de {{ fornecedorTabOrdenado.length }}</p>
                <div class="flex items-center gap-1">
                  <button @click="paginaFornecedorTab = 1" :disabled="paginaFornecedorTab === 1" class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"><i class="fas fa-angle-double-left"></i></button>
                  <button @click="paginaFornecedorTab--" :disabled="paginaFornecedorTab === 1" class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"><i class="fas fa-angle-left"></i></button>
                  <template v-for="p in paginasVisiveisFn(totalPaginasFornecedorTab, paginaFornecedorTab)" :key="p">
                    <button v-if="typeof p === 'number'" @click="paginaFornecedorTab = p" class="min-w-[28px] px-2 py-1 rounded text-[11px] font-semibold transition" :class="p === paginaFornecedorTab ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-slate-100 text-slate-600'">{{ p }}</button>
                    <span v-else class="text-slate-400 text-[11px] px-1">...</span>
                  </template>
                  <button @click="paginaFornecedorTab++" :disabled="paginaFornecedorTab === totalPaginasFornecedorTab" class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"><i class="fas fa-angle-right"></i></button>
                  <button @click="paginaFornecedorTab = totalPaginasFornecedorTab" :disabled="paginaFornecedorTab === totalPaginasFornecedorTab" class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"><i class="fas fa-angle-double-right"></i></button>
                </div>
              </div>
            </div>
            <div v-else class="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
              <p class="text-gray-500">Nenhum item encontrado com os filtros selecionados.</p>
            </div>
          </div>
          <div v-else class="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            <p class="text-gray-500">Selecione um fornecedor acima para ver os itens.</p>
          </div>
        </div>

        <!-- Análises de Dados Críticos -->
        <div class="space-y-6">

          <!-- 1. Lidos com Estoque Zero -->
          <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 p-5 space-y-3">
            <div class="flex items-center gap-2 flex-wrap">
              <div class="h-8 w-8 rounded-lg bg-red-50 flex items-center justify-center">
                <i class="fas fa-exclamation-triangle text-red-600 text-sm"></i>
              </div>
              <h2 class="text-sm font-bold text-slate-800">Lidos com Estoque Zero</h2>
              <span v-if="itensLidosEstoqueZeroFiltrados.length" class="text-[10px] text-slate-400 font-medium">{{ itensLidosEstoqueZeroFiltrados.length }} item(ns)</span>
              <div class="ml-auto flex items-center gap-2 flex-wrap">
                <select v-model="filtroSetorEstoqueZero" class="px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-red-500" @change="paginaDadosEstoqueZero = 1">
                  <option value="todos">Todos os setores</option>
                  <option v-for="setor in setoresUnicosDados" :key="setor" :value="setor">{{ setor }}</option>
                </select>
                <select v-model="filtroUsuarioEstoqueZero" class="px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-red-500" @change="paginaDadosEstoqueZero = 1">
                  <option value="todos">Todos os usuários</option>
                  <option v-for="u in usuariosUnicosDados" :key="u" :value="u">{{ u }}</option>
                </select>
                <div class="relative">
                  <i class="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[11px]"></i>
                  <input v-model="buscaDadosEstoqueZero" type="text" placeholder="Buscar..." class="pl-7 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-red-500 w-36" @input="paginaDadosEstoqueZero = 1" />
                </div>
                <button v-if="itensLidosEstoqueZeroFiltrados.length > 0" @click="handlePrintCard(estoqueZeroFiltradoOrdenado, colunasEstoqueZero, 'Lidos com Estoque Zero')" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-[11px] font-medium shadow-sm hover:bg-red-700 transition">
                  <i class="fas fa-print"></i> Imprimir
                </button>
              </div>
            </div>
            <div v-if="estoqueZeroFiltradoOrdenado.length === 0" class="flex flex-col items-center justify-center py-8 text-slate-400">
              <i class="fas fa-check-circle text-3xl mb-2"></i>
              <p class="text-xs">Nenhum item encontrado.</p>
            </div>
            <div v-else class="overflow-x-auto">
              <table class="w-full text-xs">
                <thead>
                  <tr class="border-b-2 border-slate-100">
                    <th class="px-3 py-2.5 text-left font-semibold text-slate-600 cursor-pointer select-none hover:text-red-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoDadosEstoqueZero, 'codigo'); paginaDadosEstoqueZero = 1">
                      <span class="inline-flex items-center gap-1">Código <i class="fas text-[10px]" :class="ordenacaoDadosEstoqueZero.coluna === 'codigo' ? (ordenacaoDadosEstoqueZero.direcao === 'asc' ? 'fa-sort-up text-red-600' : 'fa-sort-down text-red-600') : 'fa-sort text-slate-300'" /></span>
                    </th>
                    <th class="px-3 py-2.5 text-left font-semibold text-slate-600 cursor-pointer select-none hover:text-red-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoDadosEstoqueZero, 'produto'); paginaDadosEstoqueZero = 1">
                      <span class="inline-flex items-center gap-1">Produto <i class="fas text-[10px]" :class="ordenacaoDadosEstoqueZero.coluna === 'produto' ? (ordenacaoDadosEstoqueZero.direcao === 'asc' ? 'fa-sort-up text-red-600' : 'fa-sort-down text-red-600') : 'fa-sort text-slate-300'" /></span>
                    </th>
                    <th class="px-3 py-2.5 text-left font-semibold text-slate-600 cursor-pointer select-none hover:text-red-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoDadosEstoqueZero, 'local'); paginaDadosEstoqueZero = 1">
                      <span class="inline-flex items-center gap-1">Local <i class="fas text-[10px]" :class="ordenacaoDadosEstoqueZero.coluna === 'local' ? (ordenacaoDadosEstoqueZero.direcao === 'asc' ? 'fa-sort-up text-red-600' : 'fa-sort-down text-red-600') : 'fa-sort text-slate-300'" /></span>
                    </th>
                    <th class="px-3 py-2.5 text-left font-semibold text-slate-600 cursor-pointer select-none hover:text-red-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoDadosEstoqueZero, 'usuario'); paginaDadosEstoqueZero = 1">
                      <span class="inline-flex items-center gap-1">Usuário <i class="fas text-[10px]" :class="ordenacaoDadosEstoqueZero.coluna === 'usuario' ? (ordenacaoDadosEstoqueZero.direcao === 'asc' ? 'fa-sort-up text-red-600' : 'fa-sort-down text-red-600') : 'fa-sort text-slate-300'" /></span>
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-50">
                  <tr v-for="(item, idx) in estoqueZeroPaginado" :key="idx" class="transition-colors" :class="idx % 2 === 0 ? 'bg-white hover:bg-red-50/40' : 'bg-slate-50/60 hover:bg-red-50/40'">
                    <td class="px-3 py-2.5 text-slate-700 font-semibold">{{ item.codigo }}</td>
                    <td class="px-3 py-2.5 text-slate-700">{{ item.produto }}</td>
                    <td class="px-3 py-2.5 text-slate-600">{{ item.local }}</td>
                    <td class="px-3 py-2.5 text-slate-600">{{ item.usuario }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <!-- Paginação -->
            <div v-if="totalPaginasEstoqueZero > 1" class="flex items-center justify-between pt-2 border-t border-slate-100">
              <p class="text-[11px] text-slate-500">Mostrando {{ ((paginaDadosEstoqueZero - 1) * itensPorPaginaDados) + 1 }} a {{ Math.min(paginaDadosEstoqueZero * itensPorPaginaDados, estoqueZeroFiltradoOrdenado.length) }} de {{ estoqueZeroFiltradoOrdenado.length }}</p>
              <div class="flex items-center gap-1">
                <button @click="paginaDadosEstoqueZero = 1" :disabled="paginaDadosEstoqueZero === 1" class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"><i class="fas fa-angle-double-left"></i></button>
                <button @click="paginaDadosEstoqueZero--" :disabled="paginaDadosEstoqueZero === 1" class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"><i class="fas fa-angle-left"></i></button>
                <template v-for="p in totalPaginasEstoqueZero" :key="p">
                  <button v-if="p === 1 || p === totalPaginasEstoqueZero || (p >= paginaDadosEstoqueZero - 1 && p <= paginaDadosEstoqueZero + 1)" @click="paginaDadosEstoqueZero = p" class="min-w-[28px] px-2 py-1 rounded text-[11px] font-semibold transition" :class="p === paginaDadosEstoqueZero ? 'bg-red-600 text-white shadow-sm' : 'hover:bg-slate-100 text-slate-600'">{{ p }}</button>
                  <span v-else-if="p === paginaDadosEstoqueZero - 2 || p === paginaDadosEstoqueZero + 2" class="text-slate-400 text-[11px] px-1">...</span>
                </template>
                <button @click="paginaDadosEstoqueZero++" :disabled="paginaDadosEstoqueZero === totalPaginasEstoqueZero" class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"><i class="fas fa-angle-right"></i></button>
                <button @click="paginaDadosEstoqueZero = totalPaginasEstoqueZero" :disabled="paginaDadosEstoqueZero === totalPaginasEstoqueZero" class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"><i class="fas fa-angle-double-right"></i></button>
              </div>
            </div>
          </div>

          <!-- 2. Lido no Local Errado -->
          <div v-if="(auditoria.analise?.itensLidoNaoPertence || 0) > 0" class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 p-5 space-y-3">
            <div class="flex items-center gap-2 flex-wrap">
              <div class="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <i class="fas fa-map-marker-alt text-amber-600 text-sm"></i>
              </div>
              <h2 class="text-sm font-bold text-slate-800">Lido no Local Errado</h2>
              <span v-if="itensLidoNaoPertenceFiltrados.length" class="text-[10px] text-slate-400 font-medium">{{ itensLidoNaoPertenceFiltrados.length }} item(ns)</span>
              <div class="ml-auto flex items-center gap-2 flex-wrap">
                <select v-model="filtroSetorLocalErrado" class="px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500" @change="paginaDadosLocalErrado = 1">
                  <option value="todos">Todos os setores</option>
                  <option v-for="setor in setoresUnicosDados" :key="setor" :value="setor">{{ setor }}</option>
                </select>
                <select v-model="filtroUsuarioLocalErrado" class="px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500" @change="paginaDadosLocalErrado = 1">
                  <option value="todos">Todos os usuários</option>
                  <option v-for="u in usuariosUnicosDados" :key="u" :value="u">{{ u }}</option>
                </select>
                <div class="relative">
                  <i class="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[11px]"></i>
                  <input v-model="buscaDadosLocalErrado" type="text" placeholder="Buscar..." class="pl-7 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500 w-36" @input="paginaDadosLocalErrado = 1" />
                </div>
                <button v-if="itensLidoNaoPertenceFiltrados.length > 0" @click="handlePrintCard(localErradoFiltradoOrdenado, colunasLocalErrado, 'Lido no Local Errado')" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-[11px] font-medium shadow-sm hover:bg-amber-700 transition">
                  <i class="fas fa-print"></i> Imprimir
                </button>
              </div>
            </div>
            <div v-if="localErradoFiltradoOrdenado.length === 0" class="flex flex-col items-center justify-center py-8 text-slate-400">
              <i class="fas fa-check-circle text-3xl mb-2"></i>
              <p class="text-xs">Nenhum item encontrado.</p>
            </div>
            <div v-else class="overflow-x-auto">
              <table class="w-full text-xs">
                <thead>
                  <tr class="border-b-2 border-slate-100">
                    <th class="px-3 py-2.5 text-left font-semibold text-slate-600 cursor-pointer select-none hover:text-amber-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoDadosLocalErrado, 'codigo'); paginaDadosLocalErrado = 1">
                      <span class="inline-flex items-center gap-1">Código <i class="fas text-[10px]" :class="ordenacaoDadosLocalErrado.coluna === 'codigo' ? (ordenacaoDadosLocalErrado.direcao === 'asc' ? 'fa-sort-up text-amber-600' : 'fa-sort-down text-amber-600') : 'fa-sort text-slate-300'" /></span>
                    </th>
                    <th class="px-3 py-2.5 text-left font-semibold text-slate-600 cursor-pointer select-none hover:text-amber-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoDadosLocalErrado, 'produto'); paginaDadosLocalErrado = 1">
                      <span class="inline-flex items-center gap-1">Produto <i class="fas text-[10px]" :class="ordenacaoDadosLocalErrado.coluna === 'produto' ? (ordenacaoDadosLocalErrado.direcao === 'asc' ? 'fa-sort-up text-amber-600' : 'fa-sort-down text-amber-600') : 'fa-sort text-slate-300'" /></span>
                    </th>
                    <th class="px-3 py-2.5 text-left font-semibold text-slate-600 cursor-pointer select-none hover:text-amber-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoDadosLocalErrado, 'local'); paginaDadosLocalErrado = 1">
                      <span class="inline-flex items-center gap-1">Local <i class="fas text-[10px]" :class="ordenacaoDadosLocalErrado.coluna === 'local' ? (ordenacaoDadosLocalErrado.direcao === 'asc' ? 'fa-sort-up text-amber-600' : 'fa-sort-down text-amber-600') : 'fa-sort text-slate-300'" /></span>
                    </th>
                    <th class="px-3 py-2.5 text-left font-semibold text-slate-600 cursor-pointer select-none hover:text-amber-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoDadosLocalErrado, 'usuario'); paginaDadosLocalErrado = 1">
                      <span class="inline-flex items-center gap-1">Usuário <i class="fas text-[10px]" :class="ordenacaoDadosLocalErrado.coluna === 'usuario' ? (ordenacaoDadosLocalErrado.direcao === 'asc' ? 'fa-sort-up text-amber-600' : 'fa-sort-down text-amber-600') : 'fa-sort text-slate-300'" /></span>
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-50">
                  <tr v-for="(item, idx) in localErradoPaginado" :key="idx" class="transition-colors" :class="idx % 2 === 0 ? 'bg-white hover:bg-amber-50/40' : 'bg-slate-50/60 hover:bg-amber-50/40'">
                    <td class="px-3 py-2.5 text-slate-700 font-semibold">{{ item.codigo }}</td>
                    <td class="px-3 py-2.5 text-slate-700">{{ item.produto }}</td>
                    <td class="px-3 py-2.5 text-slate-600">{{ item.local }}</td>
                    <td class="px-3 py-2.5 text-slate-600">{{ item.usuario }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <!-- Paginação -->
            <div v-if="totalPaginasLocalErrado > 1" class="flex items-center justify-between pt-2 border-t border-slate-100">
              <p class="text-[11px] text-slate-500">Mostrando {{ ((paginaDadosLocalErrado - 1) * itensPorPaginaDados) + 1 }} a {{ Math.min(paginaDadosLocalErrado * itensPorPaginaDados, localErradoFiltradoOrdenado.length) }} de {{ localErradoFiltradoOrdenado.length }}</p>
              <div class="flex items-center gap-1">
                <button @click="paginaDadosLocalErrado = 1" :disabled="paginaDadosLocalErrado === 1" class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"><i class="fas fa-angle-double-left"></i></button>
                <button @click="paginaDadosLocalErrado--" :disabled="paginaDadosLocalErrado === 1" class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"><i class="fas fa-angle-left"></i></button>
                <template v-for="p in totalPaginasLocalErrado" :key="p">
                  <button v-if="p === 1 || p === totalPaginasLocalErrado || (p >= paginaDadosLocalErrado - 1 && p <= paginaDadosLocalErrado + 1)" @click="paginaDadosLocalErrado = p" class="min-w-[28px] px-2 py-1 rounded text-[11px] font-semibold transition" :class="p === paginaDadosLocalErrado ? 'bg-amber-600 text-white shadow-sm' : 'hover:bg-slate-100 text-slate-600'">{{ p }}</button>
                  <span v-else-if="p === paginaDadosLocalErrado - 2 || p === paginaDadosLocalErrado + 2" class="text-slate-400 text-[11px] px-1">...</span>
                </template>
                <button @click="paginaDadosLocalErrado++" :disabled="paginaDadosLocalErrado === totalPaginasLocalErrado" class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"><i class="fas fa-angle-right"></i></button>
                <button @click="paginaDadosLocalErrado = totalPaginasLocalErrado" :disabled="paginaDadosLocalErrado === totalPaginasLocalErrado" class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"><i class="fas fa-angle-double-right"></i></button>
              </div>
            </div>
          </div>

          <!-- 3. Grande Estoque Não Lido -->
          <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 p-5 space-y-3">
            <div class="flex items-center gap-2 flex-wrap">
              <div class="h-8 w-8 rounded-lg bg-orange-50 flex items-center justify-center">
                <i class="fas fa-boxes text-orange-600 text-sm"></i>
              </div>
              <h2 class="text-sm font-bold text-slate-800">Grande Estoque Não Lido</h2>
              <span v-if="itensGrandeEstoqueFormatados.length" class="text-[10px] text-slate-400 font-medium">{{ itensGrandeEstoqueFormatados.length }} item(ns)</span>
              <div class="ml-auto flex items-center gap-2 flex-wrap">
                <select v-model="filtroSetorGrandeEstoque" class="px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500" @change="paginaDadosGrandeEstoque = 1">
                  <option value="todos">Todos os setores</option>
                  <option v-for="setor in setoresUnicosDados" :key="setor" :value="setor">{{ setor }}</option>
                </select>
                <div class="relative">
                  <i class="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[11px]"></i>
                  <input v-model="buscaDadosGrandeEstoque" type="text" placeholder="Buscar..." class="pl-7 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500 w-36" @input="paginaDadosGrandeEstoque = 1" />
                </div>
                <button v-if="itensGrandeEstoqueFormatados.length > 0" @click="handlePrintCard(grandeEstoqueFiltradoOrdenado, colunasGrandeEstoque, 'Grande Estoque Não Lido')" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600 text-white text-[11px] font-medium shadow-sm hover:bg-orange-700 transition">
                  <i class="fas fa-print"></i> Imprimir
                </button>
              </div>
            </div>
            <div v-if="grandeEstoqueFiltradoOrdenado.length === 0" class="flex flex-col items-center justify-center py-8 text-slate-400">
              <i class="fas fa-check-circle text-3xl mb-2"></i>
              <p class="text-xs">Nenhum item encontrado.</p>
            </div>
            <div v-else class="overflow-x-auto">
              <table class="w-full text-xs">
                <thead>
                  <tr class="border-b-2 border-slate-100">
                    <th class="px-3 py-2.5 text-left font-semibold text-slate-600 cursor-pointer select-none hover:text-orange-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoDadosGrandeEstoque, 'codigo'); paginaDadosGrandeEstoque = 1">
                      <span class="inline-flex items-center gap-1">Código <i class="fas text-[10px]" :class="ordenacaoDadosGrandeEstoque.coluna === 'codigo' ? (ordenacaoDadosGrandeEstoque.direcao === 'asc' ? 'fa-sort-up text-orange-600' : 'fa-sort-down text-orange-600') : 'fa-sort text-slate-300'" /></span>
                    </th>
                    <th class="px-3 py-2.5 text-left font-semibold text-slate-600 cursor-pointer select-none hover:text-orange-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoDadosGrandeEstoque, 'produto'); paginaDadosGrandeEstoque = 1">
                      <span class="inline-flex items-center gap-1">Produto <i class="fas text-[10px]" :class="ordenacaoDadosGrandeEstoque.coluna === 'produto' ? (ordenacaoDadosGrandeEstoque.direcao === 'asc' ? 'fa-sort-up text-orange-600' : 'fa-sort-down text-orange-600') : 'fa-sort text-slate-300'" /></span>
                    </th>
                    <th class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-orange-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoDadosGrandeEstoque, 'estoque'); paginaDadosGrandeEstoque = 1">
                      <span class="inline-flex items-center gap-1">Estoque <i class="fas text-[10px]" :class="ordenacaoDadosGrandeEstoque.coluna === 'estoque' ? (ordenacaoDadosGrandeEstoque.direcao === 'asc' ? 'fa-sort-up text-orange-600' : 'fa-sort-down text-orange-600') : 'fa-sort text-slate-300'" /></span>
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-50">
                  <tr v-for="(item, idx) in grandeEstoquePaginado" :key="idx" class="transition-colors" :class="idx % 2 === 0 ? 'bg-white hover:bg-orange-50/40' : 'bg-slate-50/60 hover:bg-orange-50/40'">
                    <td class="px-3 py-2.5 text-slate-700 font-semibold">{{ item.codigo }}</td>
                    <td class="px-3 py-2.5 text-slate-700">{{ item.produto }}</td>
                    <td class="px-3 py-2.5 text-right text-orange-700 font-semibold">{{ item.estoque?.toLocaleString('pt-BR') }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <!-- Paginação -->
            <div v-if="totalPaginasGrandeEstoque > 1" class="flex items-center justify-between pt-2 border-t border-slate-100">
              <p class="text-[11px] text-slate-500">Mostrando {{ ((paginaDadosGrandeEstoque - 1) * itensPorPaginaDados) + 1 }} a {{ Math.min(paginaDadosGrandeEstoque * itensPorPaginaDados, grandeEstoqueFiltradoOrdenado.length) }} de {{ grandeEstoqueFiltradoOrdenado.length }}</p>
              <div class="flex items-center gap-1">
                <button @click="paginaDadosGrandeEstoque = 1" :disabled="paginaDadosGrandeEstoque === 1" class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"><i class="fas fa-angle-double-left"></i></button>
                <button @click="paginaDadosGrandeEstoque--" :disabled="paginaDadosGrandeEstoque === 1" class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"><i class="fas fa-angle-left"></i></button>
                <template v-for="p in totalPaginasGrandeEstoque" :key="p">
                  <button v-if="p === 1 || p === totalPaginasGrandeEstoque || (p >= paginaDadosGrandeEstoque - 1 && p <= paginaDadosGrandeEstoque + 1)" @click="paginaDadosGrandeEstoque = p" class="min-w-[28px] px-2 py-1 rounded text-[11px] font-semibold transition" :class="p === paginaDadosGrandeEstoque ? 'bg-orange-600 text-white shadow-sm' : 'hover:bg-slate-100 text-slate-600'">{{ p }}</button>
                  <span v-else-if="p === paginaDadosGrandeEstoque - 2 || p === paginaDadosGrandeEstoque + 2" class="text-slate-400 text-[11px] px-1">...</span>
                </template>
                <button @click="paginaDadosGrandeEstoque++" :disabled="paginaDadosGrandeEstoque === totalPaginasGrandeEstoque" class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"><i class="fas fa-angle-right"></i></button>
                <button @click="paginaDadosGrandeEstoque = totalPaginasGrandeEstoque" :disabled="paginaDadosGrandeEstoque === totalPaginasGrandeEstoque" class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"><i class="fas fa-angle-double-right"></i></button>
              </div>
            </div>
          </div>
        </div>

        <!-- 4. Itens Ruptura Menor Custo -->
        <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 p-5 space-y-3">
          <div class="flex items-center gap-2 flex-wrap">
            <div class="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <i class="fas fa-coins text-blue-600 text-sm"></i>
            </div>
            <h2 class="text-sm font-bold text-slate-800">Itens de Ruptura - Menor Custo</h2>
            <span v-if="itensRupturaFormatados.length" class="text-[10px] text-slate-400 font-medium">{{ itensRupturaFormatados.length }} item(ns)</span>
            <div class="ml-auto flex items-center gap-2 flex-wrap">
              <select v-model="filtroSetorRuptura" class="px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" @change="paginaDadosRuptura = 1">
                <option value="todos">Todos os setores</option>
                <option v-for="setor in setoresUnicosDados" :key="setor" :value="setor">{{ setor }}</option>
              </select>
              <div class="relative">
                <i class="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[11px]"></i>
                <input v-model="buscaDadosRuptura" type="text" placeholder="Buscar..." class="pl-7 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 w-36" @input="paginaDadosRuptura = 1" />
              </div>
              <button v-if="itensRupturaFormatados.length > 0" @click="handlePrintCard(rupturaFiltradoOrdenado, colunasRuptura, 'Itens de Ruptura - Menor Custo')" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-[11px] font-medium shadow-sm hover:bg-blue-700 transition">
                <i class="fas fa-print"></i> Imprimir
              </button>
            </div>
          </div>
          <div v-if="rupturaFiltradoOrdenado.length === 0" class="flex flex-col items-center justify-center py-8 text-slate-400">
            <i class="fas fa-check-circle text-3xl mb-2"></i>
            <p class="text-xs">Nenhum item com custo de ruptura encontrado.</p>
          </div>
          <div v-else class="overflow-x-auto">
            <table class="w-full text-xs">
              <thead>
                <tr class="border-b-2 border-slate-100">
                  <th class="px-3 py-2.5 text-left font-semibold text-slate-600 cursor-pointer select-none hover:text-blue-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoDadosRuptura, 'codigo'); paginaDadosRuptura = 1">
                    <span class="inline-flex items-center gap-1">Código <i class="fas text-[10px]" :class="ordenacaoDadosRuptura.coluna === 'codigo' ? (ordenacaoDadosRuptura.direcao === 'asc' ? 'fa-sort-up text-blue-600' : 'fa-sort-down text-blue-600') : 'fa-sort text-slate-300'" /></span>
                  </th>
                  <th class="px-3 py-2.5 text-left font-semibold text-slate-600 cursor-pointer select-none hover:text-blue-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoDadosRuptura, 'produto'); paginaDadosRuptura = 1">
                    <span class="inline-flex items-center gap-1">Produto <i class="fas text-[10px]" :class="ordenacaoDadosRuptura.coluna === 'produto' ? (ordenacaoDadosRuptura.direcao === 'asc' ? 'fa-sort-up text-blue-600' : 'fa-sort-down text-blue-600') : 'fa-sort text-slate-300'" /></span>
                  </th>
                  <th class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-blue-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoDadosRuptura, 'estoque'); paginaDadosRuptura = 1">
                    <span class="inline-flex items-center gap-1">Qtd Estoque <i class="fas text-[10px]" :class="ordenacaoDadosRuptura.coluna === 'estoque' ? (ordenacaoDadosRuptura.direcao === 'asc' ? 'fa-sort-up text-blue-600' : 'fa-sort-down text-blue-600') : 'fa-sort text-slate-300'" /></span>
                  </th>
                  <th class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-blue-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoDadosRuptura, 'custo'); paginaDadosRuptura = 1">
                    <span class="inline-flex items-center gap-1">Custo <i class="fas text-[10px]" :class="ordenacaoDadosRuptura.coluna === 'custo' ? (ordenacaoDadosRuptura.direcao === 'asc' ? 'fa-sort-up text-blue-600' : 'fa-sort-down text-blue-600') : 'fa-sort text-slate-300'" /></span>
                  </th>
                  <th class="px-3 py-2.5 text-left font-semibold text-slate-600 cursor-pointer select-none hover:text-blue-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoDadosRuptura, 'fornecedor'); paginaDadosRuptura = 1">
                    <span class="inline-flex items-center gap-1">Fornecedor <i class="fas text-[10px]" :class="ordenacaoDadosRuptura.coluna === 'fornecedor' ? (ordenacaoDadosRuptura.direcao === 'asc' ? 'fa-sort-up text-blue-600' : 'fa-sort-down text-blue-600') : 'fa-sort text-slate-300'" /></span>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-50">
                <tr v-for="(item, idx) in rupturaPaginado" :key="idx" class="transition-colors" :class="idx % 2 === 0 ? 'bg-white hover:bg-blue-50/40' : 'bg-slate-50/60 hover:bg-blue-50/40'">
                  <td class="px-3 py-2.5 text-slate-700 font-semibold">{{ item.codigo }}</td>
                  <td class="px-3 py-2.5 text-slate-700">{{ item.produto }}</td>
                  <td class="px-3 py-2.5 text-right text-slate-700 font-mono">{{ item.estoque }}</td>
                  <td class="px-3 py-2.5 text-right text-blue-700 font-semibold">R$ {{ parseFloat(item.custo).toFixed(2) }}</td>
                  <td class="px-3 py-2.5 text-slate-600">{{ item.fornecedor }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <!-- Paginação -->
          <div v-if="totalPaginasRuptura > 1" class="flex items-center justify-between pt-2 border-t border-slate-100">
            <p class="text-[11px] text-slate-500">Mostrando {{ ((paginaDadosRuptura - 1) * itensPorPaginaDados) + 1 }} a {{ Math.min(paginaDadosRuptura * itensPorPaginaDados, rupturaFiltradoOrdenado.length) }} de {{ rupturaFiltradoOrdenado.length }}</p>
            <div class="flex items-center gap-1">
              <button @click="paginaDadosRuptura = 1" :disabled="paginaDadosRuptura === 1" class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"><i class="fas fa-angle-double-left"></i></button>
              <button @click="paginaDadosRuptura--" :disabled="paginaDadosRuptura === 1" class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"><i class="fas fa-angle-left"></i></button>
              <template v-for="p in totalPaginasRuptura" :key="p">
                <button v-if="p === 1 || p === totalPaginasRuptura || (p >= paginaDadosRuptura - 1 && p <= paginaDadosRuptura + 1)" @click="paginaDadosRuptura = p" class="min-w-[28px] px-2 py-1 rounded text-[11px] font-semibold transition" :class="p === paginaDadosRuptura ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-slate-100 text-slate-600'">{{ p }}</button>
                <span v-else-if="p === paginaDadosRuptura - 2 || p === paginaDadosRuptura + 2" class="text-slate-400 text-[11px] px-1">...</span>
              </template>
              <button @click="paginaDadosRuptura++" :disabled="paginaDadosRuptura === totalPaginasRuptura" class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"><i class="fas fa-angle-right"></i></button>
              <button @click="paginaDadosRuptura = totalPaginasRuptura" :disabled="paginaDadosRuptura === totalPaginasRuptura" class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"><i class="fas fa-angle-double-right"></i></button>
            </div>
          </div>
        </div>
      </div>

      <!-- ESTATÍSTICAS -->
      <div v-if="abaAtiva === 'estatisticas'" class="space-y-6">
        <!-- Setores -->
        <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 p-5 space-y-3">
          <div class="flex items-center gap-2 flex-wrap">
            <div class="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <i class="fas fa-chart-pie text-indigo-600 text-sm"></i>
            </div>
            <h2 class="text-sm font-bold text-slate-800">Parcial por Setor</h2>
            <span v-if="setoresComAnalise.length" class="text-[10px] text-slate-400 font-medium">{{ setoresComAnalise.length }} setor(es)</span>
            <span v-if="setoresComAnalise.filter(s => s.percentualPendente > 3).length" class="text-[10px] px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 font-medium border border-orange-100">{{ setoresComAnalise.filter(s => s.percentualPendente > 3).length }} acima da meta</span>
            <div class="ml-auto flex items-center gap-2">
              <div class="relative">
                <i class="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[11px]"></i>
                <input v-model="buscaSetores" type="text" placeholder="Buscar setor..." class="pl-7 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-44" @input="paginaSetores = 1" />
              </div>
              <button v-if="setoresFiltradoOrdenado.length > 0" @click="handlePrintSetores" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-[11px] font-medium shadow-sm hover:bg-indigo-700 transition">
                <i class="fas fa-print"></i> Imprimir
              </button>
            </div>
          </div>
          <div v-if="setoresFiltradoOrdenado.length === 0" class="flex flex-col items-center justify-center py-8 text-slate-400">
            <i class="fas fa-chart-pie text-3xl mb-2"></i>
            <p class="text-xs">Nenhum setor encontrado.</p>
          </div>
          <div v-else class="overflow-x-auto">
            <table class="w-full text-xs">
              <thead>
                <tr class="border-b-2 border-slate-100">
                  <th class="px-3 py-2.5 text-left font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoSetores, 'nome'); paginaSetores = 1">
                    <span class="inline-flex items-center gap-1">Setor <i class="fas text-[10px]" :class="ordenacaoSetores.coluna === 'nome' ? (ordenacaoSetores.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" /></span>
                  </th>
                  <th class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoSetores, 'total'); paginaSetores = 1">
                    <span class="inline-flex items-center gap-1">Total <i class="fas text-[10px]" :class="ordenacaoSetores.coluna === 'total' ? (ordenacaoSetores.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" /></span>
                  </th>
                  <th class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoSetores, 'lidos'); paginaSetores = 1">
                    <span class="inline-flex items-center gap-1">Lidos <i class="fas text-[10px]" :class="ordenacaoSetores.coluna === 'lidos' ? (ordenacaoSetores.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" /></span>
                  </th>
                  <th class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoSetores, 'pendentes'); paginaSetores = 1">
                    <span class="inline-flex items-center gap-1">Pendentes <i class="fas text-[10px]" :class="ordenacaoSetores.coluna === 'pendentes' ? (ordenacaoSetores.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" /></span>
                  </th>
                  <th class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoSetores, 'comProblema'); paginaSetores = 1">
                    <span class="inline-flex items-center gap-1">Problemas <i class="fas text-[10px]" :class="ordenacaoSetores.coluna === 'comProblema' ? (ordenacaoSetores.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" /></span>
                  </th>
                  <th class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoSetores, 'desatualizados'); paginaSetores = 1">
                    <span class="inline-flex items-center gap-1">Desatualiz. <i class="fas text-[10px]" :class="ordenacaoSetores.coluna === 'desatualizados' ? (ordenacaoSetores.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" /></span>
                  </th>
                  <th class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoSetores, 'percentualConclusao'); paginaSetores = 1">
                    <span class="inline-flex items-center gap-1">Conclusão <i class="fas text-[10px]" :class="ordenacaoSetores.coluna === 'percentualConclusao' ? (ordenacaoSetores.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" /></span>
                  </th>
                  <th class="px-3 py-2.5 text-center font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoSetores, 'classificacao'); paginaSetores = 1">
                    <span class="inline-flex items-center gap-1">Classificação <i class="fas text-[10px]" :class="ordenacaoSetores.coluna === 'classificacao' ? (ordenacaoSetores.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" /></span>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-50">
                <tr
                  v-for="(s, idx) in setoresPaginados"
                  :key="s.nome"
                  class="transition-colors cursor-pointer"
                  :class="idx % 2 === 0 ? 'bg-white hover:bg-indigo-50/40' : 'bg-slate-50/60 hover:bg-indigo-50/40'"
                  @click="abrirModalSetorLocal('setor', [s])"
                >
                  <td class="px-3 py-2.5 text-slate-700 font-medium">{{ s.nome }}</td>
                  <td class="px-3 py-2.5 text-right text-blue-700 font-semibold">{{ s.total.toLocaleString('pt-BR') }}</td>
                  <td class="px-3 py-2.5 text-right text-emerald-700 font-semibold">{{ s.lidos.toLocaleString('pt-BR') }}</td>
                  <td class="px-3 py-2.5 text-right text-orange-600 font-semibold">{{ s.pendentes.toLocaleString('pt-BR') }}</td>
                  <td class="px-3 py-2.5 text-right text-red-600 font-semibold">{{ s.comProblema.toLocaleString('pt-BR') }}</td>
                  <td class="px-3 py-2.5 text-right text-yellow-600 font-semibold">{{ s.desatualizados.toLocaleString('pt-BR') }}</td>
                  <td class="px-3 py-2.5 text-right">
                    <div class="flex items-center justify-end gap-2">
                      <div class="w-14 bg-slate-100 rounded-full h-1.5 hidden sm:block">
                        <div class="h-1.5 rounded-full bg-emerald-400 transition-all" :style="{ width: Math.min(s.percentualConclusao, 100) + '%' }"></div>
                      </div>
                      <span class="text-slate-700 font-semibold">{{ s.percentualConclusao.toFixed(2) }}%</span>
                    </div>
                  </td>
                  <td class="px-3 py-2.5 text-center">
                    <span class="px-2 py-1 rounded-full text-[10px] font-bold" :class="s.classificacaoClass">{{ s.classificacao }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <!-- Paginação -->
          <div v-if="totalPaginasSetores > 1" class="flex items-center justify-between pt-2 border-t border-slate-100">
            <p class="text-[11px] text-slate-500">Mostrando {{ ((paginaSetores - 1) * itensPorPaginaSetores) + 1 }} a {{ Math.min(paginaSetores * itensPorPaginaSetores, setoresFiltradoOrdenado.length) }} de {{ setoresFiltradoOrdenado.length }}</p>
            <div class="flex items-center gap-1">
              <button @click="paginaSetores = 1" :disabled="paginaSetores === 1" class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"><i class="fas fa-angle-double-left"></i></button>
              <button @click="paginaSetores--" :disabled="paginaSetores === 1" class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"><i class="fas fa-angle-left"></i></button>
              <template v-for="p in totalPaginasSetores" :key="p">
                <button v-if="p === 1 || p === totalPaginasSetores || (p >= paginaSetores - 1 && p <= paginaSetores + 1)" @click="paginaSetores = p" class="min-w-[28px] px-2 py-1 rounded text-[11px] font-semibold transition" :class="p === paginaSetores ? 'bg-indigo-600 text-white shadow-sm' : 'hover:bg-slate-100 text-slate-600'">{{ p }}</button>
                <span v-else-if="p === paginaSetores - 2 || p === paginaSetores + 2" class="text-slate-400 text-[11px] px-1">...</span>
              </template>
              <button @click="paginaSetores++" :disabled="paginaSetores === totalPaginasSetores" class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"><i class="fas fa-angle-right"></i></button>
              <button @click="paginaSetores = totalPaginasSetores" :disabled="paginaSetores === totalPaginasSetores" class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"><i class="fas fa-angle-double-right"></i></button>
            </div>
          </div>
        </div>

        <!-- Locais -->
        <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 p-5 space-y-3">
          <div class="flex items-center gap-2 flex-wrap">
            <div class="h-8 w-8 rounded-lg bg-rose-50 flex items-center justify-center">
              <i class="fas fa-map-marker-alt text-rose-600 text-sm"></i>
            </div>
            <h2 class="text-sm font-bold text-slate-800">Locais</h2>
            <span v-if="locaisComAnalise.length" class="text-[10px] text-slate-400 font-medium">{{ locaisComAnalise.length }} local(is)</span>
            <span v-if="locaisComAnalise.filter(l => l.pendentes > 0).length" class="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium border border-amber-100">{{ locaisComAnalise.filter(l => l.pendentes > 0).length }} com pendência</span>
            <div class="ml-auto flex items-center gap-2">
              <div class="relative">
                <i class="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[11px]"></i>
                <input v-model="buscaLocais" type="text" placeholder="Buscar local..." class="pl-7 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-rose-500 w-44" @input="paginaLocais = 1" />
              </div>
              <button v-if="locaisFiltradoOrdenado.length > 0" @click="handlePrintLocais" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-[11px] font-medium shadow-sm hover:bg-rose-700 transition">
                <i class="fas fa-print"></i> Imprimir
              </button>
            </div>
          </div>
          <div v-if="locaisFiltradoOrdenado.length === 0" class="flex flex-col items-center justify-center py-8 text-slate-400">
            <i class="fas fa-map-marker-alt text-3xl mb-2"></i>
            <p class="text-xs">Nenhum local encontrado.</p>
          </div>
          <div v-else class="overflow-x-auto">
            <table class="w-full text-xs">
              <thead>
                <tr class="border-b-2 border-slate-100">
                  <th class="px-3 py-2.5 text-left font-semibold text-slate-600 cursor-pointer select-none hover:text-rose-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoLocais, 'nome'); paginaLocais = 1">
                    <span class="inline-flex items-center gap-1">Local <i class="fas text-[10px]" :class="ordenacaoLocais.coluna === 'nome' ? (ordenacaoLocais.direcao === 'asc' ? 'fa-sort-up text-rose-600' : 'fa-sort-down text-rose-600') : 'fa-sort text-slate-300'" /></span>
                  </th>
                  <th class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-rose-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoLocais, 'lidos'); paginaLocais = 1">
                    <span class="inline-flex items-center gap-1">Lidos <i class="fas text-[10px]" :class="ordenacaoLocais.coluna === 'lidos' ? (ordenacaoLocais.direcao === 'asc' ? 'fa-sort-up text-rose-600' : 'fa-sort-down text-rose-600') : 'fa-sort text-slate-300'" /></span>
                  </th>
                  <th class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-rose-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoLocais, 'pendentes'); paginaLocais = 1">
                    <span class="inline-flex items-center gap-1">Pendentes <i class="fas text-[10px]" :class="ordenacaoLocais.coluna === 'pendentes' ? (ordenacaoLocais.direcao === 'asc' ? 'fa-sort-up text-rose-600' : 'fa-sort-down text-rose-600') : 'fa-sort text-slate-300'" /></span>
                  </th>
                  <th class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-rose-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoLocais, 'comProblema'); paginaLocais = 1">
                    <span class="inline-flex items-center gap-1">Problemas <i class="fas text-[10px]" :class="ordenacaoLocais.coluna === 'comProblema' ? (ordenacaoLocais.direcao === 'asc' ? 'fa-sort-up text-rose-600' : 'fa-sort-down text-rose-600') : 'fa-sort text-slate-300'" /></span>
                  </th>
                  <th class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-rose-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoLocais, 'desatualizados'); paginaLocais = 1">
                    <span class="inline-flex items-center gap-1">Desatualiz. <i class="fas text-[10px]" :class="ordenacaoLocais.coluna === 'desatualizados' ? (ordenacaoLocais.direcao === 'asc' ? 'fa-sort-up text-rose-600' : 'fa-sort-down text-rose-600') : 'fa-sort text-slate-300'" /></span>
                  </th>
                  <th class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-rose-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoLocais, 'total'); paginaLocais = 1">
                    <span class="inline-flex items-center gap-1">Total <i class="fas text-[10px]" :class="ordenacaoLocais.coluna === 'total' ? (ordenacaoLocais.direcao === 'asc' ? 'fa-sort-up text-rose-600' : 'fa-sort-down text-rose-600') : 'fa-sort text-slate-300'" /></span>
                  </th>
                  <th class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-rose-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoLocais, 'percentualLido'); paginaLocais = 1">
                    <span class="inline-flex items-center gap-1">% Lido <i class="fas text-[10px]" :class="ordenacaoLocais.coluna === 'percentualLido' ? (ordenacaoLocais.direcao === 'asc' ? 'fa-sort-up text-rose-600' : 'fa-sort-down text-rose-600') : 'fa-sort text-slate-300'" /></span>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-50">
                <tr
                  v-for="(l, idx) in locaisPaginados"
                  :key="l.nome"
                  class="transition-colors cursor-pointer"
                  :class="idx % 2 === 0 ? 'bg-white hover:bg-rose-50/40' : 'bg-slate-50/60 hover:bg-rose-50/40'"
                  @click="abrirModalSetorLocal('local', [l])"
                >
                  <td class="px-3 py-2.5 text-slate-700 font-medium">{{ l.nome }}</td>
                  <td class="px-3 py-2.5 text-right text-emerald-700 font-semibold">{{ l.lidos.toLocaleString('pt-BR') }}</td>
                  <td class="px-3 py-2.5 text-right text-orange-600 font-semibold">{{ l.pendentes.toLocaleString('pt-BR') }}</td>
                  <td class="px-3 py-2.5 text-right text-red-600 font-semibold">{{ l.comProblema.toLocaleString('pt-BR') }}</td>
                  <td class="px-3 py-2.5 text-right text-yellow-600 font-semibold">{{ l.desatualizados.toLocaleString('pt-BR') }}</td>
                  <td class="px-3 py-2.5 text-right text-blue-700 font-semibold">{{ l.total.toLocaleString('pt-BR') }}</td>
                  <td class="px-3 py-2.5 text-right">
                    <div class="flex items-center justify-end gap-2">
                      <div class="w-14 bg-slate-100 rounded-full h-1.5 hidden sm:block">
                        <div class="h-1.5 rounded-full transition-all" :class="l.percentualLido >= 97 ? 'bg-emerald-400' : l.percentualLido >= 90 ? 'bg-amber-400' : 'bg-red-400'" :style="{ width: Math.min(l.percentualLido, 100) + '%' }"></div>
                      </div>
                      <span class="font-bold" :class="l.percentualLido >= 97 ? 'text-emerald-700' : l.percentualLido >= 90 ? 'text-amber-700' : 'text-red-700'">{{ l.percentualLido.toFixed(2) }}%</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <!-- Paginação -->
          <div v-if="totalPaginasLocais > 1" class="flex items-center justify-between pt-2 border-t border-slate-100">
            <p class="text-[11px] text-slate-500">Mostrando {{ ((paginaLocais - 1) * itensPorPaginaLocais) + 1 }} a {{ Math.min(paginaLocais * itensPorPaginaLocais, locaisFiltradoOrdenado.length) }} de {{ locaisFiltradoOrdenado.length }}</p>
            <div class="flex items-center gap-1">
              <button @click="paginaLocais = 1" :disabled="paginaLocais === 1" class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"><i class="fas fa-angle-double-left"></i></button>
              <button @click="paginaLocais--" :disabled="paginaLocais === 1" class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"><i class="fas fa-angle-left"></i></button>
              <template v-for="p in totalPaginasLocais" :key="p">
                <button v-if="p === 1 || p === totalPaginasLocais || (p >= paginaLocais - 1 && p <= paginaLocais + 1)" @click="paginaLocais = p" class="min-w-[28px] px-2 py-1 rounded text-[11px] font-semibold transition" :class="p === paginaLocais ? 'bg-rose-600 text-white shadow-sm' : 'hover:bg-slate-100 text-slate-600'">{{ p }}</button>
                <span v-else-if="p === paginaLocais - 2 || p === paginaLocais + 2" class="text-slate-400 text-[11px] px-1">...</span>
              </template>
              <button @click="paginaLocais++" :disabled="paginaLocais === totalPaginasLocais" class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"><i class="fas fa-angle-right"></i></button>
              <button @click="paginaLocais = totalPaginasLocais" :disabled="paginaLocais === totalPaginasLocais" class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"><i class="fas fa-angle-double-right"></i></button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ModalMetrica -->
    <ModalMetrica 
      :aberto="modalMetricaAberto"
      :tipo="metricaSelecionada"
      :dados="auditoria.analise"
      :dadosCompletos="auditoria.dados"
      :tipoAuditoria="auditoria.tipo"
      @fechar="fecharModalMetrica"
    />

    <!-- ModalSetorLocal -->
    <ModalSetorLocal 
      :aberto="modalSetorLocalAberto"
      :tipo="tipoModalSetorLocal"
      :items="itemsModalSetorLocal"
      :titulo="tipoModalSetorLocal ? (tipoModalSetorLocal === 'setor' ? 'Detalhes do Setor' : 'Locais do Setor') : ''"
      :subtitulo="tipoModalSetorLocal && itemsModalSetorLocal.length > 0 ? (tipoModalSetorLocal === 'setor' ? itemsModalSetorLocal[0].nome : 'Clique em um local para ver os itens') : ''"
      :dadosCompletos="auditoria.dados"
      :analise="auditoria.analise"
      @fechar="fecharModalSetorLocal"
      @abrirLocais="abrirLocaisDoSetor"
      @abrirItens="abrirItensDoLocal"
    />

    <!-- Modal Itens -->
    <div 
      v-if="modalItensAberto"
      class="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      @click.stop="fecharModalItens"
    >
      <div 
        class="bg-white rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col print:max-w-full print:shadow-none"
        @click.stop
      >
        <!-- Header -->
        <div class="bg-blue-700 text-white p-4 flex items-center justify-between">
          <div>
            <h2 class="text-xl font-bold">{{ tituloModalItens }}</h2>
            <p class="text-blue-100 text-sm mt-1">{{ itensModal.length }} itens</p>
          </div>
          <button
            @click="fecharModalItens"
            class="text-white hover:opacity-80 transition print:hidden"
          >
            <i class="fas fa-times text-xl"></i>
          </button>
        </div>

        <!-- Filtros e Ordenação -->
        <div class="bg-gray-100 border-b px-4 py-3 flex gap-2 flex-wrap items-center print:hidden">
          <select
            v-model="filtroStatusItens"
            class="px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="Filtrar por status"
          >
            <option value="todos">Todos os status</option>
            <option value="lido">Apenas Lidos</option>
            <option value="pendente">Apenas Pendentes</option>
          </select>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-4" ref="printAreaItens" data-pdf-area="itens">
          <div class="bg-white rounded-lg shadow overflow-hidden">
            <!-- Cabeçalho específico para PDF -->
            <div class="hidden pdf-print-show text-xs text-gray-700 p-2 border-b">
              <div><strong>Local:</strong> {{ tituloModalItens }}</div>
            </div>
            
            <!-- Search -->
            <div class="relative mb-3">
              <i class="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[11px]"></i>
              <input v-model="buscaModalItens" type="text" placeholder="Buscar..." class="pl-7 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64" @input="paginaModalItens = 1" />
            </div>
            <div v-if="modalItensOrdenado.length === 0" class="flex flex-col items-center justify-center py-8 text-slate-400">
              <i class="fas fa-inbox text-3xl mb-2"></i>
              <p class="text-xs">Nenhum item encontrado.</p>
            </div>
            <div v-else class="overflow-x-auto">
              <table class="w-full text-xs">
                <thead>
                  <tr class="border-b-2 border-slate-100">
                    <th v-for="col in colunasModal" :key="col.chave"
                      :class="['px-3 py-2.5 font-semibold text-slate-600 cursor-pointer select-none hover:text-blue-600 transition-colors', col.alinhamento === 'right' ? 'text-right' : col.alinhamento === 'center' ? 'text-center' : 'text-left', col.classeHeader || '']"
                      @click="atualizarOrdenacaoDados(ordenacaoModalItens, col.chave); paginaModalItens = 1"
                    >
                      <span class="inline-flex items-center gap-1" :class="col.alinhamento === 'right' ? 'justify-end' : ''">
                        {{ col.titulo }}
                        <i class="fas text-[10px]" :class="ordenacaoModalItens.coluna === col.chave ? (ordenacaoModalItens.direcao === 'asc' ? 'fa-sort-up text-blue-600' : 'fa-sort-down text-blue-600') : 'fa-sort text-slate-300'" />
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-50">
                  <tr v-for="(item, idx) in modalItensPaginado" :key="idx" class="transition-colors" :class="idx % 2 === 0 ? 'bg-white hover:bg-blue-50/40' : 'bg-slate-50/60 hover:bg-blue-50/40'">
                    <td v-for="col in colunasModal" :key="col.chave"
                      :class="['px-3 py-2.5', col.alinhamento === 'right' ? 'text-right' : col.alinhamento === 'center' ? 'text-center' : 'text-left', col.classeCell || '', col.chave === 'Código' ? 'font-semibold text-slate-700' : 'text-slate-600']"
                    >
                      <template v-if="col.chave === 'status'">
                        <span class="pdf-hide" :class="item.statusClass">{{ item.status }}</span>
                        <span class="pdf-only text-gray-800 font-semibold">{{ item.lido ? 'Lido' : 'Não lido' }}</span>
                      </template>
                      <template v-else-if="col.chave === '_estoque'">
                        <span class="font-mono">{{ item._estoque || 0 }}</span>
                      </template>
                      <template v-else>{{ item[col.chave] }}</template>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <!-- Pagination -->
            <div v-if="totalPaginasModalItens > 1" class="flex items-center justify-between pt-2 border-t border-slate-100 mt-3">
              <p class="text-[11px] text-slate-500">Mostrando {{ ((paginaModalItens - 1) * itensPorPaginaModalItens) + 1 }} a {{ Math.min(paginaModalItens * itensPorPaginaModalItens, modalItensOrdenado.length) }} de {{ modalItensOrdenado.length }}</p>
              <div class="flex items-center gap-1">
                <button @click="paginaModalItens = 1" :disabled="paginaModalItens === 1" class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"><i class="fas fa-angle-double-left"></i></button>
                <button @click="paginaModalItens--" :disabled="paginaModalItens === 1" class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"><i class="fas fa-angle-left"></i></button>
                <template v-for="p in paginasVisiveisFn(totalPaginasModalItens, paginaModalItens)" :key="p">
                  <button v-if="typeof p === 'number'" @click="paginaModalItens = p" class="min-w-[28px] px-2 py-1 rounded text-[11px] font-semibold transition" :class="p === paginaModalItens ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-slate-100 text-slate-600'">{{ p }}</button>
                  <span v-else class="text-slate-400 text-[11px] px-1">...</span>
                </template>
                <button @click="paginaModalItens++" :disabled="paginaModalItens === totalPaginasModalItens" class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"><i class="fas fa-angle-right"></i></button>
                <button @click="paginaModalItens = totalPaginasModalItens" :disabled="paginaModalItens === totalPaginasModalItens" class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"><i class="fas fa-angle-double-right"></i></button>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="bg-gray-50 px-4 py-2 flex justify-between items-center print:hidden">
          <p class="text-sm text-gray-600">Mostrando {{ itensModalFormatados.length }} de {{ itensModal.length }} itens</p>
          <div class="flex items-center gap-2">
            <button
              @click="fecharModalItens"
              class="px-4 py-2 rounded-lg bg-gray-300 text-gray-800 hover:bg-gray-400 transition font-medium"
            >
              Fechar
            </button>
            <button
              @click="handlePrintPDFItens"
              class="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition font-medium"
              title="Baixar PDF"
            >
              <i class="fas fa-file-pdf mr-2"></i> PDF
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Relatório -->
    <div 
      v-if="modalRelatorioAberto"
      class="modal-relatorio-overlay fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      @click.stop="fecharRelatorio"
    >
      <div 
        ref="printAreaRelatorio"
        data-pdf-area="relatorio"
        class="modal-relatorio-container bg-white rounded-lg shadow-2xl w-full max-w-7xl overflow-hidden flex flex-col print:max-w-full print:shadow-none"
        @click.stop
        style="max-height: 95vh;"
      >
        <!-- Header -->
        <div class="bg-blue-700 text-white p-4 flex items-center justify-between print:bg-blue-800">
          <div>
            <h2 class="text-xl font-bold">Relatório de Auditoria</h2>
            <p class="text-blue-100 text-sm">{{ auditoria.tipo }} - {{ dataAuditoriaBR }}</p>
          </div>
          <button
            @click="fecharRelatorio"
            class="text-white hover:opacity-80 transition print:hidden"
          >
            <i class="fas fa-times text-xl"></i>
          </button>
        </div>

        <!-- Content - Compacto para Print -->
        <div class="overflow-y-auto p-6 space-y-6 text-sm bg-slate-50">
          <div ref="resultadoGeralSetorExportRef" class="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
            <div class="bg-blue-700 text-white px-6 py-4 flex items-center justify-between gap-3">
              <h3 class="text-lg font-bold flex items-center gap-2">
                <i class="fas fa-chart-bar"></i>
                Relatório Geral
              </h3>
              <button
                @click="exportarResultadoGeralSetor"
                class="export-button-hidden inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white hover:bg-white/20 transition text-xs font-semibold print:hidden"
              >
                <i class="fas fa-image"></i>
                Salvar imagem
              </button>
            </div>

            <div class="grid grid-cols-1 xl:grid-cols-2 gap-0 bg-slate-50">
              <div class="bg-white border-r border-slate-200 overflow-hidden">
                <div class="p-6">
                  <div class="mb-6 pb-6 border-b border-slate-200">
                    <div class="grid grid-cols-2 gap-4 mb-4">
                      <div class="bg-blue-50 rounded-lg p-3">
                        <p class="text-xs font-semibold text-gray-600 mb-1">Total Auditável</p>
                        <p class="text-2xl font-bold text-blue-700">{{ dadosRelatorio?.resultadoGeral.totalAuditaveis }}</p>
                      </div>
                      <div class="bg-green-50 rounded-lg p-3">
                        <p class="text-xs font-semibold text-gray-600 mb-1">Total Lidos</p>
                        <p class="text-2xl font-bold text-green-700">{{ dadosRelatorio?.resultadoGeral.totalLidos }}</p>
                      </div>
                      <div class="bg-orange-50 rounded-lg p-3">
                        <p class="text-xs font-semibold text-gray-600 mb-1">Pendentes</p>
                        <p class="text-2xl font-bold text-orange-700">{{ dadosRelatorio?.resultadoGeral.pendentes }}</p>
                      </div>
                      <div class="bg-yellow-50 rounded-lg p-3">
                        <p class="text-xs font-semibold text-gray-600 mb-1">Desatualizados</p>
                        <p class="text-2xl font-bold text-yellow-700">{{ dadosRelatorio?.resultadoGeral.desatualizados || 0 }}</p>
                      </div>
                    </div>
                  </div>

                  <div class="space-y-3">
                    <div class="rounded-lg border-2 p-4" :class="dadosRelatorio?.resultadoGeral.percentualPendente <= 3 ? 'border-green-400 bg-green-50' : 'border-orange-400 bg-orange-50'">
                      <p class="text-xs font-bold uppercase tracking-wide mb-1" :class="dadosRelatorio?.resultadoGeral.percentualPendente <= 3 ? 'text-green-700' : 'text-orange-700'">% Pendente</p>
                      <p class="text-4xl font-bold" :class="dadosRelatorio?.resultadoGeral.percentualPendente <= 3 ? 'text-green-600' : 'text-orange-600'">
                        {{ dadosRelatorio?.resultadoGeral.percentualPendente.toFixed(2) }}%
                      </p>
                      <p class="text-xs mt-2" :class="dadosRelatorio?.resultadoGeral.percentualPendente <= 3 ? 'text-green-600 font-semibold' : 'text-orange-600 font-semibold'">
                        Meta: 3%
                      </p>
                    </div>

                    <div class="rounded-lg p-3" :class="dadosRelatorio?.resultadoGeral.faltaParaMeta > 0 ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'">
                      <p class="text-xs font-semibold" :class="dadosRelatorio?.resultadoGeral.faltaParaMeta > 0 ? 'text-red-700' : 'text-green-700'">
                        <i :class="dadosRelatorio?.resultadoGeral.faltaParaMeta > 0 ? 'fas fa-exclamation-circle' : 'fas fa-check-circle'" class="mr-1"></i>
                        <span v-if="dadosRelatorio?.resultadoGeral.faltaParaMeta > 0">
                          Faltam {{ dadosRelatorio?.resultadoGeral.faltaParaMeta.toFixed(2) }}% ({{ dadosRelatorio?.resultadoGeral.itensFaltam }} itens) para meta
                        </span>
                        <span v-else>
                          Meta atingida!
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div class="bg-white overflow-hidden">
                <div class="overflow-hidden">
                  <table class="w-full text-xs">
                    <thead>
                      <tr class="bg-slate-100 border-b border-slate-200">
                        <th class="px-4 py-3 text-left font-bold text-gray-700">Setor</th>
                        <th class="px-3 py-3 text-right font-bold text-gray-700">Pend.</th>
                        <th class="px-3 py-3 text-right font-bold text-gray-700">%</th>
                        <th class="px-3 py-3 text-center font-bold text-gray-700">Classificação</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-200">
                      <tr
                        v-for="setor in dadosRelatorio?.setores"
                        :key="setor.nome"
                        :class="[
                          setor.classificacao === 'Excelente'
                            ? 'bg-green-50 hover:bg-green-100'
                            : setor.classificacao === 'Bom'
                              ? 'bg-emerald-50 hover:bg-emerald-100'
                              : setor.classificacao === 'Regular'
                                ? 'bg-yellow-50 hover:bg-yellow-100'
                                : 'bg-red-50 hover:bg-red-100'
                        ]"
                      >
                        <td class="px-4 py-3 font-medium text-gray-800 truncate">{{ setor.nome }}</td>
                        <td class="px-3 py-3 text-right font-bold" :class="setor.pendentes > 0 ? 'text-orange-600' : 'text-green-600'">{{ setor.pendentes }}</td>
                        <td class="px-3 py-3 text-right font-bold" :class="setor.percentualPendente <= 3 ? 'text-green-600' : 'text-orange-600'">{{ setor.percentualPendente.toFixed(1) }}%</td>
                        <td class="px-3 py-3 text-center">
                          <span class="px-2 py-1 rounded text-xs font-semibold" :class="[
                            setor.classificacao === 'Excelente' ? 'bg-green-200 text-green-800' :
                            setor.classificacao === 'Bom' ? 'bg-emerald-200 text-emerald-800' :
                            setor.classificacao === 'Regular' ? 'bg-yellow-200 text-yellow-800' :
                            'bg-red-200 text-red-800'
                          ]">
                            {{ setor.classificacao }}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <!-- CARD 3: Top 10 Locais com Mais Pendentes (Inferior Esquerda) -->
          <div ref="topLocaisPendentesExportRef" class="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
            <div class="bg-orange-700 text-white px-6 py-4 flex items-center justify-between gap-3">
              <div>
                <h3 class="text-lg font-bold flex items-center gap-2">
                  <i class="fas fa-map-marker-alt"></i>
                  Top 10 Locais com Mais Pendentes
                </h3>
                <p class="text-xs text-orange-100 mt-1">Focos de ação prioritária</p>
              </div>
              <button
                @click="exportarTopLocaisPendentes"
                class="export-button-hidden inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white hover:bg-white/20 transition text-xs font-semibold print:hidden"
              >
                <i class="fas fa-image"></i>
                Salvar imagem
              </button>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-xs">
                <thead>
                  <tr class="bg-slate-100 border-b border-slate-200">
                    <th class="px-4 py-3 text-center font-bold text-gray-700">#</th>
                    <th class="px-4 py-3 text-left font-bold text-gray-700">Local</th>
                    <th class="px-4 py-3 text-right font-bold text-gray-700">Pendentes</th>
                    <th class="px-4 py-3 text-right font-bold text-gray-700">Total</th>
                    <th class="px-4 py-3 text-right font-bold text-gray-700">% Pend</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-200">
                  <tr v-for="(local, i) in (dadosRelatorio?.topLocaisPendentes || []).slice(0, 10)" :key="local.nome" class="hover:bg-orange-50">
                    <td class="px-4 py-3 text-center font-bold text-gray-400">{{ i + 1 }}</td>
                    <td class="px-4 py-3 font-medium text-gray-800">{{ local.nome }}</td>
                    <td class="px-4 py-3 text-right font-bold text-orange-600">{{ local.pendentes }}</td>
                    <td class="px-4 py-3 text-right text-gray-600">{{ local.total }}</td>
                    <td class="px-4 py-3 text-right font-bold text-orange-600">{{ local.percentualPendente.toFixed(1) }}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- CARD 4: Locais Sem Leitura (Abaixo de Tudo) -->
          <div v-if="dadosRelatorio?.locaisSemLeitura.length > 0" class="bg-white rounded-xl shadow-md border border-red-300 overflow-hidden">
            <div class="bg-red-700 text-white px-6 py-4">
              <h3 class="text-lg font-bold flex items-center gap-2">
                <i class="fas fa-exclamation-triangle"></i>
                Locais Sem Leitura ({{ dadosRelatorio?.locaisSemLeitura.length }} locais)
              </h3>
              <p class="text-xs text-red-100 mt-1">Esses locais ainda não tiveram nenhuma leitura nesta auditoria</p>
            </div>
            <div class="p-6">
              <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                <span
                  v-for="local in dadosRelatorio?.locaisSemLeitura"
                  :key="local"
                  class="px-3 py-2 bg-red-100 border border-red-300 text-red-800 rounded-lg text-xs font-medium text-center hover:bg-red-200 transition"
                >
                  {{ local }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="bg-gray-50 px-4 py-2 flex justify-end gap-2 print:hidden">
          <button
            @click="handlePrintRelatorio"
            class="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 transition text-sm font-medium"
          >
            <i class="fas fa-print mr-1"></i>Imprimir
          </button>
          <button
            @click="fecharRelatorio"
            class="px-3 py-1.5 rounded bg-gray-300 text-gray-800 hover:bg-gray-400 transition text-sm font-medium"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>

    <div 
      v-if="modalUsuarioAberto && usuarioDetalhes"
      class="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-8"
      @click.stop="fecharModalUsuario"
    >
      <div 
        class="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        @click.stop
      >
        <div class="bg-blue-700 text-white p-4 flex items-center justify-between">
          <div>
            <h2 class="text-xl font-bold">Detalhes do Usuário</h2>
            <p class="text-sm text-blue-100 mt-1">{{ usuarioDetalhes.nome }}</p>
          </div>
          <button
            @click="fecharModalUsuario"
            class="text-white hover:opacity-80 transition"
          >
            <i class="fas fa-times text-xl"></i>
          </button>
        </div>

        <div class="p-4 space-y-4 overflow-y-auto">
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div class="bg-blue-50 rounded-lg p-3">
              <p class="text-xs text-gray-600">Total lidos</p>
              <p class="text-xl font-bold text-blue-700">{{ usuarioDetalhes.lidos }}</p>
            </div>
            <div class="bg-orange-50 rounded-lg p-3">
              <p class="text-xs text-gray-600">Pendentes</p>
              <p class="text-xl font-bold text-orange-600">{{ usuarioDetalhes.pendentes }}</p>
            </div>
            <div class="bg-red-50 rounded-lg p-3">
              <p class="text-xs text-gray-600">Com problema</p>
              <p class="text-xl font-bold text-red-600">{{ usuarioDetalhes.comProblema }}</p>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="bg-gray-50 rounded-lg p-3">
              <p class="text-xs font-semibold text-gray-700 mb-1">
                Pico de hora
              </p>
              <div v-if="usuarioDetalhes.picoHora">
                <p class="text-lg font-bold text-blue-700">
                  {{ usuarioDetalhes.picoHora }}
                </p>
                <p class="text-xs text-gray-500">
                  {{ usuarioDetalhes.picoQtd }} leituras nesse horário
                </p>
              </div>
              <div v-else class="text-xs text-gray-500">
                Sem dados suficientes para horário de pico.
              </div>
            </div>

            <div class="bg-gray-50 rounded-lg p-3">
              <p class="text-xs font-semibold text-gray-700 mb-1">
                Locais mais lidos
              </p>
              <div v-if="usuarioDetalhes.locaisTop && usuarioDetalhes.locaisTop.length > 0" class="space-y-1">
                <div
                  v-for="l in usuarioDetalhes.locaisTop"
                  :key="l.local"
                  class="flex justify-between text-xs"
                >
                  <span class="font-mono text-gray-800 mr-2">
                    {{ l.local }}
                  </span>
                  <span class="font-semibold text-purple-600">
                    {{ l.contagem }} leituras
                  </span>
                </div>
              </div>
              <div v-else class="text-xs text-gray-500">
                Nenhum local com leitura registrada.
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="bg-red-50 rounded-lg p-3 border border-red-100">
              <p class="text-xs font-semibold text-red-700 mb-1">
                Estoque zero
              </p>
              <p class="text-xs text-gray-700 mb-2">
                {{ usuarioDetalhes.estoqueZeroQtd }} item(s) com leitura e estoque zero.
              </p>
              <div v-if="usuarioDetalhes.estoqueZero && usuarioDetalhes.estoqueZero.length > 0" class="space-y-1 max-h-40 overflow-y-auto text-xs">
                <div
                  v-for="i in usuarioDetalhes.estoqueZero"
                  :key="i.codigo + '-' + i.local"
                  class="flex justify-between"
                >
                  <span class="font-mono text-gray-800 mr-2">
                    {{ i.codigo }}
                  </span>
                  <span class="text-gray-600 truncate">
                    {{ i.local }}
                  </span>
                </div>
              </div>
            </div>

            <div class="bg-yellow-50 rounded-lg p-3 border border-yellow-100">
              <p class="text-xs font-semibold text-yellow-700 mb-1">
                Lido não pertence
              </p>
              <p class="text-xs text-gray-700 mb-2">
                {{ usuarioDetalhes.lidoNaoPertenceQtd }} item(s) lidos em local diferente.
              </p>
              <div v-if="usuarioDetalhes.lidoNaoPertence && usuarioDetalhes.lidoNaoPertence.length > 0" class="space-y-1 max-h-40 overflow-y-auto text-xs">
                <div
                  v-for="i in usuarioDetalhes.lidoNaoPertence"
                  :key="i.codigo + '-' + i.local"
                  class="flex justify-between"
                >
                  <span class="font-mono text-gray-800 mr-2">
                    {{ i.codigo }}
                  </span>
                  <span class="text-gray-600 truncate">
                    {{ i.local }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<style>
.pdf-sanitize, .pdf-sanitize * {
  background: #ffffff !important;
  background-color: #ffffff !important;
  background-image: none !important;
  color: #111827 !important;
  border-color: #e5e7eb !important;
  box-shadow: none !important;
}
.pdf-sanitize table thead {
  background-color: #f3f4f6 !important;
}
.pdf-sanitize .text-green-600 { color: #16a34a !important; }
.pdf-sanitize .text-red-600 { color: #dc2626 !important; }
.pdf-sanitize .text-blue-600 { color: #2563eb !important; }
.pdf-sanitize .text-gray-600 { color: #4b5563 !important; }
/* Compactação e bordas para melhor leitura no PDF */
.pdf-sanitize table {
  border-collapse: collapse !important;
  width: 100% !important;
  font-size: 11px !important;
  line-height: 1.2 !important;
}
.pdf-sanitize th, .pdf-sanitize td {
  border: 1px solid #e5e7eb !important;
  padding: 5px 6px !important;
  vertical-align: middle !important;
}
.modal-relatorio-overlay {
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}
@media print {
  @page {
    size: A4 landscape;
    margin: 10mm;
  }
  body {
    margin: 0;
    padding: 0;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
  .modal-relatorio-overlay {
    position: static !important;
    inset: auto !important;
    background: transparent !important;
    padding: 0 !important;
    align-items: stretch !important;
    justify-content: flex-start !important;
  }
  .modal-relatorio-container {
    box-shadow: none !important;
    border-radius: 0 !important;
    max-width: 100% !important;
    width: 100% !important;
    max-height: 100% !important;
  }
}
.pdf-sanitize .pdf-hide {
  display: none !important;
}
.pdf-print-show {
  display: none;
}
.pdf-sanitize .pdf-print-show {
  display: block !important;
}
.pdf-only {
  display: none;
}
.pdf-sanitize .pdf-only {
  display: table-cell !important;
}
.pdf-sanitize .sticky {
  position: static !important;
  top: auto !important;
}
.pdf-sanitize .overflow-y-auto {
  overflow: visible !important;
  max-height: none !important;
}
</style>
