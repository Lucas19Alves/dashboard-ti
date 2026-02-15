<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuditoriasStore } from '../stores/auditoriasStore'

const store = useAuditoriasStore()
const router = useRouter()
const abaAtiva = ref('calendario')

// Formulário
const formulario = ref({
  arquivo: null,
  tipo: 'Etiqueta',
  data: new Date().toISOString().split('T')[0],
})

const processando = ref(false)

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

const handleFileChange = (event) => {
  const files = event.target.files
  if (files && files.length > 0) {
    formulario.value.arquivo = files[0]
  }
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
  if (!abaAtiva.value || abaAtiva.value === 'calendario') {
    auditorias = store.auditorias
  } else {
    auditorias = store.auditoriasAgrupadas[abaAtiva.value] || []
  }
  // Filtrar apenas auditorias ativas
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
    </div>

    <!-- Calendário de Auditorias -->
    <div v-if="abaAtiva === 'calendario'" class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <div class="bg-white rounded-lg shadow-lg p-6">
        <h2 class="text-2xl font-bold text-gray-800 mb-4">
          <i class="fas fa-calendar-alt text-blue-600 mr-2"></i>
          Calendário de Auditorias
        </h2>
        
        <div class="grid grid-cols-1 gap-3">
          <div
            v-for="(dia, index) in diasSemana"
            :key="index"
            :class="[
              'p-4 rounded-lg border-l-4 transition',
              dia.tipos.length > 0
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 bg-gray-50'
            ]"
          >
            <div class="flex justify-between items-center">
              <div>
                <h3 class="font-bold text-gray-800">{{ dia.dia }}</h3>
                <p class="text-sm text-gray-600">08:00 - 18:00</p>
              </div>
              <div v-if="dia.tipos.length > 0" class="text-right">
                <span
                  v-for="tipo in dia.tipos"
                  :key="tipo"
                  class="inline-block bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-semibold"
                >
                  {{ tipo }}
                </span>
              </div>
              <div v-else class="text-gray-400">
                <i class="fas fa-times text-xl"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Formulário de Nova Auditoria -->
      <div class="bg-white rounded-lg shadow-lg p-6">
        <h2 class="text-2xl font-bold text-gray-800 mb-4">
          <i class="fas fa-plus text-green-600 mr-2"></i>
          Nova Auditoria
        </h2>

        <div class="space-y-4">
          <!-- Arquivo Excel -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Arquivo Excel</label>
            <input
              @change="handleFileChange"
              type="file"
              accept=".xlsx,.xls,.csv"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p class="text-xs text-gray-500 mt-1">Selecione o arquivo Excel com os dados da auditoria</p>
            <p v-if="formulario.arquivo" class="text-xs text-green-600 mt-1">
              ✓ {{ formulario.arquivo.name }}
            </p>
          </div>

          <!-- Tipo de Auditoria -->
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

          <!-- Data -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Data</label>
            <input
              v-model="formulario.data"
              type="date"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <!-- Botão Submeter -->
          <button
            @click="submeterAuditoria"
            :disabled="processando || !formulario.arquivo"
            class="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <i :class="processando ? 'fas fa-spinner fa-spin' : 'fas fa-plus'" class="mr-2"></i>
            {{ processando ? 'Processando...' : 'Criar Auditoria' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Lista de Auditorias -->
    <div class="bg-white rounded-lg shadow-lg overflow-hidden">
      <div class="bg-blue-600 text-white px-6 py-4">
        <h2 class="text-xl font-bold">
          <i class="fas fa-list mr-2"></i>
          Auditorias Ativas
        </h2>
      </div>

      <div v-if="auditoriasFiltradasPorTipo.length === 0" class="p-6 text-center">
        <p class="text-gray-500">Nenhuma auditoria registrada ainda</p>
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
