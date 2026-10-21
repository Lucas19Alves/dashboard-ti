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
import PrevisaoAuditoria from '../components/PrevisaoAuditoria.vue'
import PlanoAcaoAuditoria from '../components/PlanoAcaoAuditoria.vue'
import EscalaSugerida from '../components/EscalaSugerida.vue'
import AbaDadosAuditoria from '../components/AbaDadosAuditoria.vue'
import AbaVisaoGeralAuditoria from '../components/AbaVisaoGeralAuditoria.vue'
import AbaEstatisticasAuditoria from '../components/AbaEstatisticasAuditoria.vue'
import NavAbasAuditoria from '../components/NavAbasAuditoria.vue'
import UiModal from '../components/ui/UiModal.vue'
import UiListaItens from '../components/ui/UiListaItens.vue'
import { isItemLido } from '../utils/itemLido'
import { blocoBarras, blocoColunas, blocoTabela } from '../utils/print'
import { abrirRelatorioTabela, useRelatorio } from '../composables/useRelatorio'
import { ritmosDaAuditoria } from '../utils/planoAcao'
import { extrairDataISOPlanilha, extrairHoraPlanilha } from '../utils/auditoriaHorario'
import { analisarSinaisAuditoria } from '../utils/sinaisAuditoria'
import { baixarCsv } from '../utils/csv'
import { atualizarOrdenacaoDados, extrairEstoque, filtrarBuscaDados, getSetorItem, isPlaceholder, paginasVisiveisFn, sortDados, temPresencaConfirmada } from '../utils/detalheAuditoria'
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
const ABAS_VALIDAS = ['dashboard', 'mapa', 'usuarios', 'plano', 'dados', 'estatisticas', 'atencao']
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
    { value: 'plano', label: 'Plano e escala', icon: 'fas fa-list-check' },
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

const itensComEstoqueZero = computed(() => {
  if (!auditoria.value?.analise) return []
  return auditoria.value.analise.itensComEstoqueZeroDetalhes || []
})

const itensLidoNaoPertence = computed(() => {
  if (!auditoria.value?.analise) return []
  return auditoria.value.analise.itensLidoNaoPertenceDetalhes || []
})

