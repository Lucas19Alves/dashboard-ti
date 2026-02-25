<template>
  <div class="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
    <!-- Cabeçalho com Busca -->
    <div v-if="titulo || mostrarBusca" class="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50">
      <h4 v-if="titulo" class="font-bold text-gray-800 text-lg flex items-center gap-2">
        <slot name="icone-titulo"></slot>
        {{ titulo }}
      </h4>
      
      <div v-if="mostrarBusca" class="relative w-full sm:w-auto">
        <i class="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
        <input 
          v-model="termoBusca"
          type="text"
          placeholder="Buscar..."
          class="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm w-full sm:w-64"
        />
      </div>
    </div>

    <!-- Tabela -->
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-blue-600 text-white sticky top-0">
          <tr>
            <th 
              v-for="col in colunas" 
              :key="col.chave"
              @click="col.sortable !== false ? ordenar(col.chave) : null"
              class="px-4 py-3 text-left font-semibold whitespace-nowrap"
              :class="[
                col.sortable !== false ? 'cursor-pointer hover:bg-blue-700 transition' : '',
                col.classeHeader || ''
              ]"
            >
              <div class="flex items-center gap-2" :class="col.alinhamento === 'right' ? 'justify-end' : col.alinhamento === 'center' ? 'justify-center' : 'justify-start'">
                {{ col.titulo }}
                <i v-if="col.sortable !== false && ordenacao.coluna === col.chave" 
                   :class="ordenacao.direcao === 'asc' ? 'fas fa-arrow-up' : 'fas fa-arrow-down'" 
                   class="text-xs opacity-80"></i>
                <i v-else-if="col.sortable !== false" class="fas fa-sort text-xs opacity-30"></i>
              </div>
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr 
            v-for="(item, idx) in dadosRenderizados" 
            :key="idx" 
            class="hover:bg-blue-50 transition duration-150 ease-in-out"
            :class="[
              clickable ? 'cursor-pointer' : '',
              getRowClass(item)
            ]"
            @click="handleClick(item)"
          >
            <td 
              v-for="col in colunas" 
              :key="col.chave"
              class="px-4 py-3 text-gray-700"
              :class="[
                col.classeCell || '',
                col.alinhamento === 'right' ? 'text-right' : col.alinhamento === 'center' ? 'text-center' : 'text-left'
              ]"
            >
              <slot :name="'cell-' + col.chave" :item="item" :valor="getValor(item, col.chave)">
                {{ formatarValor(getValor(item, col.chave), col) }}
              </slot>
            </td>
          </tr>
          <tr v-if="dadosPaginados.length === 0">
             <td :colspan="colunas.length" class="px-4 py-12 text-center text-gray-500">
               <div class="flex flex-col items-center justify-center">
                 <i class="fas fa-search text-3xl text-gray-300 mb-2"></i>
                 <p>Nenhum registro encontrado</p>
               </div>
             </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Paginação -->
    <div v-if="!exibirTudo" class="p-4 border-t border-gray-200 bg-gray-50 flex flex-col sm:flex-row items-center justify-between gap-4">
      <p class="text-sm text-gray-600">
        Mostrando <span class="font-medium">{{ dadosFiltrados.length > 0 ? inicioPagina + 1 : 0 }}</span> a <span class="font-medium">{{ Math.min(fimPagina, dadosFiltrados.length) }}</span> de <span class="font-medium">{{ dadosFiltrados.length }}</span> registros
      </p>
      
      <div class="flex gap-2">
        <button 
          @click="paginaAnterior"
          :disabled="paginaAtual === 1"
          class="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-xs"
        >
          <i class="fas fa-chevron-left mr-1"></i> Anterior
        </button>
        
        <div class="hidden sm:flex gap-1">
           <button 
             v-for="p in paginasVisiveis" 
             :key="p"
             @click="paginaAtual = p"
             class="w-8 h-8 flex items-center justify-center text-sm rounded-md transition"
             :class="p === paginaAtual ? 'bg-blue-600 text-white font-medium shadow-sm' : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'"
           >
             {{ p }}
           </button>
        </div>
        <span class="sm:hidden px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md">
          {{ paginaAtual }} / {{ totalPaginas || 1 }}
        </span>

        <button 
          @click="proximaPagina"
          :disabled="paginaAtual >= totalPaginas"
          class="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-xs"
        >
          Próximo <i class="fas fa-chevron-right ml-1"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  dados: {
    type: Array,
    required: true
  },
  colunas: {
    type: Array,
    required: true
    // Formato: [{ chave: 'nome', titulo: 'Nome', sortable: true, alinhamento: 'left', format: (val) => val, classeHeader: '', classeCell: '' }]
  },
  titulo: {
    type: String,
    default: ''
  },
  itensPorPagina: {
    type: Number,
    default: 10
  },
  mostrarBusca: {
    type: Boolean,
    default: true
  },
  clickable: {
    type: Boolean,
    default: false
  },
  rowClass: {
    type: [String, Function],
    default: ''
  },
  exibirTudo: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['click-row'])

