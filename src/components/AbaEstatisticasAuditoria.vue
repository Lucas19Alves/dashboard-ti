<script setup>
import { ref, computed } from 'vue'
import { atualizarOrdenacaoDados, sortDados } from '../utils/detalheAuditoria'

// Aba "Estatísticas" do detalhe da auditoria: parcial por setor e por local.
const props = defineProps({
  setores: { type: Array, default: () => [] },
  locais: { type: Array, default: () => [] },
  imprimir: { type: Function, default: null },
})
const emit = defineEmits(['abrir-setor-local'])
const setoresComAnalise = computed(() => props.setores)
const locaisComAnalise = computed(() => props.locais)
const abrirModalSetorLocal = (...args) => emit('abrir-setor-local', ...args)
const handlePrintCard = (...args) => props.imprimir?.(...args)

// Paginação/ordenação das tabelas de estatísticas
const paginaSetores = ref(1)
const paginaLocais = ref(1)

const itensPorPaginaSetores = 10
const itensPorPaginaLocais = 12

const buscaSetores = ref('')
const buscaLocais = ref('')

const ordenacaoSetores = ref({ coluna: 'percentualPendente', direcao: 'desc' })
const ordenacaoLocais = ref({ coluna: 'pendentes', direcao: 'desc' })

// Setores: filtrado + ordenado + paginado
const setoresFiltradoOrdenado = computed(() => {
  let lista = [...setoresComAnalise.value]
  if (buscaSetores.value) {
    const t = buscaSetores.value.toLowerCase()
    lista = lista.filter(s => s.nome.toLowerCase().includes(t) || s.classificacao.toLowerCase().includes(t))
  }
  return sortDados(lista, ordenacaoSetores.value)
})

const totalPaginasSetores = computed(() => Math.ceil(setoresFiltradoOrdenado.value.length / itensPorPaginaSetores))

const setoresPaginados = computed(() => {
  const inicio = (paginaSetores.value - 1) * itensPorPaginaSetores
  return setoresFiltradoOrdenado.value.slice(inicio, inicio + itensPorPaginaSetores)
})

// Locais: filtrado + ordenado + paginado

// Locais: filtrado + ordenado + paginado
const locaisFiltradoOrdenado = computed(() => {
  let lista = [...locaisComAnalise.value]
  if (buscaLocais.value) {
    const t = buscaLocais.value.toLowerCase()
    lista = lista.filter(l => l.nome.toLowerCase().includes(t))
  }
  return sortDados(lista, ordenacaoLocais.value)
})

const totalPaginasLocais = computed(() => Math.ceil(locaisFiltradoOrdenado.value.length / itensPorPaginaLocais))

const locaisPaginados = computed(() => {
  const inicio = (paginaLocais.value - 1) * itensPorPaginaLocais
  return locaisFiltradoOrdenado.value.slice(inicio, inicio + itensPorPaginaLocais)
})

// Dados para o relatório



const colunasLocaisEstat = [
  { chave: 'nome', titulo: 'Local', sortable: true },
  { chave: 'lidos', titulo: 'Lidos', sortable: true, alinhamento: 'right' },
  { chave: 'pendentes', titulo: 'Pendentes', sortable: true, alinhamento: 'right' },
  { chave: 'comProblema', titulo: 'Problemas', sortable: true, alinhamento: 'right' },
  { chave: 'desatualizados', titulo: 'Desatualizados', sortable: true, alinhamento: 'right' },
  { chave: 'total', titulo: 'Total', sortable: true, alinhamento: 'right' },
  { chave: 'percentualLido', titulo: '% Lido', sortable: true, alinhamento: 'right', format: (v) => v.toFixed(2) + '%' }
]

const handlePrintLocais = () => {
  handlePrintCard(locaisFiltradoOrdenado.value, colunasLocaisEstat, 'Locais')
}
</script>

