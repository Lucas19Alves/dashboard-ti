<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuditoriasStore } from '../stores/auditoriasStore'
import UploadAnaliseAuditoria from '../components/UploadAnaliseAuditoria.vue'
import ModalMetrica from '../components/ModalMetrica.vue'
import ModalSetorLocal from '../components/ModalSetorLocal.vue'

const router = useRouter()
const route = useRoute()
const store = useAuditoriasStore()

const auditoria = computed(() => {
  return store.auditorias.find(a => a.id === parseInt(route.params.id))
})

const abaAtiva = ref('dashboard')
const filtroUsuario = ref('')
const filtroDados = ref('')
const filtroFornecedor = ref('')
const modalMetricaAberto = ref(false)
const metricaSelecionada = ref(null)
const modalSetorLocalAberto = ref(false)
const tipoModalSetorLocal = ref(null)
const itemsModalSetorLocal = ref([])
const viewModeLocais = ref('grid') // 'grid' ou 'list'
const modalRelatorioAberto = ref(false)
const filtroItens = ref('')
const ordenacaoUsuarios = ref({ coluna: 'totalLidos', direcao: 'desc' })
const ordenacaoItens = ref({ coluna: 'Código', direcao: 'asc' })
const filtroStatusItens = ref('todos')
const modalUsuarioAberto = ref(false)
const usuarioSelecionado = ref(null)
const mostrarUploadSubstituir = ref(false)
const modalItensAberto = ref(false)
const itensModal = ref([])
const tituloModalItens = ref('')
const printAreaItens = ref(null)
const printAreaRelatorio = ref(null)

const abas = ['dashboard', 'usuarios', 'dados', 'estatisticas']
const abasDisplay = { dashboard: 'Dashboard', usuarios: 'Usuários', dados: 'Dados', estatisticas: 'Estatísticas' }

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

const handleUploadCompleto = ({ dados, analise }) => {
  if (auditoria.value) {
    // Atualizar SKU automaticamente baseado em itens auditáveis
    store.updateAuditoria(auditoria.value.id, {
      dados: dados,
      analise: analise,
      sku: analise.totalItens, // SKU = total de itens auditáveis
      parcial: analise.parcialPercentual,
      total: analise.totalItens
    })
    store.addToast('Dados importados com sucesso!', 'success')
    mostrarUploadSubstituir.value = false
  }
}

// =========== DASHBOARD ===========
const metricasGerais = computed(() => {
  if (!auditoria.value?.analise) return null
  const a = auditoria.value.analise
  const comProblema = (a.itensComEstoqueZero || 0) + (a.itensLidoNaoPertence || 0)
  const totalAuditaveis = a.itensLidosCorretamente + a.itensPendentes + a.itensLidosComProblema
  const totalLidos = a.itensLidosCorretamente + a.itensLidosComProblema
  const percentualConclusao = a.percentualConclusao ?? (totalAuditaveis > 0 ? (totalLidos / totalAuditaveis) * 100 : 0)
  const percentualPendente = a.parcialPercentual ?? (totalAuditaveis > 0 ? (a.itensPendentes / totalAuditaveis) * 100 : 0)
  
  return {
    totalItens: a.totalItens, // Total de itens auditáveis (SKU)
    lidosCorretamente: a.itensLidosCorretamente,
    pendentes: a.itensPendentes,
    comProblema: comProblema,
    totalLidos: totalLidos, // Total lidos (corretos + problemas)
    percentualConclusao: percentualConclusao, // % concluído (exato)
    percentualPendente: percentualPendente, // % pendente (exato)
    metaConclusao: 97.0, // Meta de conclusão
    metaPendente: 3.0, // Meta de pendente (foco)
    faltaParaMeta: Math.max(0, percentualPendente - 3.0), // Quanto falta para meta de 3%
    setoresParados: a.setoresParados?.length || 0,
    locaisCriticos: a.locaisSemLeitura?.length || 0
  }
})

const insights = computed(() => {
  if (!auditoria.value?.dados || !auditoria.value?.analise) return []
  
  const insights = []
  const a = auditoria.value.analise
  const dados = auditoria.value.dados
  const totalLidos = a.itensLidosCorretamente + a.itensLidosComProblema
  const totalAuditaveis = a.itensLidosCorretamente + a.itensPendentes + a.itensLidosComProblema
  const percentualConclusao = a.percentualConclusao || 0
  const percentualPendente = a.parcialPercentual || 0

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
      detalhes: [`Ainda restam ${a.itensPendentes} itens pendentes`]
    })
  } else {
    insights.push({
      tipo: 'aviso',
      titulo: '📊 Progresso em Andamento',
      mensagem: `${percentualConclusao.toFixed(2)}% de conclusão`,
      detalhes: [`Faltam ${a.itensPendentes} itens para completar`]
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
      mensagem: `${qtdMuitoTempo} item(ns) com muitos dias sem venda e sem leitura`,
      detalhes: []
    })
  }

  return insights
})

// =========== ANÁLISES INTELIGENTES ===========
const horarioInicio = computed(() => store.horariosAuditoria?.inicio || '08:00')
const horarioFim = computed(() => store.horariosAuditoria?.fim || '18:00')

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
  const totalLidos = a.itensLidosCorretamente + a.itensLidosComProblema
  const totalAuditaveis = a.itensLidosCorretamente + a.itensPendentes + a.itensLidosComProblema

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

