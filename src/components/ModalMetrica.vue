<template>
  <UiModal v-if="aberto" :title="titulo" :subtitle="subtitulo" width="max-w-6xl" @close="fechar">
    <div class="space-y-5">
      <!-- Resumo -->
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div class="flex items-center gap-4 rounded-2xl bg-slate-50 p-4">
          <span class="inline-flex size-12 items-center justify-center rounded-2xl bg-white shadow-sm" :class="classeValor"><i :class="[icone, 'text-lg']"></i></span>
          <div>
            <p :class="['text-3xl font-bold tracking-tight', classeValor]">{{ Number(valor).toLocaleString('pt-BR') }}</p>
            <p class="text-xs text-slate-500">de {{ composicao.total.toLocaleString('pt-BR') }} auditáveis</p>
          </div>
        </div>
        <div class="rounded-2xl bg-slate-50 p-4">
          <div class="flex items-center justify-between text-xs">
            <span class="font-semibold text-slate-600">Composição da auditoria</span>
            <span class="font-bold text-slate-800">{{ composicao.conclusao.toFixed(1) }}% concluído</span>
          </div>
          <div class="mt-2 flex h-3 gap-0.5 overflow-hidden rounded-full bg-white">
            <span v-for="p in composicao.partes" :key="p.chave" class="h-full transition-opacity" :class="[p.cor, destaque(p.chave) ? '' : 'opacity-25']" :style="{ width: `${composicao.total ? (p.valor / composicao.total) * 100 : 0}%` }"></span>
          </div>
          <div class="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
            <span v-for="p in composicao.partes" :key="p.chave" :class="destaque(p.chave) ? '' : 'opacity-50'">
              <i class="mr-1 inline-block size-2 rounded-full" :class="p.ponto"></i>{{ p.rotulo }}: <b class="text-slate-800">{{ p.valor.toLocaleString('pt-BR') }}</b>
            </span>
          </div>
          <div v-if="tipo === 'problema'" class="mt-3 flex flex-wrap gap-2 text-xs">
            <span class="rounded-full bg-red-50 px-2.5 py-1 font-semibold text-red-700"><i class="fas fa-box-open mr-1"></i>{{ resumoProblemas['Estoque Zero'] }} lidos sem estoque</span>
            <span class="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700"><i class="fas fa-location-crosshairs mr-1"></i>{{ resumoProblemas['Local Errado'] }} fora do local</span>
          </div>
        </div>
      </div>

      <UiListaItens
        :itens="baseLista"
        :colunas="colunasLista"
        :facetas="facetas"
        :titulo="`Auditoria - ${titulo}`"
        :ordem-inicial="{ chave: '_estoque', direcao: 'desc' }"
      />
    </div>
  </UiModal>
</template>

<script setup>
import { computed } from 'vue'
import UiModal from './ui/UiModal.vue'
import UiListaItens from './ui/UiListaItens.vue'

const props = defineProps({
  aberto: Boolean,
  tipo: String,
  dados: Object,
  dadosCompletos: Array,
  tipoAuditoria: String
})

const emit = defineEmits(['fechar'])

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

const fechar = () => emit('fechar')

const normalizar = (valor) => {
  if (valor == null) return ''
  try {
    return String(valor).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
  } catch {
    return String(valor).toLowerCase()
  }
}

const isLidoNaoPertence = (item) => {
  const valor = item['Lido não pertence']
  if (valor === undefined || valor === null) return false
  if (valor === true) return true
  if (typeof valor === 'string') return valor.toLowerCase().includes('sim')
  return false
}

const temPresencaEfetiva = (item) => item._temPresenca || isLidoNaoPertence(item)

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
  if (props.tipo === 'total') return items
  return []
})

const setorDe = item => (item['Classe de Produto Raiz'] || item['Setor'] || '').toString().trim()

const colunasLista = computed(() => {
  const cols = [
    { chave: 'Código', titulo: 'Código' },
    { chave: 'Produto', titulo: 'Produto', largura: 'max-w-72' },
    { chave: 'setor', titulo: 'Setor', valor: setorDe, largura: 'max-w-44' },
    { chave: 'Local', titulo: 'Local' },
    { chave: 'Usuário', titulo: 'Usuário' },
    { chave: '_estoque', titulo: 'Estoque', alinhamento: 'right', valor: i => Number(i._estoque || 0) }
  ]
  if (props.tipo === 'problema') cols.push({ chave: '_problema', titulo: 'Motivo', alinhamento: 'center', badge: v => (v === 'Estoque Zero' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700') })
  if (props.tipo === 'desatualizado' || props.tipo === 'total') cols.push({ chave: 'situacao', titulo: 'Situação', valor: i => i['Situação'] || i['Situação atual da auditoria'] || i._situacao || '' })
  return cols
})

const facetas = computed(() => [
  { chave: 'setor', titulo: 'Setor', valor: setorDe },
  { chave: 'Local', titulo: 'Local' },
  { chave: 'Usuário', titulo: 'Usuário' },
  ...(props.tipo === 'problema' ? [{ chave: '_problema', titulo: 'Motivo' }] : [])
])

// Composição do total auditável para o gráfico do topo.
const composicao = computed(() => {
  const d = props.dados || {}
  const total = Number(d.totalItens || 0)
  const pendentes = Number(d.itensPendentes || 0)
  const problema = Number(d.itensLidosComProblema || 0)
  const corretos = Math.max(0, total - pendentes - problema)
  const partes = [
    { chave: 'lidos', rotulo: 'Lidos corretamente', valor: corretos, cor: 'bg-emerald-500', ponto: 'bg-emerald-500' },
    { chave: 'problema', rotulo: 'Lidos com problema', valor: problema, cor: 'bg-red-500', ponto: 'bg-red-500' },
    { chave: 'pendentes', rotulo: 'Pendentes', valor: pendentes, cor: 'bg-amber-400', ponto: 'bg-amber-400' }
  ]
  return { total, partes, conclusao: total ? ((total - pendentes) / total) * 100 : 0 }
})
const destaque = chave => !props.tipo || props.tipo === 'total' || props.tipo === chave || (props.tipo === 'lidos' && chave !== 'pendentes')

const resumoProblemas = computed(() => {
  const contagem = { 'Estoque Zero': 0, 'Local Errado': 0 }
  baseLista.value.forEach(i => { if (i._problema in contagem) contagem[i._problema]++ })
  return contagem
})

const icone = computed(() => ({ total: 'fas fa-clipboard-list', lidos: 'fas fa-check-circle', pendentes: 'fas fa-hourglass-half', problema: 'fas fa-exclamation-triangle', desatualizado: 'fas fa-history' })[props.tipo] || 'fas fa-list')
</script>
