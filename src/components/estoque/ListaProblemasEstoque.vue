<script setup>
import { computed } from 'vue'
import { TIPOS_PROBLEMA } from '../../utils/estoque'
import { formatarQuantidade } from '../../utils/estoqueTotal'
import UiTabela from '../ui/UiTabela.vue'

// Lista de problemas de estoque (reincidências, zerados, parados, sem local) na tabela padrão:
// busca, filtros por qualquer coluna, ordenação, agrupamento, paginação, CSV e relatório.
// `filtrosIniciais` vem de fora (clicar num local em "Onde agir" filtra as listas).
// `compacto`: só as primeiras linhas, sem barra de filtros (Visão geral, Início).
const props = defineProps({
  linhas: { type: Array, required: true },
  filtrosIniciais: { type: Array, default: () => [] },
  compacto: { type: Boolean, default: false },
  limite: { type: Number, default: 0 },
  id: { type: String, default: 'estoque' },
  titulo: { type: String, default: 'Itens' },
  vazio: { type: String, default: 'Nenhum item.' }
})
const emit = defineEmits(['abrir'])

// --- Texto de cada linha ---
const br = iso => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—')
const real = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const destaque = l => ({
  reincidencia: l.saiuDaAuditoria ? `Saiu da auditoria, ${l.dias} dias sem leitura` : `${l.dias} dias sem leitura`,
  semEstoque: l.vezes > 1 ? `Zerado em ${l.vezes} auditorias` : 'Zerado na última',
  parado: `${l.dias} dias sem venda`,
  semLocal: l.sugerido ? `Sem local, sugerido ${l.sugerido}` : 'Sem local, sem sugestão'
})[l.tipo]
const qtd = l => formatarQuantidade(l.estoque, l.unidade)
const detalhe = (l) => {
  const partes = [`${qtd(l)} em estoque`]
  if (l.tipo === 'reincidencia') {
    partes.push(l.nuncaLido ? 'nunca lido' : `lido pela última vez em ${br(l.ultimaLeitura)}`, l.saiuDaAuditoria ? `fora da auditoria desde ${br(l.ultimaData)}` : `${l.auditoriasSemLeitura} auditorias seguidas`)
    if (l.diasSemVenda !== null) partes.push(`sem venda há ${l.diasSemVenda} d`)
    if (l.custoAcumulado) partes.push(`${real(l.custoAcumulado)} em ruptura`)
  } else if (l.tipo === 'semEstoque') {
    partes[0] = `desde ${br(l.desde)}`
    if (l.diasSemVenda !== null) partes.push(`sem venda há ${l.diasSemVenda} d`)
  } else if (l.tipo === 'semLocal') {
    partes.push(l.diasSemVenda === null ? 'sem venda registrada' : `sem venda há ${l.diasSemVenda} d`, 'nunca auditado')
    if (l.naLista) partes.push('na planilha de não vinculados')
  } else {
    if (l.validade) partes.push(l.venceEm < 0 ? `vencido em ${br(l.validade)}` : `vence em ${br(l.validade)}`)
    if (l.naoAchado) partes.push('não achado na última auditoria')
    if (l.semLocal) partes.push('sem local')
    if (l.saiu) partes.push('saiu da auditoria')
  }
  return partes.join(', ')
}
const corGravidade = g => (g >= 6 ? 'bg-red-600' : g >= 4 ? 'bg-amber-500' : 'bg-slate-300')
const nivel = g => (g >= 6 ? 'Alta' : g >= 4 ? 'Média' : 'Baixa')