const leituraPorHora = computed(() => {
  if (!auditoria.value?.dados) return null
  const dados = auditoria.value.dados

  const contagem = {}
  for (let h = 8; h <= 18; h++) contagem[h] = 0

  const toHour = (valor) => {
    if (!valor) return null
    // String com data/hora
    if (typeof valor === 'string') {
      const d = new Date(valor)
      if (!isNaN(d.getTime())) return d.getHours()
      // tenta HH:mm
      const m = valor.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/)
      if (m) return Math.max(0, Math.min(23, parseInt(m[1], 10)))
      return null
    }
    // Timestamp numérico (ms)
    if (typeof valor === 'number') {
      if (valor > 1e12) {
        const d = new Date(valor)
        return isNaN(d.getTime()) ? null : d.getHours()
      }
      // Serial do Excel (dias desde 1899-12-30)
      const base = new Date(Date.UTC(1899, 11, 30))
      const d = new Date(base.getTime() + valor * 864e5)
      return isNaN(d.getTime()) ? null : d.getUTCHours()
    }
    // Objeto Date
    if (valor instanceof Date) return valor.getHours()
    return null
  }

  const isLidoNaoPertence = (item) => {
    const valor = item['Lido não pertence']
    if (valor === undefined || valor === null) return false
    if (valor === true) return true
    if (typeof valor === 'string') return valor.toLowerCase().includes('sim')
    return false
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

  dados.forEach(item => {
    const lidoNaoPertence = isLidoNaoPertence(item)
    const efetivamenteTemPresenca = item._temPresenca || lidoNaoPertence
    if (!efetivamenteTemPresenca) return
    
    // Tentar diferentes colunas de data/hora
    const horaValor = getHoraValor(item)
    
    const h = toHour(horaValor)
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
    const totalLidos = a.itensLidosCorretamente + a.itensLidosComProblema
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
const usuariosOrdenados = computed(() => {
  if (!auditoria.value?.analise) return []
  const analise = auditoria.value.analise
  const lista = analise.usuarios
    .filter(u => u.toLowerCase().includes(filtroUsuario.value.toLowerCase()))
    .map(u => {
      const lidos = analise.porUsuario[u]?.lidos || 0
      const comProblema = analise.porUsuario[u]?.comProblema || 0
      const pendentes = analise.porUsuario[u]?.pendentes || 0
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
      
      return {
        nome: u,
        lidos,
        comProblema,
        totalLidos,
        total,
        performance,
        performanceClass,
        score
      }
    })

  const coluna = ordenacaoUsuarios.value.coluna
  const direcao = ordenacaoUsuarios.value.direcao === 'asc' ? 1 : -1

  return lista.sort((a, b) => {
    if (coluna === 'nome') {
      return a.nome.localeCompare(b.nome) * direcao
    }
    if (coluna === 'lidos') {
      return (a.lidos - b.lidos) * direcao
    }
    if (coluna === 'comProblema') {
      return (a.comProblema - b.comProblema) * direcao
    }
    if (coluna === 'totalLidos') {
      return (a.totalLidos - b.totalLidos) * direcao
    }
    if (coluna === 'total') {
      return (a.total - b.total) * direcao
    }
    if (coluna === 'performance') {
      return (a.score - b.score) * direcao
    }
    return 0
  })
})

const ordenarUsuarios = (coluna) => {
  if (ordenacaoUsuarios.value.coluna === coluna) {
    ordenacaoUsuarios.value.direcao = ordenacaoUsuarios.value.direcao === 'asc' ? 'desc' : 'asc'
  } else {
    ordenacaoUsuarios.value.coluna = coluna
    ordenacaoUsuarios.value.direcao = coluna === 'nome' ? 'asc' : 'desc'
  }
}

const analiseUsuarios = computed(() => {
  if (!auditoria.value?.analise) return null
  const usuarios = auditoria.value.analise.usuarios
  if (usuarios.length === 0) return null

  const totalLidos = usuarios.reduce((sum, u) => sum + (auditoria.value.analise.porUsuario[u]?.lidos || 0), 0)
  const mediaLidosPorUsuario = Math.round(totalLidos / usuarios.length)
  const usuarioMaisProdutivo = usuarios.sort((a, b) => 
    (auditoria.value.analise.porUsuario[b]?.lidos || 0) - (auditoria.value.analise.porUsuario[a]?.lidos || 0)
  )[0]

  return {
    totalUsuarios: usuarios.length,
    mediaLidasPorUsuario: mediaLidosPorUsuario,
    usuarioDestaque: usuarioMaisProdutivo,
    lidasDestaque: auditoria.value.analise.porUsuario[usuarioMaisProdutivo]?.lidos || 0
  }
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
  const toHour = (valor) => {
    if (!valor) return null
    if (typeof valor === 'string') {
      const d = new Date(valor)
      if (!isNaN(d.getTime())) return d.getHours()
      const m = valor.match(/(\d{1,2}):(\d{2})/)
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
  const isLidoNaoPertence = (item) => {
    if (item._lidoNaoPertence !== undefined) return !!item._lidoNaoPertence
    const valor = item['Lido não pertence']
    if (valor === undefined || valor === null) return false
    if (valor === true) return true
    if (typeof valor === 'string') return valor.toLowerCase().includes('sim')
    return false
  }
  auditoria.value.dados.forEach(item => {
    const u = (item['Usuário'] || '').toString().trim()
    if (!u || !cont[u]) return
    const lnp = isLidoNaoPertence(item)
    const tem = item._temPresenca || lnp
    if (!tem) return
    const horaValor = item['Auditado em'] || item['Data'] || item['Hora'] || item['Lido em'] || item['Carimbo de data/hora']
    const h = toHour(horaValor)
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
  const isLidoNaoPertence = (item) => {
    if (item._lidoNaoPertence !== undefined) return !!item._lidoNaoPertence
    const valor = item['Lido não pertence']
    if (valor === undefined || valor === null) return false
    if (valor === true) return true
    if (typeof valor === 'string') return valor.toLowerCase().includes('sim')
    return false
  }
  auditoria.value.dados.forEach(item => {
    const u = (item['Usuário'] || '').toString().trim()
    if (!u || !(u in mapa)) return
    const lnp = isLidoNaoPertence(item)
    const tem = item._temPresenca || lnp
    if (!tem) return
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
  const setores = {}

  Object.entries(analise.porSetor).forEach(([setor, dados]) => {
    setores[setor] = {
      nome: setor,
      lidos: dados.lidos,
      pendentes: dados.pendentes,
      comProblema: dados.comProblema,
      total: dados.lidos + dados.pendentes + dados.comProblema,
      percentualConclusao: (dados.lidos + dados.pendentes + dados.comProblema) > 0 ? 
        Math.round((dados.lidos / (dados.lidos + dados.pendentes + dados.comProblema)) * 100) : 0
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

const handlePrintPDFItens = async () => {
  try {
    const area = printAreaItens.value
    if (!area) return
    const html2pdf = (await import('html2pdf.js')).default
    const nomeArquivo = (tituloModalItens.value || 'itens-local').replace(/[^\w\-]+/g, '_') + '.pdf'
    const opt = {
      margin:       [10, 10, 10, 10],
      filename:     nomeArquivo,
      image:        { type: 'jpeg', quality: 0.95 },
      html2canvas:  { 
        scale: 2, 
        useCORS: true, 
        scrollY: 0,
        onclone: (doc) => {
          try {
            const el = doc.querySelector('[data-pdf-area=\"itens\"]') || doc.querySelector('[ref=\"printAreaItens\"]') || doc.querySelector('[data-pdf-area]')
            if (el) el.classList.add('pdf-sanitize')
          } catch {}
        }
      },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' },
      pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
    }
    area.classList.add('pdf-sanitize')
    await html2pdf().from(area).set(opt).save()
    area.classList.remove('pdf-sanitize')
  } catch (e) {
    console.error('Falha ao gerar PDF:', e)
  }
}

const handlePrintRelatorio = () => {
  if (typeof window !== 'undefined' && window.print) {
    window.print()
  }
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
  return (auditoria.value.analise.itensComEstoqueZeroDetalhes || []).slice(0, 5)
})

const itensGrandeEstoqueNaoLidos = computed(() => {
  if (!auditoria.value?.dados) return []
  return auditoria.value.dados.filter(item => {
    const temPresenca = item._temPresenca !== undefined ? item._temPresenca : temPresencaConfirmada(item)
    const estoque = item._estoque !== undefined ? item._estoque : extrairEstoque(item)
    return !temPresenca && estoque > 100
  })
    .sort((a, b) => {
      const estoqueA = a._estoque !== undefined ? a._estoque : extrairEstoque(a)
      const estoqueB = b._estoque !== undefined ? b._estoque : extrairEstoque(b)
      return estoqueB - estoqueA
    })
    .slice(0, 5)
})

const itensMuitoTempoNaoLidos = computed(() => {
  if (!auditoria.value?.dados) return []
  return auditoria.value.dados.filter(item => {
    const temPresenca = item._temPresenca !== undefined ? item._temPresenca : temPresencaConfirmada(item)
    const diasSemVenda = parseInt(item['Dias sem venda']) || 0
    return !temPresenca && diasSemVenda > 30
  })
    .sort((a, b) => {
      const diasA = parseInt(a['Dias sem venda']) || 0
      const diasB = parseInt(b['Dias sem venda']) || 0
      return diasB - diasA
    })
    .slice(0, 5)
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
    return custo > 0 && custo < 50
  })
    .sort((a, b) => parseFloat(a['Custo Ruptura']) - parseFloat(b['Custo Ruptura']))
    .slice(0, 5)
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
  return auditoria.value.dados.filter(item => 
    item['Fornecedor'] === filtroFornecedor.value
  )
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
      const comProblema = dados.comProblema || 0
      const totalLidos = lidos + comProblema
      const total = lidos + pendentes + comProblema
      const nomeLocal = (local || 'Não especificado').toString().trim()
      const itensDoLocal = dadosCompletos.filter(item => {
        const itemLocal = (item['Local'] || 'Não especificado').toString().trim()
        return itemLocal === nomeLocal
      })
      return {
        nome: nomeLocal,
        lidos: lidos,
        pendentes: pendentes,
        comProblema: comProblema,
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

// Dados para o relatório
const dadosRelatorio = computed(() => {
  if (!auditoria.value?.analise) return null
  
  const a = auditoria.value.analise
  const totalLidos = a.itensLidosCorretamente + a.itensLidosComProblema
  const totalAuditaveis = a.itensLidosCorretamente + a.itensPendentes + a.itensLidosComProblema
  const percentualConclusao = a.percentualConclusao || 0
  const percentualPendente = a.parcialPercentual || 0
  
  // Top 20 locais com mais itens pendentes
  const topLocaisPendentes = locaisComAnalise.value
    .sort((a, b) => b.pendentes - a.pendentes)
    .slice(0, 20)
  
  // Locais sem leitura
  const locaisSemLeitura = a.locaisSemLeitura || []
  
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
      pendentes: a.itensPendentes,
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

const iconeAba = (tab) => {
  const icones = {
    'dashboard': 'fas fa-chart-line',
    'usuarios': 'fas fa-users-cog',
    'dados': 'fas fa-database',
    'estatisticas': 'fas fa-chart-bar'
  }
  return icones[tab]
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

const itensModalFiltrados = computed(() => {
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
  
  // Aplicar filtro de busca
  if (filtroItens.value) {
    const busca = filtroItens.value.toLowerCase()
    filtrados = filtrados.filter(item => 
      String(item['Código'] || '').toLowerCase().includes(busca) ||
      String(item['Produto'] || '').toLowerCase().includes(busca)
    )
  }
  
  // Aplicar ordenação
  filtrados = [...filtrados].sort((a, b) => {
    const coluna = ordenacaoItens.value.coluna
    let valorA = a[coluna] || ''
    let valorB = b[coluna] || ''
    
    // Tratamento especial para colunas numéricas
    if (coluna === 'Estoque atual') {
      valorA = a._estoque !== undefined ? a._estoque : extrairEstoque(a)
      valorB = b._estoque !== undefined ? b._estoque : extrairEstoque(b)
    } else if (coluna === 'Dias sem venda') {
      valorA = parseInt(valorA) || 0
      valorB = parseInt(valorB) || 0
    }
    
    if (typeof valorA === 'number' && typeof valorB === 'number') {
      return ordenacaoItens.value.direcao === 'asc' 
        ? valorA - valorB
        : valorB - valorA
    }
    
    return ordenacaoItens.value.direcao === 'asc'
      ? String(valorA).localeCompare(String(valorB))
      : String(valorB).localeCompare(String(valorA))
  })
  
  return filtrados
})

const abrirModalRelatorio = () => {
  modalRelatorioAberto.value = true
}

const fecharModalRelatorio = () => {
  modalRelatorioAberto.value = false
}
</script>

<template>
  <div v-if="auditoria" class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
    <!-- Header -->
    <div class="bg-linear-to-r from-blue-600 to-blue-800 text-white p-6 shadow-lg">
      <div class="max-w-7xl mx-auto flex items-center justify-between">
        <div>
          <button @click="voltar" class="mb-3 flex items-center gap-2 hover:opacity-80 transition text-blue-100">
            <i class="fas fa-arrow-left"></i> Voltar
          </button>
          <h1 class="text-4xl font-bold">{{ auditoria.tipo }}</h1>
          <p class="text-blue-100 mt-2">
            <i class="fas fa-calendar mr-2"></i>{{ dataAuditoriaBR }} | 
            <i class="fas fa-boxes mr-2"></i>SKU: {{ auditoria.sku }} | 
            <i class="fas fa-tasks mr-2"></i>Total: {{ auditoria.analise?.totalItens || 0 }} itens
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
              @click="abrirModalRelatorio"
              class="px-4 py-2 bg-white text-blue-600 hover:bg-blue-50 rounded-lg transition font-medium shadow-lg"
            >
              <i class="fas fa-file-alt mr-2"></i>Relatório
            </button>
            <button
              v-if="!readOnly"
              @click="mostrarUploadSubstituir = true"
              class="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition font-medium"
            >
              <i class="fas fa-upload mr-2"></i>Atualizar dados
            </button>
          </div>
          <div>
            <div class="text-5xl font-bold">{{ (auditoria.analise?.parcialPercentual || 0).toFixed(2) }}%</div>
            <p class="text-blue-100">Pendente</p>
            <div class="mt-2">
              <span
                :class="[
                  'px-3 py-1 rounded-full text-xs font-semibold',
                  (auditoria.analise?.parcialPercentual || 0) <= 3.0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                ]"
              >
                {{ (auditoria.analise?.parcialPercentual || 0) <= 3.0 ? 'Dentro da Meta' : 'Fora da Meta' }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Abas -->
    <div class="sticky top-0 z-10 bg-white border-b shadow-sm">
      <div class="max-w-7xl mx-auto flex gap-0">
        <button
          v-for="tab in abas"
          :key="tab"
          @click="abaAtiva = tab"
          :class="[
            'px-6 py-4 font-medium transition border-b-2',
            abaAtiva === tab
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-800'
          ]"
        >
          <i :class="iconeAba(tab)" class="mr-2"></i>{{ abasDisplay[tab] }}
        </button>
      </div>
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

        <div v-else-if="!readOnly" class="mb-4"></div>

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

        <!-- Métricas Gerais -->
        <template v-else>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div 
              @click="abrirModalMetrica('total')"
              class="bg-white rounded-lg p-6 shadow border-l-4 border-blue-500 cursor-pointer hover:shadow-lg transition"
            >
              <p class="text-gray-600 text-sm font-medium">Total Auditável</p>
              <p class="text-4xl font-bold text-blue-600 mt-2">{{ metricasGerais?.totalItens }}</p>
              <p class="text-xs text-gray-500 mt-1">Itens para auditar</p>
            </div>
            <div 
              @click="abrirModalMetrica('lidos')"
              class="bg-white rounded-lg p-6 shadow border-l-4 border-green-500 cursor-pointer hover:shadow-lg transition"
            >
              <p class="text-gray-600 text-sm font-medium">✅ Total Lidos</p>
              <p class="text-4xl font-bold text-green-600 mt-2">{{ metricasGerais?.totalLidos }}</p>
              <p class="text-xs text-gray-500 mt-1">{{ metricasGerais?.percentualConclusao?.toFixed(2) }}% concluído</p>
              <p class="text-xs text-gray-400 mt-1">Meta: {{ metricasGerais?.metaConclusao }}%</p>
            </div>
            <div 
              @click="abrirModalMetrica('pendentes')"
              class="bg-white rounded-lg p-6 shadow border-l-4 border-orange-500 cursor-pointer hover:shadow-lg transition"
            >
              <p class="text-gray-600 text-sm font-medium">⏳ Pendentes</p>
              <p class="text-4xl font-bold text-orange-600 mt-2">{{ metricasGerais?.pendentes }}</p>
              <p class="text-xs text-gray-500 mt-1">{{ metricasGerais?.percentualPendente?.toFixed(2) }}% pendente</p>
              <p class="text-xs" :class="metricasGerais?.percentualPendente <= 3 ? 'text-green-600' : 'text-red-600'">
                Meta: {{ metricasGerais?.metaPendente }}% 
                <span v-if="metricasGerais?.faltaParaMeta > 0">(+{{ metricasGerais?.faltaParaMeta.toFixed(2) }}%)</span>
              </p>
            </div>
            <div 
              @click="abrirModalMetrica('problema')"
              class="bg-white rounded-lg p-6 shadow border-l-4 border-red-500 cursor-pointer hover:shadow-lg transition"
            >
              <p class="text-gray-600 text-sm font-medium">⚠️ Com Problema</p>
              <p class="text-4xl font-bold text-red-600 mt-2">{{ metricasGerais?.comProblema }}</p>
              <p class="text-xs text-gray-500 mt-1">Requer atenção</p>
            </div>
          </div>

          <!-- Progress Geral -->
          <div class="bg-white rounded-lg p-6 shadow">
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
                      class="h-full bg-linear-to-r from-green-500 to-green-600 transition-all duration-500"
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
                      class="h-full bg-linear-to-r from-orange-500 to-orange-600 transition-all duration-500"
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
          <div class="bg-white rounded-lg p-6 shadow space-y-6">
            <h3 class="font-bold text-lg text-gray-800">Análises Inteligentes</h3>
            
            <!-- Auditoria em Andamento -->
            <template v-if="!readOnly">
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="rounded-lg border-l-4 border-indigo-500 bg-indigo-50 p-4">
                  <p class="text-sm text-gray-600">Ritmo Atual (itens/h)</p>
                  <p class="text-3xl font-bold text-indigo-700 mt-1">{{ projecoes?.ritmoHora?.toFixed(1) || 0 }}</p>
                  <p class="text-xs text-gray-500 mt-1">Desde {{ horarioInicio }} até agora</p>
                </div>
                <div class="rounded-lg border-l-4 border-blue-500 bg-blue-50 p-4">
                  <p class="text-sm text-gray-600">Horas Restantes</p>
                  <p class="text-3xl font-bold text-blue-700 mt-1">{{ projecoes ? formatHoras(projecoes.horasRestantes) : '00:00' }}</p>
                  <p class="text-xs text-gray-500 mt-1">Fim programado: {{ horarioFim }}</p>
                </div>
                <div class="rounded-lg border-l-4 border-green-500 bg-green-50 p-4">
                  <p class="text-sm text-gray-600">Projeção até {{ horarioFim }}</p>
                  <p class="text-3xl font-bold text-green-700 mt-1">
                    +{{ projecoes?.projItens || 0 }} itens
                  </p>
                  <p class="text-xs text-gray-600 mt-1">
                    Percentual final: {{ projecoes?.projPercentualFinal?.toFixed(2) || 0 }}%
                  </p>
                </div>
              </div>

              <!-- Mapa de Leituras por Horário -->
              <div>
                <h4 class="font-semibold text-gray-800 mb-3">
                  <i class="fas fa-clock text-blue-600 mr-2"></i>Mapa de Leituras por Horário
                </h4>
                <div v-if="leituraPorHora && leituraPorHora.max > 0" class="space-y-2">
                  <div v-for="p in leituraPorHora.serie" :key="p.hora" class="flex items-center gap-3">
                    <div class="w-16 text-xs text-gray-600">{{ p.hora }}</div>
                    <div class="flex-1 h-3 bg-gray-200 rounded">
                      <div
                        class="h-3 bg-blue-500 rounded"
                        :style="{ width: ((p.valor / leituraPorHora.max) * 100) + '%' }"
                        title="Itens lidos na hora"
                      />
                    </div>
                    <div class="w-10 text-right text-xs font-medium text-gray-700">{{ p.valor }}</div>
                  </div>
                </div>
                <div v-else class="text-sm text-gray-500">
                  Não há dados de horário suficientes para montar o mapa.
                </div>
              </div>
            </template>

            <!-- Auditoria Fechada (Insights de Melhoria) -->
            <template v-else>
              <div v-if="improvementInsights && improvementInsights.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div 
                  v-for="(insight, idx) in improvementInsights" 
                  :key="idx"
                  class="rounded-lg p-4 border-l-4 shadow-sm"
                  :class="insight.tipo === 'sucesso' ? 'bg-green-50 border-green-500' : insight.tipo === 'critico' ? 'bg-red-50 border-red-500' : 'bg-orange-50 border-orange-500'"
                >
                  <div class="flex items-start gap-3">
                    <div class="p-2 rounded-full bg-white shadow-sm">
                      <i :class="[insight.icon, insight.tipo === 'sucesso' ? 'text-green-600' : insight.tipo === 'critico' ? 'text-red-600' : 'text-orange-600']" class="text-lg"></i>
                    </div>
                    <div>
                      <p class="text-sm font-medium text-gray-600">{{ insight.titulo }}</p>
                      <p class="text-xl font-bold mt-1" :class="insight.tipo === 'sucesso' ? 'text-green-800' : insight.tipo === 'critico' ? 'text-red-800' : 'text-orange-800'">
                        {{ insight.valor }}
                      </p>
                      <p class="text-xs text-gray-500 mt-2 leading-relaxed">
                        {{ insight.descricao }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="text-center text-gray-500 py-4">
                <p>Nenhum insight de melhoria disponível para esta auditoria.</p>
              </div>
            </template>

            <!-- Resumo Histórico -->
            <div v-if="historicoResumo" class="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

          <!-- Insights -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div 
              v-for="(insight, i) in insights"
              :key="i"
              :class="[
                'rounded-lg p-6 shadow transition hover:shadow-lg',
                insight.tipo === 'critico' ? 'bg-red-50 border-l-4 border-red-500' :
                insight.tipo === 'sucesso' ? 'bg-green-50 border-l-4 border-green-500' :
                insight.tipo === 'aviso' ? 'bg-yellow-50 border-l-4 border-yellow-500' :
                'bg-blue-50 border-l-4 border-blue-500'
              ]"
            >
              <h4 class="font-bold text-lg mb-2 text-gray-800">{{ insight.titulo }}</h4>
              <p class="text-gray-700 mb-3">{{ insight.mensagem }}</p>
              <div v-if="insight.detalhes && insight.detalhes.length > 0" class="space-y-1">
                <div v-for="detalhe in insight.detalhes" :key="detalhe" class="text-sm text-gray-600">
                  • {{ detalhe }}
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- USUÁRIOS -->
      <div v-if="abaAtiva === 'usuarios'" class="space-y-6">
        <!-- Análises Rápidas -->
        <div v-if="analiseUsuarios" class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-white rounded-lg p-6 shadow">
            <p class="text-gray-600 text-sm font-medium">Total de Usuários</p>
            <p class="text-3xl font-bold text-blue-600 mt-2">{{ analiseUsuarios.totalUsuarios }}</p>
          </div>
          <div class="bg-white rounded-lg p-6 shadow">
            <p class="text-gray-600 text-sm font-medium">Média de Lidos/Usuário</p>
            <p class="text-3xl font-bold text-green-600 mt-2">{{ analiseUsuarios.mediaLidasPorUsuario }}</p>
          </div>
          <div class="bg-white rounded-lg p-6 shadow border-l-4 border-purple-500">
            <p class="text-gray-600 text-sm font-medium">🌟 Melhor Desempenho</p>
            <p class="text-2xl font-bold text-purple-600 mt-2">{{ analiseUsuarios.usuarioDestaque }}</p>
            <p class="text-xs text-gray-500 mt-1">{{ analiseUsuarios.lidasDestaque }} lidos</p>
          </div>
        </div>

        <!-- Filtro -->
        <div>
          <input 
            v-model="filtroUsuario"
            type="text"
            placeholder="🔍 Filtrar por nome..."
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
          />
        </div>

        <!-- Tabela de Usuários Ordenada -->
        <div class="bg-white rounded-lg shadow overflow-hidden">
          <table class="w-full">
            <thead class="bg-gray-100 border-b">
              <tr>
                <th
                  class="px-6 py-4 text-left font-semibold text-gray-700 cursor-pointer select-none"
                  @click="ordenarUsuarios('nome')"
                >
                  Usuário
                  <i
                    v-if="ordenacaoUsuarios.coluna === 'nome'"
                    :class="ordenacaoUsuarios.direcao === 'asc' ? 'fas fa-arrow-up ml-1 text-xs' : 'fas fa-arrow-down ml-1 text-xs'"
                  />
                </th>
                <th
                  class="px-6 py-4 text-right font-semibold text-gray-700 cursor-pointer select-none"
                  @click="ordenarUsuarios('lidos')"
                >
                  Lidos Corretamente
                  <i
                    v-if="ordenacaoUsuarios.coluna === 'lidos'"
                    :class="ordenacaoUsuarios.direcao === 'asc' ? 'fas fa-arrow-up ml-1 text-xs' : 'fas fa-arrow-down ml-1 text-xs'"
                  />
                </th>
                <th
                  class="px-6 py-4 text-right font-semibold text-gray-700 cursor-pointer select-none"
                  @click="ordenarUsuarios('comProblema')"
                >
                  Com Problema
                  <i
                    v-if="ordenacaoUsuarios.coluna === 'comProblema'"
                    :class="ordenacaoUsuarios.direcao === 'asc' ? 'fas fa-arrow-up ml-1 text-xs' : 'fas fa-arrow-down ml-1 text-xs'"
                  />
                </th>
                <th
                  class="px-6 py-4 text-right font-semibold text-gray-700 cursor-pointer select-none"
                  @click="ordenarUsuarios('totalLidos')"
                >
                  Total Lidos
                  <i
                    v-if="ordenacaoUsuarios.coluna === 'totalLidos'"
                    :class="ordenacaoUsuarios.direcao === 'asc' ? 'fas fa-arrow-up ml-1 text-xs' : 'fas fa-arrow-down ml-1 text-xs'"
                  />
                </th>
                <th
                  class="px-6 py-4 text-center font-semibold text-gray-700"
                >
                  Detalhes
                </th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr v-for="usuario in usuariosOrdenados" :key="usuario.nome" class="hover:bg-blue-50 transition">
                <td class="px-6 py-4 font-medium text-gray-800">{{ usuario.nome }}</td>
                <td class="px-6 py-4 text-right text-green-600 font-semibold">{{ usuario.lidos }}</td>
                <td class="px-6 py-4 text-right text-red-600 font-semibold">{{ usuario.comProblema || 0 }}</td>
                <td class="px-6 py-4 text-right text-blue-600 font-semibold">{{ usuario.totalLidos }}</td>
                <td class="px-6 py-4 text-center">
                  <button
                    class="px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition"
                    @click="abrirModalUsuario(usuario.nome)"
                  >
                    Ver detalhes
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        
      </div>

      <!-- DADOS -->
      <div v-if="abaAtiva === 'dados'" class="space-y-8">
        <!-- Mapa de Setores e Corredores -->
        <div>
          <h2 class="text-2xl font-bold text-gray-800 mb-6">
            <i class="fas fa-map text-blue-600 mr-2"></i>Mapa de Setores e Corredores
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div 
              v-for="(setor, nome) in mapaSeteores"
              :key="nome"
              @click="abrirModalSetorLocal('setor', [setor])"
              class="bg-white rounded-lg p-6 shadow hover:shadow-lg transition border-l-4 cursor-pointer"
              :class="setor.percentualConclusao >= 75 ? 'border-green-500' : setor.percentualConclusao >= 50 ? 'border-yellow-500' : 'border-red-500'"
            >
              <div class="flex items-start justify-between mb-4">
                <div>
                  <h3 class="font-bold text-lg text-gray-800">{{ setor.nome }}</h3>
                  <p class="text-sm text-gray-500">{{ setor.total }} itens total</p>
                </div>
                <span 
                  :class="[
                    'px-3 py-1 rounded-full text-xs font-bold',
                    setor.percentualConclusao >= 75 ? 'bg-green-100 text-green-800' :
                    setor.percentualConclusao >= 50 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  ]"
                >
                  {{ setor.percentualConclusao }}%
                </span>
              </div>
              <div class="space-y-2">
                <div class="flex justify-between text-sm">
                  <span class="text-green-600 font-medium">✓ {{ setor.lidos }} lidos</span>
                  <span class="text-orange-600 font-medium">⏳ {{ setor.pendentes }} pendentes</span>
                </div>
                <div class="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    :style="{ width: setor.percentualConclusao + '%' }"
                    class="h-full bg-linear-to-r from-blue-500 to-green-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Filtro de Fornecedor -->
        <div v-if="fornecedoresUnicos.length > 0">
          <h3 class="text-xl font-bold text-gray-800 mb-4">
            <i class="fas fa-truck text-blue-600 mr-2"></i>Filtrar por Fornecedor
          </h3>
          <select 
            v-model="filtroFornecedor"
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
          >
            <option value="">Selecione um fornecedor...</option>
            <option v-for="fornecedor in fornecedoresUnicos" :key="fornecedor" :value="fornecedor">
              {{ fornecedor }}
            </option>
          </select>

          <!-- Itens do Fornecedor Selecionado -->
          <div v-if="filtroFornecedor && itensPorFornecedor.length > 0" class="mt-6 bg-white rounded-lg shadow overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-gray-100 border-b">
                <tr>
                  <th class="px-4 py-3 text-left font-semibold text-gray-700">Produto</th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-700">Setor</th>
                  <th class="px-4 py-3 text-right font-semibold text-gray-700">Estoque</th>
                  <th class="px-4 py-3 text-center font-semibold text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody class="divide-y">
                <tr v-for="(item, i) in itensPorFornecedor" :key="i" class="hover:bg-blue-50">
                  <td class="px-4 py-3">
                    <p class="font-bold text-gray-900">{{ item['Código'] || '-' }}</p>
                    <p class="text-sm text-gray-600">{{ item['Produto'] || '-' }}</p>
                  </td>
                  <td class="px-4 py-3 text-gray-600">{{ item['Setor'] || item['Classe de Produto Raiz'] || '-' }}</td>
                  <td class="px-4 py-3 text-right font-semibold">{{ item._estoque !== undefined ? item._estoque : (extrairEstoque(item) || '0') }}</td>
                  <td class="px-4 py-3 text-center">
                    <span v-if="item._temPresenca !== undefined ? item._temPresenca : (item['Presença confirmada'] || false)" class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">✓ Lido</span>
                    <span v-else class="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">⏳ Pendente</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Análises de Dados Críticos -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Itens Lidos com Estoque Zero -->
          <div class="bg-white rounded-lg p-6 shadow">
            <h4 class="font-bold text-lg text-red-600 mb-4">
              <i class="fas fa-exclamation-triangle mr-2"></i>⚠️ Lidos com Estoque Zero
            </h4>
            <p class="text-3xl font-bold text-red-600 mb-3">{{ auditoria.analise?.itensComEstoqueZero || 0 }}</p>
            <p class="text-sm text-gray-600 mb-4">Itens com presença confirmada mas sem estoque no sistema</p>
            <div v-if="itensLidosEstoqueZero.length > 0" class="space-y-2 max-h-48 overflow-y-auto">
              <div v-for="item in itensLidosEstoqueZero" :key="item.codigo" class="text-xs text-gray-700 bg-red-50 p-2 rounded">
                <p class="font-bold text-red-800">Código: {{ item.codigo }}</p>
                <p class="font-medium">{{ item.produto }}</p>
                <p class="text-gray-600">Usuário: {{ item.usuario }} | Local: {{ item.local }}</p>
              </div>
            </div>
            <div v-else class="text-green-600">
              <p class="text-sm">✅ Nenhum item</p>
            </div>
          </div>

          <!-- Itens Lido Não Pertence -->
          <div v-if="(auditoria.analise?.itensLidoNaoPertence || 0) > 0" class="bg-white rounded-lg p-6 shadow">
            <h4 class="font-bold text-lg text-yellow-600 mb-4">
              <i class="fas fa-map-marker-alt mr-2"></i>⚠️ Lido no Local Errado
            </h4>
            <p class="text-3xl font-bold text-yellow-600 mb-3">{{ auditoria.analise?.itensLidoNaoPertence || 0 }}</p>
            <p class="text-sm text-gray-600 mb-4">Itens lidos mas no local incorreto</p>
            <div v-if="itensLidoNaoPertence.length > 0" class="space-y-2 max-h-48 overflow-y-auto">
              <div v-for="item in itensLidoNaoPertence.slice(0, 5)" :key="item.codigo" class="text-xs text-gray-700 bg-yellow-50 p-2 rounded">
                <p class="font-bold text-yellow-800">Código: {{ item.codigo }}</p>
                <p class="font-medium">{{ item.produto }}</p>
                <p class="text-gray-600">Usuário: {{ item.usuario }} | Local: {{ item.local }}</p>
              </div>
            </div>
          </div>

          <!-- Grande Estoque não Lido -->
          <div class="bg-white rounded-lg p-6 shadow">
            <h4 class="font-bold text-lg text-orange-600 mb-4">
              <i class="fas fa-boxes mr-2"></i>Grande Estoque Não Lido
            </h4>
            <p class="text-3xl font-bold text-orange-600 mb-3">{{ itensGrandeEstoqueNaoLidos.length }}</p>
            <p class="text-sm text-gray-600 mb-4">Produtos com estoque > 100 itens ainda não confirmados</p>
            <div v-if="itensGrandeEstoqueNaoLidos.length > 0" class="space-y-2">
              <div v-for="item in itensGrandeEstoqueNaoLidos" :key="item['Código']" class="text-xs text-gray-700 bg-orange-50 p-2 rounded">
                <p class="font-bold text-orange-800">Código: {{ item['Código'] }}</p>
                <p class="font-medium">{{ item['Produto'] }}</p>
                <p class="text-orange-700">Estoque: {{ item._estoque !== undefined ? item._estoque : extrairEstoque(item) }} un</p>
              </div>
            </div>
          </div>

          <!-- Muito Tempo sem Leitura -->
          <div class="bg-white rounded-lg p-6 shadow">
            <h4 class="font-bold text-lg text-red-600 mb-4">
              <i class="fas fa-calendar-times mr-2"></i>Muito Tempo sem Leitura
            </h4>
            <p class="text-3xl font-bold text-red-600 mb-3">{{ itensMuitoTempoNaoLidos.length }}</p>
            <p class="text-sm text-gray-600 mb-4">Itens não confirmados há mais de 30 dias</p>
            <div v-if="itensMuitoTempoNaoLidos.length > 0" class="space-y-2">
              <div v-for="item in itensMuitoTempoNaoLidos" :key="item['Código']" class="text-xs text-gray-700 bg-red-50 p-2 rounded">
                <p class="font-bold text-red-800">Código: {{ item['Código'] }}</p>
                <p class="font-medium">{{ item['Produto'] }}</p>
                <p class="text-red-700">{{ item['Dias sem venda'] }} dias sem venda</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Itens Ruptura Menor Custo -->
        <div class="bg-white rounded-lg p-6 shadow">
          <h4 class="font-bold text-lg text-blue-600 mb-4">
            <i class="fas fa-coins mr-2"></i>Itens de Ruptura - Menor Custo
          </h4>
          <div v-if="itensRupturaMenorCusto.length > 0" class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-blue-50 border-b">
                <tr>
                  <th class="px-4 py-2 text-left font-semibold text-gray-700">Código / Produto</th>
                  <th class="px-4 py-2 text-right font-semibold text-gray-700">Custo</th>
                  <th class="px-4 py-2 text-left font-semibold text-gray-700">Fornecedor</th>
                </tr>
              </thead>
              <tbody class="divide-y">
                <tr v-for="item in itensRupturaMenorCusto" :key="item['Código']" class="hover:bg-blue-50">
                  <td class="px-4 py-2">
                    <p class="font-bold text-gray-900">{{ item['Código'] }}</p>
                    <p class="text-sm text-gray-600">{{ item['Produto'] }}</p>
                  </td>
                  <td class="px-4 py-2 text-right font-semibold text-blue-600">R$ {{ parseFloat(item['Custo Ruptura']).toFixed(2) }}</td>
                  <td class="px-4 py-2 text-gray-600">{{ item['Fornecedor'] }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="text-gray-600">Nenhum item com custo de ruptura encontrado</div>
        </div>
      </div>

      <!-- ESTATÍSTICAS -->
      <div v-if="abaAtiva === 'estatisticas'" class="space-y-8">
        <!-- Setores com Análise -->
        <div>
          <h2 class="text-2xl font-bold text-gray-800 mb-6">
            <i class="fas fa-chart-pie text-blue-600 mr-2"></i>Parcial por Setor
          </h2>
          <div class="space-y-4">
            <div 
              v-for="setor in setoresComAnalise"
              :key="setor.nome"
              @click="abrirModalSetorLocal('setor', [setor])"
              class="bg-white rounded-lg p-6 shadow hover:shadow-lg transition cursor-pointer"
            >
              <div class="flex items-center justify-between mb-4">
                <div>
                  <h3 class="font-bold text-lg text-gray-800">{{ setor.nome }}</h3>
                  <p class="text-sm text-gray-600">Total: {{ setor.total }} itens</p>
                </div>
                <div class="text-right">
                  <p class="text-3xl font-bold text-orange-600">{{ setor.pendentes }}</p>
                  <p class="text-sm text-gray-600">pendentes</p>
                  <p class="text-xs font-semibold mt-1" :class="setor.classificacaoClass">{{ setor.classificacao }}</p>
                </div>
              </div>
              <div class="space-y-3">
                <div>
                  <div class="flex justify-between text-sm mb-2">
                    <span class="text-gray-700">Concluído</span>
                    <span class="font-bold text-green-600">{{ setor.percentualConclusao.toFixed(2) }}%</span>
                  </div>
                  <div class="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      :style="{ width: Math.min(setor.percentualConclusao, 100) + '%' }"
                      class="h-full bg-green-500"
                    />
                  </div>
                </div>
                <div>
                  <div class="flex justify-between text-sm mb-2">
                    <span class="text-gray-700">Pendente</span>
                    <span class="font-bold" :class="setor.percentualPendente <= 3 ? 'text-green-600' : 'text-orange-600'">
                      {{ setor.percentualPendente.toFixed(2) }}%
                    </span>
                  </div>
                  <div class="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      :style="{ width: Math.min(setor.percentualPendente, 100) + '%' }"
                      class="h-full bg-orange-500"
                    />
                  </div>
                  <p class="text-xs text-gray-500 mt-1">Meta: 3%</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Locais com Mais Itens para Ler -->
        <div>
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-2xl font-bold text-gray-800">
              <i class="fas fa-map-marker-alt text-red-600 mr-2"></i>Locais com Mais Itens para Ler
            </h2>
            <!-- Toggle de Visualização -->
            <div class="flex gap-2">
              <button
                @click="viewModeLocais = 'grid'"
                :class="['px-4 py-2 rounded font-medium transition', viewModeLocais === 'grid' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300']"
              >
                <i class="fas fa-th mr-2"></i>Grade
              </button>
              <button
                @click="viewModeLocais = 'list'"
                :class="['px-4 py-2 rounded font-medium transition', viewModeLocais === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300']"
              >
                <i class="fas fa-list mr-2"></i>Lista
              </button>
            </div>
          </div>
          
          <!-- Visualização em Grade -->
          <div v-if="viewModeLocais === 'grid'" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div 
              v-for="(local, i) in locaisComAnalise"
              :key="local.nome"
              @click="abrirModalSetorLocal('local', [local])"
              class="bg-white rounded-lg p-6 shadow hover:shadow-lg transition cursor-pointer border-l-4"
              :class="local.percentualLido >= 75 ? 'border-green-500' : local.percentualLido >= 50 ? 'border-yellow-500' : 'border-red-500'"
            >
              <div class="flex items-start justify-between mb-4">
                <div class="flex-1">
                  <h4 class="font-bold text-lg text-gray-800">{{ local.nome }}</h4>
                  <p class="text-sm text-gray-500 mt-1">Total: {{ local.total }} itens</p>
                </div>
                <div class="text-right">
                  <p class="text-3xl font-bold text-red-600">{{ local.pendentes }}</p>
                  <p class="text-xs text-gray-600">pendentes</p>
                </div>
              </div>
              <div class="space-y-2">
                <div class="flex justify-between text-sm">
                  <span class="text-green-600 font-medium">✓ {{ local.lidos }} lidos</span>
                  <span class="text-orange-600 font-medium">⏳ {{ local.pendentes }} pendentes</span>
                </div>
                <div class="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    :style="{ width: local.percentualLido + '%' }"
                    class="h-full bg-linear-to-r from-blue-500 to-green-500"
                  />
                </div>
                  <p class="text-xs text-gray-600 text-center">{{ local.percentualLido.toFixed(2) }}% concluído</p>
              </div>
            </div>
          </div>
          
          <!-- Visualização em Lista -->
          <div v-else class="bg-white rounded-lg shadow overflow-hidden">
            <table class="w-full">
              <thead class="bg-gray-100 border-b">
                <tr>
                  <th class="px-6 py-4 text-left font-semibold text-gray-700">#</th>
                  <th class="px-6 py-4 text-left font-semibold text-gray-700">Local</th>
                  <th class="px-6 py-4 text-right font-semibold text-gray-700">Lidos</th>
                  <th class="px-6 py-4 text-right font-semibold text-gray-700">Pendentes</th>
                  <th class="px-6 py-4 text-right font-semibold text-gray-700">Problema</th>
                  <th class="px-6 py-4 text-right font-semibold text-gray-700">Total</th>
                  <th class="px-6 py-4 text-right font-semibold text-gray-700">%</th>
                </tr>
              </thead>
              <tbody class="divide-y">
                <tr 
                  v-for="(local, i) in locaisComAnalise"
                  :key="local.nome"
                  @click="abrirModalSetorLocal('local', [local])"
                  class="hover:bg-blue-50 transition cursor-pointer"
                >
                  <td class="px-6 py-4 text-center font-bold text-gray-400">{{ i + 1 }}</td>
                  <td class="px-6 py-4 font-medium text-gray-800">{{ local.nome }}</td>
                  <td class="px-6 py-4 text-right text-green-600 font-semibold">{{ local.lidos }}</td>
                  <td class="px-6 py-4 text-right text-orange-600 font-semibold">{{ local.pendentes }}</td>
                  <td class="px-6 py-4 text-right text-red-600 font-semibold">{{ local.comProblema || 0 }}</td>
                  <td class="px-6 py-4 text-right font-semibold text-blue-600">{{ local.total }}</td>
                  <td class="px-6 py-4 text-right font-bold text-blue-600">{{ local.percentualLido.toFixed(2) }}%</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div v-if="locaisComAnalise.length === 0" class="bg-white rounded-lg p-8 text-center text-gray-500">
            <i class="fas fa-map-marker-alt text-4xl text-gray-300 mb-4"></i>
            <p>Nenhum local encontrado com itens para ler</p>
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
        <div class="bg-linear-to-r from-blue-600 to-blue-800 text-white p-4 flex items-center justify-between">
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
          <input
            v-model="filtroItens"
            type="text"
            placeholder="🔍 Buscar por código, produto..."
            class="px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-[200px]"
          />
          <select
            v-model="filtroStatusItens"
            class="px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="Filtrar por status"
          >
            <option value="todos">Todos os status</option>
            <option value="lido">Apenas Lidos</option>
            <option value="pendente">Apenas Pendentes</option>
          </select>
          <select
            v-model="ordenacaoItens.coluna"
            class="px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="Código">Ordenar por Código</option>
            <option value="Produto">Ordenar por Produto</option>
            <option value="Estoque atual">Ordenar por Estoque</option>
            <option value="Dias sem venda">Ordenar por Dias sem Venda</option>
          </select>
          <select
            v-model="ordenacaoItens.direcao"
            class="px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="asc">Crescente</option>
            <option value="desc">Decrescente</option>
          </select>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-4" ref="printAreaItens" data-pdf-area="itens">
          <div class="bg-white rounded-lg shadow overflow-hidden">
            <!-- Cabeçalho específico para PDF -->
            <div class="hidden pdf-print-show text-xs text-gray-700 p-2 border-b">
              <div><strong>Local:</strong> {{ tituloModalItens }}</div>
            </div>
            <table class="w-full text-sm border border-gray-200">
              <thead class="bg-gray-100 border-b sticky top-0">
                <tr>
                  <th class="px-4 py-3 text-left font-semibold text-gray-700">Código</th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-700">Produto</th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-700 hidden pdf-only">Local</th>
                  <th class="px-4 py-3 text-right font-semibold text-gray-700">Estoque</th>
                  <th class="px-4 py-3 text-right font-semibold text-gray-700">Dias sem Venda</th>
                  <th class="px-4 py-3 text-center font-semibold text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody class="divide-y">
                <tr 
                  v-for="(item, idx) in itensModalFiltrados" 
                  :key="idx" 
                  class="hover:bg-blue-50 transition"
                >
                  <td class="px-4 py-3 font-bold text-gray-900">{{ item['Código'] || '-' }}</td>
                  <td class="px-4 py-3 text-gray-800">{{ item['Produto'] || '-' }}</td>
                  <td class="px-4 py-3 text-gray-700 hidden pdf-only">{{ item['Local'] || item['Local '] || '-' }}</td>
                  <td class="px-4 py-3 text-right font-semibold">{{ item._estoque !== undefined ? item._estoque : (extrairEstoque(item) || 0) }}</td>
                  <td class="px-4 py-3 text-right text-gray-600">{{ item['Dias sem venda'] || 0 }}</td>
                  <td class="px-4 py-3 text-center">
                    <span class="pdf-hide" :class="getStatusItem(item).classe">
                      {{ getStatusItem(item).texto }}
                    </span>
                    <span class="pdf-only text-gray-800 font-semibold">
                      {{ (item._temPresenca !== undefined ? item._temPresenca : (item['Presença confirmada'] || false)) ? 'Lido' : 'Não lido' }}
                    </span>
                  </td>
                </tr>
                <tr v-if="itensModalFiltrados.length === 0">
                  <td colspan="6" class="px-4 py-6 text-center text-gray-500">Nenhum item encontrado</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Footer -->
        <div class="bg-gray-50 px-4 py-2 flex justify-between items-center print:hidden">
          <p class="text-sm text-gray-600">Mostrando {{ itensModalFiltrados.length }} de {{ itensModal.length }} itens</p>
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
      @click.stop="fecharModalRelatorio"
    >
      <div 
        ref="printAreaRelatorio"
        data-pdf-area="relatorio"
        class="modal-relatorio-container bg-white rounded-lg shadow-2xl w-full max-w-7xl overflow-hidden flex flex-col print:max-w-full print:shadow-none"
        @click.stop
        style="max-height: 95vh;"
      >
        <!-- Header -->
        <div class="bg-linear-to-r from-blue-600 to-blue-800 text-white p-4 flex items-center justify-between print:bg-blue-800">
          <div>
            <h2 class="text-xl font-bold">Relatório de Auditoria</h2>
            <p class="text-blue-100 text-sm">{{ auditoria.tipo }} - {{ dataAuditoriaBR }}</p>
          </div>
          <button
            @click="fecharModalRelatorio"
            class="text-white hover:opacity-80 transition print:hidden"
          >
            <i class="fas fa-times text-xl"></i>
          </button>
        </div>

        <!-- Content - Compacto para Print -->
        <div class="overflow-y-auto p-4 space-y-3 text-sm">
          <!-- Resultado Geral com Destaque para % Pendente -->
          <div class="bg-gradient-to-r from-orange-50 to-red-50 rounded-lg p-4 border-l-4 border-orange-600">
            <div class="grid grid-cols-4 gap-3 mb-3">
              <div>
                <p class="text-xs text-gray-600">Total Auditável</p>
                <p class="text-lg font-bold text-blue-600">{{ dadosRelatorio?.resultadoGeral.totalAuditaveis }}</p>
              </div>
              <div>
                <p class="text-xs text-gray-600">Total Lidos</p>
                <p class="text-lg font-bold text-green-600">{{ dadosRelatorio?.resultadoGeral.totalLidos }}</p>
              </div>
              <div>
                <p class="text-xs text-gray-600">Pendentes</p>
                <p class="text-lg font-bold text-orange-600">{{ dadosRelatorio?.resultadoGeral.pendentes }}</p>
              </div>
              <div class="bg-white rounded p-2 border-2" :class="dadosRelatorio?.resultadoGeral.percentualPendente <= 3 ? 'border-green-500' : 'border-orange-500'">
                <p class="text-xs font-bold text-gray-700">% PENDENTE</p>
                <p class="text-2xl font-bold" :class="dadosRelatorio?.resultadoGeral.percentualPendente <= 3 ? 'text-green-600' : 'text-orange-600'">
                  {{ dadosRelatorio?.resultadoGeral.percentualPendente.toFixed(2) }}%
                </p>
                <p class="text-xs" :class="dadosRelatorio?.resultadoGeral.percentualPendente <= 3 ? 'text-green-600' : 'text-orange-600'">
                  Meta: 3%
                </p>
              </div>
            </div>
            <div class="bg-white rounded p-2 text-xs">
              <p class="font-semibold text-gray-800">
                <span v-if="dadosRelatorio?.resultadoGeral.faltaParaMeta > 0" class="text-red-600">
                  ⚠️ Faltam {{ dadosRelatorio?.resultadoGeral.faltaParaMeta.toFixed(2) }}% ({{ dadosRelatorio?.resultadoGeral.itensFaltam }} itens) para meta
                </span>
                <span v-else class="text-green-600 font-bold">
                  ✅ Meta atingida!
                </span>
              </p>
            </div>
          </div>

          <!-- Grid lado a lado para Setores e Top Locais -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <!-- Setores - Tabela Compacta -->
            <div>
              <h3 class="text-sm font-bold text-gray-800 mb-2">Análise por Setor</h3>
              <div class="bg-white rounded border overflow-hidden">
                <table class="w-full text-xs">
                  <thead class="bg-gray-100 border-b">
                    <tr>
                      <th class="px-2 py-2 text-left font-semibold text-gray-700">Setor</th>
                      <th class="px-2 py-2 text-right font-semibold text-gray-700">Pendentes</th>
                      <th class="px-2 py-2 text-right font-semibold text-gray-700">% Pend</th>
                      <th class="px-2 py-2 text-center font-semibold text-gray-700">Classif</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y">
                    <tr
                      v-for="setor in dadosRelatorio?.setores"
                      :key="setor.nome"
                      class="hover:bg-blue-50"
                      :class="[
                        setor.classificacao === 'Excelente'
                          ? 'bg-green-50'
                          : setor.classificacao === 'Bom'
                            ? 'bg-green-50/60'
                            : setor.classificacao === 'Regular'
                              ? 'bg-yellow-50'
                              : 'bg-red-50'
                      ]"
                    >
                      <td class="px-2 py-2 font-medium text-gray-800 text-xs">{{ setor.nome }}</td>
                      <td class="px-2 py-2 text-right font-semibold">{{ setor.pendentes }}</td>
                      <td class="px-2 py-2 text-right font-bold" :class="setor.percentualPendente <= 3 ? 'text-green-600' : 'text-orange-600'">
                        {{ setor.percentualPendente.toFixed(2) }}%
                        <div class="text-[10px] font-normal text-gray-500">SKU: {{ setor.total }}</div>
                      </td>
                      <td class="px-2 py-2 text-center">
                        <span class="px-2 py-0.5 rounded text-xs font-semibold" :class="setor.classificacaoClass + ' bg-opacity-20'">
                          {{ setor.classificacao }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Top 20 Locais - Tabela Compacta -->
            <div>
              <h3 class="text-sm font-bold text-gray-800 mb-2">Top 20 Locais com Mais Pendentes</h3>
              <div class="bg-white rounded border overflow-hidden">
                <table class="w-full text-xs">
                  <thead class="bg-gray-100 border-b">
                    <tr>
                      <th class="px-2 py-2 text-center font-semibold text-gray-700">#</th>
                      <th class="px-2 py-2 text-left font-semibold text-gray-700">Local</th>
                      <th class="px-2 py-2 text-right font-semibold text-gray-700">Pend</th>
                      <th class="px-2 py-2 text-right font-semibold text-gray-700">Total</th>
                      <th class="px-2 py-2 text-right font-semibold text-gray-700">% Pend</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y">
                    <tr v-for="(local, i) in dadosRelatorio?.topLocaisPendentes" :key="local.nome" class="hover:bg-orange-50">
                      <td class="px-2 py-2 text-center font-bold text-gray-400">{{ i + 1 }}</td>
                      <td class="px-2 py-2 font-medium text-gray-800">{{ local.nome }}</td>
                      <td class="px-2 py-2 text-right font-semibold text-orange-600">{{ local.pendentes }}</td>
                      <td class="px-2 py-2 text-right text-gray-600">{{ local.total }}</td>
                      <td class="px-2 py-2 text-right font-bold text-orange-600">{{ local.percentualPendente.toFixed(2) }}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Locais Sem Leitura -->
          <div v-if="dadosRelatorio?.locaisSemLeitura.length > 0" class="bg-red-50 border-l-4 border-red-500 rounded p-2">
            <h3 class="text-xs font-bold text-gray-800 mb-2">Locais Sem Leitura</h3>
            <div class="flex flex-wrap gap-1">
              <span 
                v-for="local in dadosRelatorio.locaisSemLeitura" 
                :key="local"
                class="px-2 py-0.5 bg-red-100 text-red-800 rounded text-xs"
              >
                {{ local }}
              </span>
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
            @click="fecharModalRelatorio"
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
        <div class="bg-linear-to-r from-blue-600 to-purple-700 text-white p-4 flex items-center justify-between">
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
</style>
