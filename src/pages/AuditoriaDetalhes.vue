<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuditoriasStore } from '../stores/auditoriasStore'
import UploadAnaliseAuditoria from '../components/UploadAnaliseAuditoria.vue'
import ModalMetrica from '../components/ModalMetrica.vue'
import ModalSetorLocal from '../components/ModalSetorLocal.vue'
import ComparativoAnterior from '../components/ComparativoAnterior.vue'
import AbaUsuariosAuditoria from '../components/AbaUsuariosAuditoria.vue'
import RelatorioAuditoria from '../components/RelatorioAuditoria.vue'
import MapaLoja from '../components/MapaLoja.vue'
import NavAbasAuditoria from '../components/NavAbasAuditoria.vue'
import UiModal from '../components/ui/UiModal.vue'
import UiListaItens from '../components/ui/UiListaItens.vue'
import { isItemLido } from '../utils/itemLido'
import { printTableInNewWindow, blocoBarras, blocoTabela, imprimirRelatorioVisual } from '../utils/print'
import { extrairDataISOPlanilha, extrairHoraPlanilha } from '../utils/auditoriaHorario'
import { analisarSinaisAuditoria } from '../utils/sinaisAuditoria'
import { baixarCsv } from '../utils/csv'
import { rotuloUsuario, separarUsuario } from '../utils/usuario'

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

// A aba fica na URL (?aba=mapa): recarregar ou compartilhar o link mantém a seção.
const ABAS_VALIDAS = ['dashboard', 'mapa', 'usuarios', 'dados', 'estatisticas', 'atencao']
const abaAtiva = computed({
  get: () => (ABAS_VALIDAS.includes(route.query.aba) ? route.query.aba : 'dashboard'),
  set: valor => {
    const query = { ...route.query }
    if (valor === 'dashboard') delete query.aba
    else query.aba = valor
    router.replace({ query })
  }
})
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
const ordenacaoItens = ref({ coluna: 'Código', direcao: 'asc' })
const modalUsuarioAberto = ref(false)
const usuarioSelecionado = ref(null)
const mostrarUploadSubstituir = ref(false)
const skuSubstituir = ref('')
const modalItensAberto = ref(false)
const itensModal = ref([])
const tituloModalItens = ref('')
const editandoSku = ref(false)
const skuEditavel = ref('')
const filtroHorarioUsuario = ref('todos')
const filtroHorarioSetor = ref('todos')
const filtroAndamentoSetor = ref('todos')

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
  estoqueZero: false,    // Data: Estoque Zero starts expanded
  lidoWrong: false,      // Data: Local Errado starts expanded
  grandeEstoque: true,   // Data: Grande Estoque starts collapsed
  tempoSemLeitura: true  // Data: Tempo sem Leitura starts collapsed
})

// UI/UX Improvements - Filter states

const abasDetalhes = computed(() => {
  const usuarios = auditoria.value?.analise?.usuarios?.length || Object.keys(auditoria.value?.analise?.porUsuario || {}).length
  const alertas = sinaisAuditoria.value?.sinais?.length || 0
  return [
    { value: 'dashboard', label: 'Visão geral', icon: 'fas fa-chart-line' },
    { value: 'mapa', label: 'Mapa da loja', icon: 'fas fa-map-location-dot' },
    { value: 'usuarios', label: 'Usuários', icon: 'fas fa-users', badge: usuarios || null },
    { value: 'dados', label: 'Dados', icon: 'fas fa-database' },
    { value: 'estatisticas', label: 'Estatísticas', icon: 'fas fa-chart-bar' },
    // Aba de uso restrito: só aparece quando aberta pelo endereço (?aba=atencao).
    ...(abaAtiva.value === 'atencao' ? [{ value: 'atencao', label: 'Atenção', icon: 'fas fa-triangle-exclamation', badge: alertas || null, tom: 'alerta' }] : [])
  ]
})
const resumoNavegacao = computed(() => {
  const pendente = metricasGerais.value?.percentualPendente ?? 0
  return { titulo: `${auditoria.value?.tipo || ''} · ${dataAuditoriaBR.value}`, pendente: `${pendente.toFixed(2)}% pendente`, naMeta: pendente <= 3 }
})

const sinaisAuditoria = computed(() => analisarSinaisAuditoria(auditoria.value?.dados, auditoria.value?.data, {
  tipoAuditoria: auditoria.value?.tipo,
  historico: store.auditorias.filter(item => item.id !== auditoria.value?.id)
}))

const exportarRegistrosSinal = sinal => {
  const colunas = [
    ['linhaPlanilha', 'Linha da planilha'], ['dataHora', 'Data e hora'], ['codigo', 'Código'], ['produto', 'Produto'], ['classe', 'Classe de produto'],
    ['local', 'Local'], ['ultimoLocal', 'Local no histórico'], ['dataUltimaAuditoria', 'Data da auditoria anterior'], ['idUltimaAuditoria', 'ID da auditoria anterior'],
    ['usuario', 'Usuário'], ['situacao', 'Situação'], ['estoque', 'Estoque'],
    ['diasSemVenda', 'Dias sem venda'], ['colunaData', 'Coluna de data'], ['colunaHora', 'Coluna de hora']
  ]
  baixarCsv(sinal.registros, colunas, `auditoria-${auditoria.value?.id || 'sem-id'}-${sinal.tipo}.csv`)
}

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