const itensVendidosOjeSemLeitura = computed(() => {
  if (!auditoria.value?.dados) return 0
  return auditoria.value.dados.filter(item => {
    const temPresenca = item._temPresenca !== undefined ? item._temPresenca : temPresencaConfirmada(item)
    const vendidoHoje = item['Dias sem venda'] === '0' || item['Dias sem venda'] === 0 || item['Dias sem venda'] === '0'
    return vendidoHoje && !temPresenca
  }).length
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


const handlePrintCard = (dados, colunas, tituloCard) => {
  if (!dados || dados.length === 0) return
  abrirRelatorioTabela({
    id: `auditoria-${String(tituloCard).toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-')}`,
    titulo: tituloCard,
    subtitulo: `Auditoria de ${auditoria.value.tipo} · ${dataAuditoriaBR.value}`,
    contexto: [{ rotulo: 'Auditoria', valor: `${auditoria.value.tipo} · ${dataAuditoriaBR.value}` }, { rotulo: 'Situação', valor: auditoria.value.status === 'fechada' ? 'Fechada' : 'Em andamento' }],
    colunas,
    itens: dados
  })
}

// Relatório da equipe nesta auditoria (aba Usuários).
const { abrir: abrirSeletorRelatorio } = useRelatorio()
const handlePrintUsuarios = () => {
  const lista = usuariosFiltrados.value
  if (!lista.length) return
  const totalLeituras = lista.reduce((s, u) => s + u.totalLidos, 0)
  const ritmos = new Map(ritmosDaAuditoria(auditoria.value).map(r => [r.usuario, r.ritmo]))
  const porHora = new Map()
  for (const item of auditoria.value?.dados || []) {
    if (!isItemLido(item)) continue
    const h = getItemHour(item)
    if (h !== null && h !== undefined) porHora.set(h, (porHora.get(h) || 0) + 1)
  }
  const horas = [...porHora.keys()].sort((a, b) => a - b)
  const linhas = lista.map((u, i) => ({
    ...u,
    posicao: i + 1,
    matricula: separarUsuario(u.nome).matricula || '—',
    nomeExibicao: separarUsuario(u.nome).nome || u.nome,
    ritmo: ritmos.has(u.nome) ? Math.round(ritmos.get(u.nome)) : '—'
  }))
  const colunasTabela = [
    { chave: 'posicao', titulo: '#', alinhamento: 'right' }, { chave: 'matricula', titulo: 'Matrícula' }, { chave: 'nomeExibicao', titulo: 'Nome' },
    { chave: 'totalLidos', titulo: 'Leituras', alinhamento: 'right' }, { chave: 'ritmo', titulo: 'Ritmo (/h)', alinhamento: 'right' },
    { chave: 'lidos', titulo: 'Lidos corretamente', alinhamento: 'right' }, { chave: 'comProblema', titulo: 'Com problema', alinhamento: 'right' },
    { chave: 'percentualProblema', titulo: '% Problema', alinhamento: 'right', format: v => `${v.toFixed(1)}%` },
    { chave: 'percentualAuditoria', titulo: '% da auditoria', alinhamento: 'right', format: v => `${v.toFixed(1)}%` }
  ]
  abrirSeletorRelatorio({
    id: 'auditoria-usuarios',
    titulo: 'Equipe da auditoria',
    subtitulo: `Auditoria de ${auditoria.value?.tipo} · ${dataAuditoriaBR.value}`,
    contexto: [{ rotulo: 'Auditoria', valor: `${auditoria.value?.tipo} · ${dataAuditoriaBR.value}` }, { rotulo: 'Situação', valor: auditoria.value?.status === 'fechada' ? 'Fechada' : 'Em andamento' }],
    indicadores: [
      { rotulo: 'Usuários', valor: lista.length },
      { rotulo: 'Leituras', valor: totalLeituras },
      { rotulo: 'Média por usuário', valor: Math.round(totalLeituras / lista.length) },
      { rotulo: 'Com problema', valor: lista.reduce((s, u) => s + u.comProblema, 0), tom: 'alerta' }
    ],
    colunas: { lista: colunasTabela.map(c => ({ chave: c.chave, titulo: c.titulo })), padrao: colunasTabela.map(c => c.chave) },
    secoes: [
      { id: 'ranking', titulo: 'Leituras por usuário', descricao: 'Barras com as leituras de cada pessoa (até 25).', gerar: () => blocoBarras({ titulo: 'Leituras por usuário', barras: lista.slice(0, 25).map(u => ({ rotulo: rotuloUsuario(u.nome), valor: u.totalLidos, texto: `${u.totalLidos} · ${u.percentualAuditoria.toFixed(1)}%` })) }) },
      { id: 'horas', titulo: 'Leituras do time por hora', descricao: 'Soma de todos por hora do dia.', padrao: horas.length > 1, gerar: () => blocoColunas({ titulo: 'Leituras por hora', colunas: horas.map(h => ({ rotulo: `${String(h).padStart(2, '0')}h`, valor: porHora.get(h) })) }) },
      { id: 'tabela', titulo: 'Detalhamento por usuário', descricao: 'Tabela com leituras, ritmo e problemas de cada pessoa.', gerar: ({ colunas }) => blocoTabela({ colunas: colunasTabela.filter(c => colunas.includes(c.chave)), linhas }) }
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
        <div class="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
          <h2 class="text-xl font-bold">Leituras para revisão <span class="ml-2 rounded-full bg-amber-100 px-2.5 py-1 align-middle text-xs font-semibold">{{ sinaisAuditoria.sinais.length }} alertas</span></h2>
          <p class="mt-2 text-sm leading-relaxed">Os alertas indicam registros fora do padrão; não comprovam fraude. Confira a planilha original e o contexto operacional antes de concluir.</p>
          <p class="mt-2 text-xs text-amber-800">{{ sinaisAuditoria.base }} Horários usam a data e a hora registradas na própria linha, sem presumir meia-noite para uma data sem hora.</p>
        </div>

        <div class="grid gap-3 sm:grid-cols-4" aria-label="Cobertura da análise">
          <div class="rounded-xl border border-slate-200 bg-white p-4"><p class="text-xs text-slate-500">Leituras</p><p class="mt-1 text-2xl font-bold text-slate-900">{{ sinaisAuditoria.totalLeituras }}</p></div>
          <div class="rounded-xl border border-slate-200 bg-white p-4"><p class="text-xs text-slate-500">Com data, hora e usuário</p><p class="mt-1 text-2xl font-bold text-slate-900">{{ sinaisAuditoria.leiturasComHorario }}</p></div>
          <div class="rounded-xl border border-slate-200 bg-white p-4"><p class="text-xs text-slate-500">Sem dados para análise temporal</p><p class="mt-1 text-2xl font-bold text-amber-700">{{ sinaisAuditoria.leiturasSemHorario }}</p></div>
          <div class="rounded-xl border border-slate-200 bg-white p-4"><p class="text-xs text-slate-500">Auditorias anteriores comparáveis</p><p class="mt-1 text-2xl font-bold text-slate-900">{{ sinaisAuditoria.auditoriasHistoricas }}</p></div>
        </div>
        <p v-if="!sinaisAuditoria.auditoriasHistoricas" class="text-xs text-slate-500">Sem auditorias anteriores do mesmo tipo nesta base local. Os alertas desta auditoria continuam disponíveis, mas a comparação histórica não é calculada.</p>

        <div v-if="!sinaisAuditoria.sinais.length" class="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600">
          <p class="font-semibold text-slate-800">Nenhum ponto de atenção pelos critérios atuais</p>
          <p class="mt-1 text-sm">A ausência de alerta não substitui a conferência habitual.</p>
        </div>

        <div v-else class="grid gap-4">
          <article v-for="(sinal, indice) in sinaisAuditoria.sinais" :key="`${sinal.tipo}-${sinal.usuario || indice}`" class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
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
      <AbaVisaoGeralAuditoria v-if="abaAtiva === 'dashboard'" :auditoria="auditoria" :metricas="metricasGerais" :somente-leitura="readOnly" @abrir-metrica="abrirModalMetrica" @upload-completo="handleUploadCompleto" :hora-do-item="getItemHour" :normalizar="normalizar" :valor-hora="getHoraValor" />

      <!-- USUÁRIOS -->
      <MapaLoja
        v-if="abaAtiva === 'mapa'"
        :auditoria="auditoria"
        :is-item-lido="isItemLido"
        @ver-itens="abrirItensDoLocal"
      />

      <div v-if="abaAtiva === 'plano'" class="space-y-6">
        <PlanoAcaoAuditoria :auditoria="auditoria" />
        <EscalaSugerida :auditoria="auditoria" :inicio="store.horariosAuditoria?.inicio || '08:00'" :fim="store.horariosAuditoria?.fim || '20:00'" />
      </div>

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
        class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
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
      <AbaDadosAuditoria v-if="abaAtiva === 'dados'" :auditoria="auditoria" :itens-lido-nao-pertence="itensLidoNaoPertence" @abrir-setor-local="abrirModalSetorLocal" :imprimir="handlePrintCard" />

      <!-- ESTATÍSTICAS -->
      <AbaEstatisticasAuditoria v-if="abaAtiva === 'estatisticas'" :setores="setoresComAnalise" :locais="locaisComAnalise" @abrir-setor-local="abrirModalSetorLocal" :imprimir="handlePrintCard" />
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
          <div class="rounded-xl bg-emerald-50 p-3">
            <p class="text-xs font-semibold text-emerald-700">Lidos</p>
            <p class="text-xl font-bold text-emerald-800">{{ resumoItensModal.lidos }}</p>
          </div>
          <div class="rounded-xl bg-amber-50 p-3">
            <p class="text-xs font-semibold text-amber-700">Pendentes</p>
            <p class="text-xl font-bold text-amber-800">{{ resumoItensModal.pendentes }}</p>
          </div>
          <div class="rounded-xl p-3" :class="resumoItensModal.perc > 3 ? 'bg-red-50' : 'bg-slate-50'">
            <p class="text-xs font-semibold text-slate-500">% pendente</p>
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
        <div class="flex flex-wrap gap-2">
          <button type="button" class="ui-btn-primary py-2" @click="verTrajetoUsuario(usuarioDetalhes.nome)"><i class="fas fa-route"></i>Ver trajeto no mapa</button>
          <router-link :to="`/colaborador/${encodeURIComponent(usuarioDetalhes.nome)}`" class="ui-btn-secondary py-2" @click="fecharModalUsuario"><i class="fas fa-id-badge"></i>Ficha do colaborador</router-link>
        </div>
        <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div class="rounded-xl bg-slate-50 p-3">
            <p class="text-xs font-semibold text-slate-500">Lidos</p>
            <p class="text-xl font-bold text-slate-900">{{ usuarioDetalhes.lidos.toLocaleString('pt-BR') }}</p>
          </div>
          <div class="rounded-xl p-3" :class="usuarioDetalhes.comProblema ? 'bg-red-50' : 'bg-slate-50'">
            <p class="text-xs font-semibold text-slate-500">Com problema</p>
            <p class="text-xl font-bold" :class="usuarioDetalhes.comProblema ? 'text-red-700' : 'text-slate-900'">{{ usuarioDetalhes.comProblema }}</p>
          </div>
          <div class="rounded-xl bg-slate-50 p-3">
            <p class="text-xs font-semibold text-slate-500">Pico</p>
            <p class="text-xl font-bold text-slate-900">{{ usuarioDetalhes.picoHora || '—' }}</p>
            <p v-if="usuarioDetalhes.picoHora" class="text-[11px] text-slate-500">{{ usuarioDetalhes.picoQtd }} leituras</p>
          </div>
          <div class="rounded-xl bg-slate-50 p-3">
            <p class="text-xs font-semibold text-slate-500">Locais lidos</p>
            <p class="text-xl font-bold text-slate-900">{{ usuarioDetalhes.qtdLocais }}</p>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <section class="rounded-xl bg-slate-50 p-4">
            <p class="text-xs font-bold text-slate-700">Leituras por hora</p>
            <div class="mt-3 flex h-28 items-end gap-1">
              <div v-for="(v, i) in usuarioDetalhes.horas" :key="i" class="group relative flex h-full flex-1 flex-col justify-end">
                <span class="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-1.5 py-0.5 text-[10px] text-white group-hover:block">{{ usuarioDetalhes.rotulosHoras[i] }}: {{ v }}</span>
                <span class="w-full rounded-t bg-blue-500 group-hover:bg-blue-700" :style="{ height: `${(v / usuarioDetalhes.maxHora) * 100}%`, minHeight: v ? '2px' : '0' }"></span>
              </div>
            </div>
            <div class="mt-1 flex justify-between text-[10px] text-slate-400"><span>{{ usuarioDetalhes.rotulosHoras[0] }}</span><span>{{ usuarioDetalhes.rotulosHoras.at(-1) }}</span></div>
          </section>
          <section class="rounded-xl bg-slate-50 p-4">
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
