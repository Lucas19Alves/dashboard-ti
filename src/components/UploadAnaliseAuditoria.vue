<template>
  <div class="space-y-6" @click.stop>
    <!-- Upload Excel Section -->
    <div class="bg-white rounded-lg shadow-lg p-8" @click.stop>
      <h3 class="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
        <i class="fas fa-file-upload text-green-600"></i>
        Carregar Dados do Auditoria
      </h3>

      <div class="space-y-4" @click.stop>
        <!-- File Input with Better Design -->
        <div class="relative" @click.stop>
          <input 
            type="file"
            id="fileInput"
            accept=".xlsx,.xls,.csv"
            @change="handleFileChange"
            class="hidden"
          />
          <label 
            for="fileInput"
            @click.stop
            class="block p-8 border-2 border-dashed border-blue-400 rounded-lg text-center cursor-pointer hover:bg-blue-50 hover:border-blue-600 transition-all"
          >
            <div class="flex flex-col items-center gap-3" @click.stop>
              <i class="fas fa-cloud-upload-alt text-5xl text-blue-400"></i>
              <div>
                <p class="text-lg font-medium text-gray-700">Clique ou arraste um arquivo</p>
                <p class="text-sm text-gray-500 mt-1">.xlsx, .xls ou .csv</p>
              </div>
            </div>
          </label>
        </div>

        <!-- File Status -->
        <div v-if="nomeArquivo" class="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3" @click.stop>
          <i class="fas fa-check-circle text-green-600 text-xl"></i>
          <div>
            <p class="font-medium text-green-800">Arquivo selecionado</p>
            <p class="text-sm text-green-700">{{ nomeArquivo }}</p>
          </div>
          <button
            @click.stop="nomeArquivo = null; arquivoSelecionado = null"
            class="ml-auto text-green-600 hover:text-green-800"
          >
            <i class="fas fa-times"></i>
          </button>
        </div>

        <!-- Process Button -->
        <button
          @click.stop="processar"
          :disabled="!nomeArquivo || processando"
          class="w-full py-3 px-6 rounded-lg font-semibold text-white transition-all flex items-center justify-center gap-2"
          :class="nomeArquivo && !processando 
            ? 'bg-green-600 hover:bg-green-700 cursor-pointer' 
            : 'bg-gray-400 cursor-not-allowed'"
        >
          <i :class="processando ? 'fas fa-spinner fa-spin' : 'fas fa-play'"></i>
          {{ processando ? 'Processando...' : 'Processar Arquivo' }}
        </button>
      </div>
    </div>

    <!-- Análises/Insights -->
    <div v-if="analise" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- Total de Itens -->
      <div class="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow-lg p-6 border-l-4 border-blue-600">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-gray-600 text-sm font-medium">Total de Itens</p>
            <p class="text-3xl font-bold text-blue-600">{{ analise.totalItens }}</p>
          </div>
          <i class="fas fa-list text-4xl text-blue-300 opacity-50"></i>
        </div>
      </div>

      <!-- Itens Lidos -->
      <div class="bg-gradient-to-br from-green-50 to-green-100 rounded-lg shadow-lg p-6 border-l-4 border-green-600">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-gray-600 text-sm font-medium">Itens Lidos</p>
            <p class="text-3xl font-bold text-green-600">{{ analise.itensLidos }}</p>
          </div>
          <i class="fas fa-check-circle text-4xl text-green-300 opacity-50"></i>
        </div>
      </div>

      <!-- Itens NÃO Lidos -->
      <div class="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg shadow-lg p-6 border-l-4 border-orange-600">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-gray-600 text-sm font-medium">Itens NÃO Lidos</p>
            <p class="text-3xl font-bold text-orange-600">{{ analise.itensPendentes }}</p>
          </div>
          <i class="fas fa-clock text-4xl text-orange-300 opacity-50"></i>
        </div>
      </div>

      <!-- Parcial (% Não Lidos) -->
      <div class="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg shadow-lg p-6 border-l-4 border-purple-600">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-gray-600 text-sm font-medium">Parcial (% Não Lidos)</p>
            <p class="text-3xl font-bold text-purple-600">{{ analise.parcialPercentual }}%</p>
          </div>
          <i class="fas fa-chart-pie text-4xl text-purple-300 opacity-50"></i>
        </div>
        <div class="mt-3 bg-gray-200 rounded-full h-2">
          <div 
            :style="{ width: analise.parcialPercentual + '%' }" 
            class="bg-purple-600 h-2 rounded-full transition-all"
          />
        </div>
      </div>
    </div>

    <!-- Insights de Setores e Locais -->
    <div v-if="analise" class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- Setores Parados -->
      <div v-if="analise.setoresParados.length > 0" class="bg-white rounded-lg shadow-lg p-6 border-l-4 border-red-500">
        <h4 class="font-bold text-gray-800 mb-3">
          <i class="fas fa-exclamation-circle text-red-600 mr-2"></i>
          Setores Parados
        </h4>
        <div class="space-y-2">
          <div v-for="setor in analise.setoresParados" :key="setor" class="bg-red-50 p-3 rounded text-sm text-red-800">
            {{ setor }}
          </div>
        </div>
      </div>

      <!-- Locais sem Leitura -->
      <div v-if="analise.locaisSemLeitura.length > 0" class="bg-white rounded-lg shadow-lg p-6 border-l-4 border-yellow-500">
        <h4 class="font-bold text-gray-800 mb-3">
          <i class="fas fa-map-marker-alt text-yellow-600 mr-2"></i>
          Locais sem Leitura
        </h4>
        <div class="space-y-2">
          <div v-for="local in analise.locaisSemLeitura" :key="local" class="bg-yellow-50 p-3 rounded text-sm text-yellow-800">
            {{ local }}
          </div>
        </div>
      </div>
    </div>

    <!-- Leituras por Usuário -->
    <div v-if="analise" class="bg-white rounded-lg shadow-lg p-6">
      <h4 class="font-bold text-gray-800 mb-4">
        <i class="fas fa-users text-blue-600 mr-2"></i>
        Leituras por Usuário
      </h4>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-100 border-b">
            <tr>
              <th class="px-4 py-2 text-left">Usuário</th>
              <th class="px-4 py-2 text-right">Lidos</th>
              <th class="px-4 py-2 text-right">Não Lidos</th>
              <th class="px-4 py-2 text-right">% Não Lidos</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            <tr v-for="usuario in analise.usuarios" :key="usuario" class="hover:bg-gray-50">
              <td class="px-4 py-3 font-medium text-gray-800">{{ usuario }}</td>
              <td class="px-4 py-3 text-right text-green-600 font-semibold">{{ analise.porUsuario[usuario].lidos }}</td>
              <td class="px-4 py-3 text-right text-orange-600 font-semibold">{{ analise.porUsuario[usuario].pendentes }}</td>
              <td class="px-4 py-3 text-right">
                <div class="flex items-center gap-2 justify-end">
                  <span class="text-xs font-semibold text-purple-600">
                    {{ Math.round((analise.porUsuario[usuario].pendentes / (analise.porUsuario[usuario].lidos + analise.porUsuario[usuario].pendentes)) * 100) }}%
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAuditoriasStore } from '../stores/auditoriasStore'

