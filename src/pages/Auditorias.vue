<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuditoriasStore } from '../stores/auditoriasStore'

const store = useAuditoriasStore()
const router = useRouter()
const abaAtiva = ref('calendario')

const formulario = ref({
  arquivo: null,
  tipo: 'Etiqueta',
  data: new Date().toISOString().split('T')[0],
})
const diaSelecionado = ref(null)

const processando = ref(false)
const arrastandoUpload = ref(false)
const erroUpload = ref('')

const submeterAuditoria = async () => {
  if (!formulario.value.arquivo) {
    store.addToast('Selecione um arquivo Excel!', 'warning')
    return
  }
  
  if (!formulario.value.tipo) {
    store.addToast('Selecione o tipo de auditoria!', 'warning')
    return
  }
  
  processando.value = true
  
  try {
    // Processar arquivo
    const dados = await store.processarExcelPresenca(formulario.value.arquivo)
    
    if (!dados || dados.length === 0) {
      store.addToast('Arquivo vazio ou inválido!', 'warning')
      return
    }
    
    // Analisar dados
    const analise = store.analisarDadosPresenca(dados)
    
    // Criar auditoria com dados já processados
    const novaAuditoria = store.addAuditoria({
      sku: analise.totalItens, // SKU = total de itens auditáveis
      tipo: formulario.value.tipo,
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
  const permitido = ['.xlsx', '.xls', '.csv']
  const nome = file.name.toLowerCase()
  const okExt = permitido.some(ext => nome.endsWith(ext))
  if (!okExt) {
    erroUpload.value = 'Tipo inválido. Use .xlsx, .xls ou .csv.'
    return false
  }
  const max = 20 * 1024 * 1024
  if (file.size > max) {
    erroUpload.value = 'Arquivo acima de 20MB.'
    return false
  }
  return true
}

const handleFileChange = (event) => {
  const files = event.target.files
  if (files && files.length > 0) {
    const file = files[0]
    if (!validarArquivoUpload(file)) return
    formulario.value.arquivo = file
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
}
const abrirSeletorUpload = () => {
  const input = document.getElementById('fileInputNovaAuditoria')
  if (input) input.click()
}

// Computed
const diasSemana = computed(() => {
  return [
    { dia: 'Segunda', tipos: ['Etiqueta'] },
    { dia: 'Terça', tipos: ['Presença'] },
    { dia: 'Quarta', tipos: ['Ruptura'] },
    { dia: 'Quinta', tipos: ['Etiqueta'] },
    { dia: 'Sexta', tipos: [] },
    { dia: 'Sábado', tipos: [] },
    { dia: 'Domingo', tipos: [] }
  ]
})

const auditoriasFiltradasPorTipo = computed(() => {
  let auditorias = []
  
  if (abaAtiva.value === 'historico') {
    // Retornar todas as auditorias fechadas
    return store.auditorias
      .filter(a => a.status === 'fechada')
      .sort((a, b) => new Date(b.data) - new Date(a.data))
  }

  if (!abaAtiva.value || abaAtiva.value === 'calendario') {
    auditorias = store.auditorias
  } else {
    auditorias = store.auditoriasAgrupadas[abaAtiva.value] || []
  }
  // Filtrar apenas auditorias ativas para as outras abas
  return auditorias.filter(a => a.status === 'em_andamento')
})

const excluirAuditoria = (id) => {
  if (confirm('Tem certeza que deseja excluir esta auditoria?')) {
    store.deleteAuditoria(id)
  }
}

const fecharAuditoria = (id) => {
  if (confirm('Deseja fechar esta auditoria? Ela não aparecerá mais na lista de ativas.')) {
    store.updateAuditoria(id, { status: 'fechada' })
    store.addToast('Auditoria fechada com sucesso!', 'success')
  }
}

const startOfWeek = (d) => {
  const date = new Date(d)
  const day = date.getDay()
  const diff = (day === 0 ? -6 : 1) - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

const formatISO = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const semanaAtual = computed(() => {
  const hoje = new Date()
  const inicio = startOfWeek(hoje)
  const dias = []
  for (let i = 0; i < 7; i++) {
    const d = new Date()
    d.setDate(inicio.getDate() + i)
    // Filter for Tue (2), Wed (3), Thu (4), Fri (5)
    if (d.getDay() >= 2 && d.getDay() <= 5) {
      dias.push({
        data: formatISO(d),
        label: d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }),
        dia: d
      })
    }
  }
  return dias
})

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
  criarAPartirCalendario(data, formulario.value.tipo, label)
}
</script>

<template>
  <div class="p-8">
    <div class="flex items-center gap-3 mb-6">
      <i class="fas fa-search text-3xl text-blue-600"></i>
      <h1 class="text-4xl font-bold text-gray-800">Auditorias</h1>
    </div>

    <!-- Abas -->
    <div class="flex gap-2 mb-6 flex-wrap">
      <button
        @click="abaAtiva = 'calendario'"
        :class="[
          'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition',
          abaAtiva === 'calendario'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        ]"
      >
        <i class="fas fa-calendar"></i>
        Calendário
      </button>
      <button
        v-for="tipo in ['Etiqueta', 'Presença', 'Ruptura']"
        :key="tipo"
        @click="abaAtiva = tipo"
        :class="[
          'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition',
          abaAtiva === tipo
            ? 'bg-blue-600 text-white'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        ]"
      >
        <i class="fas fa-tasks"></i>
        {{ tipo }}
      </button>
      <button
        @click="abaAtiva = 'historico'"
        :class="[
          'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition',
          abaAtiva === 'historico'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        ]"
      >
        <i class="fas fa-history"></i>
        Histórico
      </button>
    </div>

    <!-- Calendário Semanal -->
    <div v-if="abaAtiva === 'calendario'" class="mb-8 space-y-4">
      <div class="bg-white rounded-lg shadow-lg p-6">
        <h2 class="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <i class="fas fa-calendar-week text-blue-600"></i>
          <span>Calendário Semanal</span>
        </h2>
        <div class="flex gap-4 overflow-x-auto pb-2 md:flex-wrap md:justify-between md:overflow-visible">
          <div
            v-for="d in semanaAtual"
            :key="d.data"
            class="group min-w-[220px] md:min-w-0 md:flex-1 md:max-w-xs p-4 rounded-xl border cursor-pointer transition-all relative overflow-hidden"
            @click="abrirDia(d)"
            :class="[
              diaSelecionado && diaSelecionado.data === d.data
                ? 'border-blue-500 bg-blue-50 shadow-lg ring-2 ring-blue-100'
                : (auditoriasPorDiaTipo[d.data]
                    ? 'border-emerald-200 bg-emerald-50/60 hover:border-emerald-400 hover:bg-emerald-50'
                    : 'border-gray-200 bg-gray-50 hover:border-blue-400 hover:bg-gray-100')
            ]"
          >
            <div class="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500/40 via-indigo-500/40 to-emerald-500/40 opacity-0 group-hover:opacity-100 transition-opacity"></div>
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
                <span class="text-xs text-gray-600">08:00 - 18:00</span>
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
                  v-else-if="(tiposPlanejados[(new Date(d.data)).getDay()] || []).includes(tipo)"
                  @click.stop="criarAPartirCalendario(d.data, tipo, d.label)"
                  class="px-3 py-1 rounded-full text-[11px] font-semibold bg-white/80 border border-dashed border-blue-300 text-blue-700 hover:bg-blue-50 transition shadow-sm flex items-center gap-1"
                  title="Criar auditoria e iniciar acompanhamento"
                >
                  <i class="fas fa-plus text-[10px]"></i>
                  {{ tipo }} • Criar
                </button>
              </template>
            </div>
            <button
              v-if="!(tiposPlanejados[(new Date(d.data)).getDay()] || []).length"
              @click.stop="criarAPartirCalendario(d.data, formulario.tipo, d.label)"
              class="mt-3 w-full px-3 py-1.5 rounded text-xs font-medium border border-dashed border-blue-400 text-blue-700 hover:bg-blue-50 transition"
            >
              Selecionar dia para acompanhamento
            </button>
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
                accept=".xlsx,.xls,.csv"
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
                    <p class="text-xs text-gray-500 mt-1">Aceita .xlsx, .xls, .csv • até 20MB</p>
                  </div>
                </div>
              </label>
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

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </div>

          <div class="flex justify-end">
            <button
              @click="submeterAuditoria"
              :disabled="processando || !formulario.arquivo"
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
    <div class="bg-white rounded-lg shadow-lg overflow-hidden">
      <div class="bg-blue-600 text-white px-6 py-4">
        <h2 class="text-xl font-bold">
          <i class="fas fa-list mr-2"></i>
          {{ abaAtiva === 'historico' ? 'Histórico de Auditorias' : 'Auditorias Ativas' }}
        </h2>
      </div>

      <div v-if="auditoriasFiltradasPorTipo.length === 0" class="p-6 text-center">
        <p class="text-gray-500">
          {{ abaAtiva === 'historico' ? 'Nenhuma auditoria fechada encontrada' : 'Nenhuma auditoria ativa encontrada' }}
        </p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
        <div
          v-for="auditoria in auditoriasFiltradasPorTipo"
          :key="auditoria.id"
          class="bg-gradient-to-br from-white to-gray-50 border-2 border-gray-200 rounded-lg p-6 hover:border-blue-500 hover:shadow-lg transition group relative"
        >
          <!-- Botões de Ação -->
          <div class="absolute top-2 right-2 flex gap-1">
            <button
              v-if="auditoria.status !== 'fechada'"
              @click.stop="fecharAuditoria(auditoria.id)"
              class="p-1.5 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition text-xs"
              title="Fechar Auditoria"
            >
              <i class="fas fa-lock"></i>
            </button>
            <button
              @click.stop="excluirAuditoria(auditoria.id)"
              class="p-1.5 bg-red-500 text-white rounded hover:bg-red-600 transition text-xs"
              title="Excluir Auditoria"
            >
              <i class="fas fa-trash"></i>
            </button>
          </div>

          <!-- Header -->
          <router-link
            :to="`/auditoria/${auditoria.id}`"
            class="block no-underline text-inherit"
          >
            <div class="flex items-start justify-between mb-4">
              <div>
                <h3 class="text-2xl font-bold text-gray-800">{{ auditoria.sku }}</h3>
                <p class="text-xs text-gray-500 mt-1">SKU / Total de Itens</p>
              </div>
              <span
                :class="[
                  'px-3 py-1 rounded-full text-xs font-semibold transition',
                  auditoria.tipo === 'Etiqueta' ? 'bg-blue-100 text-blue-800 group-hover:bg-blue-200' :
                  auditoria.tipo === 'Presença' ? 'bg-green-100 text-green-800 group-hover:bg-green-200' :
                  'bg-orange-100 text-orange-800 group-hover:bg-orange-200'
                ]"
              >
                {{ auditoria.tipo }}
              </span>
            </div>
          </router-link>

          <!-- Data -->
          <div class="border-b pb-4 mb-4">
            <p class="text-sm text-gray-600">
              <i class="fas fa-calendar mr-2 text-blue-600"></i>
              {{ new Date(auditoria.data).toLocaleDateString('pt-BR') }}
            </p>
          </div>

          <!-- Status -->
          <router-link
            :to="`/auditoria/${auditoria.id}`"
            class="block no-underline text-inherit"
          >
            <div v-if="auditoria.total > 0" class="space-y-3">
              <!-- Métrica de Leitura -->
              <div>
                <div class="flex justify-between mb-1">
                  <span class="text-sm font-medium text-gray-700">Progresso</span>
                  <span class="text-sm font-bold text-blue-600">{{ (auditoria.analise?.percentualConclusao || 0).toFixed(2) }}%</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    :style="{ width: Math.min(auditoria.analise?.percentualConclusao || 0, 100) + '%' }"
                    class="bg-linear-to-r from-green-500 to-green-600 h-full transition-all"
                  />
                </div>
              </div>

              <!-- Info Cards -->
              <div class="grid grid-cols-2 gap-2 pt-2">
                <div class="bg-green-50 rounded p-2 text-center">
                  <p class="text-xs text-gray-600">Lidos</p>
                  <p class="text-lg font-bold text-green-600">{{ (auditoria.analise?.itensLidosCorretamente || 0) + (auditoria.analise?.itensLidosComProblema || 0) }}</p>
                </div>
                <div class="bg-orange-50 rounded p-2 text-center">
                  <p class="text-xs text-gray-600">Pendentes</p>
                  <p class="text-lg font-bold text-orange-600">{{ auditoria.analise?.itensPendentes || 0 }}</p>
                </div>
              </div>
            </div>

            <!-- Status Vazio -->
            <div v-else class="text-center py-6">
              <i class="fas fa-upload text-gray-300 text-3xl mb-2"></i>
              <p class="text-sm text-gray-500">Upload pendente</p>
            </div>

            <!-- Hover Info -->
            <div class="mt-4 pt-4 border-t text-center text-xs text-gray-500 group-hover:text-blue-600 transition">
              <i class="fas fa-arrow-right mr-1"></i>
              Clique para ver detalhes completos
            </div>
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>
