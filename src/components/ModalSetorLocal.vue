<template>
  <div 
    v-if="aberto"
    class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
    @click.stop="fechar"
  >
    <!-- Modal Content -->
    <div 
      class="bg-white rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
      @click.stop
    >
      <!-- Header -->
      <div class="bg-linear-to-r from-blue-600 to-blue-800 text-white p-4 flex items-center justify-between">
        <div>
          <h2 class="text-xl font-bold">{{ titulo }}</h2>
          <p class="text-blue-100 text-sm mt-1">{{ subtitulo }}</p>
        </div>
        <button
          @click="fechar"
          class="text-white hover:opacity-80 transition"
        >
          <i class="fas fa-times text-xl"></i>
        </button>
      </div>

      <!-- Filtros e Ordenação -->
      <div class="bg-gray-100 border-b px-4 py-3 flex gap-2 flex-wrap items-center">
        <input
          v-model="filtroBusca"
          type="text"
          placeholder="🔍 Buscar..."
          class="px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-[200px]"
        />
        <select
          v-model="ordenacao.coluna"
          class="px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="nome">Ordenar por Nome</option>
          <option value="pendentes">Ordenar por Pendentes</option>
          <option value="lidos">Ordenar por Lidos</option>
          <option value="total">Ordenar por Total</option>
          <option value="percentualPendente">Ordenar por % Pendente</option>
        </select>
        <select
          v-model="ordenacao.direcao"
          class="px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="asc">Crescente</option>
          <option value="desc">Decrescente</option>
        </select>
        <button
          v-if="filtroBusca || ordenacao.coluna !== 'nome'"
          @click="limparFiltros"
          class="px-3 py-1.5 text-sm bg-gray-300 text-gray-800 rounded hover:bg-gray-400 transition"
        >
          Limpar
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-4">
        <!-- Lista de Itens com Filtros -->
        <div class="bg-white rounded-lg shadow overflow-hidden">
          <table class="w-full text-sm">
            <thead class="bg-gray-100 border-b sticky top-0">
              <tr>
                <th class="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-200" @click="ordenarPor('nome')">
                  {{ nomeColuna }}
                  <i v-if="ordenacao.coluna === 'nome'" :class="ordenacao.direcao === 'asc' ? 'fas fa-arrow-up' : 'fas fa-arrow-down'" class="ml-1 text-xs"></i>
                </th>
                <th class="px-4 py-3 text-right font-semibold text-gray-700 cursor-pointer hover:bg-gray-200" @click="ordenarPor('lidos')">
                  Lidos
                  <i v-if="ordenacao.coluna === 'lidos'" :class="ordenacao.direcao === 'asc' ? 'fas fa-arrow-up' : 'fas fa-arrow-down'" class="ml-1 text-xs"></i>
                </th>
                <th class="px-4 py-3 text-right font-semibold text-gray-700 cursor-pointer hover:bg-gray-200" @click="ordenarPor('pendentes')">
                  Pendentes
                  <i v-if="ordenacao.coluna === 'pendentes'" :class="ordenacao.direcao === 'asc' ? 'fas fa-arrow-up' : 'fas fa-arrow-down'" class="ml-1 text-xs"></i>
                </th>
                <th class="px-4 py-3 text-right font-semibold text-gray-700 cursor-pointer hover:bg-gray-200" @click="ordenarPor('comProblema')">
                  Problema
                  <i v-if="ordenacao.coluna === 'comProblema'" :class="ordenacao.direcao === 'asc' ? 'fas fa-arrow-up' : 'fas fa-arrow-down'" class="ml-1 text-xs"></i>
                </th>
                <th class="px-4 py-3 text-right font-semibold text-gray-700 cursor-pointer hover:bg-gray-200" @click="ordenarPor('total')">
                  Total
                  <i v-if="ordenacao.coluna === 'total'" :class="ordenacao.direcao === 'asc' ? 'fas fa-arrow-up' : 'fas fa-arrow-down'" class="ml-1 text-xs"></i>
                </th>
                <th class="px-4 py-3 text-right font-semibold text-gray-700 cursor-pointer hover:bg-gray-200" @click="ordenarPor('percentualPendente')">
                  % Pendente
                  <i v-if="ordenacao.coluna === 'percentualPendente'" :class="ordenacao.direcao === 'asc' ? 'fas fa-arrow-up' : 'fas fa-arrow-down'" class="ml-1 text-xs"></i>
                </th>
                <th v-if="tipo === 'local'" class="px-4 py-3 text-center font-semibold text-gray-700">Ação</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr 
                v-for="(item, idx) in itemsFiltrados" 
                :key="idx" 
                class="hover:bg-blue-50 transition cursor-pointer"
                @click="tipo === 'setor' ? abrirLocaisDoSetor(item) : null"
              >
                <td class="px-4 py-3 font-medium text-gray-800">{{ item.nome }}</td>
                <td class="px-4 py-3 text-right text-green-600 font-semibold">{{ item.lidos }}</td>
                <td class="px-4 py-3 text-right text-orange-600 font-semibold">{{ item.pendentes }}</td>
                <td class="px-4 py-3 text-right text-red-600 font-semibold">{{ item.comProblema || 0 }}</td>
                <td class="px-4 py-3 text-right font-semibold text-blue-600">{{ item.total }}</td>
                <td class="px-4 py-3 text-right font-bold" :class="item.percentualPendente <= 3 ? 'text-green-600' : 'text-orange-600'">
                  {{ item.percentualPendente?.toFixed(2) || item.percentualLido?.toFixed(2) || '0.00' }}%
                </td>
                <td v-if="tipo === 'local'" class="px-4 py-3 text-center">
                  <button
                    @click.stop="abrirItensDoLocal(item)"
                    class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-xs"
                  >
                    Ver Itens
                  </button>
                </td>
              </tr>
              <tr v-if="itemsFiltrados.length === 0">
                <td colspan="7" class="px-4 py-6 text-center text-gray-500">Nenhum item encontrado</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Footer -->
      <div class="bg-gray-50 px-4 py-2 flex justify-between items-center">
        <p class="text-sm text-gray-600">Mostrando {{ itemsFiltrados.length }} de {{ items.length }} itens</p>
        <button
          @click="fechar"
          class="px-4 py-2 rounded-lg bg-gray-300 text-gray-800 hover:bg-gray-400 transition font-medium"
        >
          Fechar
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  aberto: Boolean,
  tipo: String, // 'setor' ou 'local'
  items: Array,
  titulo: String,
  subtitulo: String,
  dadosCompletos: Array, // Dados completos da auditoria para filtrar itens
  analise: Object // Análise completa para buscar locais do setor
})

