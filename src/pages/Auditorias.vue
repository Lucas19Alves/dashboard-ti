<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuditoriasStore } from '../stores/auditoriasStore'
import { criarPreviaPlanilha } from '../utils/planilha'
import { metricasAuditoria } from '../utils/metricasAuditoria'
import StatCard from '../components/ui/StatCard.vue'
import UiPageHeader from '../components/ui/UiPageHeader.vue'
import UiTabs from '../components/ui/UiTabs.vue'

const store = useAuditoriasStore()
const router = useRouter()
const route = useRoute()
const abaAtiva = ref('calendario')
const abasAuditoria = [
  { value: 'calendario', label: 'Calendário', icon: 'fas fa-calendar' },
  { value: 'Etiqueta', label: 'Etiqueta', icon: 'fas fa-tag' },
  { value: 'Presença', label: 'Presença', icon: 'fas fa-check-square' },
  { value: 'Ruptura', label: 'Ruptura', icon: 'fas fa-exclamation-triangle' }
]
const semanaOffset = ref(0) // 0 = atual, -1 = anterior, 1 = próxima

// Os cards refletem sempre o SKU e a análise mais recentes.
const getMetricasCard = metricasAuditoria

// Filtros e Paginação
const filtroTexto = ref('')
const ordenacao = ref('data_desc') // data_desc, data_asc, progresso_desc, progresso_asc
const paginaAtual = ref(1)
const itensPorPagina = 8

// Filtro de Data
const mostrarFiltroData = ref(false)
const filtroDataTipo = ref('todas') // todas, especifica, periodo, apartir, antes
const filtroDataInicio = ref('')
const filtroDataFim = ref('')

const filtroDataInicioExibicao = computed({
  get() {
    if (!filtroDataInicio.value) return ''
    const [ano, mes, dia] = filtroDataInicio.value.split('-')
    return `${dia}/${mes}/${ano}`
  },
  set(valor) {
    if (valor.length === 10) {
      const [dia, mes, ano] = valor.split('/')
      if (dia && mes && ano && !isNaN(dia) && !isNaN(mes) && !isNaN(ano)) {
        filtroDataInicio.value = `${ano}-${mes}-${dia}`
      }
    } else if (valor === '') {
      filtroDataInicio.value = ''
    }
  }
})

const filtroDataFimExibicao = computed({
  get() {
    if (!filtroDataFim.value) return ''
    const [ano, mes, dia] = filtroDataFim.value.split('-')
    return `${dia}/${mes}/${ano}`
  },
  set(valor) {
    if (valor.length === 10) {
      const [dia, mes, ano] = valor.split('/')
      if (dia && mes && ano && !isNaN(dia) && !isNaN(mes) && !isNaN(ano)) {
        filtroDataFim.value = `${ano}-${mes}-${dia}`
      }
    } else if (valor === '') {
      filtroDataFim.value = ''
    }
  }
})

const handleFiltroDataInput = (e, tipo) => {
  let v = e.target.value.replace(/\D/g, '')
  if (v.length > 8) v = v.slice(0, 8)
  
  if (v.length > 4) {
    v = v.replace(/^(\d{2})(\d{2})(\d{0,4})/, '$1/$2/$3')
  } else if (v.length > 2) {
    v = v.replace(/^(\d{2})(\d{0,2})/, '$1/$2')
  }
  
  e.target.value = v
  
  if (tipo === 'inicio') {
    filtroDataInicioExibicao.value = v
  } else {
    filtroDataFimExibicao.value = v
  }
}

// Resetar paginação ao trocar de aba
watch(abaAtiva, () => {
  paginaAtual.value = 1
  filtroTexto.value = ''
})

const formulario = ref({
  arquivo: null,
  tipo: 'Etiqueta',
  data: new Date().toISOString().split('T')[0],
  sku: ''
})
const diaSelecionado = ref(null)
const mostrarModalExclusao = ref(false)
const idParaExcluir = ref(null)
const mostrarModalFechamento = ref(false)
const idParaFechar = ref(null)

const processando = ref(false)
const arrastandoUpload = ref(false)
const erroUpload = ref('')
const previaArquivo = ref(null)
const carregandoPrevia = ref(false)

const submeterAuditoria = async () => {
  if (!formulario.value.arquivo) {
    store.addToast('Selecione um arquivo Excel!', 'warning')
    return
  }
  
  if (!formulario.value.tipo) {
    store.addToast('Selecione o tipo de auditoria!', 'warning')
    return
  }

  if (!formulario.value.sku || parseInt(formulario.value.sku) <= 0) {
    store.addToast('Informe a quantidade total de itens a auditar (SKU)!', 'warning')
    return
  }
  
  processando.value = true
  
  try {
    // Processar arquivo
    let dados = []
    const tipo = formulario.value.tipo
    const temEtiqueta = typeof store.processarExcelEtiqueta === 'function'
    const temRuptura = typeof store.processarExcelRuptura === 'function'
    const optsRuptura = {
      dataAuditoria: formulario.value.data,
      tipoAuditoria: tipo
    }
    if (tipo === 'Presença') {
      dados = await store.processarExcelPresenca(formulario.value.arquivo)
    } else if (tipo === 'Ruptura') {
      dados = temRuptura
        ? await store.processarExcelRuptura(formulario.value.arquivo, optsRuptura)
        : await store.processarExcelPresenca(formulario.value.arquivo, optsRuptura)
    } else if (tipo === 'Etiqueta') {
      dados = temEtiqueta
        ? await store.processarExcelEtiqueta(formulario.value.arquivo)
        : await store.processarExcelPresenca(formulario.value.arquivo)
    } else {
      dados = await store.processarExcelPresenca(formulario.value.arquivo, { tipo: tipo, dataAuditoria: formulario.value.data })
    }
    
    if (!dados || dados.length === 0) {
      store.addToast('Arquivo vazio ou inválido!', 'warning')
      return
    }

    // Usar o tipo que foi selecionado no formulário
    const tipoEfetivo = formulario.value.tipo
    const skuValor = parseInt(formulario.value.sku) || 0
    const temAnaliseEtiqueta = typeof store.analisarDadosEtiqueta === 'function'
    const temAnaliseRuptura = typeof store.analisarDadosRuptura === 'function'
    const analise = tipoEfetivo === 'Presença'
      ? store.analisarDadosPresenca(dados, skuValor)
      : tipoEfetivo === 'Ruptura'
        ? (temAnaliseRuptura ? store.analisarDadosRuptura(dados, skuValor) : store.analisarDadosPresenca(dados, skuValor))
      : tipoEfetivo === 'Etiqueta'
        ? (temAnaliseEtiqueta ? store.analisarDadosEtiqueta(dados, skuValor) : store.analisarDadosPresenca(dados, skuValor))
        : store.analisarDadosPresenca(dados, skuValor)
    
    // Criar auditoria com dados já processados
    const novaAuditoria = await store.addAuditoria({
      sku: skuValor || analise.totalItens,
      tipo: tipoEfetivo,
      data: formulario.value.data,
      dados: dados,
      analise: analise,
      parcial: analise.parcialPercentual,
      total: analise.totalItens
    })

    store.addToast(`Auditoria criada com sucesso! ${dados.length} itens carregados.`, 'success')
    
    // Redirecionar para a página de detalhes
    router.push(`/auditoria/${novaAuditoria.id}`)

    // Limpar formulário
    formulario.value = {
      arquivo: null,
      tipo: 'Etiqueta',
      data: new Date().toISOString().split('T')[0],
      sku: ''
    }
  } catch (erro) {
    console.error('Erro ao processar:', erro)
    store.addToast('Erro ao processar arquivo: ' + erro.message, 'error')
  } finally {
    processando.value = false
  }
}

