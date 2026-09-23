<template>
  <div 
    v-if="aberto"
    class="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-8"
    @click.stop="fechar"
  >
    <!-- Modal Content -->
    <div 
      class="bg-white rounded-lg shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col"
      @click.stop
    >
      <!-- Header -->
      <div class="bg-blue-700 text-white p-4 flex items-center justify-between">
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

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-4">
        <!-- Search -->
        <div class="relative mb-3">
          <i class="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[11px]"></i>
          <input v-model="buscaModal" type="text" placeholder="Buscar..." class="pl-7 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64" @input="paginaModal = 1" />
        </div>

        <div v-if="listaOrdenada.length === 0" class="flex flex-col items-center justify-center py-8 text-slate-400">
          <i class="fas fa-inbox text-3xl mb-2"></i>
          <p class="text-xs">Nenhum item encontrado.</p>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="border-b-2 border-slate-100">
                <th class="px-3 py-2.5 text-left font-semibold text-slate-600 cursor-pointer select-none hover:text-blue-600 transition-colors" @click="atualizarOrdenacaoModal(ordenacaoModal, 'nome'); paginaModal = 1">
                  <span class="inline-flex items-center gap-1">{{ tipo === 'setor' ? 'Setor' : 'Local' }} <i class="fas text-[10px]" :class="ordenacaoModal.coluna === 'nome' ? (ordenacaoModal.direcao === 'asc' ? 'fa-sort-up text-blue-600' : 'fa-sort-down text-blue-600') : 'fa-sort text-slate-300'" /></span>
                </th>
                <th class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-blue-600 transition-colors" @click="atualizarOrdenacaoModal(ordenacaoModal, 'lidos'); paginaModal = 1">
                  <span class="inline-flex items-center gap-1 justify-end">Lidos <i class="fas text-[10px]" :class="ordenacaoModal.coluna === 'lidos' ? (ordenacaoModal.direcao === 'asc' ? 'fa-sort-up text-blue-600' : 'fa-sort-down text-blue-600') : 'fa-sort text-slate-300'" /></span>
                </th>
                <th class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-blue-600 transition-colors" @click="atualizarOrdenacaoModal(ordenacaoModal, 'pendentes'); paginaModal = 1">
                  <span class="inline-flex items-center gap-1 justify-end">Pendentes <i class="fas text-[10px]" :class="ordenacaoModal.coluna === 'pendentes' ? (ordenacaoModal.direcao === 'asc' ? 'fa-sort-up text-blue-600' : 'fa-sort-down text-blue-600') : 'fa-sort text-slate-300'" /></span>
                </th>
                <th class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-blue-600 transition-colors" @click="atualizarOrdenacaoModal(ordenacaoModal, 'comProblema'); paginaModal = 1">
                  <span class="inline-flex items-center gap-1 justify-end">Problema <i class="fas text-[10px]" :class="ordenacaoModal.coluna === 'comProblema' ? (ordenacaoModal.direcao === 'asc' ? 'fa-sort-up text-blue-600' : 'fa-sort-down text-blue-600') : 'fa-sort text-slate-300'" /></span>
                </th>
                <th class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-blue-600 transition-colors" @click="atualizarOrdenacaoModal(ordenacaoModal, 'total'); paginaModal = 1">
                  <span class="inline-flex items-center gap-1 justify-end">Total <i class="fas text-[10px]" :class="ordenacaoModal.coluna === 'total' ? (ordenacaoModal.direcao === 'asc' ? 'fa-sort-up text-blue-600' : 'fa-sort-down text-blue-600') : 'fa-sort text-slate-300'" /></span>
                </th>
                <th class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-blue-600 transition-colors" @click="atualizarOrdenacaoModal(ordenacaoModal, 'percentualPendente'); paginaModal = 1">
                  <span class="inline-flex items-center gap-1 justify-end">% Pendente <i class="fas text-[10px]" :class="ordenacaoModal.coluna === 'percentualPendente' ? (ordenacaoModal.direcao === 'asc' ? 'fa-sort-up text-blue-600' : 'fa-sort-down text-blue-600') : 'fa-sort text-slate-300'" /></span>
                </th>
                <th v-if="tipo === 'local'" class="px-3 py-2.5 text-center font-semibold text-slate-600">Ação</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="(item, idx) in listaPaginada" :key="idx"
                class="transition-colors"
                :class="[idx % 2 === 0 ? 'bg-white hover:bg-blue-50/40' : 'bg-slate-50/60 hover:bg-blue-50/40', tipo === 'setor' ? 'cursor-pointer' : '']"
                @click="handleRowClick(item)"
              >
                <td class="px-3 py-2.5 text-slate-700 font-semibold">{{ item.nome }}</td>
                <td class="px-3 py-2.5 text-right text-green-600 font-semibold">{{ item.lidos }}</td>
                <td class="px-3 py-2.5 text-right text-orange-600 font-semibold">{{ item.pendentes }}</td>
                <td class="px-3 py-2.5 text-right text-red-600 font-semibold">{{ item.comProblema || 0 }}</td>
                <td class="px-3 py-2.5 text-right text-blue-600 font-semibold">{{ item.total }}</td>
                <td class="px-3 py-2.5 text-right">
                  <span class="font-bold" :class="getPercentual(item) <= 3 ? 'text-green-600' : 'text-orange-600'">{{ getPercentual(item).toFixed(2) }}%</span>
                </td>
                <td v-if="tipo === 'local'" class="px-3 py-2.5 text-center">
                  <button @click.stop="abrirItensDoLocal(item)" class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-xs">Ver Itens</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div v-if="totalPaginasModal > 1" class="flex items-center justify-between pt-2 border-t border-slate-100 mt-3">
          <p class="text-[11px] text-slate-500">Mostrando {{ ((paginaModal - 1) * itensPorPaginaModal) + 1 }} a {{ Math.min(paginaModal * itensPorPaginaModal, listaOrdenada.length) }} de {{ listaOrdenada.length }}</p>
          <div class="flex items-center gap-1">
            <button @click="paginaModal = 1" :disabled="paginaModal === 1" class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"><i class="fas fa-angle-double-left"></i></button>
            <button @click="paginaModal--" :disabled="paginaModal === 1" class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"><i class="fas fa-angle-left"></i></button>
            <template v-for="p in paginasVisiveis" :key="p">
              <button v-if="typeof p === 'number'" @click="paginaModal = p" class="min-w-[28px] px-2 py-1 rounded text-[11px] font-semibold transition" :class="p === paginaModal ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-slate-100 text-slate-600'">{{ p }}</button>
              <span v-else class="text-slate-400 text-[11px] px-1">...</span>
            </template>
            <button @click="paginaModal++" :disabled="paginaModal === totalPaginasModal" class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"><i class="fas fa-angle-right"></i></button>
            <button @click="paginaModal = totalPaginasModal" :disabled="paginaModal === totalPaginasModal" class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"><i class="fas fa-angle-double-right"></i></button>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="bg-gray-50 px-4 py-2 flex justify-end items-center">
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
import { ref, computed, watch } from 'vue'

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

