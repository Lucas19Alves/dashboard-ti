<script setup>
import { ref, computed } from 'vue'
import { useVencimentosStore } from '../stores/vencimentosStore'
import { useAuditoriasStore } from '../stores/auditoriasStore'
import TabelaInterativaAuditoria from '../components/TabelaInterativaAuditoria.vue'
import { printTable } from '../utils/print'

const store = useVencimentosStore()
const toastStore = useAuditoriasStore()

const arquivo = ref(null)
const carregando = ref(false)
const filtroSetor = ref('')
const filtroFornecedor = ref('')
const filtroStatus = ref('')
const busca = ref('')
const setorFocus = ref('')
const fornecedorSelecionado = ref('')
const hoverDrop = ref(false)
const inputRef = ref(null)
const modalSetorAberto = ref(false)
const setorModalNome = ref('')
const mostrarUpload = ref(true)

const escolherArquivo = (e) => {
  arquivo.value = e.target.files?.[0] || null
}

const onDropArquivo = (e) => {
  e.preventDefault()
  const f = e.dataTransfer?.files?.[0]
  if (f) arquivo.value = f
  hoverDrop.value = false
}
const onDragOverArquivo = (e) => {
  e.preventDefault()
  hoverDrop.value = true
}
const onDragLeaveArquivo = () => {
  hoverDrop.value = false
}
const dispararSelecao = () => {
  inputRef.value?.click()
}

const formatarData = (d) => {
  if (!d || !(d instanceof Date) || isNaN(d)) return '—'
  const dia = String(d.getDate()).padStart(2, '0')
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const ano = d.getFullYear()
  return `${dia}/${mes}/${ano}`
}

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
  } catch (e) {
    toastStore.addToast('Erro ao processar arquivo: ' + (e?.message || 'desconhecido'), 'error')
  } finally {
    carregando.value = false
  }
}

const resumo = computed(() => store.analise || { total: 0, vencidos: 0, hoje: 0, ate3: 0 })

const fornecedores = computed(() => {
  const set = new Set()
  store.itens.forEach(i => { if (i._fornecedor) set.add(i._fornecedor) })
  return Array.from(set).sort()
})

const setores = computed(() => store.setores || [])

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

const colunasSetores = [
  { chave: 'nome', titulo: 'Setor', sortable: true },
  { chave: 'total', titulo: 'Total', sortable: true, alinhamento: 'right' },
  { chave: 'vencidos', titulo: 'Vencidos', sortable: true, alinhamento: 'right' },
  { chave: 'hoje', titulo: 'Hoje', sortable: true, alinhamento: 'right' },
  { chave: 'ate3', titulo: 'Até 3 dias', sortable: true, alinhamento: 'right' },
  { chave: 'acoes', titulo: 'Ações', sortable: false, alinhamento: 'center' }
]

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

const setarFocusSetor = (nome) => {
  setorFocus.value = nome || ''
  filtroSetor.value = nome || ''
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
}

const limparFocus = () => {
  setorFocus.value = ''
}

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

const rowClassPrazo = (item) => {
  if (item._prazo === 'vencidos') return 'bg-red-50'
  if (item._prazo === 'hoje') return 'bg-orange-50'
  if (item._prazo === 'ate3') return 'bg-yellow-50'
  return ''
}

const colunasFornecedores = [
  { chave: 'fornecedor', titulo: 'Fornecedor', sortable: true },
  { chave: 'total', titulo: 'Total', sortable: true, alinhamento: 'right' },
  { chave: 'vencidos', titulo: 'Vencidos', sortable: true, alinhamento: 'right' },
  { chave: 'hoje', titulo: 'Hoje', sortable: true, alinhamento: 'right' },
  { chave: 'ate3', titulo: 'Até 3 dias', sortable: true, alinhamento: 'right' }
]

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

const rowClassResumo = (item) => {
  if ((item.vencidos || 0) > 0 || (item.hoje || 0) > 0) return 'bg-red-50'
  if ((item.ate3 || 0) > 0) return 'bg-yellow-50'
  return ''
}

const abrirItensFornecedor = (row) => {
  fornecedorSelecionado.value = row.fornecedor
}
const limparFornecedor = () => {
  fornecedorSelecionado.value = ''
}
const itensFornecedor = computed(() => {
  if (!fornecedorSelecionado.value) return []
  return store.itens.filter(i => i._fornecedor === fornecedorSelecionado.value)
})