const validarArquivoUpload = (file) => {
  erroUpload.value = ''
  if (!file) return false
  const permitido = ['.xlsx', '.csv']
  const nome = file.name.toLowerCase()
  const okExt = permitido.some(ext => nome.endsWith(ext))
  if (!okExt) {
    erroUpload.value = 'Tipo inválido. Use .xlsx ou .csv.'
    return false
  }
  const max = 20 * 1024 * 1024
  if (file.size > max) {
    erroUpload.value = 'Arquivo acima de 20MB.'
    return false
  }
  return true
}

const handleFileChange = async (event) => {
  const files = event.target.files
  if (files && files.length > 0) {
    const file = files[0]
    if (!validarArquivoUpload(file)) return
    formulario.value.arquivo = file
    carregandoPrevia.value = true
    if (typeof store.detectarTipoArquivo === 'function') {
      try {
        const [t, previa] = await Promise.all([
          store.detectarTipoArquivo(file),
          criarPreviaPlanilha(file)
        ])
        previaArquivo.value = previa
        if (t && ['Etiqueta', 'Presença', 'Ruptura'].includes(t)) {
          formulario.value.tipo = t
          store.addToast(`Tipo detectado automaticamente: ${t}`, 'info')
        }
      } catch (error) {
        erroUpload.value = error?.message || 'Não foi possível analisar o arquivo.'
        formulario.value.arquivo = null
        previaArquivo.value = null
      } finally {
        carregandoPrevia.value = false
      }
    }
  }
}

const onDragOverUpload = () => {
  arrastandoUpload.value = true
}
const onDragLeaveUpload = () => {
  arrastandoUpload.value = false
}
const onDropUpload = (e) => {
  arrastandoUpload.value = false
  const dt = e.dataTransfer
  if (!dt || !dt.files || dt.files.length === 0) return
  const file = dt.files[0]
  if (!validarArquivoUpload(file)) return
  formulario.value.arquivo = file
  carregandoPrevia.value = true
  criarPreviaPlanilha(file)
    .then(previa => { previaArquivo.value = previa })
    .catch(error => {
      erroUpload.value = error?.message || 'Não foi possível analisar o arquivo.'
      formulario.value.arquivo = null
      previaArquivo.value = null
    })
    .finally(() => { carregandoPrevia.value = false })
}
const abrirSeletorUpload = () => {
  const input = document.getElementById('fileInputNovaAuditoria')
  if (input) input.click()
}

const obterHorarioFim = (tipo) => {
  return tipo === 'Etiqueta' ? '20:00' : '18:00'
}

const obterHorarioMaximoDia = (data) => {
  const mapa = auditoriasPorDiaTipo.value || {}
  const porData = mapa[data]
  if (!porData) {
    // Se não há auditorias, verificar tipos planejados
    const tiposDodia = tiposPlanejados.value[semanaAtual.value.find(d => d.data === data)?.dayIndex] || []
    if (tiposDodia.includes('Etiqueta')) return '20:00'
    return '18:00'
  }
  // Se há auditorias, retornar o horário máximo entre seus tipos
  const tipos = Object.keys(porData)
  if (tipos.includes('Etiqueta')) return '20:00'
  return '18:00'
}

// Computed
const auditoriasFiltradas = computed(() => {
  let auditorias = []
  
  // Seleção Base
  if (!abaAtiva.value || abaAtiva.value === 'calendario') {
    // No calendário mostra apenas as ativas para não poluir
    auditorias = store.auditorias.filter(a => a.status === 'em_andamento')
  } else {
    // Nas abas de tipo, mostra TUDO (ativas + histórico)
    auditorias = store.auditorias.filter(a => a.tipo === abaAtiva.value)
  }

  // Filtro de Texto
  if (filtroTexto.value) {
    const termo = filtroTexto.value.toLowerCase()
    auditorias = auditorias.filter(a => 
      a.id.toString().includes(termo) ||
      (a.sku && a.sku.toString().toLowerCase().includes(termo))
    )
  }

  // Filtro de Data
  if (filtroDataTipo.value !== 'todas' && filtroDataInicio.value) {
    auditorias = auditorias.filter(a => {
      // Garantir que a data da auditoria está no formato YYYY-MM-DD para comparação de string
      const dataAuditoria = a.data.substring(0, 10)
      const inicio = filtroDataInicio.value
      const fim = filtroDataFim.value

      switch (filtroDataTipo.value) {
        case 'especifica':
          return dataAuditoria === inicio
        case 'periodo':
          return fim ? (dataAuditoria >= inicio && dataAuditoria <= fim) : (dataAuditoria >= inicio)
        case 'apartir':
          return dataAuditoria >= inicio
        case 'antes':
          return dataAuditoria <= inicio
        default:
          return true
      }
    })
  }

  // Ordenação
  auditorias.sort((a, b) => {
    const dataA = new Date(a.data)
    const dataB = new Date(b.data)
    const progressoA = getMetricasCard(a).percentualConclusao
    const progressoB = getMetricasCard(b).percentualConclusao

    switch (ordenacao.value) {
      case 'data_asc': return dataA - dataB
      case 'data_desc': return dataB - dataA
      case 'progresso_asc': return progressoA - progressoB
      case 'progresso_desc': return progressoB - progressoA
      default: return dataB - dataA
    }
  })

  return auditorias
})

