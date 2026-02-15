<template>
  <div 
    v-if="aberto"
    class="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-8"
    @click.stop="fechar"
  >
    <!-- Modal Content -->
    <div 
      class="bg-white rounded-lg shadow-2xl w-full max-w-5xl flex flex-col max-h-[85vh]"
      @click.stop
    >
      <!-- Header -->
      <div :class="['text-white p-6 flex items-center justify-between shrink-0 rounded-t-lg', corFundo]">
        <div>
          <h2 class="text-2xl font-bold">{{ titulo }}</h2>
          <p class="text-opacity-90 mt-1">{{ subtitulo }}</p>
        </div>
        <button
          @click="fechar"
          class="text-white hover:opacity-80 transition"
        >
          <i class="fas fa-times text-2xl"></i>
        </button>
      </div>

      <!-- Content -->
      <div class="p-6 space-y-4 overflow-y-auto flex-1">
        <!-- Valor Principal -->
        <div class="text-center py-6 border-b">
          <p class="text-gray-600 text-sm font-medium mb-2">Quantidade</p>
          <p :class="['text-5xl font-bold', classeValor]">{{ valor }}</p>
        </div>

        <!-- Detalhes específicos por tipo -->
        <div v-if="tipo === 'total'" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div class="bg-green-50 p-4 rounded-lg">
              <p class="text-gray-600 text-sm">Lidos Corretamente</p>
              <p class="text-2xl font-bold text-green-600">{{ dados.itensLidosCorretamente }}</p>
            </div>
            <div class="bg-orange-50 p-4 rounded-lg">
              <p class="text-gray-600 text-sm">Pendentes</p>
              <p class="text-2xl font-bold text-orange-600">{{ dados.itensPendentes }}</p>
            </div>
            <div class="bg-red-50 p-4 rounded-lg">
              <p class="text-gray-600 text-sm">Com Problema</p>
              <p class="text-2xl font-bold text-red-600">{{ dados.itensLidosComProblema }}</p>
            </div>
            <div class="bg-gray-50 p-4 rounded-lg">
              <p class="text-gray-600 text-sm">Ignorados</p>
              <p class="text-2xl font-bold text-gray-600">{{ dados.itensIgnorados }}</p>
            </div>
          </div>
          <div class="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <p class="text-gray-700 text-sm"><strong>Taxa de Conclusão:</strong> {{ Math.round(((dados.itensLidosCorretamente + dados.itensLidosComProblema) / (dados.totalItens - dados.itensIgnorados) * 100) || 0) }}%</p>
          </div>
        </div>

        <div v-if="tipo === 'lidos'" class="space-y-4">
          <div class="bg-green-50 p-4 rounded-lg">
            <p class="text-gray-600 text-sm">Status</p>
            <p class="text-lg font-bold text-green-600 mt-2">✅ Completamente Auditados</p>
            <p class="text-xs text-gray-600 mt-1">Com presença confirmada e estoque disponível</p>
          </div>
          <div class="bg-gray-50 p-4 rounded-lg">
            <div class="flex justify-between items-center mb-2">
              <p class="text-gray-600 text-sm font-medium">Percentual do Total</p>
              <span class="text-xs font-semibold text-gray-600">{{ dados.itensLidosCorretamente }}/{{ dados.totalItens }} itens</span>
            </div>
            <div class="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
              <div 
                :style="{ width: Math.round((dados.itensLidosCorretamente / (dados.totalItens || 1)) * 100) + '%' }"
                class="h-full bg-linear-to-r from-green-500 to-green-600"
              />
            </div>
          </div>
        </div>

        <div v-if="tipo === 'pendentes'" class="space-y-4">
          <div class="bg-orange-50 p-4 rounded-lg">
            <p class="text-gray-600 text-sm">Status</p>
            <p class="text-lg font-bold text-orange-600 mt-2">⏳ Aguardando Leitura</p>
            <p class="text-xs text-gray-600 mt-1">Itens com estoque mas ainda sem presença confirmada</p>
          </div>
          <div class="bg-gray-50 p-4 rounded-lg">
            <div class="flex justify-between items-center mb-2">
              <p class="text-gray-600 text-sm font-medium">Percentual Pendente</p>
              <span class="text-xs font-semibold text-gray-600">{{ dados.itensPendentes }}/{{ dados.totalItens }} itens</span>
            </div>
            <div class="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
              <div 
                :style="{ width: Math.round((dados.itensPendentes / (dados.totalItens || 1)) * 100) + '%' }"
                class="h-full bg-linear-to-r from-orange-500 to-orange-600"
              />
            </div>
          </div>
        </div>

        <div v-if="tipo === 'problema'" class="space-y-4">
          <div class="bg-red-50 p-4 rounded-lg border border-red-200">
            <p class="text-gray-600 text-sm"><strong>⚠️ Itens que Requerem Atenção</strong></p>
            <div class="mt-3 space-y-2">
              <div v-if="dados.itensComEstoqueZero > 0" class="text-sm">
                <p class="text-red-700">• <strong>Estoque Zero:</strong> {{ dados.itensComEstoqueZero }} itens lidos mas sem estoque no sistema</p>
              </div>
              <div v-if="dados.itensLidoNaoPertence > 0" class="text-sm">
                <p class="text-red-700">• <strong>Local Errado:</strong> {{ dados.itensLidoNaoPertence }} itens lidos no local incorreto</p>
              </div>
            </div>
          </div>
          <div class="bg-gray-50 p-4 rounded-lg">
            <div class="flex justify-between items-center mb-2">
              <p class="text-gray-600 text-sm font-medium">Percentual de Problemas</p>
              <span class="text-xs font-semibold text-gray-600">{{ dados.itensLidosComProblema }}/{{ dados.totalItens }} itens</span>
            </div>
            <div class="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
              <div 
                :style="{ width: Math.round((dados.itensLidosComProblema / (dados.totalItens || 1)) * 100) + '%' }"
                class="h-full bg-linear-to-r from-red-500 to-red-600"
              />
            </div>
          </div>
        </div>

        <div v-if="lista.length > 0 || filtro" class="space-y-3 pt-4 border-t">
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <p class="font-bold text-gray-800">
              <i class="fas fa-list mr-2"></i>Lista de Itens
              <span class="text-sm font-normal text-gray-500 ml-2">({{ lista.length }} encontrados)</span>
            </p>
            <input 
              v-model="filtro"
              type="text"
              placeholder="🔍 Buscar código, produto..."
              class="w-full sm:w-auto px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div class="max-h-80 overflow-auto border rounded bg-white shadow-inner">
            <table class="w-full text-sm">
              <thead class="bg-gray-100 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th class="px-3 py-2 text-left font-semibold text-gray-700">Código</th>
                  <th class="px-3 py-2 text-left font-semibold text-gray-700">Produto</th>
                  <th class="px-3 py-2 text-left font-semibold text-gray-700">Local</th>
                  <th class="px-3 py-2 text-right font-semibold text-gray-700">Estoque</th>
                  <th v-if="tipo === 'problema'" class="px-3 py-2 text-center font-semibold text-gray-700">Motivo</th>
                </tr>
              </thead>
              <tbody class="divide-y">
                <tr v-for="(i, idx) in lista" :key="idx" class="hover:bg-blue-50 transition">
                  <td class="px-3 py-2 font-bold text-gray-900">{{ i['Código'] }}</td>
                  <td class="px-3 py-2 text-gray-800">{{ i['Produto'] }}</td>
                  <td class="px-3 py-2 text-gray-700 text-xs">{{ i['Local'] || '-' }}</td>
                  <td class="px-3 py-2 text-right font-mono text-gray-800">{{ i._estoque || 0 }}</td>
                  <td v-if="tipo === 'problema'" class="px-3 py-2 text-center">
                    <span 
                      class="px-2 py-0.5 rounded text-xs font-bold"
                      :class="i._problema === 'Estoque Zero' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'"
                    >
                      {{ i._problema }}
                    </span>
                  </td>
                </tr>
                <tr v-if="lista.length === 0">
                  <td :colspan="tipo === 'problema' ? 5 : 4" class="px-3 py-8 text-center text-gray-500">
                    Nenhum item encontrado com o filtro atual.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="bg-gray-50 px-6 py-4 flex justify-end gap-2 shrink-0 rounded-b-lg border-t">
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
import { computed, ref } from 'vue'

