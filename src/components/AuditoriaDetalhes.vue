<template>
  <!-- Modal Background -->
  <div 
    v-if="auditoria"
    class="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-40 flex items-center justify-center p-4"
    @click.stop="fechar"
  >
    <!-- Modal Content -->
    <div 
      class="bg-white rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
      @click.stop
    >
      <!-- Header -->
      <div class="bg-linear-to-r from-blue-600 to-blue-800 text-white p-6 flex items-center justify-between">
        <div>
          <h2 class="text-3xl font-bold">{{ auditoria.tipo }}</h2>
          <p class="text-blue-100 mt-1">Data: {{ auditoria.data }} | SKU: {{ auditoria.sku }}</p>
        </div>
        <button
          @click="fechar"
          class="text-white hover:bg-blue-700 p-2 rounded-lg transition"
        >
          <i class="fas fa-times text-2xl"></i>
        </button>
      </div>

      <!-- Tabs -->
      <div class="bg-gray-100 border-b flex gap-0">
        <button
          v-for="tab in abas"
          :key="tab"
          @click="abaAtiva = tab"
          :class="[
            'px-6 py-3 font-medium transition',
            abaAtiva === tab
              ? 'border-b-2 border-blue-600 text-blue-600 bg-white'
              : 'text-gray-600 hover:text-gray-800'
          ]"
        >
          <i :class="iconeAba(tab)" class="mr-2"></i>
          {{ tab }}
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-6">
        <!-- Estatísticas -->
        <div v-if="abaAtiva === 'Estatísticas'" class="space-y-6">
          <!-- Upload se não houver dados -->
          <div v-if="!props.dados || props.dados.length === 0" class="bg-blue-50 border-2 border-blue-300 rounded-lg p-8">
            <div class="text-center">
              <i class="fas fa-cloud-upload-alt text-4xl text-blue-500 mb-4"></i>
              <h3 class="text-xl font-bold text-gray-800 mb-2">Nenhum dado carregado</h3>
              <p class="text-gray-600 mb-6">Faça upload de um arquivo Excel para começar a análise</p>
              <UploadAnaliseAuditoria 
                :auditoria="auditoria"
                @analiseCompleta="handleUploadCompleto"
              />
            </div>
          </div>

          <!-- Cards de Métricas (se houver dados) -->
          <template v-else>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div class="bg-linear-to-br from-blue-50 to-blue-100 rounded-lg p-6 border-l-4 border-blue-600">
                <p class="text-gray-600 text-sm font-medium">Total de Itens</p>
                <p class="text-4xl font-bold text-blue-600 mt-2">{{ analise?.totalItens || 0 }}</p>
              </div>
              <div class="bg-linear-to-br from-green-50 to-green-100 rounded-lg p-6 border-l-4 border-green-600">
                <p class="text-gray-600 text-sm font-medium">Itens Lidos</p>
                <p class="text-4xl font-bold text-green-600 mt-2">{{ analise?.itensLidos || 0 }}</p>
              </div>
              <div class="bg-linear-to-br from-orange-50 to-orange-100 rounded-lg p-6 border-l-4 border-orange-600">
                <p class="text-gray-600 text-sm font-medium">Itens NÃO Lidos</p>
                <p class="text-4xl font-bold text-orange-600 mt-2">{{ analise?.itensPendentes || 0 }}</p>
              </div>
              <div class="bg-linear-to-br from-purple-50 to-purple-100 rounded-lg p-6 border-l-4 border-purple-600">
                <p class="text-gray-600 text-sm font-medium">Parcial (%)</p>
                <p class="text-4xl font-bold text-purple-600 mt-2">{{ analise?.parcialPercentual || 0 }}%</p>
              </div>
            </div>

            <!-- Progress Bar -->
            <div class="bg-white rounded-lg p-6 border border-gray-200">
              <h3 class="font-bold text-gray-800 mb-4">Progresso Geral</h3>
              <div class="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                <div 
                  :style="{ width: (100 - (analise?.parcialPercentual || 0)) + '%' }"
                  class="bg-gradient-to-r from-green-500 to-green-600 h-full transition-all"
                />
              </div>
              <p class="text-sm text-gray-600 mt-2">
                {{ analise?.itensLidos || 0 }} de {{ analise?.totalItens || 0 }} itens lidos
              </p>
            </div>

            <!-- Setores e Locais -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div v-if="analise?.setoresParados && analise?.setoresParados.length > 0" class="bg-red-50 rounded-lg p-6 border border-red-200">
                <h4 class="font-bold text-red-800 mb-4">
                  <i class="fas fa-exclamation-circle mr-2"></i>
                  Setores Parados
                </h4>
                <div class="space-y-2">
                  <div v-for="setor in analise.setoresParados" :key="setor" class="bg-white p-3 rounded text-sm text-red-700 border border-red-200">
                    {{ setor }}
                  </div>
                </div>
              </div>
              <div v-if="analise?.locaisSemLeitura && analise?.locaisSemLeitura.length > 0" class="bg-yellow-50 rounded-lg p-6 border border-yellow-200">
                <h4 class="font-bold text-yellow-800 mb-4">
                  <i class="fas fa-map-marker-alt mr-2"></i>
                  Locais sem Leitura
                </h4>
                <div class="space-y-2">
                  <div v-for="local in analise.locaisSemLeitura" :key="local" class="bg-white p-3 rounded text-sm text-yellow-700 border border-yellow-200">
                    {{ local }}
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- Usuários -->
        <div v-if="abaAtiva === 'Usuários'" class="space-y-4">
          <div class="flex gap-2 mb-4">
            <input 
              v-model="filtroUsuario"
              type="text"
              placeholder="🔍 Filtrar usuários..."
              class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>
          <div class="overflow-x-auto bg-white rounded-lg border border-gray-200">
            <table class="w-full">
              <thead class="bg-gray-100 border-b">
                <tr>
                  <th class="px-6 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-200">
                    <i class="fas fa-user mr-2"></i>Usuário
                  </th>
                  <th class="px-6 py-3 text-right font-semibold text-gray-700 cursor-pointer hover:bg-gray-200">Lidos</th>
                  <th class="px-6 py-3 text-right font-semibold text-gray-700 cursor-pointer hover:bg-gray-200">Não Lidos</th>
                  <th class="px-6 py-3 text-right font-semibold text-gray-700 cursor-pointer hover:bg-gray-200">%</th>
                </tr>
              </thead>
              <tbody class="divide-y">
                <tr v-for="usuario in usuariosFilatrados" :key="usuario" class="hover:bg-blue-50 transition">
                  <td class="px-6 py-3 font-medium text-gray-800">{{ usuario }}</td>
                  <td class="px-6 py-3 text-right text-green-600 font-semibold">{{ analise?.porUsuario[usuario]?.lidos || 0 }}</td>
                  <td class="px-6 py-3 text-right text-orange-600 font-semibold">{{ analise?.porUsuario[usuario]?.pendentes || 0 }}</td>
                  <td class="px-6 py-3 text-right text-purple-600 font-semibold">
                    {{ calcularPorcentagem(analise?.porUsuario[usuario]) }}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Dados Brutos -->
        <div v-if="abaAtiva === 'Dados'" class="space-y-4">
          <div class="flex gap-2 mb-4">
            <input 
              v-model="filtroDados"
              type="text"
              placeholder="🔍 Filtrar dados..."
              class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
            />
            <button
              @click="exportarCSV"
              class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              <i class="fas fa-download mr-2"></i>CSV
            </button>
          </div>
          <div class="overflow-x-auto bg-white rounded-lg border border-gray-200">
            <table class="w-full text-sm">
              <thead class="bg-gray-100 border-b sticky top-0">
                <tr>
                  <th v-for="coluna in colunas" :key="coluna" class="px-3 py-2 text-left font-semibold text-gray-700">
                    {{ coluna }}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y">
                <tr v-for="(item, idx) in dadosFilatrados" :key="idx" class="hover:bg-blue-50 transition">
                  <td v-for="coluna in colunas" :key="coluna" class="px-3 py-2 text-gray-700">
                    {{ item[coluna] || '-' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import UploadAnaliseAuditoria from './UploadAnaliseAuditoria.vue'

const props = defineProps({
  auditoria: Object,
  analise: Object,
  dados: Array
})

const emit = defineEmits(['fechar', 'uploadCompleto'])

const abaAtiva = ref('Estatísticas')
const filtroUsuario = ref('')
const filtroDados = ref('')

const abas = ['Estatísticas', 'Usuários', 'Dados']

const iconeAba = (tab) => {
  const icones = {
    'Estatísticas': 'fas fa-chart-bar',
    'Usuários': 'fas fa-users',
    'Dados': 'fas fa-table'
  }
  return icones[tab]
}

const colunas = computed(() => {
  if (!props.dados || props.dados.length === 0) return []
  return Object.keys(props.dados[0])
})

const usuariosFilatrados = computed(() => {
  if (!props.analise) return []
  return props.analise.usuarios.filter(u => 
    u.toLowerCase().includes(filtroUsuario.value.toLowerCase())
  )
})

const dadosFilatrados = computed(() => {
  if (!props.dados) return []
  return props.dados.filter(item => {
    const termo = filtroDados.value.toLowerCase()
    return Object.values(item).some(val => 
      String(val).toLowerCase().includes(termo)
    )
  })
})

const calcularPorcentagem = (usuario) => {
  if (!usuario) return 0
  const total = usuario.lidos + usuario.pendentes
  return total > 0 ? Math.round((usuario.pendentes / total) * 100) : 0
}

const fechar = () => {
  emit('fechar')
}

const handleUploadCompleto = ({ dados, analise }) => {
  // Atualizar os dados no contexto do modal
  // Os dados serão refrescados quando o modal fechar e reabrir
  // Ou emitimos para o pai atualizar
  emit('uploadCompleto', { dados, analise })
}

const exportarCSV = () => {
  if (!props.dados || props.dados.length === 0) return
  
  const headers = colunas.value
  const csv = [
    headers.join(','),
    ...props.dados.map(item => 
      headers.map(col => {
        const val = item[col] || ''
        return `"${String(val).replace(/"/g, '""')}"` // Escapar aspas
      }).join(',')
    )
  ].join('\n')
  
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `auditoria-${props.auditoria.tipo}-${props.auditoria.data}.csv`
  document.body.appendChild(a)
  a.click()
  window.URL.revokeObjectURL(url)
  document.body.removeChild(a)
}
</script>
