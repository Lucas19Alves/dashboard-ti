<template>
  <UiModal v-if="aberto" :title="titulo" :subtitle="subtitulo" width="max-w-5xl" @close="fechar">
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div class="rounded-2xl bg-slate-50 p-3">
          <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">{{ tipo === 'setor' ? 'Setores' : 'Locais' }}</p>
          <p class="text-xl font-bold text-slate-900">{{ (items || []).length }}</p>
        </div>
        <div class="rounded-2xl bg-slate-50 p-3">
          <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Itens</p>
          <p class="text-xl font-bold text-slate-900">{{ totais.total.toLocaleString('pt-BR') }}</p>
        </div>
        <div class="rounded-2xl bg-slate-50 p-3">
          <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Pendentes</p>
          <p class="text-xl font-bold text-amber-700">{{ totais.pendentes.toLocaleString('pt-BR') }}</p>
        </div>
        <div class="rounded-2xl p-3" :class="acimaDaMeta ? 'bg-red-50' : 'bg-emerald-50'">
          <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Acima de {{ META }}%</p>
          <p class="text-xl font-bold" :class="acimaDaMeta ? 'text-red-700' : 'text-emerald-700'">{{ acimaDaMeta }}</p>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <div class="relative min-w-0 flex-1 basis-56">
          <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400"></i>
          <input v-model="buscaModal" type="search" class="ui-input py-2 pl-8 text-sm" :placeholder="tipo === 'setor' ? 'Buscar setor...' : 'Buscar local...'">
        </div>
        <select v-model="ordem" class="ui-input w-auto py-2 text-sm" aria-label="Ordenar">
          <option v-for="o in ordens" :key="o.valor" :value="o.valor">{{ o.rotulo }}</option>
        </select>
        <div class="flex items-center gap-3 text-[11px] text-slate-500">
          <span><i class="mr-1 inline-block size-2 rounded-full bg-emerald-500"></i>Lidos</span>
          <span><i class="mr-1 inline-block size-2 rounded-full bg-red-500"></i>Problema</span>
          <span><i class="mr-1 inline-block size-2 rounded-full bg-amber-400"></i>Pendentes</span>
        </div>
      </div>

      <p v-if="!lista.length" class="rounded-2xl bg-slate-50 py-10 text-center text-sm text-slate-500">Nenhum resultado.</p>
      <ul v-else class="max-h-[55vh] divide-y divide-slate-100 overflow-y-auto rounded-2xl ring-1 ring-slate-200">
        <li v-for="item in lista" :key="item.nome">
          <button
            type="button"
            class="flex w-full items-center gap-4 px-4 py-3 text-left transition hover:bg-blue-50/50"
            @click="tipo === 'setor' ? abrirLocaisDoSetor(item) : abrirItensDoLocal(item)"
          >
            <div class="min-w-0 flex-1">
              <div class="flex items-baseline justify-between gap-3">
                <p class="truncate text-sm font-bold text-slate-900" :title="item.nome">{{ item.nome }}</p>
                <p class="shrink-0 text-xs text-slate-500">{{ item.lidos || 0 }} lidos · {{ item.comProblema || 0 }} probl. · <b class="text-amber-700">{{ item.pendentes || 0 }} pend.</b> · {{ item.total || 0 }} itens</p>
              </div>
              <div class="mt-2 flex h-2 gap-0.5 overflow-hidden rounded-full bg-slate-100">
                <span class="bg-emerald-500" :style="{ width: larg(item.lidos || 0, item.total) }"></span>
                <span class="bg-red-500" :style="{ width: larg(item.comProblema || 0, item.total) }"></span>
                <span class="bg-amber-400" :style="{ width: larg(item.pendentes || 0, item.total) }"></span>
              </div>
            </div>
            <span class="w-20 shrink-0 rounded-full px-2 py-1 text-center text-xs font-bold" :class="percentualPendenteDe(item) > META ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'">
              {{ percentualPendenteDe(item).toFixed(1) }}%
            </span>
            <span class="hidden shrink-0 text-xs font-semibold text-blue-600 sm:inline">
              {{ tipo === 'setor' ? 'Ver locais' : 'Ver itens' }} <i class="fas fa-chevron-right text-[10px]"></i>
            </span>
          </button>
        </li>
      </ul>
    </div>
  </UiModal>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import UiModal from './ui/UiModal.vue'
import { correspondeBusca } from '../utils/busca'

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

const buscaModal = ref('')
const ordem = ref('pendentes')
const ordens = [
  { valor: 'pendentes', rotulo: 'Mais pendentes' },
  { valor: 'percentualPendente', rotulo: 'Maior % pendente' },
  { valor: 'comProblema', rotulo: 'Mais problemas' },
  { valor: 'total', rotulo: 'Mais itens' },
  { valor: 'nome', rotulo: 'Nome' }
]
const META = 3

watch(() => props.items, () => { buscaModal.value = '' })

const lista = computed(() => (props.items || [])
  .filter(item => correspondeBusca(buscaModal.value, [item.nome]))
  .sort((a, b) => (ordem.value === 'nome'
    ? String(a.nome).localeCompare(String(b.nome), 'pt-BR', { numeric: true })
    : (Number(b[ordem.value]) || 0) - (Number(a[ordem.value]) || 0))))

const totais = computed(() => (props.items || []).reduce((t, i) => ({
  lidos: t.lidos + (i.lidos || 0),
  pendentes: t.pendentes + (i.pendentes || 0),
  comProblema: t.comProblema + (i.comProblema || 0),
  total: t.total + (i.total || 0)
}), { lidos: 0, pendentes: 0, comProblema: 0, total: 0 }))
const acimaDaMeta = computed(() => (props.items || []).filter(i => percentualPendenteDe(i) > META).length)
const percentualPendenteDe = item => (item?.total ? ((item.pendentes || 0) / item.total) * 100 : 0)
const larg = (v, total) => `${total ? (v / total) * 100 : 0}%`

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
