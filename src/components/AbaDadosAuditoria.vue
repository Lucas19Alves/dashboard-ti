<script setup>
import { computed } from 'vue'
import { extrairEstoque, getSetorItem, temPresencaConfirmada } from '../utils/detalheAuditoria'
import UiTabela from './ui/UiTabela.vue'

// Aba "Dados" do detalhe da auditoria: mapa de setores e tabelas de itens (todos os itens,
// estoque zero, fora do local, grande estoque e ruptura de menor custo), todas na tabela padrão.
const props = defineProps({
  auditoria: { type: Object, required: true },
  itensLidoNaoPertence: { type: Array, default: () => [] },
  imprimir: { type: Function, default: null },
})
const emit = defineEmits(['abrir-setor-local'])
const auditoria = computed(() => props.auditoria)
const abrirModalSetorLocal = (...args) => emit('abrir-setor-local', ...args)

// =========== DADOS ===========
const mapaSeteores = computed(() => {
  if (!auditoria.value?.dados || !auditoria.value?.analise) return {}
  
  const analise = auditoria.value.analise
  if (!analise.porSetor) return {}
  const setores = {}

  Object.entries(analise.porSetor).forEach(([setor, dados]) => {
    const lidos = Number(dados?.lidos || 0)
    const pendentes = Number(dados?.pendentes || 0)
    const comProblema = Number(dados?.comProblema || 0)
    const total = lidos + pendentes + comProblema
    const percentualConclusao = total > 0 ? Math.round((lidos / total) * 100) : 0
    const percentualPendente = total > 0 ? parseFloat(((pendentes / total) * 100).toFixed(2)) : 0

    setores[setor] = {
      nome: setor,
      lidos,
      pendentes,
      comProblema,
      total,
      percentualConclusao,
      percentualPendente,
      percentualLido: percentualConclusao
    }
  })

  return setores
})

// Setor de um item dos detalhes da análise (que nem sempre trazem o setor).
const setorPorCodigo = computed(() => {
  const map = new Map()
  for (const item of auditoria.value?.dados || []) {
    const codigo = item?.['Código']
    if (codigo != null) map.set(String(codigo).trim(), getSetorItem(item))
  }
  return map
})
const getSetorDetalhe = (detalhe) => {
  const direto = detalhe?.setor
  if (direto != null && String(direto).trim() !== '') return String(direto).trim()
  const codigo = detalhe?.codigo ?? detalhe?.['Código']
  if (codigo == null) return 'Não especificado'
  return setorPorCodigo.value.get(String(codigo).trim()) || 'Não especificado'
}
const numero = v => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v))

// Todos os itens da auditoria numa forma só (base das tabelas).
const itensAuditoria = computed(() => (auditoria.value?.dados || []).map((item) => {
  const lido = item._temPresenca !== undefined ? Boolean(item._temPresenca) : temPresencaConfirmada(item)
  return {
    codigo: String(item['Código'] ?? '').trim(),
    produto: item['Produto'] || '',
    setor: getSetorItem(item),
    classe: item['Classe de Produto'] || '',
    local: String(item['Local'] || '').split(' - ')[0].trim(),
    fornecedor: item['Fornecedor'] || '',
    usuario: String(item['Usuário'] || '').trim(),
    estoque: item._estoque !== undefined ? item._estoque : (extrairEstoque(item) || 0),
    diasSemVenda: numero(item['Dias sem venda']),
    custo: parseFloat(item['Custo Ruptura']) || 0,
    situacao: item._situacao || item['Situação'] || '',
    lido,
    status: item._lidoNaoPertence ? 'Lido não pertence' : lido ? 'Lido' : 'Pendente'
  }
}))
const detalhe = i => ({
  codigo: String(i.codigo || i['Código'] || '').trim(),
  produto: i.produto || i['Produto'] || '',
  local: String(i.local || i['Local'] || '').split(' - ')[0].trim(),
  usuario: String(i.usuario || '').trim(),
  setor: getSetorDetalhe(i)
})
const estoqueZero = computed(() => (auditoria.value?.analise?.itensComEstoqueZeroDetalhes || []).map(detalhe))
const localErrado = computed(() => (props.itensLidoNaoPertence || []).map(detalhe))
const grandeEstoque = computed(() => itensAuditoria.value.filter(i => !i.lido && i.estoque > 100))
const rupturaMenorCusto = computed(() => itensAuditoria.value.filter(i => !i.lido && i.custo > 0 && i.custo <= 50))