const paginaModal = ref(1)
const itensPorPaginaModal = 10
const buscaModal = ref('')
const ordenacaoModal = ref({ coluna: 'pendentes', direcao: 'desc' })

const atualizarOrdenacaoModal = (obj, coluna) => {
  if (obj.coluna === coluna) {
    obj.direcao = obj.direcao === 'asc' ? 'desc' : 'asc'
  } else {
    obj.coluna = coluna
    obj.direcao = 'asc'
  }
}

watch(() => props.items, () => { paginaModal.value = 1; buscaModal.value = '' })

const listaFiltrada = computed(() => {
  if (!props.items) return []
  if (!buscaModal.value) return props.items
  const t = buscaModal.value.toLowerCase()
  return props.items.filter(item => String(item.nome || '').toLowerCase().includes(t))
})

const listaOrdenada = computed(() => {
  const items = [...listaFiltrada.value]
  const { coluna, direcao } = ordenacaoModal.value
  const mult = direcao === 'asc' ? 1 : -1
  return items.sort((a, b) => {
    const va = a[coluna] ?? ''
    const vb = b[coluna] ?? ''
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * mult
    return String(va).localeCompare(String(vb), 'pt-BR', { numeric: true }) * mult
  })
})

const totalPaginasModal = computed(() => Math.max(1, Math.ceil(listaOrdenada.value.length / itensPorPaginaModal)))

