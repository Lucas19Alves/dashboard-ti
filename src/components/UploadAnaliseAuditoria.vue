<template>
  <div class="space-y-6" @click.stop>
    <!-- Upload Excel Section -->
    <div class="bg-white rounded-lg shadow-lg p-8" @click.stop>
      <h3 class="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
        <i class="fas fa-file-upload text-green-600"></i>
        Carregar Dados do Auditoria
      </h3>

      <div class="space-y-4" @click.stop>
        <div 
          class="relative"
          @dragover.prevent="onDragOver"
          @dragleave.prevent="onDragLeave"
          @drop.prevent="onDrop"
          @click.stop
        >
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
            :class="[
              'block p-8 border-2 border-dashed rounded-lg text-center cursor-pointer transition-all',
              arrastando ? 'bg-blue-50 border-blue-600' : 'border-blue-400 hover:bg-blue-50 hover:border-blue-600'
            ]"
          >
            <div class="flex flex-col items-center gap-3" @click.stop>
              <i class="fas fa-cloud-upload-alt text-5xl text-blue-400"></i>
              <div>
                <p class="text-lg font-medium text-gray-700">
                  Clique para selecionar ou arraste o arquivo aqui
                </p>
                <p class="text-sm text-gray-500 mt-1">
                  Aceita .xlsx, .xls, .csv
                </p>
              </div>
            </div>
          </label>
          <p class="mt-2 text-xs text-gray-500">
            Arquivo máximo recomendado: 20MB. Apenas um arquivo por vez.
          </p>
          <div v-if="erroUpload" class="mt-2 text-sm text-red-600">
            {{ erroUpload }}
          </div>
        </div>

        <div 
          v-if="nomeArquivo" 
          class="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3" 
          @click.stop
        >
          <i class="fas fa-check-circle text-green-600 text-xl"></i>
          <div>
            <p class="font-medium text-green-800">Arquivo selecionado</p>
            <p class="text-sm text-green-700">{{ nomeArquivo }}</p>
          </div>
          <button
            @click.stop="abrirSeletor"
            class="ml-auto px-3 py-1.5 rounded bg-green-600 text-white hover:bg-green-700 transition text-sm"
          >
            Trocar arquivo
          </button>
          <button
            @click.stop="nomeArquivo = null; arquivoSelecionado = null"
            class="text-green-600 hover:text-green-800"
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
      <div 
        @click="abrirModal('total')"
        class="bg-linear-to-br from-blue-50 to-blue-100 rounded-lg shadow-lg p-6 border-l-4 border-blue-600 cursor-pointer hover:shadow-xl hover:scale-105 transition-all"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="text-gray-600 text-sm font-medium">Total Auditável</p>
            <p class="text-3xl font-bold text-blue-600">{{ analise.totalItens }}</p>
          </div>
          <i class="fas fa-list text-4xl text-blue-300 opacity-50"></i>
        </div>
      </div>

      <!-- Itens Lidos Corretamente -->
      <div 
        @click="abrirModal('lidos')"
        class="bg-linear-to-br from-green-50 to-green-100 rounded-lg shadow-lg p-6 border-l-4 border-green-600 cursor-pointer hover:shadow-xl hover:scale-105 transition-all"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="text-gray-600 text-sm font-medium">✅ Lidos Corretamente</p>
            <p class="text-3xl font-bold text-green-600">{{ analise.itensLidosCorretamente }}</p>
          </div>
          <i class="fas fa-check-circle text-4xl text-green-300 opacity-50"></i>
        </div>
      </div>

      <!-- Itens Pendentes -->
      <div 
        @click="abrirModal('pendentes')"
        class="bg-linear-to-br from-orange-50 to-orange-100 rounded-lg shadow-lg p-6 border-l-4 border-orange-600 cursor-pointer hover:shadow-xl hover:scale-105 transition-all"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="text-gray-600 text-sm font-medium">⏳ Pendentes</p>
            <p class="text-3xl font-bold text-orange-600">{{ pendentesExibidos }}</p>
          </div>
          <i class="fas fa-clock text-4xl text-orange-300 opacity-50"></i>
        </div>
      </div>

      <!-- Itens Com Problema -->
      <div 
        @click="abrirModal('problema')"
        class="bg-linear-to-br from-red-50 to-red-100 rounded-lg shadow-lg p-6 border-l-4 border-red-600 cursor-pointer hover:shadow-xl hover:scale-105 transition-all"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="text-gray-600 text-sm font-medium">⚠️ Com Problema</p>
            <p class="text-3xl font-bold text-red-600">{{ analise.itensLidosComProblema }}</p>
          </div>
          <i class="fas fa-exclamation-circle text-4xl text-red-300 opacity-50"></i>
        </div>
        <div v-if="analise.itensLidosComProblema > 0" class="mt-3 text-xs text-red-700 space-y-1">
          <p v-if="analise.itensComEstoqueZero > 0">• Estoque Zero: {{ analise.itensComEstoqueZero }}</p>
          <p v-if="analise.itensLidoNaoPertence > 0">• Local Errado: {{ analise.itensLidoNaoPertence }}</p>
        </div>
      </div>
    </div>

    <!-- Modal de Métrica -->
    <ModalMetrica 
      :aberto="modalAberto"
      :tipo="tipoMetricaSelecionada"
      :dados="analise"
      :tipoAuditoria="props.auditoria?.tipo"
      @fechar="fecharModal"
    />

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
import { ref, computed } from 'vue'
import { useAuditoriasStore } from '../stores/auditoriasStore'
import ModalMetrica from './ModalMetrica.vue'