const totalPaginas = computed(() => Math.ceil(auditoriasFiltradas.value.length / itensPorPagina))

const auditoriasPaginadas = computed(() => {
  const inicio = (paginaAtual.value - 1) * itensPorPagina
  return auditoriasFiltradas.value.slice(inicio, inicio + itensPorPagina)
})

const totalAuditorias = computed(() => Array.isArray(store.auditorias) ? store.auditorias.length : 0)
const auditoriasAbertas = computed(() =>
  Array.isArray(store.auditorias) ? store.auditorias.filter(a => a && a.status !== 'fechada') : []
)
const auditoriasFechadas = computed(() =>
  Array.isArray(store.auditorias) ? store.auditorias.filter(a => a && a.status === 'fechada') : []
)

const parcialMediaGeral = computed(() => {
  const lista = Array.isArray(store.auditorias) ? store.auditorias.filter(a => a) : []
  if (!lista.length) return 0
  const soma = lista.reduce((acc, a) => {
    if (!a.analise) return acc
    const analise = a.analise
    const v = typeof analise.parcialPercentual === 'number' ? analise.parcialPercentual : 0
    return acc + (Number.isFinite(v) ? v : 0)
  }, 0)
  return soma / lista.length
})

const statusAuditorias = computed(() => {
  const total = totalAuditorias.value
  const abertas = auditoriasAbertas.value.length
  if (!total) {
    return {
      titulo: 'Nenhuma auditoria cadastrada',
      descricao: 'Use o calendário para iniciar uma nova auditoria.',
      classe: 'bg-gray-100 text-gray-700'
    }
  }
  if (abertas > 0) {
    return {
      titulo: 'Auditorias em andamento',
      descricao: `${abertas} de ${total} auditorias estão abertas para acompanhamento.`,
      classe: 'bg-blue-50 text-blue-800'
    }
  }
  return {
    titulo: 'Todas as auditorias fechadas',
    descricao: 'Nenhuma auditoria aberta no momento.',
    classe: 'bg-green-50 text-green-800'
  }
})

const excluirAuditoria = (id) => {
  idParaExcluir.value = id
  mostrarModalExclusao.value = true
}

const confirmarExclusao = () => {
  if (idParaExcluir.value) {
    store.deleteAuditoria(idParaExcluir.value)
    store.addToast('Auditoria removida com sucesso!', 'success')
  }
  fecharModalExclusao()
}

const fecharModalExclusao = () => {
  mostrarModalExclusao.value = false
  idParaExcluir.value = null
}

const fecharAuditoria = (id) => {
  idParaFechar.value = id
  mostrarModalFechamento.value = true
}

const confirmarFechamento = async () => {
  if (idParaFechar.value) {
    await store.updateAuditoria(idParaFechar.value, { status: 'fechada' })
    await store.carregarAuditoriasPersistidas()
    store.addToast('Auditoria fechada com sucesso!', 'success')
  }
  fecharModalFechamento()
}

const fecharModalFechamento = () => {
  mostrarModalFechamento.value = false
  idParaFechar.value = null
}

const startOfWeek = (d, offset = 0) => {
  const date = new Date(d)
  const day = date.getDay()
  // Se for Sexta (5), Sábado (6) ou Domingo (0), avançamos para a próxima Segunda (1)
  // Caso contrário (Seg-Qui), mostramos a Segunda desta mesma semana
  let diff
  if (day === 0) { // Domingo
    diff = 1
  } else if (day >= 5) { // Sex ou Sáb
    diff = 1 + (7 - day)
  } else { // Seg a Qui
    diff = 1 - day
  }
  
  // Aplica o offset de semanas
  date.setDate(date.getDate() + diff + (offset * 7))
  date.setHours(0, 0, 0, 0)
  return date
}

const formatISO = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Formata data ISO (YYYY-MM-DD) para formato local (DD/MM/YYYY) sem problemas de fuso horário
const formatarDataISO = (dataISO) => {
  if (!dataISO) return ''
  const [ano, mes, dia] = dataISO.split('-')
  return `${dia}/${mes}/${ano}`
}

const semanaAtual = computed(() => {
  const hoje = new Date()
  const inicio = startOfWeek(hoje, semanaOffset.value)
  const dias = []
  
  for (let i = 0; i < 7; i++) {
    const d = new Date(inicio)
    d.setDate(inicio.getDate() + i)
    // Filter for Mon (1), Tue (2), Wed (3), Thu (4)
    if (d.getDay() >= 1 && d.getDay() <= 4) {
      dias.push({
        data: formatISO(d),
        label: d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }),
        dia: d,
        dayIndex: d.getDay()
      })
    }
  }
  // Garante a ordem Seg (1), Ter (2), Qua (3), Qui (4)
  return dias.sort((a, b) => a.dayIndex - b.dayIndex)
})

const labelSemanaSelecionada = computed(() => {
  const dias = semanaAtual.value
  if (!dias.length) return ''
  const prim = dias[0].dia
  const ult = dias[dias.length - 1].dia
  
  const f = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  const fAno = (d) => d.getFullYear()
  
  if (prim.getFullYear() !== ult.getFullYear()) {
    return `${f(prim)}/${prim.getFullYear()} a ${f(ult)}/${ult.getFullYear()}`
  }
  return `${f(prim)} a ${f(ult)} de ${fAno(ult)}`
})

const navegarSemana = (direcao) => {
  semanaOffset.value += direcao
}

const voltarHoje = () => {
  semanaOffset.value = 0
}

const auditoriasPorDiaTipo = computed(() => {
  const map = {}
  ;(store.auditorias || []).forEach(a => {
    if (!map[a.data]) map[a.data] = {}
    if (!map[a.data][a.tipo]) map[a.data][a.tipo] = []
    map[a.data][a.tipo].push(a)
  })
  return map
})