const props = defineProps({
  aberto: Boolean,
  tipo: String,
  dados: Object,
  dadosCompletos: Array
})

const emit = defineEmits(['fechar'])
const filtro = ref('')

const titulo = computed(() => {
  const titulos = {
    'total': 'Total de Itens da Auditoria',
    'lidos': 'Itens Lidos Corretamente',
    'pendentes': 'Itens Pendentes - Não Lidos',
    'problema': 'Itens Lidos Com Problema'
  }
  return titulos[props.tipo] || 'Métrica'
})

const subtitulo = computed(() => {
  const subtitulos = {
    'total': 'Total de itens auditáveis (excluindo: sem leitura e sem estoque)',
    'lidos': 'Itens com presença confirmada e estoque disponível',
    'pendentes': 'Itens sem presença confirmada mas com estoque',
    'problema': 'Itens com presença mas estoque zerado ou lido no local errado'
  }
  return subtitulos[props.tipo] || ''
})

const valor = computed(() => {
  if (!props.dados) return '-'
  const valores = {
    'total': props.dados.totalItens || 0,
    'lidos': props.dados.itensLidosCorretamente || 0,
    'pendentes': props.dados.itensPendentes || 0,
    'problema': props.dados.itensLidosComProblema || 0
  }
  return valores[props.tipo] || 0
})