// --- Colunas ---
const real = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const COR_STATUS = { Lido: 'bg-emerald-100 text-emerald-800', Pendente: 'bg-orange-100 text-orange-800', 'Lido não pertence': 'bg-amber-100 text-amber-800' }
const C = {
  codigo: { chave: 'codigo', titulo: 'Código', tipo: 'texto' },
  produto: { chave: 'produto', titulo: 'Produto', tipo: 'texto', largura: 'max-w-72' },
  setor: { chave: 'setor', titulo: 'Setor', tipo: 'categoria', rapido: true },
  local: { chave: 'local', titulo: 'Local', tipo: 'categoria', rapido: true },
  usuario: { chave: 'usuario', titulo: 'Usuário', tipo: 'categoria', rapido: true },
  fornecedor: { chave: 'fornecedor', titulo: 'Fornecedor', tipo: 'categoria', rapido: true },
  estoque: { chave: 'estoque', titulo: 'Estoque', tipo: 'numero' },
  custo: { chave: 'custo', titulo: 'Custo ruptura', tipo: 'numero', formato: real },
  diasSemVenda: { chave: 'diasSemVenda', titulo: 'Dias sem venda', tipo: 'numero' },
  status: { chave: 'status', titulo: 'Status', tipo: 'categoria', rapido: true, badge: v => COR_STATUS[v] || 'bg-slate-100 text-slate-600' },
  situacao: { chave: 'situacao', titulo: 'Situação na planilha', tipo: 'categoria', oculta: true },
  classe: { chave: 'classe', titulo: 'Classe', tipo: 'categoria', oculta: true }
}
const colunasItens = [C.codigo, C.produto, C.setor, { ...C.fornecedor }, { ...C.local, rapido: false }, { ...C.usuario, rapido: false }, C.estoque, C.diasSemVenda, C.status, { ...C.custo, oculta: true }, C.situacao, C.classe]
const colunasDetalhe = [C.codigo, C.produto, C.setor, C.local, C.usuario]
const colunasGrandeEstoque = [C.codigo, C.produto, C.setor, { ...C.fornecedor, rapido: false }, C.local, C.estoque, C.diasSemVenda]
const colunasRuptura = [C.codigo, C.produto, C.setor, C.fornecedor, { ...C.local, rapido: false }, C.estoque, C.custo]
const atalhosItens = [
  { rotulo: 'Pendentes', icone: 'fas fa-hourglass-half', condicoes: [{ chave: 'status', op: 'em', valor: ['Pendente'] }] },
  { rotulo: 'Pendentes com estoque', icone: 'fas fa-boxes-stacked', condicoes: [{ chave: 'status', op: 'em', valor: ['Pendente'] }, { chave: 'estoque', op: 'maior', valor: '0' }] },
  { rotulo: 'Lido não pertence', icone: 'fas fa-map-marker-alt', condicoes: [{ chave: 'status', op: 'em', valor: ['Lido não pertence'] }] },
  { rotulo: 'Com ruptura', icone: 'fas fa-coins', condicoes: [{ chave: 'custo', op: 'maior', valor: '0' }] }
]
const id = computed(() => auditoria.value?.id ?? 'atual')
</script>