const tiposPlanejados = computed(() => store.tiposAuditoriaPorDia || {})

const dataExibicao = computed({
  get() {
    if (!formulario.value.data) return ''
    const [ano, mes, dia] = formulario.value.data.split('-')
    return `${dia}/${mes}/${ano}`
  },
  set(valor) {
    // Tenta formatar DD/MM/AAAA para AAAA-MM-DD
    if (valor.length === 10) {
      const [dia, mes, ano] = valor.split('/')
      if (dia && mes && ano && !isNaN(dia) && !isNaN(mes) && !isNaN(ano)) {
        formulario.value.data = `${ano}-${mes}-${dia}`
      }
    }
  }
})

const handleDataInput = (e) => {
  let v = e.target.value.replace(/\D/g, '')
  if (v.length > 8) v = v.slice(0, 8)
  
  if (v.length > 4) {
    v = v.replace(/^(\d{2})(\d{2})(\d{0,4})/, '$1/$2/$3')
  } else if (v.length > 2) {
    v = v.replace(/^(\d{2})(\d{0,2})/, '$1/$2')
  }
  
  e.target.value = v
  dataExibicao.value = v
}

const criarAPartirCalendario = (data, tipo, label) => {
  formulario.value.data = data
  formulario.value.tipo = tipo
  diaSelecionado.value = { data, label }
}

const abrirDia = (dia) => {
  const data = dia && dia.data ? dia.data : dia
  const label = dia && dia.label ? dia.label : ''
  const mapa = auditoriasPorDiaTipo.value || {}
  const porData = mapa[data]

  // Se há auditorias existentes, navega para uma
  if (porData) {
    const preferencia = ['Presença', 'Etiqueta', 'Ruptura']
    for (const t of preferencia) {
      const lista = porData[t]
      if (lista && lista.length > 0) {
        router.push(`/auditoria/${lista[0].id}`)
        return
      }
    }
    const qualquer = Object.values(porData).flat()
    if (qualquer.length > 0) {
      router.push(`/auditoria/${qualquer[0].id}`)
      return
    }
  }

  // Se não há auditorias, simula clicar no primeiro botão disponível
  const tiposDodia = tiposPlanejados.value[dia.dayIndex] || []

  if (tiposDodia.length > 0) {
    // Chama exatamente como o primeiro botão de tipo planejado faria
    criarAPartirCalendario(data, tiposDodia[0], label)
  } else {
    // Chama exatamente como o botão genérico faria
    criarAPartirCalendario(data, formulario.value.tipo, label)
  }
}