const props = defineProps({
  auditoria: Object
})

const emit = defineEmits(['analiseCompleta'])

const store = useAuditoriasStore()
const nomeArquivo = ref(null)
const arquivoSelecionado = ref(null)
const processando = ref(false)
const analise = ref(null)
const modalAberto = ref(false)
const tipoMetricaSelecionada = ref(null)
const arrastando = ref(false)
const erroUpload = ref('')

const pendentesExibidos = computed(() => {
  const a = analise.value
  if (!a) return 0
  return a.itensPendentes || 0
})

const handleFileChange = (event) => {
  event.stopPropagation()
  const files = event.target.files
  if (files && files.length > 0) {
    const file = files[0]
    if (!validarArquivo(file)) {
      return
    }
    arquivoSelecionado.value = file
    nomeArquivo.value = file.name
    erroUpload.value = ''
    console.log('✅ Arquivo selecionado:', file.name)
  }
}

const abrirSeletor = () => {
  const input = document.getElementById('fileInput')
  if (input) input.click()
}

const validarArquivo = (file) => {
  erroUpload.value = ''
  const permitido = ['.xlsx', '.xls', '.csv']
  const nome = file.name.toLowerCase()
  const okExt = permitido.some(ext => nome.endsWith(ext))
  if (!okExt) {
    erroUpload.value = 'Tipo de arquivo inválido. Use .xlsx, .xls ou .csv.'
    return false
  }
  const max = 20 * 1024 * 1024
  if (file.size > max) {
    erroUpload.value = 'Arquivo muito grande. Tamanho máximo recomendado: 20MB.'
    return false
  }
  return true
}

const onDragOver = () => {
  arrastando.value = true
}

const onDragLeave = () => {
  arrastando.value = false
}

const onDrop = (e) => {
  arrastando.value = false
  const dt = e.dataTransfer
  if (!dt || !dt.files || dt.files.length === 0) return
  const file = dt.files[0]
  if (!validarArquivo(file)) return
  arquivoSelecionado.value = file
  nomeArquivo.value = file.name
  erroUpload.value = ''
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
    let dados = []
    const tipo = props.auditoria?.tipo || 'Etiqueta'
    const temEtiqueta = typeof store.processarExcelEtiqueta === 'function'
    const temRuptura = typeof store.processarExcelRuptura === 'function'
    const optsRuptura = {
      dataAuditoria: props.auditoria?.data,
      tipoAuditoria: tipo
    }
    if (tipo === 'Presença') {
      dados = await store.processarExcelPresenca(arquivoSelecionado.value)
    } else if (tipo === 'Ruptura') {
      dados = temRuptura
        ? await store.processarExcelRuptura(arquivoSelecionado.value, optsRuptura)
        : await store.processarExcelPresenca(arquivoSelecionado.value, optsRuptura)
    } else if (tipo === 'Etiqueta') {
      dados = temEtiqueta
        ? await store.processarExcelEtiqueta(arquivoSelecionado.value)
        : await store.processarExcelPresenca(arquivoSelecionado.value)
    } else {
      dados = await store.processarExcelPresenca(arquivoSelecionado.value, { tipo: tipo, dataAuditoria: props.auditoria?.data })
    }
    
    if (!dados || dados.length === 0) {
      store.addToast('Arquivo vazio ou inválido!', 'warning')
      return
    }

    console.log('✅ Dados recebidos:', dados.length, 'linhas')
    // Usar o tipo definido na auditoria (já foi selecionado no formulário)
    const tipoEfetivo = props.auditoria?.tipo || 'Etiqueta'
    const skuValor = props.auditoria?.sku || 0
    const optsAnaliseRuptura = {
      dataAuditoria: props.auditoria?.data,
      tipoAuditoria: tipoEfetivo
    }
    const temAnaliseEtiqueta = typeof store.analisarDadosEtiqueta === 'function'
    const temAnaliseRuptura = typeof store.analisarDadosRuptura === 'function'
    analise.value = tipoEfetivo === 'Presença'
      ? store.analisarDadosPresenca(dados, skuValor)
      : tipoEfetivo === 'Ruptura'
        ? (temAnaliseRuptura ? store.analisarDadosRuptura(dados, skuValor, optsAnaliseRuptura) : store.analisarDadosPresenca(dados, skuValor))
      : tipoEfetivo === 'Etiqueta'
        ? (temAnaliseEtiqueta ? store.analisarDadosEtiqueta(dados, skuValor) : store.analisarDadosPresenca(dados, skuValor))
        : store.analisarDadosPresenca(dados, skuValor)
    
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

const abrirModal = (tipo) => {
  tipoMetricaSelecionada.value = tipo
  modalAberto.value = true
}

const fecharModal = () => {
  modalAberto.value = false
  tipoMetricaSelecionada.value = null
}
</script>