<template>
  <div class="space-y-8">
    <!-- Mapa de Setores e Corredores -->
    <div>
      <h2 class="text-2xl font-bold text-gray-800 mb-6">
        <i class="fas fa-map text-blue-600 mr-2"></i>Mapa de Setores e Corredores
      </h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <div
          v-for="(setor, nome) in mapaSeteores"
          :key="nome"
          @click="abrirModalSetorLocal('setor', [setor])"
          class="group bg-white rounded-xl p-5 cursor-pointer transition-all duration-200 border border-gray-100 hover:border-gray-200"
        >
          <!-- Nome e seta -->
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-semibold text-gray-800 text-[15px] truncate mr-2">{{ setor.nome }}</h3>
            <i class="fas fa-chevron-right text-xs text-gray-300 group-hover:text-blue-700" aria-hidden="true"></i>
          </div>

          <!-- Progresso circular + métricas -->
          <div class="flex items-center gap-4">
            <!-- Círculo de progresso -->
            <div class="relative flex-shrink-0">
              <svg class="w-16 h-16 -rotate-90" viewBox="0 0 60 60">
                <circle cx="30" cy="30" r="25" fill="none" stroke="#f1f5f9" stroke-width="5"/>
                <circle
                  cx="30" cy="30" r="25" fill="none" stroke-width="5" stroke-linecap="round"
                  :stroke="setor.percentualConclusao >= 75 ? '#10b981' : setor.percentualConclusao >= 50 ? '#f59e0b' : '#ef4444'"
                  :stroke-dasharray="157"
                  :stroke-dashoffset="157 - (157 * setor.percentualConclusao / 100)"
                />
              </svg>
              <div class="absolute inset-0 flex items-center justify-center">
                <span class="text-sm font-bold text-gray-700">{{ setor.percentualConclusao }}%</span>
              </div>
            </div>

            <!-- Números -->
            <div class="flex-1 space-y-1.5 min-w-0">
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-400">Total</span>
                <span class="text-sm font-semibold text-gray-700">{{ setor.total }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-emerald-500">Lidos</span>
                <span class="text-sm font-semibold text-emerald-600">{{ setor.lidos }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-orange-400">Pendentes</span>
                <span class="text-sm font-semibold text-orange-500">{{ setor.pendentes }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <section class="space-y-6">
      <div class="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-3">
        <div><h2 class="text-sm font-bold text-slate-800"><i class="fas fa-list mr-2 text-slate-400"></i>Itens da auditoria</h2><p class="text-xs text-slate-500">Todos os itens, com filtros por fornecedor, setor, status, estoque e mais.</p></div>
        <UiTabela :id="`auditoria-${id}-itens`" titulo="Itens da auditoria" :itens="itensAuditoria" :colunas="colunasItens" :atalhos="atalhosItens" :ordem-inicial="{ chave: 'codigo', direcao: 'asc' }" :chave-item="i => i.codigo + i.local + i.status" />
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-3">
        <div><h2 class="text-sm font-bold text-slate-800"><i class="fas fa-exclamation-triangle mr-2 text-slate-400"></i>Lidos com estoque zero</h2><p class="text-xs text-slate-500">Lidos na gôndola com estoque zerado no sistema.</p></div>
        <UiTabela :id="`auditoria-${id}-estoque-zero`" titulo="Lidos com estoque zero" :itens="estoqueZero" :colunas="colunasDetalhe" :ordem-inicial="{ chave: 'codigo', direcao: 'asc' }" :tamanho-pagina="10" vazio="Nenhum item lido com estoque zero." />
      </div>

      <div v-if="localErrado.length" class="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-3">
        <div><h2 class="text-sm font-bold text-slate-800"><i class="fas fa-map-marker-alt mr-2 text-slate-400"></i>Lido no local errado</h2><p class="text-xs text-slate-500">Achados num local diferente do vinculado.</p></div>
        <UiTabela :id="`auditoria-${id}-local-errado`" titulo="Lido no local errado" :itens="localErrado" :colunas="colunasDetalhe" :ordem-inicial="{ chave: 'codigo', direcao: 'asc' }" :tamanho-pagina="10" />
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-3">
        <div><h2 class="text-sm font-bold text-slate-800"><i class="fas fa-boxes mr-2 text-slate-400"></i>Grande estoque não lido</h2><p class="text-xs text-slate-500">Mais de 100 unidades no sistema e sem leitura.</p></div>
        <UiTabela :id="`auditoria-${id}-grande-estoque`" titulo="Grande estoque não lido" :itens="grandeEstoque" :colunas="colunasGrandeEstoque" :ordem-inicial="{ chave: 'estoque', direcao: 'desc' }" :tamanho-pagina="10" vazio="Nenhum item com grande estoque sem leitura." />
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-3">
        <div><h2 class="text-sm font-bold text-slate-800"><i class="fas fa-coins mr-2 text-slate-400"></i>Ruptura de menor custo</h2><p class="text-xs text-slate-500">Não lidos com custo de ruptura de até R$ 50,00.</p></div>
        <UiTabela :id="`auditoria-${id}-ruptura`" titulo="Ruptura de menor custo" :itens="rupturaMenorCusto" :colunas="colunasRuptura" :ordem-inicial="{ chave: 'custo', direcao: 'desc' }" :tamanho-pagina="10" vazio="Nenhum item com custo de ruptura." />
      </div>
    </section>
  </div>
</template>