// Atalhos do painel inicial abrem o formulário já preenchido: /auditorias?data=AAAA-MM-DD&tipo=Etiqueta
const abrirCriacaoPelaRota = () => {
  const { data, tipo } = route.query
  if (typeof data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return
  const [ano, mes, dia] = data.split('-').map(Number)
  const label = new Date(ano, mes - 1, dia).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
  const tipoValido = ['Etiqueta', 'Presença', 'Ruptura'].includes(tipo) ? tipo : formulario.value.tipo
  abaAtiva.value = 'calendario'
  criarAPartirCalendario(data, tipoValido, label)
}
abrirCriacaoPelaRota()

const parcialRestante = (a) => {
  if (!a) return 0
  const v = (a.analise && typeof a.analise.parcialPercentual === 'number')
    ? a.analise.parcialPercentual
    : (typeof a.parcial === 'number' ? a.parcial : 0)
  return Number.isFinite(v) ? v : 0
}

const textoMeta = (a) => {
  if (!a) return ''
  return a.metaAlcancada ? 'Dentro da Meta' : 'Fora da Meta'
}

const classesCardDia = (d) => {
  if (diaSelecionado.value && diaSelecionado.value.data === d.data) {
    return 'border-blue-500 bg-blue-50 shadow-lg ring-2 ring-blue-100'
  }
  const mapa = auditoriasPorDiaTipo.value || {}
  const porData = mapa[d.data]
  if (!porData) {
    return 'border-gray-200 bg-gray-50 hover:border-blue-400 hover:bg-gray-100'
  }
  const lista = Object.values(porData).flat()
  const temAberta = lista.some(a => a.status !== 'fechada')
  if (temAberta) {
    return 'border-blue-300 bg-blue-50/60 hover:border-blue-400 hover:bg-blue-50'
  }
  const foraMeta = lista.some(a => a.status === 'fechada' && !a.metaAlcancada)
  if (foraMeta) {
    return 'border-red-200 bg-red-50/60 hover:border-red-400 hover:bg-red-50'
  }
  return 'border-green-200 bg-green-50/60 hover:border-green-400 hover:bg-green-50'
}
</script>

<template>
  <div class="min-h-[calc(100vh-4rem)] px-4 py-6 md:px-8 md:py-8 max-w-7xl mx-auto space-y-6">
      <UiPageHeader title="Auditorias" subtitle="Organize, acompanhe e finalize as auditorias da loja." icon="fas fa-search">
        <template #actions>
          <div class="inline-flex max-w-md flex-col gap-1 rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 sm:flex-row sm:items-center sm:gap-2 md:text-sm">
            <span class="font-semibold">{{ statusAuditorias.titulo }}</span>
            <span class="text-[11px] opacity-80 md:text-xs">{{ statusAuditorias.descricao }}</span>
          </div>
        </template>
      </UiPageHeader>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Auditorias ativas" :value="auditoriasAbertas.length" description="Em andamento no momento." icon="fas fa-play" tone="blue" />
        <StatCard title="Auditorias fechadas" :value="auditoriasFechadas.length" description="Concluídas e disponíveis no histórico." icon="fas fa-lock" tone="green" />
        <StatCard title="Total de auditorias" :value="totalAuditorias" description="Registradas no sistema." icon="fas fa-clipboard-list" tone="indigo" />
        <StatCard title="Parcial média" :value="`${parcialMediaGeral.toFixed(1)}%`" description="Quanto falta em média para entregar." icon="fas fa-chart-line" tone="amber" />
      </div>

      <UiTabs v-model="abaAtiva" :items="abasAuditoria" />

    <!-- Modal de Confirmação de Exclusão -->
    <div
      v-if="mostrarModalExclusao"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      @click.self="fecharModalExclusao"
    >
      <div class="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md transform transition-all scale-100 animate-in fade-in zoom-in duration-200">
        <div class="text-center">
          <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
            <i class="fas fa-exclamation-triangle text-red-600 text-xl"></i>
          </div>
          <h3 class="text-lg font-bold text-gray-900 mb-2">Confirmar Exclusão</h3>
          <p class="text-sm text-gray-500 mb-6">
            Tem certeza que deseja excluir esta auditoria? Esta ação não pode ser desfeita e todos os dados associados serão perdidos.
          </p>
          <div class="flex justify-center gap-3">
            <button
              @click="fecharModalExclusao"
              class="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-200"
            >
              Cancelar
            </button>
            <button
              @click="confirmarExclusao"
              class="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Sim, excluir
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal de Confirmação de Fechamento -->
    <div
      v-if="mostrarModalFechamento"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      @click.self="fecharModalFechamento"
    >
      <div class="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md transform transition-all scale-100 animate-in fade-in zoom-in duration-200">
        <div class="text-center">
          <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 mb-4">
            <i class="fas fa-lock text-yellow-600 text-xl"></i>
          </div>
          <h3 class="text-lg font-bold text-gray-900 mb-2">Confirmar Fechamento</h3>
          <p class="text-sm text-gray-500 mb-6">
            Deseja fechar esta auditoria? Ela não aparecerá mais na lista de ativas, mas poderá ser consultada no histórico.
          </p>
          <div class="flex justify-center gap-3">
            <button
              @click="fecharModalFechamento"
              class="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-200"
            >
              Cancelar
            </button>
            <button
              @click="confirmarFechamento"
              class="px-4 py-2 rounded-lg bg-yellow-600 text-white font-medium hover:bg-yellow-700 transition shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
            >
              Sim, fechar
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Calendário Semanal -->
    <div v-if="abaAtiva === 'calendario'" class="mb-8 space-y-4">
      <div class="bg-white rounded-lg p-6">
        <div class="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <h2 class="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <i class="fas fa-calendar-week text-blue-600"></i>
            <span>Calendário Semanal</span>
          </h2>
          
          <div class="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 shadow-xs">
            <button 
              @click="navegarSemana(-1)"
              class="h-9 w-9 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all shadow-xs"
              title="Semana Anterior"
            >
              <i class="fas fa-chevron-left text-[10px]"></i>
            </button>
            
            <div class="px-4 py-1 text-center min-w-[180px]">
              <span class="text-sm font-bold text-slate-700 block leading-tight">{{ labelSemanaSelecionada }}</span>
              <span v-if="semanaOffset !== 0" class="text-[9px] text-blue-600 font-bold uppercase tracking-wider">
                {{ semanaOffset > 0 ? 'Semana Futura' : 'Semana Passada' }}
              </span>
              <span v-else class="text-[9px] text-emerald-600 font-bold uppercase tracking-wider">
                Semana Atual
              </span>
            </div>
            
            <button 
              @click="navegarSemana(1)"
              class="h-9 w-9 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all shadow-xs"
              title="Próxima Semana"
            >
              <i class="fas fa-chevron-right text-[10px]"></i>
            </button>
            
            <div class="w-px h-5 bg-slate-200 mx-1"></div>
            
            <button 
              @click="voltarHoje"
              class="px-3 h-9 flex items-center justify-center rounded-lg text-xs font-bold transition-all"
              :class="semanaOffset === 0 ? 'bg-slate-100 text-slate-400 cursor-default' : 'bg-white border border-slate-200 text-blue-600 hover:bg-blue-50 hover:border-blue-200 shadow-xs'"
              :disabled="semanaOffset === 0"
            >
              Hoje
            </button>
          </div>
        </div>
        <div class="flex gap-4 overflow-x-auto pb-2 md:flex-wrap md:justify-between md:overflow-visible">
          <div
            v-for="d in semanaAtual"
            :key="d.data"
            class="group min-w-55 md:min-w-0 md:flex-1 md:max-w-xs p-4 rounded-xl border cursor-pointer transition-all relative overflow-hidden"
            @click="abrirDia(d)"
            :class="classesCardDia(d)"
          >
            <div class="flex justify-between items-center mb-3">
              <div class="flex flex-col">
                <span class="text-[11px] uppercase tracking-wide text-gray-400">
                  {{ d.label.split(',')[0] }}
                </span>
                <span class="font-bold text-gray-900 text-lg leading-tight">
                  {{ d.label.split(',')[1] }}
                </span>
              </div>
              <div class="flex flex-col items-end text-right">
                <span class="text-[10px] font-medium text-gray-400">Janela</span>
                <span class="text-xs text-gray-600">08:00 - {{ obterHorarioMaximoDia(d.data) }}</span>
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              <template v-for="tipo in ['Etiqueta', 'Presença', 'Ruptura']" :key="tipo">
                <router-link
                  v-if="auditoriasPorDiaTipo[d.data] && auditoriasPorDiaTipo[d.data][tipo] && auditoriasPorDiaTipo[d.data][tipo].length > 0"
                  :to="`/auditoria/${auditoriasPorDiaTipo[d.data][tipo][0].id}`"
                  @click.stop
                  class="px-3 py-1 rounded-full text-[11px] font-semibold no-underline shadow-sm ring-1 ring-black/5 flex items-center gap-1"
                  :class="[
                    auditoriasPorDiaTipo[d.data][tipo][0].status === 'fechada'
                      ? (auditoriasPorDiaTipo[d.data][tipo][0].metaAlcancada ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')
                      : 'bg-blue-100 text-blue-800'
                  ]"
                  :title="auditoriasPorDiaTipo[d.data][tipo][0].status === 'fechada' ? 'Fechada' : 'Em andamento'"
                >
                  <i class="fas fa-check-circle text-[10px]" v-if="auditoriasPorDiaTipo[d.data][tipo][0].status === 'fechada'"></i>
                  <i class="fas fa-play text-[10px]" v-else></i>
                  {{ tipo }} • {{ auditoriasPorDiaTipo[d.data][tipo][0].status === 'fechada' ? 'Fechada' : 'Aberta' }}
                </router-link>
                <button
                  v-else-if="!auditoriasPorDiaTipo[d.data] && (tiposPlanejados[d.dayIndex] || []).includes(tipo)"
                  @click.stop="criarAPartirCalendario(d.data, tipo, d.label)"
                  class="px-3 py-1 rounded-full text-[11px] font-semibold bg-white/80 border border-dashed border-blue-300 text-blue-700 hover:bg-blue-50 transition shadow-sm flex items-center gap-1"
                  title="Criar auditoria e iniciar acompanhamento"
                >
                  <i class="fas fa-plus text-[10px]"></i>
                  {{ tipo }} • Criar
                </button>
              </template>
              <button
                v-if="!auditoriasPorDiaTipo[d.data] && !(tiposPlanejados[d.dayIndex] || []).length"
                @click.stop="criarAPartirCalendario(d.data, formulario.tipo, d.label)"
                class="px-3 py-1 rounded-full text-[11px] font-semibold bg-white/80 border border-dashed border-blue-300 text-blue-700 hover:bg-blue-50 transition shadow-sm flex items-center gap-1"
              >
                <i class="fas fa-plus text-[10px]"></i>
                Criar Auditoria
              </button>
            </div>
            <div
              v-if="auditoriasPorDiaTipo[d.data]"
              class="mt-2 text-[11px] text-gray-700 space-y-1"
            >
              <div
                v-for="tipo in ['Etiqueta', 'Presença', 'Ruptura']"
                :key="tipo + d.data"
                v-if="auditoriasPorDiaTipo[d.data][tipo] && auditoriasPorDiaTipo[d.data][tipo].length > 0"
                class="flex items-center gap-1"
              >
                <span class="font-semibold">{{ tipo }}</span>
                <span>— {{ parcialRestante(auditoriasPorDiaTipo[d.data][tipo][0]).toFixed(2) }}% pendente —</span>
                <span>{{ textoMeta(auditoriasPorDiaTipo[d.data][tipo][0]) }}</span>
              </div>
            </div>
            <div class="mt-3 flex items-center justify-between text-[11px] text-gray-500">
              <span v-if="auditoriasPorDiaTipo[d.data]">Dia com auditoria</span>
              <span v-else class="italic text-gray-400">Sem auditoria cadastrada</span>
              <span
                v-if="diaSelecionado && diaSelecionado.data === d.data"
                class="inline-flex items-center gap-1 text-blue-700 font-semibold"
              >
                <i class="fas fa-play text-[10px]"></i>
                Selecionado
              </span>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="diaSelecionado"
        class="bg-white rounded-lg shadow-lg p-6"
      >
        <h2 class="text-2xl font-bold text-gray-800 mb-4 flex items-center justify-between">
          <span class="flex items-center gap-2">
            <i class="fas fa-play-circle text-green-600"></i>
            <span>Iniciar acompanhamento</span>
          </span>
          <span class="text-sm text-gray-600">
            Dia selecionado: <span class="font-semibold text-gray-800">{{ diaSelecionado.label }}</span>
          </span>
        </h2>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Arquivo Excel</label>
            <div
              class="relative"
              @dragover.prevent="onDragOverUpload"
              @dragleave.prevent="onDragLeaveUpload"
              @drop.prevent="onDropUpload"
            >
              <input
                id="fileInputNovaAuditoria"
                @change="handleFileChange"
                type="file"
                accept=".xlsx,.csv"
                class="hidden"
              />
              <label
                for="fileInputNovaAuditoria"
                :class="[
                  'block p-6 border-2 border-dashed rounded-lg text-center cursor-pointer transition-all',
                  arrastandoUpload ? 'bg-blue-50 border-blue-600' : 'border-blue-400 hover:bg-blue-50 hover:border-blue-600'
                ]"
              >
                <div class="flex flex-col items-center gap-2">
                  <i class="fas fa-cloud-upload-alt text-4xl text-blue-400"></i>
                  <div>
                    <p class="text-sm font-medium text-gray-700">
                      Clique para selecionar ou arraste o arquivo aqui
                    </p>
                    <p class="text-xs text-gray-500 mt-1">Aceita .xlsx e .csv • até 20MB</p>
                  </div>
                </div>
              </label>
            </div>
            <div v-if="carregandoPrevia" class="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-700">
              <i class="fas fa-spinner fa-spin mr-2"></i>Analisando estrutura da planilha…
            </div>
            <div v-else-if="previaArquivo" class="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <p class="text-sm font-semibold text-slate-800">Pré-visualização validada</p>
                <span class="text-xs font-medium text-slate-500">{{ previaArquivo.totalLinhas }} linhas · {{ previaArquivo.totalColunas }} colunas</span>
              </div>
              <div class="mt-2 flex flex-wrap gap-1.5">
                <span v-for="coluna in previaArquivo.colunas.slice(0, 8)" :key="coluna" class="rounded-md bg-white px-2 py-1 text-[11px] text-slate-600 ring-1 ring-slate-200">
                  {{ coluna }}
                </span>
                <span v-if="previaArquivo.colunas.length > 8" class="px-2 py-1 text-[11px] text-slate-500">+{{ previaArquivo.colunas.length - 8 }}</span>
              </div>
            </div>
            <p class="text-xs text-gray-500 mt-1">Selecione o arquivo Excel com os dados da auditoria</p>
            <p v-if="erroUpload" class="text-xs text-red-600 mt-1">{{ erroUpload }}</p>
            <div
              v-if="formulario.arquivo"
              class="mt-2 bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2"
            >
              <i class="fas fa-check-circle text-green-600"></i>
              <span class="text-sm text-green-800 truncate max-w-xs">{{ formulario.arquivo.name }}</span>
              <button
                @click="abrirSeletorUpload"
                class="ml-auto px-3 py-1.5 rounded bg-green-600 text-white hover:bg-green-700 transition text-xs"
              >
                Trocar
              </button>
              <button
                @click="formulario.arquivo = null"
                class="text-green-700 hover:text-green-900"
                title="Limpar arquivo"
              >
                <i class="fas fa-times"></i>
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Tipo de Auditoria</label>
              <select
                v-model="formulario.tipo"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option>Etiqueta</option>
                <option>Presença</option>
                <option>Ruptura</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Data</label>
              <input
                :value="dataExibicao"
                @input="handleDataInput"
                type="text"
                placeholder="DD/MM/AAAA"
                maxlength="10"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">SKU <span class="text-red-500">*</span></label>
              <input
                v-model="formulario.sku"
                type="number"
                min="1"
                placeholder="Total de itens a auditar"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p class="text-xs text-gray-500 mt-1">Quantidade total de itens do inventário</p>
            </div>
          </div>

          <div class="flex justify-end">
            <button
              @click="submeterAuditoria"
              :disabled="processando || !formulario.arquivo || !formulario.sku"
              class="inline-flex items-center justify-center px-6 py-2 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              <i :class="processando ? 'fas fa-spinner fa-spin' : 'fas fa-play'" class="mr-2"></i>
              <span>{{ processando ? 'Processando...' : 'Iniciar acompanhamento' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Lista de Auditorias -->
    <div class="bg-white rounded-lg shadow-lg">
      <div class="bg-blue-600 text-white px-6 py-4 rounded-t-lg flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-20">
        <h2 class="text-xl font-bold flex items-center gap-2">
          <i class="fas fa-list"></i>
          {{ abaAtiva === 'calendario' ? 'Auditorias Ativas' : `Auditorias de ${abaAtiva}` }}
        </h2>
        <div class="flex flex-col md:flex-row gap-3 w-full md:w-auto items-center">
          
          <!-- Busca Melhorada -->
          <div class="relative w-full md:w-auto group">
            <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors"></i>
            <input
              v-model="filtroTexto"
              type="text"
              placeholder="Buscar SKU ou ID..."
              class="w-full md:w-64 pl-10 pr-4 py-2 rounded-lg bg-white border border-blue-400/30 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50 focus:bg-white transition-all shadow-sm"
            />
          </div>

          <!-- Botão Filtro Data -->
          <div class="relative">
            <button 
              @click="mostrarFiltroData = !mostrarFiltroData"
              class="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-blue-400/30 hover:bg-gray-50 transition-all text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-white/50"
              :class="{'bg-blue-50 border-blue-200 text-blue-700': mostrarFiltroData || filtroDataTipo !== 'todas'}"
            >
              <i class="fas fa-filter text-sm" :class="filtroDataTipo !== 'todas' ? 'text-blue-600' : 'text-gray-400'"></i>
              <span :class="filtroDataTipo !== 'todas' ? 'font-semibold' : ''">{{ filtroDataTipo !== 'todas' ? 'Filtro Ativo' : 'Filtrar Data' }}</span>
              <i class="fas fa-chevron-down text-xs ml-1 opacity-70"></i>
            </button>
            
            <!-- Overlay transparente para fechar ao clicar fora -->
            <div v-if="mostrarFiltroData" class="fixed inset-0 z-40 cursor-default" @click="mostrarFiltroData = false"></div>

            <!-- Dropdown do Filtro -->
            <div 
              v-if="mostrarFiltroData" 
              class="absolute left-0 md:left-auto md:right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-2xl p-4 text-gray-800 z-50 border border-gray-100 animate-in fade-in zoom-in-95 duration-200"
            >
              <div class="flex justify-between items-center mb-3 pb-2 border-b border-gray-100">
                <h3 class="font-bold text-gray-700 flex items-center gap-2">
                  <i class="fas fa-calendar-alt text-blue-600"></i> Filtrar por Data
                </h3>
                <button @click="mostrarFiltroData = false" class="text-gray-400 hover:text-gray-600">
                  <i class="fas fa-times"></i>
                </button>
              </div>

              <div class="space-y-3">
                <div>
                  <label class="block text-xs font-semibold text-gray-500 mb-1">Tipo de Filtro</label>
                  <select 
                    v-model="filtroDataTipo" 
                    class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                  >
                    <option value="todas">Todas as datas</option>
                    <option value="especifica">Data Específica</option>
                    <option value="periodo">Período (Entre)</option>
                    <option value="apartir">A partir de</option>
                    <option value="antes">Antes de</option>
                  </select>
                </div>

                <div v-if="filtroDataTipo !== 'todas'" class="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div>
                    <label class="block text-xs font-semibold text-gray-500 mb-1">
                      {{ filtroDataTipo === 'periodo' ? 'Data Inicial' : 'Data' }}
                    </label>
                    <input 
                      :value="filtroDataInicioExibicao"
                      @input="(e) => handleFiltroDataInput(e, 'inicio')"
                      type="text"
                      placeholder="DD/MM/AAAA"
                      maxlength="10"
                      class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                  </div>
                  
                  <div v-if="filtroDataTipo === 'periodo'">
                    <label class="block text-xs font-semibold text-gray-500 mb-1">Data Final</label>
                    <input 
                      :value="filtroDataFimExibicao"
                      @input="(e) => handleFiltroDataInput(e, 'fim')"
                      type="text"
                      placeholder="DD/MM/AAAA"
                      maxlength="10"
                      class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                  </div>
                </div>

                <div class="pt-2 flex justify-end gap-2">
                  <button 
                    @click="filtroDataTipo = 'todas'; mostrarFiltroData = false"
                    class="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition"
                  >
                    Limpar
                  </button>
                  <button 
                    @click="mostrarFiltroData = false"
                    class="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition shadow-sm"
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Ordenação Melhorada -->
          <div class="relative group">
             <i class="fas fa-sort absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none group-hover:text-blue-600 transition-colors"></i>
             <select
              v-model="ordenacao"
              class="appearance-none pl-9 pr-8 py-2 rounded-lg bg-white border border-blue-400/30 text-gray-700 focus:outline-none focus:ring-2 focus:ring-white/50 cursor-pointer hover:bg-gray-50 transition-all shadow-sm text-sm"
            >
              <option value="data_desc" class="text-gray-800">Mais Recentes</option>
              <option value="data_asc" class="text-gray-800">Mais Antigas</option>
              <option value="progresso_desc" class="text-gray-800">Maior Progresso</option>
              <option value="progresso_asc" class="text-gray-800">Menor Progresso</option>
            </select>
            <i class="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none"></i>
          </div>
        </div>
      </div>

      <div v-if="auditoriasFiltradas.length === 0" class="p-12 text-center">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
          <i class="fas fa-search text-gray-400 text-2xl"></i>
        </div>
        <h3 class="text-lg font-medium text-gray-900">Nenhuma auditoria encontrada</h3>
        <p class="text-gray-500 mt-1">Tente ajustar seus filtros ou crie uma nova auditoria.</p>
      </div>

      <div v-else class="flex flex-col h-full">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-6">
          <div
            v-for="auditoria in auditoriasPaginadas"
          :key="auditoria.id"
          class="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 group relative flex flex-col overflow-hidden border border-gray-100 hover:border-blue-200"
        >
          <!-- Indicador de Tipo Lateral -->
          <div 
            class="absolute left-0 top-0 bottom-0 w-1.5"
            :class="auditoria.tipo === 'Etiqueta' ? 'bg-blue-500' : auditoria.tipo === 'Presença' ? 'bg-emerald-500' : 'bg-orange-500'"
          ></div>

          <div class="p-5 flex-1 flex flex-col pl-7">
            <!-- Botões de Ação (Hover) -->
            <div class="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0 z-10">
              <button
                v-if="auditoria.status !== 'fechada'"
                @click.stop="fecharAuditoria(auditoria.id)"
                class="w-8 h-8 flex items-center justify-center bg-white border border-yellow-200 text-yellow-600 rounded-lg hover:bg-yellow-50 transition shadow-sm"
                title="Fechar Auditoria"
              >
                <i class="fas fa-lock text-xs"></i>
              </button>
              <button
                @click.stop="excluirAuditoria(auditoria.id)"
                class="w-8 h-8 flex items-center justify-center bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition shadow-sm"
                title="Excluir Auditoria"
              >
                <i class="fas fa-trash text-xs"></i>
              </button>
            </div>

            <router-link
              :to="`/auditoria/${auditoria.id}`"
              class="block no-underline text-inherit flex flex-col h-full"
            >
              <!-- Header -->
              <div class="flex flex-col mb-4">
                <div class="flex items-center gap-2 mb-1">
                  <span
                    :class="[
                      'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider',
                      auditoria.tipo === 'Etiqueta' ? 'bg-blue-50 text-blue-700' :
                      auditoria.tipo === 'Presença' ? 'bg-emerald-50 text-emerald-700' :
                      'bg-orange-50 text-orange-700'
                    ]"
                  >
                    {{ auditoria.tipo }}
                  </span>
                  <span class="text-[10px] text-gray-400 font-medium">• #{{ auditoria.id }}</span>
                </div>
                <h3 class="text-2xl font-bold text-gray-800 leading-tight truncate" :title="auditoria.sku">
                  {{ auditoria.sku }}
                </h3>
                <span class="text-xs text-gray-400 mt-0.5">Criado em {{ formatarDataISO(auditoria.data) }}</span>
              </div>

              <!-- Progress Section -->
              <div v-if="getMetricasCard(auditoria).total > 0" class="space-y-4 flex-1">
                <div>
                  <div class="flex justify-between items-end mb-1.5">
                    <span class="text-xs font-semibold text-gray-500">Progresso</span>
                    <span class="text-sm font-bold text-gray-900">{{ getMetricasCard(auditoria).percentualConclusao.toFixed(1) }}%</span>
                  </div>
                  <div class="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      :style="{ width: getMetricasCard(auditoria).percentualConclusao + '%' }"
                      :class="[
                        'h-full transition-all duration-500 ease-out relative rounded-full',
                        getMetricasCard(auditoria).percentualConclusao >= 100 ? 'bg-green-500' : 'bg-blue-600'
                      ]"
                    ></div>
                  </div>
                </div>

                <!-- Stats Grid -->
                <div class="grid grid-cols-3 gap-2">
                  <div class="bg-gray-50 rounded-lg p-2 text-center border border-gray-100">
                    <p class="text-[9px] font-bold text-gray-400 uppercase mb-0.5">Lidos</p>
                    <p class="text-base font-bold text-gray-800 leading-none">
                      {{ getMetricasCard(auditoria).lidos }}
                    </p>
                  </div>
                  <div class="bg-gray-50 rounded-lg p-2 text-center border border-gray-100">
                    <p class="text-[9px] font-bold text-gray-400 uppercase mb-0.5">Pendentes</p>
                    <p class="text-base font-bold text-gray-800 leading-none">
                      {{ getMetricasCard(auditoria).pendentes }}
                    </p>
                  </div>
                  <div class="bg-gray-50 rounded-lg p-2 text-center border border-gray-100">
                    <p class="text-[9px] font-bold text-gray-400 uppercase mb-0.5">Restante</p>
                    <p class="text-base font-bold text-orange-600 leading-none">
                      {{
                        (
                          auditoria.tipo === 'Ruptura' || auditoria.tipo === 'Presença' || auditoria.tipo === 'Etiqueta'
                            ? getMetricasCard(auditoria).percentualPendente
                            : (100 - getMetricasCard(auditoria).percentualConclusao)
                        ).toFixed(1)
                      }}%
                    </p>
                  </div>
                </div>
              </div>

              <!-- Empty State -->
              <div v-else class="text-center py-6 border border-dashed border-gray-200 rounded-lg bg-gray-50/50 flex-1">
                <i class="fas fa-inbox text-gray-300 text-2xl mb-2"></i>
                <p class="text-xs font-medium text-gray-500">Sem dados</p>
              </div>

              <!-- Footer Action -->
              <div class="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between group-hover:text-blue-600 transition-colors">
                <span class="text-xs font-semibold text-gray-500 group-hover:text-blue-600 transition-colors">Acessar Painel</span>
                <i class="fas fa-arrow-right text-xs text-gray-300 group-hover:text-blue-600 transform group-hover:translate-x-1 transition-all"></i>
              </div>
            </router-link>
          </div>
        </div>
      </div>

      <!-- Paginação -->
      <div v-if="totalPaginas > 1" class="p-6 border-t border-gray-100 flex justify-center">
        <nav class="flex items-center gap-2">
          <button
            @click="paginaAtual--"
            :disabled="paginaAtual === 1"
            class="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <i class="fas fa-chevron-left"></i>
          </button>
          
          <span class="text-sm text-gray-600 font-medium px-4">
            Página {{ paginaAtual }} de {{ totalPaginas }}
          </span>

          <button
            @click="paginaAtual++"
            :disabled="paginaAtual === totalPaginas"
            class="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <i class="fas fa-chevron-right"></i>
          </button>
        </nav>
      </div>
    </div>
  </div>
</div>
</template>
