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
              <p class="text-2xl font-bold text-orange-600">{{ pendentesExibidos }}</p>
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
            <p class="text-gray-700 text-sm"><strong>Taxa de Conclusão:</strong> {{ Math.round(((( (dados.totalLidos != null ? dados.totalLidos : 0) || ((dados.itensAtualizados || 0) + (dados.itensDesatualizados || 0) + (dados.itensLidoNaoPertence || 0) + (dados.itensComEstoqueZero || 0))) / (dados.totalItens || 1)) * 100) || 0) }}%</p>
          </div>
        </div>

        <div v-if="tipo === 'lidos'" class="space-y-4">
          <div class="bg-green-50 p-4 rounded-lg">
            <p class="text-gray-600 text-sm">Status</p>
            <p class="text-lg font-bold text-green-600 mt-2">✅ Itens Lidos</p>
            <p class="text-xs text-gray-600 mt-1">Total de itens com presença confirmada</p>
          </div>
          
          <div class="grid grid-cols-2 gap-4">
            <div class="bg-white border border-gray-200 p-3 rounded-lg">
              <p class="text-xs text-gray-500">Lidos Corretamente</p>
              <p class="text-lg font-bold text-green-600">{{ dados.itensLidosCorretamente }}</p>
            </div>
            <div class="bg-white border border-gray-200 p-3 rounded-lg">
              <p class="text-xs text-gray-500">Com Problema</p>
              <p class="text-lg font-bold text-red-600">{{ dados.itensLidosComProblema }}</p>
            </div>
          </div>

          <div class="bg-gray-50 p-4 rounded-lg">
            <div class="flex justify-between items-center mb-2">
              <p class="text-gray-600 text-sm font-medium">Percentual do Total</p>
              <span class="text-xs font-semibold text-gray-600">{{ dados.totalLidos }}/{{ dados.totalItens }} itens</span>
            </div>
            <div class="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
              <div 
                :style="{ width: Math.round((dados.totalLidos / (dados.totalItens || 1)) * 100) + '%' }"
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
              <span class="text-xs font-semibold text-gray-600">{{ pendentesExibidos }}/{{ dados.totalItens }} itens</span>
            </div>
            <div class="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
              <div 
                :style="{ width: Math.round((pendentesExibidos / (dados.totalItens || 1)) * 100) + '%' }"
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

        <div v-if="lista.length > 0" class="space-y-3 pt-4 border-t">
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
            <div class="flex flex-wrap gap-2 w-full sm:w-auto justify-start sm:justify-end">
              <select
                v-if="usuariosOpcoes.length > 0"
                v-model="filtroUsuario"
                class="border border-gray-300 rounded-lg px-2 py-1 text-xs text-gray-700 bg-white"
              >
                <option value="">Todos usuarios</option>
                <option v-for="u in usuariosOpcoes" :key="u" :value="u">{{ u }}</option>
              </select>
              <select
                v-if="setoresOpcoes.length > 0"
                v-model="filtroSetor"
                class="border border-gray-300 rounded-lg px-2 py-1 text-xs text-gray-700 bg-white"
              >
                <option value="">Todos setores</option>
                <option v-for="s in setoresOpcoes" :key="s" :value="s">{{ s }}</option>
              </select>
              <select
                v-if="locaisOpcoes.length > 0"
                v-model="filtroLocal"
                class="border border-gray-300 rounded-lg px-2 py-1 text-xs text-gray-700 bg-white"
              >
                <option value="">Todos locais</option>
                <option v-for="l in locaisOpcoes" :key="l" :value="l">{{ l }}</option>
              </select>
              <select
                v-if="tipo === 'problema'"
                v-model="filtroProblema"
                class="border border-gray-300 rounded-lg px-2 py-1 text-xs text-gray-700 bg-white"
              >
                <option value="">Todos problemas</option>
                <option v-for="p in problemasOpcoes" :key="p" :value="p">{{ p }}</option>
              </select>
              <button
                type="button"
                @click="imprimirLista"
                class="inline-flex items-center px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition shadow"
              >
                <i class="fas fa-print mr-1"></i>
                <span class="hidden sm:inline">Imprimir relatorio</span>
                <span class="sm:hidden">Imprimir</span>
              </button>
            </div>
          </div>

          <!-- Search bar -->
          <div class="relative mb-3">
            <i class="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[11px]"></i>
            <input v-model="buscaLista" type="text" placeholder="Buscar por código, produto ou local..." class="pl-7 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64" @input="paginaLista = 1" />
          </div>

          <!-- Empty state -->
          <div v-if="listaOrdenada.length === 0" class="flex flex-col items-center justify-center py-8 text-slate-400">
            <i class="fas fa-check-circle text-3xl mb-2"></i>
            <p class="text-xs">Nenhum item encontrado.</p>
          </div>

          <!-- Table -->
          <div v-else class="overflow-x-auto">
            <table class="w-full text-xs">
              <thead>
                <tr class="border-b-2 border-slate-100">
                  <th class="px-3 py-2.5 text-left font-semibold text-slate-600 cursor-pointer select-none hover:text-blue-600 transition-colors" @click="atualizarOrdenacao(ordenacaoLista, 'Código'); paginaLista = 1">
                    <span class="inline-flex items-center gap-1">Código <i class="fas text-[10px]" :class="ordenacaoLista.coluna === 'Código' ? (ordenacaoLista.direcao === 'asc' ? 'fa-sort-up text-blue-600' : 'fa-sort-down text-blue-600') : 'fa-sort text-slate-300'" /></span>
                  </th>
                  <th class="px-3 py-2.5 text-left font-semibold text-slate-600 cursor-pointer select-none hover:text-blue-600 transition-colors" @click="atualizarOrdenacao(ordenacaoLista, 'Produto'); paginaLista = 1">
                    <span class="inline-flex items-center gap-1">Produto <i class="fas text-[10px]" :class="ordenacaoLista.coluna === 'Produto' ? (ordenacaoLista.direcao === 'asc' ? 'fa-sort-up text-blue-600' : 'fa-sort-down text-blue-600') : 'fa-sort text-slate-300'" /></span>
                  </th>
                  <th class="px-3 py-2.5 text-left font-semibold text-slate-600 cursor-pointer select-none hover:text-blue-600 transition-colors" @click="atualizarOrdenacao(ordenacaoLista, 'Local'); paginaLista = 1">
                    <span class="inline-flex items-center gap-1">Local <i class="fas text-[10px]" :class="ordenacaoLista.coluna === 'Local' ? (ordenacaoLista.direcao === 'asc' ? 'fa-sort-up text-blue-600' : 'fa-sort-down text-blue-600') : 'fa-sort text-slate-300'" /></span>
                  </th>
                  <th class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-blue-600 transition-colors" @click="atualizarOrdenacao(ordenacaoLista, '_estoque'); paginaLista = 1">
                    <span class="inline-flex items-center gap-1 justify-end">Estoque <i class="fas text-[10px]" :class="ordenacaoLista.coluna === '_estoque' ? (ordenacaoLista.direcao === 'asc' ? 'fa-sort-up text-blue-600' : 'fa-sort-down text-blue-600') : 'fa-sort text-slate-300'" /></span>
                  </th>
                  <th v-if="tipo === 'problema'" class="px-3 py-2.5 text-center font-semibold text-slate-600 cursor-pointer select-none hover:text-blue-600 transition-colors" @click="atualizarOrdenacao(ordenacaoLista, 'Motivo'); paginaLista = 1">
                    <span class="inline-flex items-center gap-1">Motivo <i class="fas text-[10px]" :class="ordenacaoLista.coluna === 'Motivo' ? (ordenacaoLista.direcao === 'asc' ? 'fa-sort-up text-blue-600' : 'fa-sort-down text-blue-600') : 'fa-sort text-slate-300'" /></span>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-50">
                <tr v-for="(item, idx) in listaPaginada" :key="idx" class="transition-colors" :class="idx % 2 === 0 ? 'bg-white hover:bg-blue-50/40' : 'bg-slate-50/60 hover:bg-blue-50/40'">
                  <td class="px-3 py-2.5 text-slate-700 font-semibold">{{ item['Código'] }}</td>
                  <td class="px-3 py-2.5 text-slate-700">{{ item['Produto'] }}</td>
                  <td class="px-3 py-2.5 text-slate-600">{{ item['Local'] }}</td>
                  <td class="px-3 py-2.5 text-right font-mono text-slate-700">{{ item._estoque || 0 }}</td>
                  <td v-if="tipo === 'problema'" class="px-3 py-2.5 text-center">
                    <span class="px-2 py-0.5 rounded text-xs font-bold" :class="item._problema === 'Estoque Zero' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'">{{ item._problema }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          <div v-if="totalPaginasLista > 1" class="flex items-center justify-between pt-2 border-t border-slate-100 mt-3">
            <p class="text-[11px] text-slate-500">Mostrando {{ ((paginaLista - 1) * itensPorPaginaLista) + 1 }} a {{ Math.min(paginaLista * itensPorPaginaLista, listaOrdenada.length) }} de {{ listaOrdenada.length }}</p>
            <div class="flex items-center gap-1">
              <button @click="paginaLista = 1" :disabled="paginaLista === 1" class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"><i class="fas fa-angle-double-left"></i></button>
              <button @click="paginaLista--" :disabled="paginaLista === 1" class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"><i class="fas fa-angle-left"></i></button>
              <template v-for="p in paginasVisiveis" :key="p">
                <button v-if="typeof p === 'number'" @click="paginaLista = p" class="min-w-[28px] px-2 py-1 rounded text-[11px] font-semibold transition" :class="p === paginaLista ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-slate-100 text-slate-600'">{{ p }}</button>
                <span v-else class="text-slate-400 text-[11px] px-1">...</span>
              </template>
              <button @click="paginaLista++" :disabled="paginaLista === totalPaginasLista" class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"><i class="fas fa-angle-right"></i></button>
              <button @click="paginaLista = totalPaginasLista" :disabled="paginaLista === totalPaginasLista" class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"><i class="fas fa-angle-double-right"></i></button>
            </div>
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
import { computed, ref, watch } from 'vue'
import { printTableInNewWindow } from '../utils/print'

const props = defineProps({
  aberto: Boolean,
  tipo: String,
  dados: Object,
  dadosCompletos: Array,
  tipoAuditoria: String
})

const emit = defineEmits(['fechar'])

const filtroUsuario = ref('')
const filtroSetor = ref('')
const filtroLocal = ref('')
const filtroProblema = ref('')
const paginaLista = ref(1)
const itensPorPaginaLista = 15
const buscaLista = ref('')
const ordenacaoLista = ref({ coluna: '_estoque', direcao: 'desc' })

const titulo = computed(() => {
  const titulos = {
    'total': 'Total de Itens da Auditoria',
    'lidos': 'Total de Itens Lidos',
    'pendentes': 'Itens Pendentes - Não Lidos',
    'problema': 'Itens Lidos Com Problema',
    'desatualizado': 'Itens Lidos Desatualizados'
  }
  return titulos[props.tipo] || 'Métrica'
})

const subtitulo = computed(() => {
  const subtitulos = {
    'total': 'Total de itens auditáveis (excluindo: sem leitura e sem estoque)',
    'lidos': 'Todos os itens com presença confirmada (incluindo com problemas)',
    'pendentes': 'Itens sem presença confirmada mas com estoque',
    'problema': 'Itens com presença mas estoque zerado ou lido no local errado',
    'desatualizado': 'Itens lidos com informação desatualizada em relação ao sistema'
  }
  return subtitulos[props.tipo] || ''
})

const valor = computed(() => {
  if (!props.dados) return '-'
  const valores = {
    'total': props.dados.totalItens || 0,
    'lidos': props.dados.totalLidos || 0,
    'pendentes': props.dados.itensPendentes || 0,
    'problema': props.dados.itensLidosComProblema || 0,
    'desatualizado': props.dados.itensDesatualizados || 0
  }
  return valores[props.tipo] || 0
})

const pendentesExibidos = computed(() => {
  if (!props.dados) return 0
  return props.dados.itensPendentes || 0
})

const corFundo = computed(() => {
  const cores = {
    'total': 'bg-gradient-to-r from-blue-600 to-blue-800',
    'lidos': 'bg-gradient-to-r from-green-600 to-green-800',
    'pendentes': 'bg-gradient-to-r from-orange-600 to-orange-800',
    'problema': 'bg-gradient-to-r from-red-600 to-red-800',
    'desatualizado': 'bg-gradient-to-r from-yellow-500 to-yellow-700'
  }
  return cores[props.tipo] || 'bg-gradient-to-r from-gray-600 to-gray-800'
})

const classeValor = computed(() => {
  const classes = {
    'total': 'text-blue-600',
    'lidos': 'text-green-600',
    'pendentes': 'text-orange-600',
    'problema': 'text-red-600',
    'desatualizado': 'text-yellow-600'
  }
  return classes[props.tipo] || 'text-gray-600'
})

const fechar = () => {
  emit('fechar')
}

const normalizar = (valor) => {
  if (valor == null) return ''
  try {
    return String(valor).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
  } catch {
    return String(valor).toLowerCase()
  }
}

const problemasOpcoes = computed(() => ['Estoque Zero', 'Local Errado'])

const isLidoNaoPertence = (item) => {
  const valor = item['Lido não pertence']
  if (valor === undefined || valor === null) return false
  if (valor === true) return true
  if (typeof valor === 'string') return valor.toLowerCase().includes('sim')
  return false
}

const temPresencaEfetiva = (item) => item._temPresenca || isLidoNaoPertence(item)

const colunas = computed(() => {
  const cols = [
    { chave: 'Código', titulo: 'Código', sortable: true },
    { chave: 'Produto', titulo: 'Produto', sortable: true },
    { chave: 'Local', titulo: 'Local', sortable: true },
    { chave: '_estoque', titulo: 'Estoque', sortable: true, alinhamento: 'right' }
  ]
  
  if (props.tipo === 'problema') {
    cols.push({ chave: 'Motivo', titulo: 'Motivo', sortable: true, alinhamento: 'center' })
  }
  
  return cols
})

const baseLista = computed(() => {
  const items = props.dadosCompletos || []
  if (!props.dados || items.length === 0) return []

  const normCodigo = (v) => String(v ?? '').trim()
  
  if (props.tipo === 'pendentes') {
    return items.filter(i => !temPresencaEfetiva(i) && (i._estoque || 0) > 0)
  }
  if (props.tipo === 'lidos') {
    return items.filter(i => temPresencaEfetiva(i))
  }
  if (props.tipo === 'problema') {
    // Normaliza código para evitar mismatch string vs number
    const codsZ = new Set((props.dados.itensComEstoqueZeroDetalhes || []).map(d => normCodigo(d.codigo)))
    const codsN = new Set((props.dados.itensLidoNaoPertenceDetalhes || []).map(d => normCodigo(d.codigo)))
    return items
      .filter(i => {
        const codigo = normCodigo(i['Código'])
        return codsZ.has(codigo) || codsN.has(codigo)
      })
      .map(i => ({
        ...i,
        _problema: codsZ.has(normCodigo(i['Código'])) ? 'Estoque Zero' : 'Local Errado',
        Motivo: codsZ.has(normCodigo(i['Código'])) ? 'Estoque Zero' : 'Local Errado'
      }))
  }
  if (props.tipo === 'desatualizado') {
    return items.filter(i => {
      const s = normalizar(i['Situação'] || i['Situação atual da auditoria'] || i._situacao || '')
      return s.includes('desatualizad')
    })
  }
  return []
})

const aplicarFiltrosAvancados = (items, { ignorarUsuario = false, ignorarSetor = false, ignorarLocal = false, ignorarProblema = false } = {}) => {
  let resultado = [...items]

  if (!ignorarUsuario && filtroUsuario.value) {
    resultado = resultado.filter(i => (i['Usuário'] || '').toString().trim() === filtroUsuario.value)
  }
  if (!ignorarSetor && filtroSetor.value) {
    resultado = resultado.filter(i => {
      const v = (i['Classe de Produto Raiz'] || i['Setor'] || '').toString().trim()
      return v === filtroSetor.value
    })
  }
  if (!ignorarLocal && filtroLocal.value) {
    resultado = resultado.filter(i => (i['Local'] || '').toString().trim() === filtroLocal.value)
  }
  if (props.tipo === 'problema' && !ignorarProblema && filtroProblema.value) {
    resultado = resultado.filter(i => (i._problema || '') === filtroProblema.value)
  }

  return resultado
}

const usuariosOpcoes = computed(() => {
  const set = new Set()
  const items = aplicarFiltrosAvancados(baseLista.value, { ignorarUsuario: true })
  items.forEach(i => {
    const v = (i['Usuário'] || '').toString().trim()
    if (v) set.add(v)
  })
  return Array.from(set).sort()
})

const setoresOpcoes = computed(() => {
  const set = new Set()
  const items = aplicarFiltrosAvancados(baseLista.value, { ignorarSetor: true })
  items.forEach(i => {
    const v = (i['Classe de Produto Raiz'] || i['Setor'] || '').toString().trim()
    if (v) set.add(v)
  })
  return Array.from(set).sort()
})

const locaisOpcoes = computed(() => {
  const set = new Set()
  const items = aplicarFiltrosAvancados(baseLista.value, { ignorarLocal: true })
  items.forEach(i => {
    const v = (i['Local'] || '').toString().trim()
    if (v) set.add(v)
  })
  return Array.from(set).sort()
})

const lista = computed(() => {
  const filtrada = aplicarFiltrosAvancados(baseLista.value)
  return filtrada.sort((a, b) => (b._estoque || 0) - (a._estoque || 0))
})

const atualizarOrdenacao = (obj, coluna) => {
  if (obj.coluna === coluna) {
    obj.direcao = obj.direcao === 'asc' ? 'desc' : 'asc'
  } else {
    obj.coluna = coluna
    obj.direcao = 'asc'
  }
}

const listaFiltradaBusca = computed(() => {
  if (!buscaLista.value) return lista.value
  const termo = normalizar(buscaLista.value)
  return lista.value.filter(item =>
    normalizar(item['Código']).includes(termo) ||
    normalizar(item['Produto']).includes(termo) ||
    normalizar(item['Local']).includes(termo)
  )
})

const listaOrdenada = computed(() => {
  const items = [...listaFiltradaBusca.value]
  const { coluna, direcao } = ordenacaoLista.value
  const mult = direcao === 'asc' ? 1 : -1
  return items.sort((a, b) => {
    const va = a[coluna] ?? ''
    const vb = b[coluna] ?? ''
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * mult
    return String(va).localeCompare(String(vb), 'pt-BR', { numeric: true }) * mult
  })
})

const totalPaginasLista = computed(() => Math.max(1, Math.ceil(listaOrdenada.value.length / itensPorPaginaLista)))

const listaPaginada = computed(() => {
  const pagina = Math.min(paginaLista.value, totalPaginasLista.value)
  const inicio = (pagina - 1) * itensPorPaginaLista
  return listaOrdenada.value.slice(inicio, inicio + itensPorPaginaLista)
})

const paginasVisiveis = computed(() => {
  const total = totalPaginasLista.value
  const atual = paginaLista.value
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = []
  pages.push(1)
  if (atual > 3) pages.push('...')
  for (let i = Math.max(2, atual - 1); i <= Math.min(total - 1, atual + 1); i++) {
    pages.push(i)
  }
  if (atual < total - 2) pages.push('...')
  pages.push(total)
  return pages
})

watch([buscaLista, lista], () => {
  paginaLista.value = 1
})

const imprimirLista = () => {
  if (!colunas.value.length || !lista.value.length) return
  const tituloRel = `Auditoria - ${titulo.value}`
  printTableInNewWindow(lista.value, colunas.value, tituloRel)
}
</script>