const imprimir = async (alvo) => {
  let data, columns, title
  if (alvo === 'fornecedor') {
    data = itensFornecedor.value.map(i => ({ ...i, _validadeISO: formatarData(i._validadeDate) }))
    columns = colunasItens
    title = `Itens do fornecedor: ${fornecedorSelecionado.value}`
  } else if (alvo === 'modal-setor') {
    data = itensSetorModal.value.map(i => ({ ...i, _validadeISO: formatarData(i._validadeDate) }))
    columns = colunasItens
    title = `Itens do setor: ${setorModalNome.value}`
  }
  if (data && columns) {
    await printTable(data, columns, title)
  }
}

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
</script>

<template>
  <div class="p-8">
    <div class="flex items-center gap-3 mb-6">
      <i class="fas fa-calendar-alt text-3xl text-orange-600"></i>
      <h1 class="text-4xl font-bold text-gray-800">Vencimentos</h1>
    </div>

    <div class="grid grid-cols-1 gap-6">
      <div v-if="mostrarUpload" class="bg-white rounded-lg shadow-lg p-6">
        <div class="flex justify-between items-center mb-3">
          <h2 class="text-2xl font-bold text-gray-800">Carregar Planilha</h2>
          <button v-if="store.itens.length > 0" @click="mostrarUpload = false" class="text-gray-500 hover:text-gray-700">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <p class="text-gray-600 text-sm mb-4">Arraste e solte o arquivo .xlsx ou clique para selecionar.</p>
        <div
          class="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center transition cursor-pointer"
          :class="hoverDrop ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'"
          @dragover="onDragOverArquivo"
          @dragleave="onDragLeaveArquivo"
          @drop="onDropArquivo"
          @click="dispararSelecao"
        >
          <i class="fas fa-file-excel text-4xl text-green-600 mb-2"></i>
          <p class="text-gray-700 font-medium" v-if="!arquivo">Solte o arquivo aqui ou clique para selecionar</p>
          <p class="text-gray-700 font-medium" v-else>{{ arquivo.name }} ({{ Math.ceil(arquivo.size/1024) }} KB)</p>
          <input ref="inputRef" type="file" accept=".xlsx,.xls" class="hidden" @change="escolherArquivo" />
        </div>
        <div class="flex items-center gap-2 mt-4">
          <button
            @click="carregarPlanilha"
            :disabled="!arquivo || carregando"
            class="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition disabled:bg-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed"
          >
            <i v-if="!carregando" class="fas fa-file-import mr-2"></i>
            <i v-else class="fas fa-spinner fa-spin mr-2"></i>
            {{ carregando ? 'Processando...' : 'Importar' }}
          </button>
          <button
            @click="arquivo = null"
            :disabled="carregando"
            class="px-3 py-2 rounded-lg bg-gray-100 text-gray-800 font-medium hover:bg-gray-200 transition"
          >
            Limpar
          </button>
        </div>
      </div>

      <div v-if="store.itens.length > 0" class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div v-if="!mostrarUpload" class="col-span-1 md:col-span-4 flex justify-end">
          <button @click="mostrarUpload = true" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-sm text-sm font-medium">
            <i class="fas fa-file-upload mr-2"></i>Nova Importação
          </button>
        </div>
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-gray-600 text-sm font-medium">Total</p>
              <p class="text-3xl font-bold text-gray-800">{{ resumo.total }}</p>
            </div>
            <i class="fas fa-list text-blue-600 text-3xl opacity-20"></i>
          </div>
        </div>
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-gray-600 text-sm font-medium">Vencidos</p>
              <p class="text-3xl font-bold text-red-600">{{ resumo.vencidos }}</p>
            </div>
            <i class="fas fa-times-circle text-red-600 text-3xl opacity-20"></i>
          </div>
        </div>
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-gray-600 text-sm font-medium">Vencendo Hoje</p>
              <p class="text-3xl font-bold text-orange-600">{{ resumo.hoje }}</p>
            </div>
            <i class="fas fa-bell text-orange-600 text-3xl opacity-20"></i>
          </div>
        </div>
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-gray-600 text-sm font-medium">Até 3 dias</p>
              <p class="text-3xl font-bold text-yellow-600">{{ resumo.ate3 }}</p>
            </div>
            <i class="fas fa-hourglass-half text-yellow-600 text-3xl opacity-20"></i>
          </div>
        </div>
      </div>

      <div v-if="store.itens.length > 0" class="bg-white rounded-lg shadow-lg p-6">
        <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-4">
          <div>
            <h2 class="text-2xl font-bold text-gray-800">Filtro</h2>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-4 gap-2 w-full md:w-auto">
            <input v-model="busca" placeholder="Buscar por código/produto" class="px-3 py-2 border rounded-md text-sm"/>
            <select v-model="filtroSetor" class="px-3 py-2 border rounded-md text-sm">
              <option value="">Todos os setores</option>
              <option v-for="s in setores" :key="s" :value="s">{{ s }}</option>
            </select>
            <select v-model="filtroFornecedor" class="px-3 py-2 border rounded-md text-sm">
              <option value="">Todos os fornecedores</option>
              <option v-for="f in fornecedores" :key="f" :value="f">{{ f }}</option>
            </select>
            <select v-model="filtroStatus" class="px-3 py-2 border rounded-md text-sm">
              <option value="">Todos os status</option>
              <option value="vencidos">Vencidos</option>
              <option value="hoje">Hoje</option>
              <option value="ate3">Até 3 dias</option>
              <option value="futuro">Futuro</option>
            </select>
          </div>
        </div>

        <div class="border rounded-md">
          <TabelaInterativaAuditoria
            :dados="linhasSetores"
            :colunas="colunasSetores"
            titulo="Resumo por Setor"
            subtitulo="Distribuição por prazo de validade"
            :rowClass="rowClassResumo"
            :exibirTudo="true"
          >
            <template #cell-vencidos="{ valor }">
              <span class="px-2 py-0.5 text-xs rounded-full border text-red-700 bg-red-50 border-red-200">{{ valor }}</span>
            </template>
            <template #cell-hoje="{ valor }">
              <span class="px-2 py-0.5 text-xs rounded-full border text-orange-700 bg-orange-50 border-orange-200">{{ valor }}</span>
            </template>
            <template #cell-ate3="{ valor }">
              <span class="px-2 py-0.5 text-xs rounded-full border text-yellow-700 bg-yellow-50 border-yellow-200">{{ valor }}</span>
            </template>
            <template #cell-acoes="{ item }">
              <button
                @click.stop="abrirModalSetor(item.nome)"
                class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-xs"
              >
                Ver itens
              </button>
            </template>
          </TabelaInterativaAuditoria>
        </div>

      </div>

      <div v-if="store.itens.length > 0" class="bg-white rounded-lg shadow-lg p-6">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-2xl font-bold text-gray-800">
            Itens por Filtro
            <span v-if="setorFocus" class="text-base font-medium text-gray-500 ml-2">(Setor: {{ setorFocus }})</span>
          </h2>
          <button v-if="setorFocus" @click="limparFocus" class="text-sm text-blue-600 hover:underline">Limpar setor</button>
        </div>
        <TabelaInterativaAuditoria
          :dados="itensFiltrados.map(i => ({ ...i, _validadeISO: formatarData(i._validadeDate) }))"
          :colunas="colunasItens"
          titulo=""
          :rowClass="rowClassPrazo"
          :itensPorPagina="15"
        >
          <template #cell-_prazo="{ valor }">
            <span
              class="px-2 py-0.5 text-xs rounded-full border"
              :class="{
                'text-red-700 bg-red-50 border-red-200': valor === 'vencidos',
                'text-orange-700 bg-orange-50 border-orange-200': valor === 'hoje',
                'text-yellow-700 bg-yellow-50 border-yellow-200': valor === 'ate3',
                'text-gray-700 bg-gray-50 border-gray-200': valor === 'futuro'
              }"
            >
              {{ valor === 'vencidos' ? 'Vencidos' : valor === 'hoje' ? 'Hoje' : valor === 'ate3' ? 'Até 3 dias' : 'Futuro' }}
            </span>
          </template>
        </TabelaInterativaAuditoria>
      </div>

      <div v-if="store.itens.length > 0" class="bg-white rounded-lg shadow-lg p-6">
        <TabelaInterativaAuditoria
          :dados="linhasFornecedores"
          :colunas="colunasFornecedores"
          titulo="Resumo por Fornecedor"
          :rowClass="rowClassResumo"
          clickable
          @click-row="abrirItensFornecedor"
          :itensPorPagina="12"
        >
          <template #cell-vencidos="{ valor }">
            <span class="px-2 py-0.5 text-xs rounded-full border text-red-700 bg-red-50 border-red-200">{{ valor }}</span>
          </template>
          <template #cell-hoje="{ valor }">
            <span class="px-2 py-0.5 text-xs rounded-full border text-orange-700 bg-orange-50 border-orange-200">{{ valor }}</span>
          </template>
          <template #cell-ate3="{ valor }">
            <span class="px-2 py-0.5 text-xs rounded-full border text-yellow-700 bg-yellow-50 border-yellow-200">{{ valor }}</span>
          </template>
        </TabelaInterativaAuditoria>
        <div v-if="fornecedorSelecionado" class="mt-4">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-lg font-semibold text-gray-800">Itens do fornecedor: {{ fornecedorSelecionado }}</h3>
            <button @click="limparFornecedor" class="text-sm text-blue-600 hover:underline">Fechar</button>
          </div>
          <TabelaInterativaAuditoria
            :dados="itensFornecedor.map(i => ({ ...i, _validadeISO: formatarData(i._validadeDate) }))"
            :colunas="colunasItens"
            titulo=""
            :rowClass="rowClassPrazo"
            :itensPorPagina="10"
          >
            <template #cell-_prazo="{ valor }">
              <span
                class="px-2 py-0.5 text-xs rounded-full border"
                :class="{
                  'text-red-700 bg-red-50 border-red-200': valor === 'vencidos',
                  'text-orange-700 bg-orange-50 border-orange-200': valor === 'hoje',
                  'text-yellow-700 bg-yellow-50 border-yellow-200': valor === 'ate3',
                  'text-gray-700 bg-gray-50 border-gray-200': valor === 'futuro'
                }"
              >
                {{ valor === 'vencidos' ? 'Vencidos' : valor === 'hoje' ? 'Hoje' : valor === 'ate3' ? 'Até 3 dias' : 'Futuro' }}
              </span>
            </template>
          </TabelaInterativaAuditoria>
          <div class="mt-3 flex justify-end">
            <button @click="imprimir('fornecedor')" class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md text-sm font-medium border border-gray-300 shadow-sm">
              <i class="fas fa-print mr-2"></i>Imprimir Relatório
            </button>
          </div>
        </div>
      </div>

      <div v-if="modalSetorAberto" class="fixed inset-0 z-50 flex items-center justify-center">
          <div class="absolute inset-0 bg-black bg-opacity-40" @click="fecharModalSetor"></div>
          <div class="relative bg-white rounded-lg shadow-xl w-full max-w-6xl mx-4 overflow-hidden flex flex-col max-h-[90vh]">
            <div class="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
              <h3 class="text-lg font-semibold text-gray-800">Itens do setor: {{ setorModalNome }}</h3>
              <button @click="fecharModalSetor" class="text-gray-500 hover:text-gray-700">
                <i class="fas fa-times text-xl"></i>
              </button>
            </div>
            <div class="p-4 overflow-y-auto">
              <TabelaInterativaAuditoria
                :dados="itensSetorModal.map(i => ({ ...i, _validadeISO: formatarData(i._validadeDate) }))"
                :colunas="colunasItens"
                titulo=""
                :rowClass="rowClassPrazo"
                :itensPorPagina="12"
              >
                <template #cell-_prazo="{ valor }">
                  <span
                    class="px-2 py-0.5 text-xs rounded-full border"
                    :class="{
                      'text-red-700 bg-red-50 border-red-200': valor === 'vencidos',
                      'text-orange-700 bg-orange-50 border-orange-200': valor === 'hoje',
                      'text-yellow-700 bg-yellow-50 border-yellow-200': valor === 'ate3',
                      'text-gray-700 bg-gray-50 border-gray-200': valor === 'futuro'
                    }"
                  >
                    {{ valor === 'vencidos' ? 'Vencidos' : valor === 'hoje' ? 'Hoje' : valor === 'ate3' ? 'Até 3 dias' : 'Futuro' }}
                  </span>
                </template>
              </TabelaInterativaAuditoria>
            </div>
            <div class="px-4 py-3 border-t bg-gray-50 flex justify-end">
              <button @click="imprimir('modal-setor')" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium shadow-sm transition">
                <i class="fas fa-print mr-2"></i>Imprimir Relatório
              </button>
            </div>
          </div>
        </div>
    </div>
  </div>
</template>
