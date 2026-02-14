<template>
  <div class="bg-white rounded-lg shadow-lg p-6">
    <div class="flex items-center justify-between mb-6">
      <h4 class="font-bold text-gray-800 text-lg">
        <i class="fas fa-table text-blue-600 mr-2"></i>
        Dados Detalhados da Auditoria
      </h4>
      <div class="flex gap-2">
        <input 
          v-model="filtroBusca"
          type="text"
          placeholder="Buscar por código, produto, usuário..."
          class="px-3 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>

    <!-- Filtros -->
    <div class="mb-4 flex gap-2 flex-wrap">
      <select 
        v-model="filtroUsuario"
        class="px-3 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Todos os usuários</option>
        <option v-for="usuario in usuariosUnicos" :key="usuario" :value="usuario">
          {{ usuario }}
        </option>
      </select>

      <select 
        v-model="filtroSetor"
        class="px-3 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Todos os setores</option>
        <option v-for="setor in setoresUnicos" :key="setor" :value="setor">
          {{ setor }}
        </option>
      </select>

      <select 
        v-model="filtroLocal"
        class="px-3 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Todos os locais</option>
        <option v-for="local in locaisUnicos" :key="local" :value="local">
          {{ local }}
        </option>
      </select>

      <select 
        v-model="filtroPresenca"
        class="px-3 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Todos</option>
        <option value="lido">Lidos</option>
        <option value="pendente">Pendentes</option>
      </select>

      <button 
        v-if="filtroUsuario || filtroSetor || filtroLocal || filtroPresenca || filtroBusca"
        @click="limparFiltros"
        class="px-3 py-1 text-sm bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition"
      >
        Limpar Filtros
      </button>
    </div>

    <!-- Tabela -->
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-blue-600 text-white sticky top-0">
          <tr>
            <th class="px-4 py-3 text-left cursor-pointer hover:bg-blue-700 transition" @click="ordenarPor('Código')">
              Código
              <i v-if="ordenacao.coluna === 'Código'" :class="ordenacao.direcao === 'asc' ? 'fas fa-arrow-up' : 'fas fa-arrow-down'" class="ml-1"></i>
            </th>
            <th class="px-4 py-3 text-left cursor-pointer hover:bg-blue-700 transition" @click="ordenarPor('Produto')">
              Produto
            </th>
            <th class="px-4 py-3 text-left cursor-pointer hover:bg-blue-700 transition" @click="ordenarPor('Classe de Produto Raiz')">
              Setor
            </th>
            <th class="px-4 py-3 text-left cursor-pointer hover:bg-blue-700 transition" @click="ordenarPor('Local')">
              Local
            </th>
            <th class="px-4 py-3 text-left cursor-pointer hover:bg-blue-700 transition" @click="ordenarPor('Usuário')">
              Usuário
            </th>
            <th class="px-4 py-3 text-left cursor-pointer hover:bg-blue-700 transition" @click="ordenarPor('Presença confirmada')">
              Presença
            </th>
            <th class="px-4 py-3 text-right">Estoque Atual</th>
            <th class="px-4 py-3 text-right">Dias sem Venda</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          <tr 
            v-for="(item, index) in dadosFiltrados" 
            :key="index"
            class="hover:bg-gray-50 transition"
            :class="{
              'bg-green-50': item['Presença confirmada'],
              'bg-orange-50': !item['Presença confirmada']
            }"
          >
            <td class="px-4 py-3 font-bold text-gray-800">{{ item['Código'] }}</td>
            <td class="px-4 py-3 text-gray-700">{{ item['Produto'] }}</td>
            <td class="px-4 py-3 text-gray-700">{{ item['Classe de Produto Raiz'] }}</td>
            <td class="px-4 py-3 text-gray-700">{{ item['Local'] }}</td>
            <td class="px-4 py-3 text-gray-700">{{ item['Usuário'] }}</td>
            <td class="px-4 py-3">
              <span 
                :class="{
                  'bg-green-100 text-green-800': item['Presença confirmada'],
                  'bg-orange-100 text-orange-800': !item['Presença confirmada']
                }"
                class="px-2 py-1 rounded-full text-xs font-semibold"
              >
                {{ item['Presença confirmada'] ? 'Confirmada' : 'Pendente' }}
              </span>
            </td>
            <td class="px-4 py-3 text-right text-gray-700">{{ item['Estoque atual'] }}</td>
            <td class="px-4 py-3 text-right text-gray-700">{{ item['Dias sem venda'] }}</td>
          </tr>
          <tr v-if="dadosFiltrados.length === 0" class="text-center">
            <td colspan="8" class="px-4 py-6 text-gray-500">Nenhum dado encontrado com os filtros selecionados</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Paginação -->
    <div class="mt-4 flex items-center justify-between">
      <p class="text-sm text-gray-600">
        Mostrando {{ dadosFiltrados.length }} de {{ dados.length }} itens
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  dados: {
    type: Array,
    required: true
  }
})