<template>
  <div class="space-y-6">
    <!-- Setores -->
    <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 p-5 space-y-3">
      <div class="flex items-center gap-2 flex-wrap">
        <div class="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center">
          <i class="fas fa-chart-pie text-indigo-600 text-sm"></i>
        </div>
        <h2 class="text-sm font-bold text-slate-800">Parcial por Setor</h2>
        <span v-if="setoresComAnalise.length" class="text-[10px] text-slate-400 font-medium">{{ setoresComAnalise.length }} setor(es)</span>
        <span v-if="setoresComAnalise.filter(s => s.percentualPendente > 3).length" class="text-[10px] px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 font-medium border border-orange-100">{{ setoresComAnalise.filter(s => s.percentualPendente > 3).length }} acima da meta</span>
        <div class="ml-auto flex items-center gap-2">
          <div class="relative">
            <i class="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[11px]"></i>
            <input v-model="buscaSetores" type="text" placeholder="Buscar setor..." class="pl-7 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-44" @input="paginaSetores = 1" />
          </div>
          <!-- Setores entram no Relatório da auditoria (botão Relatório no topo). -->
        </div>
      </div>
      <div v-if="setoresFiltradoOrdenado.length === 0" class="flex flex-col items-center justify-center py-8 text-slate-400">
        <i class="fas fa-chart-pie text-3xl mb-2"></i>
        <p class="text-xs">Nenhum setor encontrado.</p>
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead>
            <tr class="border-b-2 border-slate-100">
              <th class="px-3 py-2.5 text-left font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoSetores, 'nome'); paginaSetores = 1">
                <span class="inline-flex items-center gap-1">Setor <i class="fas text-[10px]" :class="ordenacaoSetores.coluna === 'nome' ? (ordenacaoSetores.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" /></span>
              </th>
              <th class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoSetores, 'total'); paginaSetores = 1">
                <span class="inline-flex items-center gap-1">Total <i class="fas text-[10px]" :class="ordenacaoSetores.coluna === 'total' ? (ordenacaoSetores.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" /></span>
              </th>
              <th class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoSetores, 'lidos'); paginaSetores = 1">
                <span class="inline-flex items-center gap-1">Lidos <i class="fas text-[10px]" :class="ordenacaoSetores.coluna === 'lidos' ? (ordenacaoSetores.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" /></span>
              </th>
              <th class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoSetores, 'pendentes'); paginaSetores = 1">
                <span class="inline-flex items-center gap-1">Pendentes <i class="fas text-[10px]" :class="ordenacaoSetores.coluna === 'pendentes' ? (ordenacaoSetores.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" /></span>
              </th>
              <th class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoSetores, 'comProblema'); paginaSetores = 1">
                <span class="inline-flex items-center gap-1">Problemas <i class="fas text-[10px]" :class="ordenacaoSetores.coluna === 'comProblema' ? (ordenacaoSetores.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" /></span>
              </th>
              <th class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoSetores, 'desatualizados'); paginaSetores = 1">
                <span class="inline-flex items-center gap-1">Desatualiz. <i class="fas text-[10px]" :class="ordenacaoSetores.coluna === 'desatualizados' ? (ordenacaoSetores.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" /></span>
              </th>
              <th class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoSetores, 'percentualConclusao'); paginaSetores = 1">
                <span class="inline-flex items-center gap-1">Conclusão <i class="fas text-[10px]" :class="ordenacaoSetores.coluna === 'percentualConclusao' ? (ordenacaoSetores.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" /></span>
              </th>
              <th class="px-3 py-2.5 text-center font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoSetores, 'classificacao'); paginaSetores = 1">
                <span class="inline-flex items-center gap-1">Classificação <i class="fas text-[10px]" :class="ordenacaoSetores.coluna === 'classificacao' ? (ordenacaoSetores.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" /></span>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-50">
            <tr
              v-for="(s, idx) in setoresPaginados"
              :key="s.nome"
              class="transition-colors cursor-pointer"
              :class="idx % 2 === 0 ? 'bg-white hover:bg-indigo-50/40' : 'bg-slate-50/60 hover:bg-indigo-50/40'"
              @click="abrirModalSetorLocal('setor', [s])"
            >
              <td class="px-3 py-2.5 text-slate-700 font-medium">{{ s.nome }}</td>
              <td class="px-3 py-2.5 text-right text-blue-700 font-semibold">{{ s.total.toLocaleString('pt-BR') }}</td>
              <td class="px-3 py-2.5 text-right text-emerald-700 font-semibold">{{ s.lidos.toLocaleString('pt-BR') }}</td>
              <td class="px-3 py-2.5 text-right text-orange-600 font-semibold">{{ s.pendentes.toLocaleString('pt-BR') }}</td>
              <td class="px-3 py-2.5 text-right text-red-600 font-semibold">{{ s.comProblema.toLocaleString('pt-BR') }}</td>
              <td class="px-3 py-2.5 text-right text-yellow-600 font-semibold">{{ s.desatualizados.toLocaleString('pt-BR') }}</td>
              <td class="px-3 py-2.5 text-right">
                <div class="flex items-center justify-end gap-2">
                  <div class="w-14 bg-slate-100 rounded-full h-1.5 hidden sm:block">
                    <div class="h-1.5 rounded-full bg-emerald-400 transition-all" :style="{ width: Math.min(s.percentualConclusao, 100) + '%' }"></div>
                  </div>
                  <span class="text-slate-700 font-semibold">{{ s.percentualConclusao.toFixed(2) }}%</span>
                </div>
              </td>
              <td class="px-3 py-2.5 text-center">
                <span class="px-2 py-1 rounded-full text-[10px] font-bold" :class="s.classificacaoClass">{{ s.classificacao }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <!-- Paginação -->
      <div v-if="totalPaginasSetores > 1" class="flex items-center justify-between pt-2 border-t border-slate-100">
        <p class="text-[11px] text-slate-500">Mostrando {{ ((paginaSetores - 1) * itensPorPaginaSetores) + 1 }} a {{ Math.min(paginaSetores * itensPorPaginaSetores, setoresFiltradoOrdenado.length) }} de {{ setoresFiltradoOrdenado.length }}</p>
        <div class="flex items-center gap-1">
          <button @click="paginaSetores = 1" :disabled="paginaSetores === 1" class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"><i class="fas fa-angle-double-left"></i></button>
          <button @click="paginaSetores--" :disabled="paginaSetores === 1" class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"><i class="fas fa-angle-left"></i></button>
          <template v-for="p in totalPaginasSetores" :key="p">
            <button v-if="p === 1 || p === totalPaginasSetores || (p >= paginaSetores - 1 && p <= paginaSetores + 1)" @click="paginaSetores = p" class="min-w-[28px] px-2 py-1 rounded text-[11px] font-semibold transition" :class="p === paginaSetores ? 'bg-indigo-600 text-white shadow-sm' : 'hover:bg-slate-100 text-slate-600'">{{ p }}</button>
            <span v-else-if="p === paginaSetores - 2 || p === paginaSetores + 2" class="text-slate-400 text-[11px] px-1">...</span>
          </template>
          <button @click="paginaSetores++" :disabled="paginaSetores === totalPaginasSetores" class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"><i class="fas fa-angle-right"></i></button>
          <button @click="paginaSetores = totalPaginasSetores" :disabled="paginaSetores === totalPaginasSetores" class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"><i class="fas fa-angle-double-right"></i></button>
        </div>
      </div>
    </div>

    <!-- Locais -->
    <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 p-5 space-y-3">
      <div class="flex items-center gap-2 flex-wrap">
        <div class="h-8 w-8 rounded-lg bg-rose-50 flex items-center justify-center">
          <i class="fas fa-map-marker-alt text-rose-600 text-sm"></i>
        </div>
        <h2 class="text-sm font-bold text-slate-800">Locais</h2>
        <span v-if="locaisComAnalise.length" class="text-[10px] text-slate-400 font-medium">{{ locaisComAnalise.length }} local(is)</span>
        <span v-if="locaisComAnalise.filter(l => l.pendentes > 0).length" class="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium border border-amber-100">{{ locaisComAnalise.filter(l => l.pendentes > 0).length }} com pendência</span>
        <div class="ml-auto flex items-center gap-2">
          <div class="relative">
            <i class="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[11px]"></i>
            <input v-model="buscaLocais" type="text" placeholder="Buscar local..." class="pl-7 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-rose-500 w-44" @input="paginaLocais = 1" />
          </div>
          <button v-if="locaisFiltradoOrdenado.length > 0" @click="handlePrintLocais" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-[11px] font-medium shadow-sm hover:bg-rose-700 transition">
            <i class="fas fa-print"></i> Imprimir
          </button>
        </div>
      </div>
      <div v-if="locaisFiltradoOrdenado.length === 0" class="flex flex-col items-center justify-center py-8 text-slate-400">
        <i class="fas fa-map-marker-alt text-3xl mb-2"></i>
        <p class="text-xs">Nenhum local encontrado.</p>
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead>
            <tr class="border-b-2 border-slate-100">
              <th class="px-3 py-2.5 text-left font-semibold text-slate-600 cursor-pointer select-none hover:text-rose-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoLocais, 'nome'); paginaLocais = 1">
                <span class="inline-flex items-center gap-1">Local <i class="fas text-[10px]" :class="ordenacaoLocais.coluna === 'nome' ? (ordenacaoLocais.direcao === 'asc' ? 'fa-sort-up text-rose-600' : 'fa-sort-down text-rose-600') : 'fa-sort text-slate-300'" /></span>
              </th>
              <th class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-rose-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoLocais, 'lidos'); paginaLocais = 1">
                <span class="inline-flex items-center gap-1">Lidos <i class="fas text-[10px]" :class="ordenacaoLocais.coluna === 'lidos' ? (ordenacaoLocais.direcao === 'asc' ? 'fa-sort-up text-rose-600' : 'fa-sort-down text-rose-600') : 'fa-sort text-slate-300'" /></span>
              </th>
              <th class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-rose-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoLocais, 'pendentes'); paginaLocais = 1">
                <span class="inline-flex items-center gap-1">Pendentes <i class="fas text-[10px]" :class="ordenacaoLocais.coluna === 'pendentes' ? (ordenacaoLocais.direcao === 'asc' ? 'fa-sort-up text-rose-600' : 'fa-sort-down text-rose-600') : 'fa-sort text-slate-300'" /></span>
              </th>
              <th class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-rose-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoLocais, 'comProblema'); paginaLocais = 1">
                <span class="inline-flex items-center gap-1">Problemas <i class="fas text-[10px]" :class="ordenacaoLocais.coluna === 'comProblema' ? (ordenacaoLocais.direcao === 'asc' ? 'fa-sort-up text-rose-600' : 'fa-sort-down text-rose-600') : 'fa-sort text-slate-300'" /></span>
              </th>
              <th class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-rose-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoLocais, 'desatualizados'); paginaLocais = 1">
                <span class="inline-flex items-center gap-1">Desatualiz. <i class="fas text-[10px]" :class="ordenacaoLocais.coluna === 'desatualizados' ? (ordenacaoLocais.direcao === 'asc' ? 'fa-sort-up text-rose-600' : 'fa-sort-down text-rose-600') : 'fa-sort text-slate-300'" /></span>
              </th>
              <th class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-rose-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoLocais, 'total'); paginaLocais = 1">
                <span class="inline-flex items-center gap-1">Total <i class="fas text-[10px]" :class="ordenacaoLocais.coluna === 'total' ? (ordenacaoLocais.direcao === 'asc' ? 'fa-sort-up text-rose-600' : 'fa-sort-down text-rose-600') : 'fa-sort text-slate-300'" /></span>
              </th>
              <th class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-rose-600 transition-colors" @click="atualizarOrdenacaoDados(ordenacaoLocais, 'percentualLido'); paginaLocais = 1">
                <span class="inline-flex items-center gap-1">% Lido <i class="fas text-[10px]" :class="ordenacaoLocais.coluna === 'percentualLido' ? (ordenacaoLocais.direcao === 'asc' ? 'fa-sort-up text-rose-600' : 'fa-sort-down text-rose-600') : 'fa-sort text-slate-300'" /></span>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-50">
            <tr
              v-for="(l, idx) in locaisPaginados"
              :key="l.nome"
              class="transition-colors cursor-pointer"
              :class="idx % 2 === 0 ? 'bg-white hover:bg-rose-50/40' : 'bg-slate-50/60 hover:bg-rose-50/40'"
              @click="abrirModalSetorLocal('local', [l])"
            >
              <td class="px-3 py-2.5 text-slate-700 font-medium">{{ l.nome }}</td>
              <td class="px-3 py-2.5 text-right text-emerald-700 font-semibold">{{ l.lidos.toLocaleString('pt-BR') }}</td>
              <td class="px-3 py-2.5 text-right text-orange-600 font-semibold">{{ l.pendentes.toLocaleString('pt-BR') }}</td>
              <td class="px-3 py-2.5 text-right text-red-600 font-semibold">{{ l.comProblema.toLocaleString('pt-BR') }}</td>
              <td class="px-3 py-2.5 text-right text-yellow-600 font-semibold">{{ l.desatualizados.toLocaleString('pt-BR') }}</td>
              <td class="px-3 py-2.5 text-right text-blue-700 font-semibold">{{ l.total.toLocaleString('pt-BR') }}</td>
              <td class="px-3 py-2.5 text-right">
                <div class="flex items-center justify-end gap-2">
                  <div class="w-14 bg-slate-100 rounded-full h-1.5 hidden sm:block">
                    <div class="h-1.5 rounded-full transition-all" :class="l.percentualLido >= 97 ? 'bg-emerald-400' : l.percentualLido >= 90 ? 'bg-amber-400' : 'bg-red-400'" :style="{ width: Math.min(l.percentualLido, 100) + '%' }"></div>
                  </div>
                  <span class="font-bold" :class="l.percentualLido >= 97 ? 'text-emerald-700' : l.percentualLido >= 90 ? 'text-amber-700' : 'text-red-700'">{{ l.percentualLido.toFixed(2) }}%</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <!-- Paginação -->
      <div v-if="totalPaginasLocais > 1" class="flex items-center justify-between pt-2 border-t border-slate-100">
        <p class="text-[11px] text-slate-500">Mostrando {{ ((paginaLocais - 1) * itensPorPaginaLocais) + 1 }} a {{ Math.min(paginaLocais * itensPorPaginaLocais, locaisFiltradoOrdenado.length) }} de {{ locaisFiltradoOrdenado.length }}</p>
        <div class="flex items-center gap-1">
          <button @click="paginaLocais = 1" :disabled="paginaLocais === 1" class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"><i class="fas fa-angle-double-left"></i></button>
          <button @click="paginaLocais--" :disabled="paginaLocais === 1" class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"><i class="fas fa-angle-left"></i></button>
          <template v-for="p in totalPaginasLocais" :key="p">
            <button v-if="p === 1 || p === totalPaginasLocais || (p >= paginaLocais - 1 && p <= paginaLocais + 1)" @click="paginaLocais = p" class="min-w-[28px] px-2 py-1 rounded text-[11px] font-semibold transition" :class="p === paginaLocais ? 'bg-rose-600 text-white shadow-sm' : 'hover:bg-slate-100 text-slate-600'">{{ p }}</button>
            <span v-else-if="p === paginaLocais - 2 || p === paginaLocais + 2" class="text-slate-400 text-[11px] px-1">...</span>
          </template>
          <button @click="paginaLocais++" :disabled="paginaLocais === totalPaginasLocais" class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"><i class="fas fa-angle-right"></i></button>
          <button @click="paginaLocais = totalPaginasLocais" :disabled="paginaLocais === totalPaginasLocais" class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"><i class="fas fa-angle-double-right"></i></button>
        </div>
      </div>
    </div>
  </div>
</template>