const corFundo = computed(() => {
  const cores = {
    'total': 'bg-gradient-to-r from-blue-600 to-blue-800',
    'lidos': 'bg-gradient-to-r from-green-600 to-green-800',
    'pendentes': 'bg-gradient-to-r from-orange-600 to-orange-800',
    'problema': 'bg-gradient-to-r from-red-600 to-red-800'
  }
  return cores[props.tipo] || 'bg-gradient-to-r from-gray-600 to-gray-800'
})

const classeValor = computed(() => {
  const classes = {
    'total': 'text-blue-600',
    'lidos': 'text-green-600',
    'pendentes': 'text-orange-600',
    'problema': 'text-red-600'
  }
  return classes[props.tipo] || 'text-gray-600'
})

const fechar = () => {
  filtro.value = ''
  emit('fechar')
}

const isLidoNaoPertence = (item) => {
  const valor = item['Lido não pertence']
  if (valor === undefined || valor === null) return false
  if (valor === true) return true
  if (typeof valor === 'string') return valor.toLowerCase().includes('sim')
  return false
}

const temPresencaEfetiva = (item) => item._temPresenca || isLidoNaoPertence(item)

const lista = computed(() => {
  const items = props.dadosCompletos || []
  if (!props.dados || items.length === 0) return []
  
  let resultado = []
  
  if (props.tipo === 'pendentes') {
    resultado = items.filter(i => !temPresencaEfetiva(i) && (i._estoque || 0) > 0)
  } else if (props.tipo === 'lidos') {
    resultado = items.filter(i => temPresencaEfetiva(i) && (i._estoque || 0) > 0)
  } else if (props.tipo === 'problema') {
    const codsZ = new Set((props.dados.itensComEstoqueZeroDetalhes || []).map(d => d.codigo))
    const codsN = new Set((props.dados.itensLidoNaoPertenceDetalhes || []).map(d => d.codigo))
    resultado = items.filter(i => codsZ.has(i['Código']) || codsN.has(i['Código']))
      .map(i => ({
        ...i,
        _problema: codsZ.has(i['Código']) ? 'Estoque Zero' : 'Local Errado'
      }))
  }

  // Filtrar
  if (filtro.value) {
    const termo = filtro.value.toLowerCase()
    resultado = resultado.filter(i => 
      String(i['Código'] || '').toLowerCase().includes(termo) ||
      String(i['Produto'] || '').toLowerCase().includes(termo) ||
      String(i['Local'] || '').toLowerCase().includes(termo)
    )
  }

  // Ordenar (Problema -> Prioridade, Outros -> Estoque desc)
  return resultado.sort((a, b) => (b._estoque || 0) - (a._estoque || 0))
})
</script>