const filtroBusca = ref('')
const filtroUsuario = ref('')
const filtroSetor = ref('')
const filtroLocal = ref('')
const filtroPresenca = ref('')
const ordenacao = ref({ coluna: 'Código', direcao: 'asc' })

const usuariosUnicos = computed(() => {
  return [...new Set(props.dados.map(item => item['Usuário']))].filter(Boolean)
})

const setoresUnicos = computed(() => {
  return [...new Set(props.dados.map(item => item['Classe de Produto Raiz']))].filter(Boolean)
})

const locaisUnicos = computed(() => {
  return [...new Set(props.dados.map(item => item['Local']))].filter(Boolean)
})

const dadosFiltrados = computed(() => {
  let filtrados = props.dados.filter(item => {
    // Filtro de busca
    if (filtroBusca.value) {
      const busca = filtroBusca.value.toLowerCase()
      const match = 
        String(item['Código']).toLowerCase().includes(busca) ||
        (item['Produto'] || '').toLowerCase().includes(busca) ||
        (item['Usuário'] || '').toLowerCase().includes(busca)
      if (!match) return false
    }

    // Filtro de usuário
    if (filtroUsuario.value && item['Usuário'] !== filtroUsuario.value) {
      return false
    }

    // Filtro de setor
    if (filtroSetor.value && item['Classe de Produto Raiz'] !== filtroSetor.value) {
      return false
    }

    // Filtro de local
    if (filtroLocal.value && item['Local'] !== filtroLocal.value) {
      return false
    }

    // Filtro de presença
    if (filtroPresenca.value === 'lido' && !item['Presença confirmada']) {
      return false
    }
    if (filtroPresenca.value === 'pendente' && item['Presença confirmada']) {
      return false
    }

    return true
  })

  // Ordenação
  filtrados.sort((a, b) => {
    const valorA = a[ordenacao.value.coluna] ?? ''
    const valorB = b[ordenacao.value.coluna] ?? ''

    if (typeof valorA === 'string') {
      return ordenacao.value.direcao === 'asc'
        ? valorA.localeCompare(valorB)
        : valorB.localeCompare(valorA)
    } else {
      return ordenacao.value.direcao === 'asc'
        ? valorA - valorB
        : valorB - valorA
    }
  })

  return filtrados
})

const ordenarPor = (coluna) => {
  if (ordenacao.value.coluna === coluna) {
    ordenacao.value.direcao = ordenacao.value.direcao === 'asc' ? 'desc' : 'asc'
  } else {
    ordenacao.value.coluna = coluna
    ordenacao.value.direcao = 'asc'
  }
}

const limparFiltros = () => {
  filtroBusca.value = ''
  filtroUsuario.value = ''
  filtroSetor.value = ''
  filtroLocal.value = ''
  filtroPresenca.value = ''
}
</script>