const termoBusca = ref('')
const paginaAtual = ref(1)
const ordenacao = ref({ coluna: null, direcao: 'asc' })

// Inicializar ordenação com a primeira coluna ordenável
if (props.colunas.length > 0) {
  const primeiraOrdenavel = props.colunas.find(c => c.sortable !== false)
  if (primeiraOrdenavel) {
    ordenacao.value.coluna = primeiraOrdenavel.chave
  }
}

// Watchers
watch(termoBusca, () => {
  paginaAtual.value = 1
})

watch(() => props.dados, () => {
  // Opcional: resetar página quando dados mudam drasticamente?
  // paginaAtual.value = 1
})

// Helper para acessar propriedades aninhadas (ex: 'usuario.nome')
const getValor = (obj, caminho) => {
  if (!caminho) return ''
  return caminho.split('.').reduce((o, k) => (o || {})[k], obj)
}

const formatarValor = (valor, coluna) => {
  if (coluna.format) {
    return coluna.format(valor)
  }
  return valor
}

const getRowClass = (item) => {
  if (typeof props.rowClass === 'function') {
    return props.rowClass(item)
  }
  return props.rowClass
}

const handleClick = (item) => {
  if (props.clickable) {
    emit('click-row', item)
  }
}

// Computed Properties
const dadosFiltrados = computed(() => {
  let resultado = [...props.dados]

  // 1. Filtragem
  if (termoBusca.value) {
    const termo = termoBusca.value.toLowerCase()
    resultado = resultado.filter(item => {
      return props.colunas.some(col => {
        const valor = getValor(item, col.chave)
        return String(valor).toLowerCase().includes(termo)
      })
    })
  }

  // 2. Ordenação
  if (ordenacao.value.coluna) {
    resultado.sort((a, b) => {
      const valorA = getValor(a, ordenacao.value.coluna)
      const valorB = getValor(b, ordenacao.value.coluna)
      
      // Tratar null/undefined
      if (valorA === valorB) return 0
      if (valorA === null || valorA === undefined) return 1
      if (valorB === null || valorB === undefined) return -1

      let comparacao = 0
      if (typeof valorA === 'string' && typeof valorB === 'string') {
        comparacao = valorA.localeCompare(valorB)
      } else {
        comparacao = valorA < valorB ? -1 : 1
      }

      return ordenacao.value.direcao === 'asc' ? comparacao : -comparacao
    })
  }

  return resultado
})

const totalPaginas = computed(() => Math.ceil(dadosFiltrados.value.length / props.itensPorPagina))

const inicioPagina = computed(() => (paginaAtual.value - 1) * props.itensPorPagina)
const fimPagina = computed(() => inicioPagina.value + props.itensPorPagina)

const dadosPaginados = computed(() => {
  return dadosFiltrados.value.slice(inicioPagina.value, fimPagina.value)
})

const paginasVisiveis = computed(() => {
  const delta = 2
  const range = []
  for (let i = Math.max(2, paginaAtual.value - delta); i <= Math.min(totalPaginas.value - 1, paginaAtual.value + delta); i++) {
    range.push(i)
  }

  if (paginaAtual.value - delta > 2) {
    range.unshift('...')
  }
  if (paginaAtual.value + delta < totalPaginas.value - 1) {
    range.push('...')
  }

  range.unshift(1)
  if (totalPaginas.value > 1) {
    range.push(totalPaginas.value)
  }

  return range.filter(p => typeof p === 'number') // Simplificação para este exemplo
})

const dadosRenderizados = computed(() => {
  if (props.exibirTudo) return dadosFiltrados.value
  return dadosPaginados.value
})

const paginaAnterior = () => {
  if (paginaAtual.value > 1) paginaAtual.value--
}

const proximaPagina = () => {
  if (paginaAtual.value < totalPaginas.value) paginaAtual.value++
}

const ordenar = (coluna) => {
  if (ordenacao.value.coluna === coluna) {
    ordenacao.value.direcao = ordenacao.value.direcao === 'asc' ? 'desc' : 'asc'
  } else {
    ordenacao.value.coluna = coluna
    ordenacao.value.direcao = 'asc'
  }
}
defineExpose({
  dadosFiltrados,
  ordenacao
})
</script>
