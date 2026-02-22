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
            <p class="text-gray-700 text-sm"><strong>Taxa de Conclusão:</strong> {{ Math.round(((( (dados.totalLidos != null ? dados.totalLidos : 0) || ((dados.itensAtualizados || 0) + (dados.itensDesatualizados || 0) + (dados.itensLidoNaoPertence || 0) + (dados.itensComEstoqueZero || 0))) / (dados.totalItens || 1)) * 100) || 0) }}%</p>
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

        <div v-if="lista.length > 0" class="space-y-3 pt-4 border-t">
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
            <p class="font-bold text-gray-800">
              <i class="fas fa-list mr-2"></i>Lista de Itens
              <span class="text-sm font-normal text-gray-500 ml-2">({{ lista.length }} encontrados)</span>
            </p>
            <div class="flex flex-wrap gap-2 w-full sm:w-auto justify-start sm:justify-end">
              <select
                v-if="usuariosOpcoes.length > 0"
                v-model="filtroUsuario"
                class="border border-gray-300 rounded-lg px-2 py-1 text-xs text-gray-700 bg-white"
              >
                <option value="">Todos usuários</option>
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
                <span class="hidden sm:inline">Imprimir relatório</span>
                <span class="sm:hidden">Imprimir</span>
              </button>
            </div>
          </div>
          
          <TabelaInterativaAuditoria
            ref="tabelaListaRef"
            :dados="lista"
            :colunas="colunas"
            :itensPorPagina="15"
            :mostrarBusca="true"
            :exibirTudo="exibirTudoTabela"
          >
            <template #cell-_estoque="{ item }">
              <span class="font-mono">{{ item._estoque || 0 }}</span>
            </template>
            
            <template #cell-Motivo="{ item }">
              <span 
                class="px-2 py-0.5 rounded text-xs font-bold"
                :class="item._problema === 'Estoque Zero' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'"
              >
                {{ item._problema }}
              </span>
            </template>
          </TabelaInterativaAuditoria>
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
import { computed, ref, nextTick } from 'vue'
import TabelaInterativaAuditoria from './TabelaInterativaAuditoria.vue'
import { printTableInNewWindow } from '../utils/print'

const props = defineProps({
  aberto: Boolean,
  tipo: String,
  dados: Object,
  dadosCompletos: Array
})

const emit = defineEmits(['fechar'])

const tabelaListaRef = ref(null)
const exibirTudoTabela = ref(false)
const filtroUsuario = ref('')
const filtroSetor = ref('')
const filtroLocal = ref('')
const filtroProblema = ref('')

const titulo = computed(() => {
  const titulos = {
    'total': 'Total de Itens da Auditoria',
    'lidos': 'Itens Lidos Corretamente',
    'pendentes': 'Itens Pendentes - Não Lidos',
    'problema': 'Itens Lidos Com Problema',
    'desatualizado': 'Itens Lidos Desatualizados'
  }
  return titulos[props.tipo] || 'Métrica'
})

const subtitulo = computed(() => {
  const subtitulos = {
    'total': 'Total de itens auditáveis (excluindo: sem leitura e sem estoque)',
    'lidos': 'Itens com presença confirmada e estoque disponível',
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
    'lidos': props.dados.itensLidosCorretamente || 0,
    'pendentes': props.dados.itensPendentes || 0,
    'problema': props.dados.itensLidosComProblema || 0,
    'desatualizado': props.dados.itensDesatualizados || 0
  }
  return valores[props.tipo] || 0
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
  
  if (props.tipo === 'pendentes') {
    return items.filter(i => !temPresencaEfetiva(i) && (i._estoque || 0) > 0)
  }
  if (props.tipo === 'lidos') {
    return items.filter(i => temPresencaEfetiva(i) && (i._estoque || 0) > 0)
  }
  if (props.tipo === 'problema') {
    const codsZ = new Set((props.dados.itensComEstoqueZeroDetalhes || []).map(d => d.codigo))
    const codsN = new Set((props.dados.itensLidoNaoPertenceDetalhes || []).map(d => d.codigo))
    return items
      .filter(i => codsZ.has(i['Código']) || codsN.has(i['Código']))
      .map(i => ({
        ...i,
        _problema: codsZ.has(i['Código']) ? 'Estoque Zero' : 'Local Errado',
        Motivo: codsZ.has(i['Código']) ? 'Estoque Zero' : 'Local Errado'
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

const extrairDadosOrdenadosTabela = (tabelaRef, colunas) => {
  if (!tabelaRef?.value || !tabelaRef.value.$el || !Array.isArray(colunas) || colunas.length === 0) return null
  const root = tabelaRef.value.$el
  const tbody = root.querySelector('tbody')
  if (!tbody) return null
  const trs = Array.from(tbody.querySelectorAll('tr'))
  if (!trs.length) return null
  const dados = []
  trs.forEach(tr => {
    const tds = Array.from(tr.querySelectorAll('td'))
    if (!tds.length) return
    const obj = {}
    colunas.forEach((col, idx) => {
      const td = tds[idx]
      const texto = td ? td.textContent ?? '' : ''
      obj[col.chave] = String(texto).trim()
    })
    dados.push(obj)
  })
  return dados
}

const imprimirLista = async () => {
  if (!colunas.value.length) return
  exibirTudoTabela.value = true
  await nextTick()
  const dadosOrdenados = extrairDadosOrdenadosTabela(tabelaListaRef, colunas.value)
  exibirTudoTabela.value = false
  const base = dadosOrdenados && dadosOrdenados.length ? dadosOrdenados : lista.value
  if (!base || !base.length) return
  const tituloRel = `Auditoria - ${titulo.value}`
  printTableInNewWindow(base, colunas.value, tituloRel)
}
</script>