// Colunas: as que aparecem no CSV/relatório e as que só servem para filtrar e ordenar (ocultas).
// Só entram colunas que têm valor em alguma linha desta lista.
const TODAS = [
  { chave: 'codigo', titulo: 'Código', tipo: 'texto' },
  { chave: 'produto', titulo: 'Produto', tipo: 'texto' },
  { chave: 'tipo', titulo: 'Problema', tipo: 'categoria', valor: l => TIPOS_PROBLEMA[l.tipo]?.rotulo, so: 'misto' },
  { chave: 'local', titulo: 'Local', tipo: 'categoria', rapido: true, valor: l => l.local || l.sugerido || '' },
  { chave: 'setor', titulo: 'Setor', tipo: 'categoria', rapido: true },
  { chave: 'fornecedor', titulo: 'Fornecedor', tipo: 'categoria', rapido: true },
  { chave: 'estoque', titulo: 'Estoque', tipo: 'numero', formato: (v, l) => qtd(l) },
  { chave: 'destaque', titulo: 'Situação', tipo: 'texto', valor: destaque, ordenavel: false },
  { chave: 'diagnostico', titulo: 'O que fazer', tipo: 'texto', ordenavel: false },
  { chave: 'gravidade', titulo: 'Prioridade', tipo: 'numero', formato: nivel, oculta: true },
  { chave: 'dias', titulo: 'Dias', tipo: 'numero', oculta: true },
  { chave: 'diasSemVenda', titulo: 'Dias sem venda', tipo: 'numero', oculta: true },
  { chave: 'ultimaVenda', titulo: 'Última venda', tipo: 'data', oculta: true },
  { chave: 'ultimaLeitura', titulo: 'Última leitura', tipo: 'data', oculta: true },
  { chave: 'auditoriasSemLeitura', titulo: 'Auditorias sem leitura', tipo: 'numero', oculta: true },
  { chave: 'custoAcumulado', titulo: 'Ruptura acumulada (R$)', tipo: 'numero', oculta: true },
  { chave: 'saiuDaAuditoria', titulo: 'Saiu da auditoria', tipo: 'booleano', valor: l => Boolean(l.saiuDaAuditoria), so: 'reincidencia' },
  { chave: 'nuncaLido', titulo: 'Nunca lido', tipo: 'booleano', valor: l => Boolean(l.nuncaLido), so: 'reincidencia' },
  { chave: 'achadoEm', titulo: 'Achado em outro local', tipo: 'categoria', oculta: true },
  { chave: 'vezes', titulo: 'Auditorias zerado', tipo: 'numero', oculta: true },
  { chave: 'validade', titulo: 'Validade', tipo: 'data', oculta: true },
  { chave: 'venceEm', titulo: 'Dias p/ vencer', tipo: 'numero', oculta: true },
  { chave: 'naoAchado', titulo: 'Não achado na gôndola', tipo: 'booleano', valor: l => Boolean(l.naoAchado), so: 'parado' },
  { chave: 'sugerido', titulo: 'Local sugerido', tipo: 'categoria', oculta: true },
  { chave: 'naLista', titulo: 'Na planilha de não vinculados', tipo: 'booleano', valor: l => Boolean(l.naLista), so: 'semLocal' }
]
const colunas = computed(() => {
  const tiposNaLista = new Set(props.linhas.map(l => l.tipo))
  return TODAS.filter((c) => {
    if (c.so === 'misto') return tiposNaLista.size > 1
    if (c.so) return tiposNaLista.has(c.so)
    if (!c.oculta || c.valor) return true
    return props.linhas.some(l => l[c.chave] !== undefined && l[c.chave] !== null && l[c.chave] !== '')
  }).map(({ so, ...c }) => ({ ...c, oculta: c.oculta || c.tipo === 'booleano' }))
})
const atalhos = computed(() => {
  const lista = [{ rotulo: 'Prioridade alta', icone: 'fas fa-circle-exclamation', condicoes: [{ chave: 'gravidade', op: 'maiorIgual', valor: '6' }] }]
  if (props.linhas.some(l => l.diasSemVenda !== null && l.diasSemVenda !== undefined)) lista.push({ rotulo: 'Vende (≤ 7 dias)', icone: 'fas fa-cart-shopping', condicoes: [{ chave: 'diasSemVenda', op: 'menorIgual', valor: '7' }] })
  if (props.linhas.some(l => l.saiuDaAuditoria)) lista.push({ rotulo: 'Saíram da auditoria', icone: 'fas fa-eye-slash', condicoes: [{ chave: 'saiuDaAuditoria', op: 'sim' }] })
  if (props.linhas.some(l => l.validade)) lista.push({ rotulo: 'Vence em 30 dias', icone: 'fas fa-calendar-xmark', condicoes: [{ chave: 'venceEm', op: 'menorIgual', valor: '30' }] })
  if (props.linhas.some(l => l.custoAcumulado > 0)) lista.push({ rotulo: 'Com ruptura', icone: 'fas fa-sack-dollar', condicoes: [{ chave: 'custoAcumulado', op: 'maior', valor: '0' }] })
  return lista
})
const compactas = computed(() => (props.limite ? props.linhas.slice(0, props.limite) : props.linhas))
</script>

