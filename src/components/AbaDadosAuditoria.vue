<script setup>
import { ref, computed } from 'vue'
import { atualizarOrdenacaoDados, extrairEstoque, filtrarBuscaDados, getSetorItem, paginasVisiveisFn, sortDados, temPresencaConfirmada } from '../utils/detalheAuditoria'
import { useAuditoriasStore } from '../stores/auditoriasStore'

// Aba "Dados" do detalhe da auditoria: mapa de setores e tabelas de itens (estoque zero,
// fora do local, grande estoque, fornecedor e ruptura).
const props = defineProps({
  auditoria: { type: Object, required: true },
  itensLidoNaoPertence: { type: Array, default: () => [] },
  imprimir: { type: Function, default: null },
})
const emit = defineEmits(['abrir-setor-local'])
const store = useAuditoriasStore()
const auditoria = computed(() => props.auditoria)
const itensLidoNaoPertence = computed(() => props.itensLidoNaoPertence)
const abrirModalSetorLocal = (...args) => emit('abrir-setor-local', ...args)
const handlePrintCard = (...args) => props.imprimir?.(...args)

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

const filtroFornecedor = ref('')
const filtroStatusFornecedor = ref('todos')

const filtroSetorFornecedor = ref('todos')
const filtroSetorEstoqueZero = ref('todos')

const filtroSetorLocalErrado = ref('todos')
const filtroSetorGrandeEstoque = ref('todos')

const filtroSetorRuptura = ref('todos')
const filtroUsuarioEstoqueZero = ref('todos')

const filtroUsuarioLocalErrado = ref('todos')

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

// Fornecedor table state
const paginaFornecedorTab = ref(1)
const buscaFornecedorTab = ref('')

const ordenacaoFornecedorTab = ref({ coluna: 'codigo', direcao: 'asc' })
const itensPorPaginaFornecedorTab = 10

// Modal Itens table state

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

// Fornecedor tab table computeds

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
</script>

<template>
  <div class="space-y-8">
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
          class="group bg-white rounded-xl p-5 cursor-pointer transition-all duration-200 border border-gray-100 hover:border-gray-200"
        >
          <!-- Nome e seta -->
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-semibold text-gray-800 text-[15px] truncate mr-2">{{ setor.nome }}</h3>
            <i class="fas fa-chevron-right text-xs text-gray-300 group-hover:text-blue-700" aria-hidden="true"></i>
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
      <div class="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-3">
        <div class="flex items-center gap-2 flex-wrap">
          <i class="fas fa-exclamation-triangle  text-sm shrink-0 text-slate-400" aria-hidden="true"></i>
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
      <div v-if="(auditoria.analise?.itensLidoNaoPertence || 0) > 0" class="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-3">
        <div class="flex items-center gap-2 flex-wrap">
          <i class="fas fa-map-marker-alt  text-sm shrink-0 text-slate-400" aria-hidden="true"></i>
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
      <div class="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-3">
        <div class="flex items-center gap-2 flex-wrap">
          <i class="fas fa-boxes  text-sm shrink-0 text-slate-400" aria-hidden="true"></i>
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
    <div class="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-3">
      <div class="flex items-center gap-2 flex-wrap">
        <i class="fas fa-coins  text-sm shrink-0 text-slate-400" aria-hidden="true"></i>
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
</template>
