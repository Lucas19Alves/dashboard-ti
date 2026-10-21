<script setup>
import { useConferencia } from '../composables/useConferencia'
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuditoriasStore } from '../stores/auditoriasStore'
import { criarPreviaPlanilha } from '../utils/planilha'
import { META_PENDENTE_PERCENTUAL, dentroDaMeta, metricasAuditoria, serieEvolucao } from '../utils/metricasAuditoria'
import { itensParaMeta, resumirAuditorias, rotuloMes } from '../utils/analiseHistorica'
import StatCard from '../components/ui/StatCard.vue'
import UiModal from '../components/ui/UiModal.vue'
import UiButton from '../components/ui/UiButton.vue'
import SparklineMeta from '../components/ui/SparklineMeta.vue'
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

// Limpa a busca ao trocar de aba
watch(abaAtiva, () => {
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

const { conferir } = useConferencia()

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
    if (!(await conferir(dados, { tipo, data: formulario.value.data, arquivo: formulario.value.arquivo?.name }))) return

    // Usar o tipo que foi selecionado no formulário
    const tipoEfetivo = formulario.value.tipo
    const skuValor = parseInt(formulario.value.sku) || 0
    const temAnaliseEtiqueta = typeof store.analisarDadosEtiqueta === 'function'
    const temAnaliseRuptura = typeof store.analisarDadosRuptura === 'function'
    const analise = tipoEfetivo === 'Presença'
      ? store.analisarDadosPresenca(dados, skuValor)
      : tipoEfetivo === 'Ruptura'
        ? (temAnaliseRuptura ? store.analisarDadosRuptura(dados, skuValor, { dataReferencia: formulario.value.data }) : store.analisarDadosPresenca(dados, skuValor))
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

// Todas as auditorias vão até as 20h.
const obterHorarioFim = () => '20:00'

// Todas as auditorias vão até as 20h, qualquer que seja o tipo.
const obterHorarioMaximoDia = () => '20:00'

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
      formatarDataISO(String(a.data).slice(0, 10)).includes(termo) ||
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



const totalAuditorias = computed(() => Array.isArray(store.auditorias) ? store.auditorias.length : 0)
const auditoriasAbertas = computed(() =>
  Array.isArray(store.auditorias) ? store.auditorias.filter(a => a && a.status !== 'fechada') : []
)
const auditoriasFechadas = computed(() =>
  Array.isArray(store.auditorias) ? store.auditorias.filter(a => a && a.status === 'fechada') : []
)

// Média do % pendente derivada do SKU atual (igual aos cards).
const parcialMediaGeral = computed(() => resumirAuditorias(store.auditorias.filter(Boolean)).mediaPendente ?? 0)


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

// Atalho do cabeçalho: abre o formulário para hoje com o tipo planejado do dia.
const novaAuditoriaHoje = () => {
  const hoje = new Date()
  const iso = formatISO(hoje)
  const tipo = (store.tiposAuditoriaPorDia[hoje.getDay()] || [])[0] || formulario.value.tipo
  abaAtiva.value = 'calendario'
  criarAPartirCalendario(iso, tipo, hoje.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }))
  requestAnimationFrame(() => document.getElementById('fileInputNovaAuditoria')?.closest('.ui-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}

// ---------- Listas: ativas (calendário) e histórico por tipo ----------
const META = META_PENDENTE_PERCENTUAL
const coresTipo = {
  'Etiqueta': { chip: 'bg-violet-50 text-violet-700', barra: 'bg-violet-500', icone: 'fas fa-tag' },
  'Presença': { chip: 'bg-sky-50 text-sky-700', barra: 'bg-sky-500', icone: 'fas fa-check-square' },
  'Ruptura': { chip: 'bg-orange-50 text-orange-700', barra: 'bg-orange-500', icone: 'fas fa-exclamation-triangle' }
}
const corTipo = tipo => coresTipo[tipo] || { chip: 'bg-slate-100 text-slate-600', barra: 'bg-slate-400', icone: 'fas fa-clipboard' }

// Anel de progresso (SVG): circunferência para r=26.
const CIRCUNFERENCIA = 2 * Math.PI * 26
const tracoAnel = percentual => `${(Math.min(100, Math.max(0, percentual)) / 100) * CIRCUNFERENCIA} ${CIRCUNFERENCIA}`
const faltamParaMeta = a => itensParaMeta(a)

const filtroSituacao = ref('todas')
const situacoes = [
  { valor: 'todas', rotulo: 'Todas' },
  { valor: 'abertas', rotulo: 'Em andamento' },
  { valor: 'fechadas', rotulo: 'Fechadas' },
  { valor: 'dentro', rotulo: 'Na meta' },
  { valor: 'fora', rotulo: 'Fora da meta' }
]
const limiteHistorico = ref(30)
watch([abaAtiva, filtroSituacao, filtroTexto, ordenacao, filtroDataTipo], () => { limiteHistorico.value = 30 })

const historicoFiltrado = computed(() => auditoriasFiltradas.value.filter(a => {
  if (filtroSituacao.value === 'abertas') return a.status !== 'fechada'
  if (filtroSituacao.value === 'fechadas') return a.status === 'fechada'
  if (filtroSituacao.value === 'dentro') return dentroDaMeta(a)
  if (filtroSituacao.value === 'fora') return !dentroDaMeta(a)
  return true
}))

// Agrupa por mês só quando a ordenação é por data; senão, um único grupo.
const gruposHistorico = computed(() => {
  const visiveis = historicoFiltrado.value.slice(0, limiteHistorico.value)
  if (!ordenacao.value.startsWith('data')) return [{ chave: 'todos', rotulo: 'Resultados', itens: visiveis, resumo: resumirAuditorias(visiveis) }]
  const grupos = []
  for (const a of visiveis) {
    const chave = String(a.data).slice(0, 7)
    let grupo = grupos.at(-1)
    if (!grupo || grupo.chave !== chave) grupos.push((grupo = { chave, rotulo: rotuloMes(chave), itens: [] }))
    grupo.itens.push(a)
  }
  return grupos.map(g => ({ ...g, resumo: resumirAuditorias(g.itens) }))
})

const resumoTipo = computed(() => {
  if (abaAtiva.value === 'calendario') return null
  const doTipo = store.auditorias.filter(a => a.tipo === abaAtiva.value)
  return { ...resumirAuditorias(doTipo), serie: serieEvolucao(doTipo, abaAtiva.value, 15) }
})



// Dias do calendário sem borda: o estado aparece só pelo fundo.
const classesCardDia = (d) => {
  if (diaSelecionado.value && diaSelecionado.value.data === d.data) return 'bg-blue-100/70 shadow-md'
  const porData = (auditoriasPorDiaTipo.value || {})[d.data]
  if (!porData) return 'bg-slate-50 hover:bg-slate-100'
  const lista = Object.values(porData).flat()
  if (lista.some(a => a.status !== 'fechada')) return 'bg-blue-50 hover:bg-blue-100/70'
  if (lista.some(a => a.status === 'fechada' && !dentroDaMeta(a))) return 'bg-red-50 hover:bg-red-100/70'
  return 'bg-emerald-50 hover:bg-emerald-100/70'
}
</script>

<template>
  <div class="ui-page min-h-[calc(100vh-4rem)]">
      <UiPageHeader title="Auditorias" subtitle="Organize, acompanhe e finalize as auditorias da loja." icon="fas fa-search">
        <template #actions>
<UiButton @click="novaAuditoriaHoje"><i class="fas fa-plus"></i>Nova auditoria</UiButton>
        </template>
      </UiPageHeader>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Auditorias ativas" :value="auditoriasAbertas.length" description="Em andamento no momento." icon="fas fa-play" tone="blue" />
        <StatCard title="Auditorias fechadas" :value="auditoriasFechadas.length" description="Concluídas e disponíveis no histórico." icon="fas fa-lock" tone="green" />
        <StatCard title="Total de auditorias" :value="totalAuditorias" description="Registradas no sistema." icon="fas fa-clipboard-list" tone="indigo" />
        <StatCard title="Pendente médio" :value="`${parcialMediaGeral.toFixed(1)}%`" :description="`Média de todas as auditorias. Meta: até ${META}%.`" icon="fas fa-chart-line" :tone="parcialMediaGeral > META ? 'amber' : 'green'" />
      </div>

      <UiTabs v-model="abaAtiva" :items="abasAuditoria" />

    <UiModal v-if="mostrarModalExclusao" title="Excluir auditoria" subtitle="Esta ação não pode ser desfeita." width="max-w-md" @close="fecharModalExclusao">
      <div class="flex items-start gap-3">
        <i class="fas fa-trash shrink-0 text-slate-400" aria-hidden="true"></i>
        <p class="text-sm text-slate-600">Todos os dados importados e a análise desta auditoria serão apagados deste navegador. Considere exportar um backup antes.</p>
      </div>
      <template #footer>
        <UiButton variant="secondary" size="sm" @click="fecharModalExclusao">Cancelar</UiButton>
        <UiButton variant="danger" size="sm" @click="confirmarExclusao"><i class="fas fa-trash"></i>Excluir</UiButton>
      </template>
    </UiModal>

    <UiModal v-if="mostrarModalFechamento" title="Fechar auditoria" subtitle="Ela sai das ativas e fica no histórico." width="max-w-md" @close="fecharModalFechamento">
      <div class="flex items-start gap-3">
        <i class="fas fa-lock shrink-0 text-slate-400" aria-hidden="true"></i>
        <p class="text-sm text-slate-600">Depois de fechada, a auditoria fica somente para consulta e entra nos indicadores de meta.</p>
      </div>
      <template #footer>
        <UiButton variant="secondary" size="sm" @click="fecharModalFechamento">Cancelar</UiButton>
        <UiButton variant="warning" size="sm" @click="confirmarFechamento"><i class="fas fa-lock"></i>Fechar auditoria</UiButton>
      </template>
    </UiModal>

    <!-- Calendário Semanal -->
    <div v-if="abaAtiva === 'calendario'" class="space-y-4">
      <div class="ui-card p-5 md:p-6">
        <div class="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <h2 class="flex items-center gap-2 text-lg font-bold text-slate-900">
            <i class="fas fa-calendar-week text-blue-600"></i>
            <span>Calendário semanal</span>
          </h2>
          
          <div class="flex items-center gap-2 rounded-xl bg-slate-50 p-1.5">
            <button 
              @click="navegarSemana(-1)"
              class="h-9 w-9 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all shadow-xs"
              title="Semana Anterior"
            >
              <i class="fas fa-chevron-left text-[10px]"></i>
            </button>
            
            <div class="px-4 py-1 text-center min-w-[180px]">
              <span class="text-sm font-bold text-slate-700 block leading-tight">{{ labelSemanaSelecionada }}</span>
              <span v-if="semanaOffset !== 0" class="text-[9px] text-blue-600 font-semibold">
                {{ semanaOffset > 0 ? 'Semana Futura' : 'Semana Passada' }}
              </span>
              <span v-else class="text-[9px] text-emerald-600 font-semibold">
                Semana atual
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
            class="group relative min-w-55 cursor-pointer overflow-hidden rounded-xl p-4 transition-all md:min-w-0 md:flex-1"
            @click="abrirDia(d)"
            :class="classesCardDia(d)"
          >
            <div class="flex justify-between items-center mb-3">
              <div class="flex flex-col">
                <span class="text-xs capitalize text-gray-500">
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
                      ? (dentroDaMeta(auditoriasPorDiaTipo[d.data][tipo][0]) ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')
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
                  class="px-3 py-1 rounded-full text-[11px] font-semibold bg-white border border-dashed border-blue-300 text-blue-700 hover:bg-blue-50 transition shadow-sm flex items-center gap-1"
                  title="Criar auditoria e iniciar acompanhamento"
                >
                  <i class="fas fa-plus text-[10px]"></i>
                  {{ tipo }} • Criar
                </button>
              </template>
              <button
                v-if="!auditoriasPorDiaTipo[d.data] && !(tiposPlanejados[d.dayIndex] || []).length"
                @click.stop="criarAPartirCalendario(d.data, formulario.tipo, d.label)"
                class="px-3 py-1 rounded-full text-[11px] font-semibold bg-white border border-dashed border-blue-300 text-blue-700 hover:bg-blue-50 transition shadow-sm flex items-center gap-1"
              >
                <i class="fas fa-plus text-[10px]"></i>
                Criar Auditoria
              </button>
            </div>
            <div
              v-if="auditoriasPorDiaTipo[d.data]"
              class="mt-2 text-[11px] text-gray-700 space-y-1"
            >
              <template v-for="tipo in ['Etiqueta', 'Presença', 'Ruptura']" :key="tipo + d.data">
                <div v-if="auditoriasPorDiaTipo[d.data][tipo]?.length" class="flex items-center gap-1">
                  <span class="font-semibold">{{ tipo }}</span>
                  <span>· {{ getMetricasCard(auditoriasPorDiaTipo[d.data][tipo][0]).percentualPendente.toFixed(2) }}% pendente</span>
                </div>
              </template>
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
        class="ui-card ui-fade-in p-5 md:p-6"
      >
        <h2 class="mb-4 flex flex-wrap items-center justify-between gap-2 text-lg font-bold text-slate-900">
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
            <div v-if="carregandoPrevia" class="mt-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-700">
              <i class="fas fa-spinner fa-spin mr-2"></i>Analisando estrutura da planilha…
            </div>
            <div v-else-if="previaArquivo" class="mt-3 rounded-xl bg-slate-50 p-4">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <p class="text-sm font-semibold text-slate-800">Pré-visualização validada</p>
                <span class="text-xs font-medium text-slate-500">{{ previaArquivo.totalLinhas }} linhas · {{ previaArquivo.totalColunas }} colunas</span>
              </div>
              <div class="mt-2 flex flex-wrap gap-1.5">
                <span v-for="coluna in previaArquivo.colunas.slice(0, 8)" :key="coluna" class="rounded-md bg-white px-2 py-1 text-[11px] text-slate-600 shadow-sm">
                  {{ coluna }}
                </span>
                <span v-if="previaArquivo.colunas.length > 8" class="px-2 py-1 text-[11px] text-slate-500">+{{ previaArquivo.colunas.length - 8 }}</span>
              </div>
            </div>
            <p class="text-xs text-gray-500 mt-1">Selecione o arquivo Excel com os dados da auditoria</p>
            <p v-if="erroUpload" class="text-xs text-red-600 mt-1">{{ erroUpload }}</p>
            <div
              v-if="formulario.arquivo"
              class="mt-2 flex items-center gap-2 rounded-xl bg-green-50 p-3"
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
                class="ui-input"
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
                class="ui-input"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">SKU <span class="text-red-500">*</span></label>
              <input
                v-model="formulario.sku"
                type="number"
                min="1"
                placeholder="Total de itens a auditar"
                class="ui-input"
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
    <section class="space-y-4">
      <!-- Barra de ferramentas -->
      <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 class="text-lg font-bold text-slate-900">
            {{ abaAtiva === 'calendario' ? 'Auditorias em andamento' : `Histórico de ${abaAtiva}` }}
          </h2>
          <p class="text-xs text-slate-500">
            <template v-if="abaAtiva === 'calendario'">{{ auditoriasFiltradas.length }} aberta(s). Feche quando a contagem terminar.</template>
            <template v-else>{{ historicoFiltrado.length }} de {{ resumoTipo?.total || 0 }} auditorias</template>
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <div class="relative min-w-0 flex-1 sm:w-60 sm:flex-none">
            <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400"></i>
            <input v-model="filtroTexto" type="search" placeholder="ID, data ou SKU..." class="ui-input py-2 pl-8 text-sm">
          </div>

          <div class="relative">
            <button
              type="button"
              class="ui-btn-secondary py-2"
              :class="filtroDataTipo !== 'todas' ? '!border-blue-300 !bg-blue-50 !text-blue-700' : ''"
              @click="mostrarFiltroData = !mostrarFiltroData"
            >
              <i class="fas fa-calendar-alt text-xs"></i>
              {{ filtroDataTipo !== 'todas' ? 'Data filtrada' : 'Data' }}
              <i class="fas fa-chevron-down text-[10px] opacity-60"></i>
            </button>
            <div v-if="mostrarFiltroData" class="fixed inset-0 z-40" @click="mostrarFiltroData = false"></div>
            <div v-if="mostrarFiltroData" class="ui-pop-in absolute right-0 top-full z-50 mt-2 w-72 rounded-xl bg-white p-4 shadow-2xl ring-1 ring-slate-900/5">
              <p class="mb-3 text-sm font-bold text-slate-800">Filtrar por data</p>
              <div class="space-y-3">
                <select v-model="filtroDataTipo" class="ui-input py-2 text-sm">
                  <option value="todas">Todas as datas</option>
                  <option value="especifica">Data específica</option>
                  <option value="periodo">Período (entre)</option>
                  <option value="apartir">A partir de</option>
                  <option value="antes">Antes de</option>
                </select>
                <template v-if="filtroDataTipo !== 'todas'">
                  <input :value="filtroDataInicioExibicao" type="text" placeholder="DD/MM/AAAA" maxlength="10" class="ui-input py-2 text-sm" @input="(e) => handleFiltroDataInput(e, 'inicio')">
                  <input v-if="filtroDataTipo === 'periodo'" :value="filtroDataFimExibicao" type="text" placeholder="Data final DD/MM/AAAA" maxlength="10" class="ui-input py-2 text-sm" @input="(e) => handleFiltroDataInput(e, 'fim')">
                </template>
                <div class="flex justify-end gap-2 pt-1">
                  <UiButton variant="ghost" size="sm" @click="filtroDataTipo = 'todas'; mostrarFiltroData = false">Limpar</UiButton>
                  <UiButton size="sm" @click="mostrarFiltroData = false">Aplicar</UiButton>
                </div>
              </div>
            </div>
          </div>

          <select v-model="ordenacao" class="ui-input w-auto py-2 text-sm" aria-label="Ordenação">
            <option value="data_desc">Mais recentes</option>
            <option value="data_asc">Mais antigas</option>
            <option value="progresso_desc">Maior progresso</option>
            <option value="progresso_asc">Menor progresso</option>
          </select>
        </div>
      </div>

      <!-- ===== Ativas (calendário) ===== -->
      <template v-if="abaAtiva === 'calendario'">
        <div v-if="auditoriasFiltradas.length === 0" class="rounded-xl bg-white px-6 py-12 text-center shadow-sm">
          <span class="mx-auto inline-flex size-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><i class="fas fa-check-double text-lg"></i></span>
          <p class="mt-3 font-semibold text-slate-800">Nenhuma auditoria em andamento</p>
          <p class="mt-1 text-sm text-slate-500">Use o calendário acima para iniciar a próxima.</p>
        </div>

        <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          <article
            v-for="auditoria in auditoriasFiltradas"
            :key="auditoria.id"
            class="group relative flex flex-col overflow-hidden rounded-xl bg-white shadow-sm shadow-slate-900/5 transition duration-200"
          >
            <router-link :to="`/auditoria/${auditoria.id}`" class="flex flex-1 flex-col p-5">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <span class="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-bold" :class="corTipo(auditoria.tipo).chip">
                    <i :class="[corTipo(auditoria.tipo).icone, 'text-[9px]']"></i>{{ auditoria.tipo }}
                  </span>
                  <p class="mt-2 text-lg font-bold text-slate-900">{{ formatarDataISO(String(auditoria.data).slice(0, 10)) }}</p>
                  <p class="text-xs text-slate-500">#{{ auditoria.id }} · SKU {{ Number(auditoria.sku || 0).toLocaleString('pt-BR') }}</p>
                </div>
                <!-- Anel de conclusão -->
                <div class="relative size-16 shrink-0">
                  <svg viewBox="0 0 64 64" class="size-16 -rotate-90">
                    <circle cx="32" cy="32" r="26" fill="none" stroke="#f1f5f9" stroke-width="6" />
                    <circle cx="32" cy="32" r="26" fill="none" stroke-width="6" stroke-linecap="round"
                      :stroke="getMetricasCard(auditoria).percentualPendente <= META ? '#059669' : '#2563eb'"
                      :stroke-dasharray="tracoAnel(getMetricasCard(auditoria).percentualConclusao)" class="transition-all duration-700" />
                  </svg>
                  <span class="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-800">{{ getMetricasCard(auditoria).percentualConclusao.toFixed(0) }}%</span>
                </div>
              </div>

              <div v-if="getMetricasCard(auditoria).total > 0" class="mt-4 grid grid-cols-3 gap-2 text-center">
                <div class="rounded-xl bg-slate-50 py-2">
                  <p class="text-base font-bold text-slate-900">{{ getMetricasCard(auditoria).lidos.toLocaleString('pt-BR') }}</p>
                  <p class="text-xs text-slate-500">Lidos</p>
                </div>
                <div class="rounded-xl bg-slate-50 py-2">
                  <p class="text-base font-bold text-slate-900">{{ getMetricasCard(auditoria).pendentes.toLocaleString('pt-BR') }}</p>
                  <p class="text-xs text-slate-500">Pendentes</p>
                </div>
                <div class="rounded-xl py-2" :class="getMetricasCard(auditoria).percentualPendente <= META ? 'bg-emerald-50' : 'bg-red-50'">
                  <p class="text-base font-bold" :class="getMetricasCard(auditoria).percentualPendente <= META ? 'text-emerald-700' : 'text-red-700'">{{ getMetricasCard(auditoria).percentualPendente.toFixed(1) }}%</p>
                  <p class="text-xs text-slate-500">Pendente</p>
                </div>
              </div>
              <p v-else class="mt-4 rounded-xl bg-slate-50 py-4 text-center text-xs text-slate-500"><i class="fas fa-inbox mr-1"></i>Sem dados importados</p>

              <p v-if="faltamParaMeta(auditoria) !== null" class="mt-3 text-xs font-medium" :class="faltamParaMeta(auditoria) > 0 ? 'text-amber-700' : 'text-emerald-700'">
                <i :class="faltamParaMeta(auditoria) > 0 ? 'fas fa-flag-checkered' : 'fas fa-circle-check'" class="mr-1"></i>
                {{ faltamParaMeta(auditoria) > 0 ? `Faltam ${faltamParaMeta(auditoria).toLocaleString('pt-BR')} itens para a meta` : 'Dentro da meta' }}
              </p>
            </router-link>
            <div class="flex items-center gap-1 bg-slate-50/80 px-3 py-2">
              <router-link :to="`/auditoria/${auditoria.id}`" class="mr-auto rounded-lg px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50">
                Abrir painel
              </router-link>
              <button type="button" class="rounded-lg px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50" title="Fechar auditoria" @click="fecharAuditoria(auditoria.id)">
                <i class="fas fa-lock mr-1"></i>Fechar
              </button>
              <button type="button" class="rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-red-50 hover:text-red-600" title="Excluir auditoria" aria-label="Excluir auditoria" @click="excluirAuditoria(auditoria.id)">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </article>
        </div>
      </template>

      <!-- ===== Histórico por tipo ===== -->
      <template v-else>
        <!-- Resumo do tipo -->
        <div v-if="resumoTipo?.total" class="grid grid-cols-2 gap-3 lg:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,2fr)]">
          <div class="rounded-xl bg-white p-4 shadow-sm">
            <p class="text-xs font-semibold text-slate-500">Auditorias</p>
            <p class="mt-1 text-2xl font-bold text-slate-900">{{ resumoTipo.total }}</p>
            <p class="text-xs text-slate-500">{{ resumoTipo.fechadas }} fechadas</p>
          </div>
          <div class="rounded-xl bg-white p-4 shadow-sm">
            <p class="text-xs font-semibold text-slate-500">Na meta</p>
            <p class="mt-1 text-2xl font-bold" :class="(resumoTipo.taxaMeta ?? 100) < 70 ? 'text-amber-700' : 'text-emerald-700'">{{ resumoTipo.taxaMeta === null ? '—' : resumoTipo.taxaMeta.toFixed(0) + '%' }}</p>
            <p class="text-xs text-slate-500">{{ resumoTipo.dentroMeta }} de {{ resumoTipo.fechadas }} fechadas</p>
          </div>
          <div class="rounded-xl bg-white p-4 shadow-sm">
            <p class="text-xs font-semibold text-slate-500">Pendente médio</p>
            <p class="mt-1 text-2xl font-bold" :class="(resumoTipo.mediaPendente ?? 0) > META ? 'text-red-700' : 'text-emerald-700'">{{ resumoTipo.mediaPendente === null ? '—' : resumoTipo.mediaPendente.toFixed(2) + '%' }}</p>
            <p class="text-xs text-slate-500">Meta: até {{ META }}%</p>
          </div>
          <div class="col-span-2 rounded-xl bg-white p-4 shadow-sm lg:col-span-1">
            <p class="text-xs font-semibold text-slate-500">Últimas {{ resumoTipo.serie.length }} · % pendente</p>
            <SparklineMeta v-if="resumoTipo.serie.length > 1" class="mt-2" altura-classe="h-12" :pontos="resumoTipo.serie" :meta="META" @selecionar="p => router.push(`/auditoria/${p.id}`)" />
            <p v-else class="mt-4 text-xs text-slate-400">Poucos dados para o gráfico.</p>
          </div>
        </div>

        <!-- Filtro de situação -->
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="s in situacoes"
            :key="s.valor"
            type="button"
            class="rounded-full px-3 py-1.5 text-xs font-semibold transition"
            :class="filtroSituacao === s.valor ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 shadow-sm hover:text-slate-900'"
            @click="filtroSituacao = s.valor"
          >{{ s.rotulo }}</button>
        </div>

        <div v-if="historicoFiltrado.length === 0" class="rounded-xl bg-white px-6 py-12 text-center shadow-sm">
          <i class="fas fa-search text-2xl text-slate-300"></i>
          <p class="mt-3 font-semibold text-slate-800">Nenhuma auditoria encontrada</p>
          <p class="mt-1 text-sm text-slate-500">Ajuste a busca ou os filtros.</p>
        </div>

        <div v-else class="space-y-5">
          <section v-for="grupo in gruposHistorico" :key="grupo.chave" class="overflow-hidden rounded-xl bg-white shadow-sm">
            <header class="flex flex-wrap items-center justify-between gap-2 bg-slate-50/80 px-5 py-3">
              <h3 class="text-sm font-bold text-slate-800">{{ grupo.rotulo }}</h3>
              <p class="text-xs text-slate-500">
                {{ grupo.itens.length }} auditoria(s)
                <template v-if="grupo.resumo.mediaPendente !== null"> · média <b :class="grupo.resumo.mediaPendente > META ? 'text-red-700' : 'text-emerald-700'">{{ grupo.resumo.mediaPendente.toFixed(2) }}%</b></template>
                <template v-if="grupo.resumo.taxaMeta !== null"> · {{ grupo.resumo.dentroMeta }}/{{ grupo.resumo.fechadas }} na meta</template>
              </p>
            </header>
            <ul class="divide-y divide-slate-100">
              <li v-for="auditoria in grupo.itens" :key="auditoria.id" class="group flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 transition hover:bg-blue-50/40 sm:flex-nowrap">
                <router-link :to="`/auditoria/${auditoria.id}`" class="flex min-w-0 flex-1 items-center gap-4">
                  <span class="inline-flex size-10 shrink-0 items-center justify-center rounded-xl" :class="auditoria.status === 'fechada' ? 'bg-slate-100 text-slate-500' : 'bg-blue-50 text-blue-600'">
                    <i :class="auditoria.status === 'fechada' ? 'fas fa-lock' : 'fas fa-spinner'" class="text-xs"></i>
                  </span>
                  <div class="w-28 shrink-0">
                    <p class="text-sm font-bold text-slate-900">{{ formatarDataISO(String(auditoria.data).slice(0, 10)) }}</p>
                    <p class="text-[11px] text-slate-500">#{{ auditoria.id }} · {{ auditoria.status === 'fechada' ? 'Fechada' : 'Em andamento' }}</p>
                  </div>
                  <!-- % pendente com barra relativa à meta (escala até 3x a meta) -->
                  <div class="hidden min-w-0 flex-1 md:block">
                    <div class="relative h-2 max-w-2xl rounded-full bg-slate-100">
                      <span class="absolute inset-y-0 left-0 rounded-full" :class="getMetricasCard(auditoria).percentualPendente <= META ? 'bg-emerald-500' : 'bg-red-500'" :style="{ width: `${Math.min(100, (getMetricasCard(auditoria).percentualPendente / (META * 3)) * 100)}%` }"></span>
                      <span class="absolute -top-1 bottom-[-4px] w-px bg-slate-400" style="left: 33.33%" title="Meta"></span>
                    </div>
                  </div>
                  <div class="w-20 shrink-0 text-right">
                    <p class="text-sm font-bold" :class="getMetricasCard(auditoria).percentualPendente <= META ? 'text-emerald-700' : 'text-red-700'">{{ getMetricasCard(auditoria).percentualPendente.toFixed(2) }}%</p>
                    <p class="text-[11px] text-slate-500">pendente</p>
                  </div>
                  <div class="hidden w-28 shrink-0 text-right lg:block">
                    <p class="text-sm font-semibold text-slate-700">{{ getMetricasCard(auditoria).pendentes.toLocaleString('pt-BR') }} / {{ getMetricasCard(auditoria).total.toLocaleString('pt-BR') }}</p>
                    <p class="text-[11px] text-slate-500">pendentes / SKU</p>
                  </div>
                </router-link>
                <div class="flex w-32 shrink-0 items-center justify-end gap-1">
                  <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" :class="dentroDaMeta(auditoria) ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'">
                    <i :class="dentroDaMeta(auditoria) ? 'fas fa-check' : 'fas fa-times'" class="text-[9px]"></i>{{ dentroDaMeta(auditoria) ? 'Meta' : 'Fora' }}
                  </span>
                  <button type="button" class="rounded-lg p-2 text-amber-600 hover:bg-amber-50" :class="auditoria.status === 'fechada' ? 'invisible' : ''" title="Fechar auditoria" aria-label="Fechar auditoria" @click="fecharAuditoria(auditoria.id)">
                    <i class="fas fa-lock text-xs"></i>
                  </button>
                  <button type="button" class="rounded-lg p-2 text-slate-300 hover:bg-red-50 hover:text-red-600" title="Excluir auditoria" aria-label="Excluir auditoria" @click="excluirAuditoria(auditoria.id)">
                    <i class="fas fa-trash text-xs"></i>
                  </button>
                </div>
              </li>
            </ul>
          </section>

          <div v-if="historicoFiltrado.length > limiteHistorico" class="text-center">
            <UiButton variant="secondary" @click="limiteHistorico += 30">
              Mostrar mais ({{ historicoFiltrado.length - limiteHistorico }} restantes)
            </UiButton>
          </div>
        </div>
      </template>
    </section>
  </div>
</template>