const props = defineProps({
  auditoria: Object
})

const emit = defineEmits(['analiseCompleta'])

const store = useAuditoriasStore()
const nomeArquivo = ref(null)
const arquivoSelecionado = ref(null)
const processando = ref(false)
const analise = ref(null)

const handleFileChange = (event) => {
  event.stopPropagation()
  const files = event.target.files
  if (files && files.length > 0) {
    arquivoSelecionado.value = files[0]
    nomeArquivo.value = files[0].name
    console.log('✅ Arquivo selecionado:', files[0].name)
  }
}

const processar = async () => {
  console.clear()
  console.log('🚀 PROCESSAMENTO INICIADO')
  
  if (!arquivoSelecionado.value) {
    store.addToast('Selecione um arquivo!', 'warning')
    return
  }

  processando.value = true

  try {
    const dados = await store.processarExcelPresenca(arquivoSelecionado.value)
    
    if (!dados || dados.length === 0) {
      store.addToast('Arquivo vazio ou inválido!', 'warning')
      return
    }
    
    console.log('✅ Dados recebidos:', dados.length, 'linhas')
    analise.value = store.analisarDadosPresenca(dados)
    
    emit('analiseCompleta', {
      dados,
      analise: analise.value
    })

    store.addToast(`Arquivo processado! ${dados.length} itens carregados.`, 'success')
    nomeArquivo.value = null
    arquivoSelecionado.value = null
  } catch (erro) {
    console.error('❌ Erro:', erro.message)
    store.addToast('Erro: ' + erro.message, 'error')
  } finally {
    processando.value = false
  }
}
</script>