const toHour = extrairHoraPlanilha

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
const serialToDateISO = extrairDataISOPlanilha

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


const leituraPorHoraFiltrada = computed(() => {
  if (!auditoria.value?.dados) return null
  const dados = auditoria.value.dados
  const auditoriaDia = String(auditoria.value.data || '').slice(0, 10)

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

  // Construir a série do mapa de quantidade.
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

const isItemConcluidoNaAuditoria = (item) => {
  if (!item) return false
  const situacao = normalizar(item._situacao || item['Situação'] || item['Situação atual da auditoria'] || '')
  if (
    item._lidoNaoPertence === true ||
    situacao.includes('lido nao pertence') ||
    situacao.includes('lido sem estoque')
  ) return false

  if (auditoria.value?.tipo === 'Etiqueta') {
    return situacao.includes('atualizado') || situacao.includes('desatualizado')
  }

  if (item._temPresenca !== true) return false
  if (item._temEstoqueSituacao === false) return false
  if (item._estoque !== undefined && Number(item._estoque) <= 0) return false
  return true
}

// Evolução acumulada da auditoria, com visão geral ou recorte por setor.
const andamentoAuditoriaPorHora = computed(() => {
  if (!auditoria.value?.dados || !metricasGerais.value?.totalItens) return null

  const auditoriaDia = String(auditoria.value.data || '').slice(0, 10)
  const setorSelecionado = filtroAndamentoSetor.value
  const dadosSetor = setorSelecionado !== 'todos'
    ? auditoria.value.analise?.porSetor?.[setorSelecionado]
    : null
  const totalAuditavel = setorSelecionado === 'todos'
    ? Number(metricasGerais.value.totalItens || 0)
    : Number((dadosSetor?.lidos || 0) + (dadosSetor?.pendentes || 0))
  const totalLidosAtual = setorSelecionado === 'todos'
    ? Number(metricasGerais.value.totalLidos || 0)
    : Number(dadosSetor?.lidos || 0)

  if (totalAuditavel <= 0) return null

  const contagem = {}
  for (let h = 0; h <= 23; h++) contagem[h] = 0

  auditoria.value.dados.forEach(item => {
    if (setorSelecionado !== 'todos' && getSetorItem(item) !== setorSelecionado) return
    if (!isItemConcluidoNaAuditoria(item)) return
    if (auditoriaDia) {
      const dataItemISO = getItemDateISO(item)
      if (dataItemISO && dataItemISO !== auditoriaDia) return
    }
    const hora = getItemHour(item)
    if (hora != null && hora >= 0 && hora <= 23) contagem[hora]++
  })

  let acumulado = 0
  const serie = []
  for (let h = 0; h <= 23; h++) {
    const leituras = contagem[h] || 0
    acumulado += leituras
    serie.push({
      hora: `${String(h).padStart(2, '0')}:00`,
      leituras,
      acumulado,
      percentual: totalAuditavel > 0 ? Math.min(100, (acumulado / totalAuditavel) * 100) : 0
    })
  }

  const primeiroIdx = serie.findIndex(ponto => ponto.leituras > 0)
  let ultimoIdx = -1
  for (let i = serie.length - 1; i >= 0; i--) {
    if (serie[i].leituras > 0) { ultimoIdx = i; break }
  }
  if (primeiroIdx < 0 || ultimoIdx < 0) {
    return {
      serie: [],
      totalAuditavel,
      totalComHorario: 0,
      semHorario: totalLidosAtual,
      percentualFinal: totalAuditavel > 0 ? Math.min(100, (totalLidosAtual / totalAuditavel) * 100) : 0
    }
  }

  const semHorario = Math.max(0, totalLidosAtual - acumulado)
  const serieVisivel = serie.slice(Math.max(0, primeiroIdx - 1), Math.min(serie.length, ultimoIdx + 2))
  if (semHorario > 0) {
    serieVisivel.push({
      hora: 'Sem horário',
      leituras: semHorario,
      acumulado: totalLidosAtual,
      percentual: totalAuditavel > 0 ? Math.min(100, (totalLidosAtual / totalAuditavel) * 100) : 0
    })
  }

  return {
    serie: serieVisivel,
    totalAuditavel,
    totalComHorario: acumulado,
    semHorario,
    percentualFinal: totalAuditavel > 0 ? Math.min(100, (totalLidosAtual / totalAuditavel) * 100) : 0
  }
})

const niveisGraficoAndamento = [100, 75, 50, 25, 0]
const graficoAndamento = computed(() => {
  const serie = andamentoAuditoriaPorHora.value?.serie || []
  if (serie.length === 0) return null

  const largura = 1000
  const altura = 300
  const margem = { esquerda: 55, direita: 25, topo: 25, base: 55 }
  const larguraUtil = largura - margem.esquerda - margem.direita
  const alturaUtil = altura - margem.topo - margem.base
  const divisor = Math.max(1, serie.length - 1)
  const pontos = serie.map((ponto, indice) => ({
    ...ponto,
    rotulo: ponto.hora === 'Sem horário' ? 'Atual' : ponto.hora,
    x: margem.esquerda + (indice / divisor) * larguraUtil,
    y: margem.topo + ((100 - Math.min(100, ponto.percentual)) / 100) * alturaUtil
  }))

  return {
    largura,
    altura,
    margem,
    alturaUtil,
    pontos,
    linha: pontos.map(ponto => `${ponto.x},${ponto.y}`).join(' '),
    area: `${margem.esquerda},${margem.topo + alturaUtil} ${pontos.map(ponto => `${ponto.x},${ponto.y}`).join(' ')} ${pontos[pontos.length - 1].x},${margem.topo + alturaUtil}`
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
  if (leituraPorHoraFiltrada.value) {
    const { serie } = leituraPorHoraFiltrada.value
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

// Lista usada na impressão da aba Usuários (mais leituras primeiro).
const usuariosFiltrados = computed(() => [...dadosUsuarios.value].sort((x, y) => y.totalLidos - x.totalLidos))

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

  let horas = []
  let rotulosHoras = []
  if (leiturasPorUsuarioHora.value) {
    rotulosHoras = leiturasPorUsuarioHora.value.labels
    horas = leiturasPorUsuarioHora.value.usuarios.find(u => u.nome === nome)?.horas || rotulosHoras.map(() => 0)
  }
  const locaisDoUsuario = new Set((auditoria.value.dados || []).filter(i => (i['Usuário'] || '').toString().trim() === nome && isItemLido(i)).map(i => (i['Local'] || '').toString().trim()))

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
    locaisTop,
    horas,
    rotulosHoras,
    maxHora: Math.max(1, ...horas),
    qtdLocais: locaisDoUsuario.size,
    problemas: [
      ...itensEstoqueZero.map(i => ({ ...i, motivo: 'Estoque Zero' })),
      ...itensLidoNaoPertence.map(i => ({ ...i, motivo: 'Local Errado' }))
    ]
  }
})

const abrirModalUsuario = (nome) => {
  usuarioSelecionado.value = nome
  modalUsuarioAberto.value = true
}

// Lista do modal de itens de um local (UiListaItens).
const setorDoItem = item => (item['Classe de Produto Raiz'] || item['Setor'] || '').toString().trim()
// Vazio quando a planilha não traz a coluna (ex.: Etiqueta).
const diasSemVendaDoItem = item => {
  const bruto = item['Dias sem venda'] ?? item['Dias sem Venda']
  if (bruto === undefined || bruto === null || String(bruto).trim() === '') return ''
  const dias = Number(String(bruto).replace(',', '.'))
  return Number.isFinite(dias) ? dias : String(bruto)
}
// Mesma regra do modal anterior: ignora itens sem presença e sem estoque.
const itensModalLista = computed(() => (itensModal.value || [])
  .filter(item => !isSemPresencaSemEstoque(item))
  .map(item => {
    const tem = item._temPresenca !== undefined ? item._temPresenca : temPresencaConfirmada(item)
    return { ...item, status: tem ? 'Lido' : 'Pendente' }
  }))
const resumoItensModal = computed(() => {
  const lidos = itensModalLista.value.filter(i => i.status === 'Lido').length
  const pendentes = itensModalLista.value.length - lidos
  return { lidos, pendentes, perc: itensModalLista.value.length ? (pendentes / itensModalLista.value.length) * 100 : 0 }
})
const colunasListaItens = [
  { chave: 'Código', titulo: 'Código' },
  { chave: 'Produto', titulo: 'Produto', largura: 'max-w-72' },
  { chave: 'setor', titulo: 'Setor', valor: setorDoItem, largura: 'max-w-44' },
  { chave: 'Usuário', titulo: 'Usuário' },
  { chave: '_estoque', titulo: 'Estoque', alinhamento: 'right', valor: i => Number(i._estoque || 0) },
  { chave: 'diasSemVenda', titulo: 'Dias sem venda', alinhamento: 'right', valor: diasSemVendaDoItem },
  { chave: 'status', titulo: 'Status', alinhamento: 'center', badge: v => (v === 'Lido' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700') }
]
const facetasListaItens = [
  { chave: 'status', titulo: 'Status' },
  { chave: 'setor', titulo: 'Setor', valor: setorDoItem },
  { chave: 'Usuário', titulo: 'Usuário' }
]

// Abre o mapa histórico (aba Usuários) no usuário do modal.
const usuarioTrajeto = ref('')
const verTrajetoUsuario = async (nome) => {
  usuarioTrajeto.value = nome
  fecharModalUsuario()
  abaAtiva.value = 'usuarios'
  await nextTick()
  document.getElementById('trajeto-usuario')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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

  // Fallback de desatualizados calculado em uma única passada pelos itens.
  let desatualizadosPorSetor = null
  const contarDesatualizados = (setor) => {
    if (!desatualizadosPorSetor) {
      desatualizadosPorSetor = new Map()
      for (const item of Array.isArray(auditoria.value?.dados) ? auditoria.value.dados : []) {
        const s = normalizar(item['Situação'] || item['Situação atual da auditoria'] || item._situacao || '')
        if (!s.includes('desatualizad')) continue
        const set = String(item['Classe de Produto Raiz'] || 'Não especificado').trim()
        desatualizadosPorSetor.set(set, (desatualizadosPorSetor.get(set) || 0) + 1)
      }
    }
    return desatualizadosPorSetor.get(setor) || 0
  }

  return Object.entries(analise.porSetor)
    .map(([setor, dados]) => {
      const lidos = dados.lidos || 0
      const pendentes = dados.pendentes || 0
      const comProblema = dados.comProblema || 0
      let desatualizados = dados.desatualizados || 0
      if (desatualizados === 0) desatualizados = contarDesatualizados(setor)
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
  const dadosCompletos = Array.isArray(auditoria.value.dados) ? auditoria.value.dados : []

  // Agrupa uma única vez por local (antes era O(locais × itens)).
  const itensPorLocal = new Map()
  const desatualizadosPorLocal = new Map()
  for (const item of dadosCompletos) {
    const itemLocal = (item['Local'] || 'Não especificado').toString().trim()
    let lista = itensPorLocal.get(itemLocal)
    if (!lista) itensPorLocal.set(itemLocal, (lista = []))
    lista.push(item)
    const s = normalizar(item['Situação'] || item['Situação atual da auditoria'] || item._situacao || '')
    if (s.includes('desatualizad')) desatualizadosPorLocal.set(itemLocal, (desatualizadosPorLocal.get(itemLocal) || 0) + 1)
  }

  const locais = Object.entries(analise.porLocal)
    .map(([local, dados]) => {
      const lidos = dados.lidos || 0
      const pendentes = dados.pendentes || 0
      const nomeLocal = (local || 'Não especificado').toString().trim()
      const comProblema = dados.comProblema || 0
      const totalLidos = lidos + comProblema
      const total = lidos + pendentes + comProblema

      const desatualizados = desatualizadosPorLocal.get(nomeLocal) || 0
      const itensDoLocal = itensPorLocal.get(nomeLocal) || []
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
  ordenacaoItens.value = { coluna: 'Código', direcao: 'asc' }
}


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
  const lista = usuariosFiltrados.value
  if (!lista.length) return
  const totalLeituras = lista.reduce((s, u) => s + u.totalLidos, 0)
  imprimirRelatorioVisual({
    titulo: `Usuários · ${auditoria.value?.tipo || 'Auditoria'}`,
    subtitulo: `${dataAuditoriaBR.value} · ${lista.length} usuário(s)`,
    indicadores: [
      { rotulo: 'Usuários', valor: lista.length },
      { rotulo: 'Leituras', valor: totalLeituras },
      { rotulo: 'Média por usuário', valor: Math.round(totalLeituras / lista.length) },
      { rotulo: 'Com problema', valor: lista.reduce((s, u) => s + u.comProblema, 0), tom: 'alerta' }
    ],
    blocos: [
      blocoBarras({ titulo: 'Leituras por usuário', barras: lista.slice(0, 20).map(u => ({ rotulo: rotuloUsuario(u.nome), valor: u.totalLidos, texto: `${u.totalLidos} · ${u.percentualAuditoria.toFixed(1)}%` })) }),
      blocoTabela({
        titulo: 'Detalhamento',
        colunas: [
          { chave: 'matricula', titulo: 'Matrícula' }, { chave: 'nomeExibicao', titulo: 'Nome' }, { chave: 'lidos', titulo: 'Lidos corretamente', alinhamento: 'right' },
          { chave: 'comProblema', titulo: 'Com problema', alinhamento: 'right' },
          { chave: 'percentualProblema', titulo: '% Problemas', alinhamento: 'right', format: v => `${v.toFixed(1)}%`, barra: { max: Math.max(5, ...lista.map(u => u.percentualProblema)), tom: v => (v > 5 ? 'ruim' : v > 2 ? 'alerta' : 'bom') } },
          { chave: 'totalLidos', titulo: 'Total lidos', alinhamento: 'right' },
          { chave: 'percentualAuditoria', titulo: '% da auditoria', alinhamento: 'right', format: v => `${v.toFixed(1)}%` }
        ],
        linhas: lista.map(u => ({ ...u, matricula: separarUsuario(u.nome).matricula || '—', nomeExibicao: separarUsuario(u.nome).nome || u.nome }))
      })
    ]
  })
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
    <div class="bg-blue-700 py-5 text-white">
      <div class="ui-container flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button 
            @click="voltar" 
            class="mb-2 inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium text-blue-100 transition hover:bg-white/10 hover:text-white"
          >
            <i class="fas fa-arrow-left"></i> 
            <span>Voltar</span>
          </button>
          <h1 class="text-3xl font-bold tracking-tight">{{ auditoria.tipo }}</h1>
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
            <div class="text-4xl font-black tracking-tight">{{ (metricasGerais?.percentualPendente ?? auditoria.analise?.parcialPercentual ?? 0).toFixed(2) }}%</div>
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

    <div v-if="ehBackupRegional" class="ui-container mt-4">
      <div class="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900 ring-1 ring-blue-100">
        <i class="fas fa-building mr-2 text-blue-600"></i>
        Dados migrados do backup regional {{ auditoria.analise?.regional?.regiao || '' }}. Os registros desta auditoria representam lojas consolidadas.
      </div>
    </div>

    <NavAbasAuditoria v-model="abaAtiva" :items="abasDetalhes" :resumo="resumoNavegacao" @relatorio="abrirRelatorio" />

    <!-- Conteúdo -->
    <div class="ui-container py-6">
      <section v-if="abaAtiva === 'atencao'" class="space-y-5" aria-label="Pontos de atenção da auditoria">
        <div class="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
          <h2 class="text-xl font-bold">Leituras para revisão <span class="ml-2 rounded-full bg-amber-100 px-2.5 py-1 align-middle text-xs font-semibold">{{ sinaisAuditoria.sinais.length }} alertas</span></h2>
          <p class="mt-2 text-sm leading-relaxed">Os alertas indicam registros fora do padrão; não comprovam fraude. Confira a planilha original e o contexto operacional antes de concluir.</p>
          <p class="mt-2 text-xs text-amber-800">{{ sinaisAuditoria.base }} Horários usam a data e a hora registradas na própria linha, sem presumir meia-noite para uma data sem hora.</p>
        </div>

        <div class="grid gap-3 sm:grid-cols-4" aria-label="Cobertura da análise">
          <div class="rounded-xl border border-slate-200 bg-white p-4"><p class="text-xs text-slate-500">Leituras</p><p class="mt-1 text-2xl font-bold text-slate-900">{{ sinaisAuditoria.totalLeituras }}</p></div>
          <div class="rounded-xl border border-slate-200 bg-white p-4"><p class="text-xs text-slate-500">Com data, hora e usuário</p><p class="mt-1 text-2xl font-bold text-emerald-700">{{ sinaisAuditoria.leiturasComHorario }}</p></div>
          <div class="rounded-xl border border-slate-200 bg-white p-4"><p class="text-xs text-slate-500">Sem dados para análise temporal</p><p class="mt-1 text-2xl font-bold text-amber-700">{{ sinaisAuditoria.leiturasSemHorario }}</p></div>
          <div class="rounded-xl border border-slate-200 bg-white p-4"><p class="text-xs text-slate-500">Auditorias anteriores comparáveis</p><p class="mt-1 text-2xl font-bold text-blue-700">{{ sinaisAuditoria.auditoriasHistoricas }}</p></div>
        </div>
        <p v-if="!sinaisAuditoria.auditoriasHistoricas" class="text-xs text-slate-500">Sem auditorias anteriores do mesmo tipo nesta base local. Os alertas desta auditoria continuam disponíveis, mas a comparação histórica não é calculada.</p>

        <div v-if="!sinaisAuditoria.sinais.length" class="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600">
          <p class="font-semibold text-slate-800">Nenhum ponto de atenção pelos critérios atuais</p>
          <p class="mt-1 text-sm">A ausência de alerta não substitui a conferência habitual.</p>
        </div>

        <div v-else class="grid gap-4">
          <article v-for="(sinal, indice) in sinaisAuditoria.sinais" :key="`${sinal.tipo}-${sinal.usuario || indice}`" class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div class="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <h3 class="text-lg font-bold text-slate-900">{{ sinal.titulo }}</h3>
                <p v-if="sinal.usuario" class="text-sm text-slate-600">Usuário: {{ sinal.usuario }}</p>
                <p v-if="sinal.periodo" class="mt-1 text-sm font-medium text-slate-700">Intervalo: {{ sinal.periodo }}</p>
              </div>
              <span class="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">{{ sinal.quantidade }} leituras</span>
            </div>
            <div class="px-5 py-4">
              <p class="text-sm text-slate-700">{{ sinal.resumo }}</p>
              <div v-if="sinal.comparacao" class="mt-3 grid gap-2 sm:grid-cols-2">
                <div v-for="bloco in sinal.comparacao" :key="bloco.periodo" class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p class="text-xs font-semibold text-slate-600">{{ bloco.periodo }}</p>
                  <p class="mt-1 text-sm text-slate-800"><strong>{{ bloco.equipe }}</strong> leituras da equipe · <strong>{{ bloco.usuario }}</strong> deste usuário</p>
                </div>
              </div>
              <p class="mt-2 text-xs text-slate-500">Critério: {{ sinal.criterio }}</p>
              <div v-if="sinal.contextoHistorico?.length" class="mt-3 rounded-xl bg-blue-50 px-4 py-3 text-xs text-blue-900">
                <p v-for="(linha, contextoIndice) in sinal.contextoHistorico" :key="contextoIndice" class="mt-1 first:mt-0">{{ linha }}</p>
                <details v-if="sinal.referencias?.length" class="mt-2">
                  <summary class="cursor-pointer font-semibold">Ver auditorias usadas na comparação</summary>
                  <div class="mt-2 overflow-x-auto"><table class="min-w-full text-left"><thead><tr><th class="px-2 py-1">Data</th><th class="px-2 py-1">Auditoria</th><th class="px-2 py-1">Máximo em 30 min</th><th class="px-2 py-1">Classes em 30 min</th></tr></thead><tbody><tr v-for="ref in sinal.referencias" :key="`${ref.id}-${ref.data}`"><td class="px-2 py-1">{{ ref.data }}</td><td class="px-2 py-1">#{{ ref.id }}</td><td class="px-2 py-1">{{ ref.maximo30 }}</td><td class="px-2 py-1">{{ ref.classes30 }}</td></tr></tbody></table></div>
                </details>
              </div>
              <details class="mt-4">
                <summary class="cursor-pointer text-sm font-semibold text-blue-700">Conferir registros ({{ sinal.registros.length }})</summary>
                <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p class="text-xs text-slate-500">{{ sinal.registros.length > 100 ? 'Mostrando os primeiros 100 registros. O CSV contém todos.' : 'Dados preservados da planilha importada.' }} A linha de origem aparece quando foi preservada na importação.</p>
                  <button type="button" class="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50" @click="exportarRegistrosSinal(sinal)">Baixar registros CSV</button>
                </div>
                <div class="mt-3 max-h-96 overflow-auto rounded-lg border border-slate-200">
                  <table class="min-w-full text-left text-xs">
                    <thead class="sticky top-0 bg-slate-50 text-slate-600"><tr>
                      <th class="px-3 py-2">Linha</th><th class="px-3 py-2">Data e hora</th><th class="px-3 py-2">Código</th><th class="px-3 py-2">Produto</th><th class="px-3 py-2">Classe</th><th class="px-3 py-2">Local</th>
                      <th v-if="sinal.tipo === 'retomada' || sinal.tipo === 'historico'" class="px-3 py-2">Local anterior</th><th class="px-3 py-2">Usuário</th>
                      <th v-if="sinal.tipo === 'excecoes'" class="px-3 py-2">Situação</th>
                      <th v-if="sinal.tipo === 'estoque'" class="px-3 py-2">Estoque</th><th v-if="sinal.tipo === 'estoque'" class="px-3 py-2">Dias sem venda</th>
                    </tr></thead>
                    <tbody class="divide-y divide-slate-100 text-slate-700">
                      <tr v-for="(item, itemIndice) in sinal.registros.slice(0, 100)" :key="`${item.codigo}-${itemIndice}`">
                        <td class="px-3 py-2">{{ item.linhaPlanilha ?? '—' }}</td><td class="whitespace-nowrap px-3 py-2">{{ item.dataHora }}</td><td class="px-3 py-2">{{ item.codigo }}</td><td class="px-3 py-2">{{ item.produto }}</td><td class="px-3 py-2">{{ item.classe }}</td><td class="px-3 py-2">{{ item.local }}</td>
                        <td v-if="sinal.tipo === 'retomada' || sinal.tipo === 'historico'" class="px-3 py-2">{{ item.ultimoLocal || '—' }}</td><td class="px-3 py-2">{{ item.usuario }}</td>
                        <td v-if="sinal.tipo === 'excecoes'" class="px-3 py-2">{{ item.situacao }}</td>
                        <td v-if="sinal.tipo === 'estoque'" class="px-3 py-2">{{ item.estoque }}</td><td v-if="sinal.tipo === 'estoque'" class="px-3 py-2">{{ item.diasSemVenda }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
          </article>
        </div>
      </section>

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

          <ComparativoAnterior :auditoria="auditoria" :historico="store.auditorias" />

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

          <!-- Andamento acumulado da auditoria completa por horário -->
          <div v-if="auditoria?.dados?.length" class="bg-white/80 backdrop-blur rounded-2xl p-6 shadow-sm">
            <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
              <div>
                <h3 class="font-bold text-lg text-gray-800 flex items-center gap-2">
                  <span class="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-violet-50 text-violet-600">
                    <i class="fas fa-chart-line text-sm"></i>
                  </span>
                  Andamento da Auditoria por Horário
                </h3>
                <p class="text-xs text-slate-400 mt-1">Percentual acumulado ao longo do dia{{ filtroAndamentoSetor === 'todos' ? ' na auditoria completa' : ` no setor ${filtroAndamentoSetor}` }}.</p>
              </div>
              <div class="flex flex-col sm:flex-row gap-2 sm:items-center">
                <select
                  v-model="filtroAndamentoSetor"
                  class="px-3 py-2 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500 max-w-xs"
                  aria-label="Filtrar andamento por setor"
                >
                  <option value="todos">Todos os setores</option>
                  <option v-for="s in Object.keys(auditoria?.analise?.porSetor || {})" :key="s" :value="s">{{ s }}</option>
                </select>
                <div v-if="andamentoAuditoriaPorHora" class="rounded-xl bg-violet-50 px-4 py-2 text-right shrink-0">
                  <p class="text-[10px] font-semibold uppercase tracking-wide text-violet-500">Progresso atual</p>
                  <p class="text-xl font-bold text-violet-700">{{ andamentoAuditoriaPorHora.percentualFinal.toFixed(2) }}%</p>
                </div>
              </div>
            </div>

            <div v-if="graficoAndamento" class="overflow-x-auto">
              <div class="min-w-[720px]">
                <svg
                  class="w-full h-auto"
                  :viewBox="`0 0 ${graficoAndamento.largura} ${graficoAndamento.altura}`"
                  role="img"
                  :aria-label="`Evolução percentual por horário para ${filtroAndamentoSetor === 'todos' ? 'todos os setores' : filtroAndamentoSetor}`"
                >
                  <defs>
                    <linearGradient id="andamento-area" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stop-color="#8b5cf6" stop-opacity="0.28" />
                      <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0.02" />
                    </linearGradient>
                  </defs>

                  <g v-for="nivel in niveisGraficoAndamento" :key="nivel">
                    <line
                      :x1="graficoAndamento.margem.esquerda"
                      :x2="graficoAndamento.largura - graficoAndamento.margem.direita"
                      :y1="graficoAndamento.margem.topo + ((100 - nivel) / 100) * graficoAndamento.alturaUtil"
                      :y2="graficoAndamento.margem.topo + ((100 - nivel) / 100) * graficoAndamento.alturaUtil"
                      stroke="#e2e8f0"
                      stroke-width="1"
                    />
                    <text
                      :x="graficoAndamento.margem.esquerda - 10"
                      :y="graficoAndamento.margem.topo + ((100 - nivel) / 100) * graficoAndamento.alturaUtil + 4"
                      text-anchor="end"
                      class="fill-slate-400 text-[11px]"
                    >{{ nivel }}%</text>
                  </g>

                  <polygon :points="graficoAndamento.area" fill="url(#andamento-area)" />
                  <polyline
                    :points="graficoAndamento.linha"
                    fill="none"
                    stroke="#7c3aed"
                    stroke-width="4"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />

                  <g v-for="p in graficoAndamento.pontos" :key="`ponto-${p.rotulo}`">
                    <line
                      :x1="p.x"
                      :x2="p.x"
                      :y1="p.y"
                      :y2="graficoAndamento.margem.topo + graficoAndamento.alturaUtil"
                      stroke="#c4b5fd"
                      stroke-width="1"
                      stroke-dasharray="3 4"
                    />
                    <circle :cx="p.x" :cy="p.y" r="6" fill="#ffffff" stroke="#7c3aed" stroke-width="4" />
                    <text :x="p.x" :y="Math.max(14, p.y - 13)" text-anchor="middle" class="fill-violet-700 text-[11px] font-bold">
                      {{ p.percentual.toFixed(1) }}%
                    </text>
                    <text :x="p.x" :y="graficoAndamento.altura - 22" text-anchor="middle" class="fill-slate-500 text-[11px] font-medium">
                      {{ p.rotulo }}
                    </text>
                  </g>
                </svg>

                <div v-if="andamentoAuditoriaPorHora?.semHorario > 0" class="mt-1 text-right text-[11px] text-slate-400">
                  {{ andamentoAuditoriaPorHora.semHorario.toLocaleString() }} item(ns) sem horário foram incorporados no ponto “Atual”.
                </div>
              </div>
            </div>
            <div v-else class="py-8 text-center text-sm text-slate-400">
              Não há leituras com horário para o setor selecionado.
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

            <!-- Mapa de Leituras por Horário -->
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

                <!-- Quantidade de leituras em cada hora -->
                <div class="rounded-2xl border border-slate-100 bg-white/70 p-4">
                    <div class="mb-3">
                      <p class="text-sm font-semibold text-slate-800">Leituras por horário</p>
                      <p class="text-[11px] text-slate-400">Quantidade registrada em cada faixa horária</p>
                    </div>
                    <div class="space-y-1.5">
                      <div v-for="(p, idx) in leituraPorHoraFiltrada.serie" :key="`leituras-${p.hora}`" class="flex items-center gap-2">
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

          </div>
        </template>
      </div>

      <!-- USUÁRIOS -->
      <MapaLoja
        v-if="abaAtiva === 'mapa'"
        :auditoria="auditoria"
        :is-item-lido="isItemLido"
        @ver-itens="abrirItensDoLocal"
      />

      <AbaUsuariosAuditoria
        v-if="abaAtiva === 'usuarios'"
        :auditoria="auditoria"
        :is-item-lido="isItemLido"
        :get-item-hour="getItemHour"
        :usuario-trajeto="usuarioTrajeto"
        @detalhes="abrirModalUsuario"
        @imprimir="handlePrintUsuarios"
      />

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
    <UiModal v-if="modalItensAberto" :title="tituloModalItens" :subtitle="`${itensModal.length} itens neste local`" width="max-w-6xl" @close="fecharModalItens">
      <div class="space-y-4">
        <div class="grid grid-cols-3 gap-3">
          <div class="rounded-2xl bg-emerald-50 p-3">
            <p class="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Lidos</p>
            <p class="text-xl font-bold text-emerald-800">{{ resumoItensModal.lidos }}</p>
          </div>
          <div class="rounded-2xl bg-amber-50 p-3">
            <p class="text-[11px] font-bold uppercase tracking-wider text-amber-700">Pendentes</p>
            <p class="text-xl font-bold text-amber-800">{{ resumoItensModal.pendentes }}</p>
          </div>
          <div class="rounded-2xl p-3" :class="resumoItensModal.perc > 3 ? 'bg-red-50' : 'bg-slate-50'">
            <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">% pendente</p>
            <p class="text-xl font-bold" :class="resumoItensModal.perc > 3 ? 'text-red-700' : 'text-slate-800'">{{ resumoItensModal.perc.toFixed(1) }}%</p>
          </div>
        </div>
        <UiListaItens :itens="itensModalLista" :colunas="colunasListaItens" :facetas="facetasListaItens" :titulo="tituloModalItens" :ordem-inicial="{ chave: 'status', direcao: 'desc' }" />
      </div>
    </UiModal>

    <!-- Modal Relatório -->
    <RelatorioAuditoria
      v-if="modalRelatorioAberto"
      :auditoria="auditoria"
      :setores="setoresComAnalise"
      :locais="locaisComAnalise"
      @close="fecharRelatorio"
    />

    <UiModal v-if="modalUsuarioAberto && usuarioDetalhes" :title="separarUsuario(usuarioDetalhes.nome).nome || usuarioDetalhes.nome" :subtitle="separarUsuario(usuarioDetalhes.nome).matricula ? `Matrícula: ${separarUsuario(usuarioDetalhes.nome).matricula} · desempenho nesta auditoria` : 'Desempenho do usuário nesta auditoria'" width="max-w-4xl" @close="fecharModalUsuario">
      <div class="space-y-5">
        <button type="button" class="ui-btn-primary py-2" @click="verTrajetoUsuario(usuarioDetalhes.nome)"><i class="fas fa-route"></i>Ver trajeto no mapa</button>
        <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div class="rounded-2xl bg-slate-50 p-3">
            <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Lidos</p>
            <p class="text-xl font-bold text-slate-900">{{ usuarioDetalhes.lidos.toLocaleString('pt-BR') }}</p>
          </div>
          <div class="rounded-2xl p-3" :class="usuarioDetalhes.comProblema ? 'bg-red-50' : 'bg-slate-50'">
            <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Com problema</p>
            <p class="text-xl font-bold" :class="usuarioDetalhes.comProblema ? 'text-red-700' : 'text-slate-900'">{{ usuarioDetalhes.comProblema }}</p>
          </div>
          <div class="rounded-2xl bg-slate-50 p-3">
            <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Pico</p>
            <p class="text-xl font-bold text-slate-900">{{ usuarioDetalhes.picoHora || '—' }}</p>
            <p v-if="usuarioDetalhes.picoHora" class="text-[11px] text-slate-500">{{ usuarioDetalhes.picoQtd }} leituras</p>
          </div>
          <div class="rounded-2xl bg-slate-50 p-3">
            <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Locais lidos</p>
            <p class="text-xl font-bold text-slate-900">{{ usuarioDetalhes.qtdLocais }}</p>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <section class="rounded-2xl bg-slate-50 p-4">
            <p class="text-xs font-bold text-slate-700">Leituras por hora</p>
            <div class="mt-3 flex h-28 items-end gap-1">
              <div v-for="(v, i) in usuarioDetalhes.horas" :key="i" class="group relative flex h-full flex-1 flex-col justify-end">
                <span class="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-1.5 py-0.5 text-[10px] text-white group-hover:block">{{ usuarioDetalhes.rotulosHoras[i] }}: {{ v }}</span>
                <span class="w-full rounded-t bg-blue-500 group-hover:bg-blue-700" :style="{ height: `${(v / usuarioDetalhes.maxHora) * 100}%`, minHeight: v ? '2px' : '0' }"></span>
              </div>
            </div>
            <div class="mt-1 flex justify-between text-[10px] text-slate-400"><span>{{ usuarioDetalhes.rotulosHoras[0] }}</span><span>{{ usuarioDetalhes.rotulosHoras.at(-1) }}</span></div>
          </section>
          <section class="rounded-2xl bg-slate-50 p-4">
            <p class="text-xs font-bold text-slate-700">Locais mais lidos</p>
            <p v-if="!usuarioDetalhes.locaisTop.length" class="mt-3 text-xs text-slate-500">Nenhum local com leitura registrada.</p>
            <ul v-else class="mt-3 space-y-2">
              <li v-for="l in usuarioDetalhes.locaisTop" :key="l.local" class="text-xs">
                <div class="flex justify-between"><span class="font-semibold text-slate-800">{{ l.local }}</span><span class="text-slate-500">{{ l.contagem }}</span></div>
                <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-white"><div class="h-full rounded-full bg-blue-500" :style="{ width: `${(l.contagem / usuarioDetalhes.locaisTop[0].contagem) * 100}%` }"></div></div>
              </li>
            </ul>
          </section>
        </div>

        <section>
          <p class="mb-2 text-sm font-bold text-slate-800">Leituras com problema ({{ usuarioDetalhes.problemas.length }})</p>
          <UiListaItens
            :itens="usuarioDetalhes.problemas"
            :colunas="[{ chave: 'codigo', titulo: 'Código' }, { chave: 'produto', titulo: 'Produto' }, { chave: 'local', titulo: 'Local' }, { chave: 'motivo', titulo: 'Motivo', alinhamento: 'center', badge: v => (v === 'Estoque Zero' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700') }]"
            :facetas="[{ chave: 'motivo', titulo: 'Motivo' }, { chave: 'local', titulo: 'Local' }]"
            :titulo="`Problemas de ${rotuloUsuario(usuarioDetalhes.nome)}`"
            :passo="30"
          />
        </section>
      </div>
    </UiModal>
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
