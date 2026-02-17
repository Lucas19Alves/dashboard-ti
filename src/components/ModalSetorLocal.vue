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

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-4">
        <!-- Lista de Itens com Filtros -->
        <TabelaInterativaAuditoria
          :dados="items"
          :colunas="colunas"
          :itensPorPagina="10"
          :mostrarBusca="true"
          :clickable="tipo === 'setor'"
          @click-row="handleRowClick"
        >
          <template #cell-percentualPendente="{ item }">
            <span class="font-bold" :class="getPercentual(item) <= 3 ? 'text-green-600' : 'text-orange-600'">
              {{ getPercentual(item).toFixed(2) }}%
            </span>
          </template>
          
          <template #cell-lidos="{ item }">
            <span class="text-green-600 font-semibold">{{ item.lidos }}</span>
          </template>
          
          <template #cell-pendentes="{ item }">
            <span class="text-orange-600 font-semibold">{{ item.pendentes }}</span>
          </template>
          
          <template #cell-comProblema="{ item }">
            <span class="text-red-600 font-semibold">{{ item.comProblema || 0 }}</span>
          </template>
          
          <template #cell-total="{ item }">
            <span class="text-blue-600 font-semibold">{{ item.total }}</span>
          </template>

          <template #cell-acoes="{ item }">
             <button
              @click.stop="abrirItensDoLocal(item)"
              class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-xs"
            >
              Ver Itens
            </button>
          </template>
        </TabelaInterativaAuditoria>
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
import { ref, computed } from 'vue'
import TabelaInterativaAuditoria from './TabelaInterativaAuditoria.vue'

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

const colunas = computed(() => {
  const cols = [
    { chave: 'nome', titulo: props.tipo === 'setor' ? 'Setor' : 'Local', sortable: true },
    { chave: 'lidos', titulo: 'Lidos', sortable: true, alinhamento: 'right' },
    { chave: 'pendentes', titulo: 'Pendentes', sortable: true, alinhamento: 'right' },
    { chave: 'comProblema', titulo: 'Problema', sortable: true, alinhamento: 'right' },
    { chave: 'total', titulo: 'Total', sortable: true, alinhamento: 'right' },
    { chave: 'percentualPendente', titulo: '% Pendente', sortable: true, alinhamento: 'right' }
  ]
  
  if (props.tipo === 'local') {
    cols.push({ chave: 'acoes', titulo: 'Ação', sortable: false, alinhamento: 'center' })
  }
  
  return cols
})

const getPercentual = (item) => {
  return item.percentualPendente || item.percentualLido || 0
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