<template>
  <!-- Compacto: só as primeiras linhas, sem filtros -->
  <div v-if="compacto">
    <p v-if="!compactas.length" class="ui-card px-4 py-10 text-center text-sm text-slate-500">{{ vazio }}</p>
    <ul v-else class="ui-card divide-y divide-slate-100">
      <li v-for="l in compactas" :key="l.tipo + l.codigo" class="grid gap-x-4 gap-y-1.5 px-4 py-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.4fr)] lg:items-center">
        <div class="flex min-w-0 items-start gap-2.5">
          <span class="mt-1.5 size-2 shrink-0 rounded-full" :class="corGravidade(l.gravidade)" :title="`Prioridade ${nivel(l.gravidade).toLowerCase()}`"></span>
          <div class="min-w-0">
            <button type="button" class="block max-w-full truncate text-left font-semibold text-slate-900 hover:text-blue-700 hover:underline" @click="emit('abrir', l.codigo)">{{ l.produto }}</button>
            <p class="truncate text-xs text-slate-500">{{ l.codigo }}<template v-if="l.local">, <b class="font-semibold text-slate-700">{{ l.local }}</b></template><template v-else-if="l.sugerido">, sugerido <b class="font-semibold text-slate-700">{{ l.sugerido }}</b></template>, {{ l.setor }}</p>
          </div>
        </div>
        <div class="min-w-0 text-sm">
          <p class="font-semibold text-slate-800"><span class="mr-1 text-xs font-medium text-slate-500">{{ TIPOS_PROBLEMA[l.tipo].curto }} ·</span>{{ destaque(l) }}</p>
          <p class="text-xs text-slate-500">{{ detalhe(l) }}</p>
        </div>
        <p class="text-sm leading-snug text-slate-700">{{ l.diagnostico }}</p>
      </li>
    </ul>
  </div>

  <UiTabela
    v-else
    :id="id"
    modo="lista"
    :titulo="titulo"
    :itens="linhas"
    :colunas="colunas"
    :atalhos="atalhos"
    :filtros-iniciais="filtrosIniciais"
    :ordem-inicial="[{ chave: 'gravidade', direcao: 'desc' }, { chave: 'dias', direcao: 'desc' }]"
    :chave-item="l => l.tipo + l.codigo"
    :vazio="vazio"
    placeholder="Buscar código, produto, local, fornecedor ou diagnóstico..."
  >
    <template #item="{ item: l }">
      <div class="grid gap-x-4 gap-y-1.5 px-4 py-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.4fr)] lg:items-center">
        <div class="flex min-w-0 items-start gap-2.5">
          <span class="mt-1.5 size-2 shrink-0 rounded-full" :class="corGravidade(l.gravidade)" :title="`Prioridade ${nivel(l.gravidade).toLowerCase()}`"></span>
          <div class="min-w-0">
            <button type="button" class="block max-w-full truncate text-left font-semibold text-slate-900 hover:text-blue-700 hover:underline" :title="`Ver tudo sobre ${l.produto}`" @click="emit('abrir', l.codigo)">{{ l.produto }}</button>
            <p class="truncate text-xs text-slate-500">{{ l.codigo }}<template v-if="l.local">, <b class="font-semibold text-slate-700">{{ l.local }}</b></template><template v-else-if="l.sugerido">, sugerido <b class="font-semibold text-slate-700">{{ l.sugerido }}</b></template>, {{ l.setor }}</p>
          </div>
        </div>
        <div class="min-w-0 text-sm">
          <p class="font-semibold text-slate-800"><span v-if="colunas.some(c => c.chave === 'tipo')" class="mr-1 text-xs font-medium text-slate-500">{{ TIPOS_PROBLEMA[l.tipo].curto }} ·</span>{{ destaque(l) }}</p>
          <p class="text-xs text-slate-500">{{ detalhe(l) }}</p>
        </div>
        <p class="text-sm leading-snug text-slate-700">{{ l.diagnostico }}</p>
      </div>
    </template>
  </UiTabela>
</template>