const listaPaginada = computed(() => {
  const pagina = Math.min(paginaModal.value, totalPaginasModal.value)
  const inicio = (pagina - 1) * itensPorPaginaModal
  return listaOrdenada.value.slice(inicio, inicio + itensPorPaginaModal)
})

const paginasVisiveis = computed(() => {
  const total = totalPaginasModal.value
  const atual = paginaModal.value
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = []
  pages.push(1)
  if (atual > 3) pages.push('...')
  for (let i = Math.max(2, atual - 1); i <= Math.min(total - 1, atual + 1); i++) pages.push(i)
  if (atual < total - 2) pages.push('...')
  pages.push(total)
  return pages
})

const getPercentual = (item) => {
  if (item == null) return 0
  if (item.percentualPendente != null) return Number(item.percentualPendente) || 0
  if (item.percentualLido != null) return Number(item.percentualLido) || 0
  if (item.percentualConclusao != null) return Number(item.percentualConclusao) || 0
  return 0
}

const handleRowClick = (item) => {
  if (props.tipo === 'setor') {
    abrirLocaisDoSetor(item)
  }
}

// Helper para normalizar strings para comparação
const normalize = (str) => {
  return str ? str.toString().toLowerCase().trim() : ''
}

// Guarda o setor atualmente em foco (quando abrindo locais de um setor)
const setorAtual = ref(null)

const abrirLocaisDoSetor = (setor) => {
  if (!props.analise || !props.analise.porLocal) return
  
  // Buscar locais que pertencem a este setor
  const locaisDoSetor = []
  const setorNome = setor.nome
  const setorNorm = normalize(setorNome)
  setorAtual.value = setorNome
  
  if (props.dadosCompletos) {
    const locaisEncontrados = {}
    
    props.dadosCompletos.forEach(item => {
      const itemSetorRaw = item['Classe de Produto Raiz'] || item['Setor'] || 'Não especificado'
      const itemSetorNorm = normalize(itemSetorRaw)
      if (itemSetorNorm === setorNorm) {
        const localNome = (item['Local'] || 'Não especificado').trim()
        if (!locaisEncontrados[localNome]) {
          locaisEncontrados[localNome] = {
            nome: localNome,
            lidos: 0,
            pendentes: 0,
            comProblema: 0,
            total: 0
          }
        }
        
        const temPresenca = !!(item._temPresenca)
        const estoque = Number(item._estoque || 0)
        
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
  let itensDoLocal = Array.isArray(local.itens) ? local.itens : []
  
  if ((!itensDoLocal || itensDoLocal.length === 0) && props.dadosCompletos) {
    itensDoLocal = props.dadosCompletos.filter(item => {
      const itemLocal = (item['Local'] || 'Não especificado').toString().trim()
      if (itemLocal !== local.nome) return false
      // Se tivermos um setor atual, filtra também pelo setor para evitar ambiguidade de locais com mesmo nome em setores diferentes
      if (setorAtual.value) {
        const itemSetorRaw = item['Classe de Produto Raiz'] || item['Setor'] || 'Não especificado'
        return normalize(itemSetorRaw) === normalize(setorAtual.value)
      }
      return true
    })
  }
  
  emit('abrirItens', {
    local: local.nome,
    itens: itensDoLocal
  })
}

const fechar = () => {
  emit('fechar')
}
</script>