const emit = defineEmits(['fechar', 'abrirItens', 'abrirLocais'])

const filtroBusca = ref('')
const ordenacao = ref({ coluna: 'nome', direcao: 'desc' })
const viewMode = ref('list')

const nomeColuna = computed(() => {
  return props.tipo === 'setor' ? 'Setor' : 'Local'
})

const itemsFiltrados = computed(() => {
  let filtrados = props.items || []
  
  // Aplicar filtro de busca
  if (filtroBusca.value) {
    const busca = filtroBusca.value.toLowerCase()
    filtrados = filtrados.filter(item => 
      item.nome.toLowerCase().includes(busca)
    )
  }
  
  // Aplicar ordenação
  filtrados = [...filtrados].sort((a, b) => {
    let valorA, valorB
    
    switch(ordenacao.value.coluna) {
      case 'nome':
        valorA = a.nome || ''
        valorB = b.nome || ''
        return ordenacao.value.direcao === 'asc' 
          ? valorA.localeCompare(valorB)
          : valorB.localeCompare(valorA)
      case 'pendentes':
        valorA = a.pendentes || 0
        valorB = b.pendentes || 0
        break
      case 'lidos':
        valorA = a.lidos || 0
        valorB = b.lidos || 0
        break
      case 'total':
        valorA = a.total || 0
        valorB = b.total || 0
        break
      case 'percentualPendente':
        valorA = a.percentualPendente || 0
        valorB = b.percentualPendente || 0
        break
      default:
        return 0
    }
    
    return ordenacao.value.direcao === 'asc' 
      ? valorA - valorB
      : valorB - valorA
  })
  
  return filtrados
})

const ordenarPor = (coluna) => {
  if (ordenacao.value.coluna === coluna) {
    ordenacao.value.direcao = ordenacao.value.direcao === 'asc' ? 'desc' : 'asc'
  } else {
    ordenacao.value.coluna = coluna
    ordenacao.value.direcao = 'desc'
  }
}

const limparFiltros = () => {
  filtroBusca.value = ''
  ordenacao.value = { coluna: 'nome', direcao: 'desc' }
}

const abrirLocaisDoSetor = (setor) => {
  if (!props.analise || !props.analise.porLocal) return
  
  // Buscar locais que pertencem a este setor
  const locaisDoSetor = []
  const setorNome = setor.nome
  
  if (props.dadosCompletos) {
    const locaisEncontrados = {}
    
    props.dadosCompletos.forEach(item => {
      const itemSetor = item['Classe de Produto Raiz'] || 'Não especificado'
      if (itemSetor === setorNome) {
        const localNome = item['Local'] || 'Não especificado'
        if (!locaisEncontrados[localNome]) {
          locaisEncontrados[localNome] = {
            nome: localNome,
            lidos: 0,
            pendentes: 0,
            comProblema: 0,
            total: 0
          }
        }
        
        const temPresenca = item._temPresenca || false
        const estoque = item._estoque || 0
        
        if (temPresenca && estoque > 0) {
          locaisEncontrados[localNome].lidos++
        } else if (!temPresenca && estoque > 0) {
          locaisEncontrados[localNome].pendentes++
        } else if (temPresenca && estoque === 0) {
          locaisEncontrados[localNome].comProblema++
        }
        locaisEncontrados[localNome].total++
      }
    })
    
    Object.values(locaisEncontrados).forEach(local => {
      local.percentualPendente = local.total > 0 ? parseFloat(((local.pendentes / local.total) * 100).toFixed(2)) : 0
      local.percentualLido = local.total > 0 ? parseFloat((((local.lidos + local.comProblema) / local.total) * 100).toFixed(2)) : 0
      locaisDoSetor.push(local)
    })
  }
  
  emit('abrirLocais', {
    setor: setorNome,
    locais: locaisDoSetor.sort((a, b) => b.pendentes - a.pendentes)
  })
}

const abrirItensDoLocal = (local) => {
  if (!props.dadosCompletos) return
  
  const itensDoLocal = props.dadosCompletos.filter(item => {
    const itemLocal = item['Local'] || 'Não especificado'
    return itemLocal === local.nome
  })
  
  emit('abrirItens', {
    local: local.nome,
    itens: itensDoLocal
  })
}

const fechar = () => {
  filtroBusca.value = ''
  ordenacao.value = { coluna: 'nome', direcao: 'desc' }
  emit('fechar')
}
</script>
