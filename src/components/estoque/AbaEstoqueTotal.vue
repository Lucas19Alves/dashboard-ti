<script setup>
import { computed, ref } from 'vue'
import { useAnaliseEstoque } from '../../composables/useAnaliseEstoque'
import { useEstoqueTotalStore } from '../../stores/estoqueTotalStore'
import { useAuditoriasStore } from '../../stores/auditoriasStore'
import { SITUACAO_ITEM, formatarQuantidade } from '../../utils/estoqueTotal'
import { TIPOS_PROBLEMA } from '../../utils/estoque'
import UiButton from '../ui/UiButton.vue'
import UiAcoes from '../ui/UiAcoes.vue'
import { GRUPOS, temCabecalhoDeAba, usarAcoesDaAba } from '../../composables/useAcoes'
import UiEmptyState from '../ui/UiEmptyState.vue'
import UiTabela from '../ui/UiTabela.vue'

// Todos os itens da planilha de estoque total, cada um com o que o sistema sabe dele:
// local e leitura (auditorias), validade (validades) e os problemas das outras abas.
const emit = defineEmits(['abrir', 'importar'])
const store = useEstoqueTotalStore()
const toast = (m, t) => useAuditoriasStore().addToast(m, t)
const { itensEstoque, problemasPorCodigo, infoEstoqueTotal, indice } = useAnaliseEstoque()

const br = iso => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—')
const int = v => (Number(v) || 0).toLocaleString('pt-BR')
const dataHora = iso => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '')
const diasDesde = iso => (iso ? Math.floor((Date.now() - Date.parse(iso)) / 86400000) : null)
const antiga = computed(() => (diasDesde(infoEstoqueTotal.value?.importadoEm) ?? 0) >= 2)

// --- Resumo (cada cartão filtra a lista) ---
// "Saiu" e "sem local" contam só com estoque, como nas listas de reincidência e sem local.
const casaSituacao = (i, s) => i.situacao === s && (!['saiu', 'nuncaLido', 'aguardando', 'naoVinculado'].includes(s) || i.estoque > 0)
const contagem = computed(() => {
  const c = { total: 0, lido: 0, pendente: 0, saiu: 0, nuncaLido: 0, aguardando: 0, naoVinculado: 0, insumo: 0, problema: 0 }
  for (const i of itensEstoque.value) {
    c.total++
    if (i.situacao in c && casaSituacao(i, i.situacao)) c[i.situacao]++
    if (problemasPorCodigo.value.has(i.codigo)) c.problema++
  }
  return c
})
const pct = v => (contagem.value.total ? `${Math.round((v / contagem.value.total) * 100)}%` : '')
const cartoes = computed(() => [
  { chave: '', rotulo: 'Itens na planilha', valor: contagem.value.total, nota: `estoque total da loja, ${int(contagem.value.insumo)} insumos` },
  { chave: 'lido', rotulo: 'Lidos na auditoria', valor: contagem.value.lido, nota: `${pct(contagem.value.lido)} achados na gôndola` },
  { chave: 'pendente', rotulo: 'Não lidos', valor: contagem.value.pendente, nota: 'com estoque e sem leitura na última' },
  { chave: 'saiu', rotulo: 'Saíram da auditoria', valor: contagem.value.saiu, nota: 'já auditados, fora da última Presença' },
  { chave: 'nuncaLido', rotulo: 'Nunca lidos', valor: contagem.value.nuncaLido, nota: `${int(contagem.value.aguardando)} chegaram depois da última auditoria, ${int(contagem.value.naoVinculado)} não vinculados (sem local)` },
  { chave: 'problema', rotulo: 'Com problema', valor: contagem.value.problema, nota: 'aparecem em alguma lista' }
])

// --- Linhas: cada item com a situação e os problemas em texto (para filtrar e ordenar) ---
const problemas = i => problemasPorCodigo.value.get(i.codigo) || []
const linhas = computed(() => itensEstoque.value.map((i) => {
  const p = problemas(i)
  return {
    ...i,
    situacaoTxt: SITUACAO_ITEM[i.situacao],
    problemaTxt: p.map(x => TIPOS_PROBLEMA[x.tipo].rotulo).join(', ') || 'Nenhum',
    comProblema: p.length > 0,
    oQueFazer: p.map(x => x.diagnostico).join(' | ')
  }
}))
const COLUNAS = [
  { chave: 'codigo', titulo: 'Código', tipo: 'texto' },
  { chave: 'produto', titulo: 'Produto', tipo: 'texto' },
  { chave: 'setor', titulo: 'Setor', tipo: 'categoria', rapido: true },
  { chave: 'local', titulo: 'Local', tipo: 'categoria', rapido: true, valor: i => i.local || (i.situacao === 'naoVinculado' ? 'Sem local (não vinculado)' : i.situacao === 'insumo' ? '' : 'Local não identificado') },
  { chave: 'situacaoTxt', titulo: 'Situação na auditoria', tipo: 'categoria', rapido: true },
  { chave: 'problemaTxt', titulo: 'Problemas', tipo: 'categoria' },
  { chave: 'fornecedor', titulo: 'Fornecedor', tipo: 'categoria' },
  { chave: 'classe', titulo: 'Classe', tipo: 'categoria', oculta: true },
  { chave: 'estoque', titulo: 'Estoque', tipo: 'numero', formato: (v, i) => formatarQuantidade(v, i.unidade) },
  { chave: 'indisponivel', titulo: 'Indisponível', tipo: 'numero', oculta: true },
  { chave: 'diasSemVenda', titulo: 'Dias sem venda', tipo: 'numero' },
  { chave: 'ultimaVenda', titulo: 'Última venda', tipo: 'data' },
  { chave: 'ultimaCompra', titulo: 'Última compra', tipo: 'data' },
  { chave: 'ranking', titulo: 'Ranking de vendas', tipo: 'numero' },
  { chave: 'ultimaLeitura', titulo: 'Última leitura', tipo: 'data' },
  { chave: 'validade', titulo: 'Validade', tipo: 'data' },
  { chave: 'venceEm', titulo: 'Dias p/ vencer', tipo: 'numero' },
  { chave: 'gerenciado', titulo: 'Gerenciado', tipo: 'booleano' },
  { chave: 'pesoVariavel', titulo: 'Peso variável', tipo: 'booleano', oculta: true },
  { chave: 'comProblema', titulo: 'Com problema', tipo: 'booleano', oculta: true },
  { chave: 'oQueFazer', titulo: 'O que fazer', tipo: 'texto', ordenavel: false }
]
const ATALHOS = [
  { rotulo: 'Com problema', icone: 'fas fa-triangle-exclamation', condicoes: [{ chave: 'comProblema', op: 'sim' }] },
  { rotulo: 'Vende (≤ 7 dias)', icone: 'fas fa-cart-shopping', condicoes: [{ chave: 'diasSemVenda', op: 'menorIgual', valor: '7' }] },
  { rotulo: 'Sem venda 30+ dias', icone: 'fas fa-hourglass-half', condicoes: [{ chave: 'diasSemVenda', op: 'maiorIgual', valor: '30' }] },
  { rotulo: 'Vence em 30 dias', icone: 'fas fa-calendar-xmark', condicoes: [{ chave: 'venceEm', op: 'menorIgual', valor: '30' }] },
  { rotulo: 'Comprado nos últimos 7 dias', icone: 'fas fa-truck', condicoes: [{ chave: 'ultimaCompra', op: 'ultimos', valor: '7' }] }
]
// Cartões do resumo filtram a tabela pela situação (ou pelos itens com problema).
const tabela = ref(null)
const filtrarCartao = (c) => {
  if (!c.chave) return tabela.value?.limparTudo()
  tabela.value?.aplicarCondicoes(c.chave === 'problema' ? [{ chave: 'comProblema', op: 'sim' }] : [{ chave: 'situacaoTxt', op: 'em', valor: [SITUACAO_ITEM[c.chave]] }])
}

// --- Texto de cada linha ---
const COR_SITUACAO = { lido: 'text-emerald-700', pendente: 'text-red-700', lidoSemEstoque: 'text-amber-700', semEstoque: 'text-slate-500', saiu: 'text-red-700', nuncaLido: 'text-red-700', aguardando: 'text-slate-500', naoVinculado: 'text-blue-700', insumo: 'text-slate-500' }
const textoValidade = i => (!i.validade ? '' : i.venceEm !== null && i.venceEm < 0 ? `vencido em ${br(i.validade)}` : `vence em ${br(i.validade)}${i.venceEm !== null ? ` (${i.venceEm} d)` : ''}`)

// --- Ações ---
const apagar = async () => {
  if (!confirm('Apagar a planilha de estoque total? As análises voltam a usar só as auditorias.')) return
  await store.limpar()
  toast('Planilha de estoque total apagada.', 'info')
}
// No cabeçalho da página Estoque fica "Atualizar estoque total"; aqui só o que é desta aba.
const noCabecalho = temCabecalhoDeAba()
const acoes = computed(() => (store.itens.length ? [
  { id: 'et-atualizar', rotulo: 'Atualizar planilha', icone: 'fas fa-rotate', grupo: GRUPOS.dados, oculta: noCabecalho, executar: () => emit('importar') },
  { id: 'et-apagar', rotulo: 'Apagar planilha de estoque total', icone: 'fas fa-trash-alt', perigo: true, executar: apagar }
] : []))
usarAcoesDaAba(() => acoes.value)
</script>

<template>
  <section class="space-y-4">
    <UiEmptyState v-if="!store.itens.length" title="Nenhuma planilha de estoque total" description="Importe o relatório de produtos com estoque do sistema. Cada item é cruzado com as auditorias (local, leituras), as validades e os não vinculados, e as listas de reincidência, zerados e parados passam a usar o estoque dela." icon="fas fa-warehouse">
      <template #actions><UiButton @click="emit('importar')"><i class="fas fa-file-upload"></i>Importar estoque total</UiButton></template>
    </UiEmptyState>

    <template v-else>
      <div class="flex flex-wrap items-center gap-2">
        <p class="mr-auto text-sm text-slate-600">
          <i class="fas fa-file-excel mr-1 text-green-600"></i><b class="text-slate-900">{{ infoEstoqueTotal?.arquivo || 'Planilha' }}</b>, importada em {{ dataHora(infoEstoqueTotal?.importadoEm) }}
          <span v-if="!indice.auditorias" class="ml-1 text-amber-700">· sem auditorias para cruzar</span>
        </p>
        <UiAcoes v-if="!noCabecalho" :acoes="acoes" contexto="Estoque da loja" tamanho="sm" />
      </div>
      <p v-if="antiga" class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        A planilha é de {{ diasDesde(infoEstoqueTotal?.importadoEm) }} dias atrás. Importe a de hoje para o estoque e os dias sem venda baterem com o sistema.
      </p>

      <section class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label="Cobertura">
        <button v-for="c in cartoes" :key="c.rotulo" type="button" class="ui-card ui-card-hover p-4 text-left" :title="c.chave ? 'Filtrar a lista' : 'Mostrar todos'" @click="filtrarCartao(c)">
          <span class="block text-[13px] font-semibold text-slate-600">{{ c.rotulo }}</span>
          <span class="mt-2 block text-[1.75rem] font-semibold leading-none tabular-nums text-slate-900">{{ int(c.valor) }}</span>
          <span class="mt-2 block text-xs leading-relaxed text-slate-500">{{ c.nota }}</span>
        </button>
      </section>

      <UiTabela ref="tabela" id="estoque-total" modo="lista" titulo="Estoque da loja" :itens="linhas" :colunas="COLUNAS" :atalhos="ATALHOS" :ordem-inicial="{ chave: 'estoque', direcao: 'desc' }" chave-item="codigo" placeholder="Buscar código, produto, local, fornecedor ou classe...">
        <template #item="{ item: i }">
          <div class="grid gap-x-4 gap-y-1.5 px-4 py-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.2fr)] lg:items-center">
            <div class="min-w-0">
              <button type="button" class="block max-w-full truncate text-left font-semibold text-slate-900 hover:text-blue-700 hover:underline" :title="`Ver tudo sobre ${i.produto}`" @click="emit('abrir', i.codigo)">{{ i.produto }}</button>
              <p class="truncate text-xs text-slate-500">{{ i.codigo }}, {{ i.setor }}<template v-if="i.fornecedor">, {{ i.fornecedor }}</template></p>
            </div>
            <div class="text-sm">
              <p><b class="tabular-nums text-slate-900">{{ formatarQuantidade(i.estoque, i.unidade) }}</b> <span class="text-xs text-slate-500">em estoque</span></p>
              <p class="text-xs text-slate-500">{{ i.diasSemVenda === null ? 'sem venda registrada' : i.diasSemVenda <= 1 ? 'vendeu ontem ou hoje' : `sem venda há ${i.diasSemVenda} d` }}</p>
            </div>
            <div class="min-w-0 text-sm">
              <p class="truncate"><b v-if="i.local" class="text-slate-900">{{ i.local }}</b><b v-else class="italic text-slate-600" :title="i.situacao === 'naoVinculado' ? 'Sem local vinculado no sistema' : 'Tem local no sistema, mas ele não aparece nas auditorias nem nas validades'">{{ i.situacao === 'naoVinculado' ? 'Sem local (não vinculado)' : 'Local não identificado' }}</b> <span class="text-xs font-medium" :class="COR_SITUACAO[i.situacao]">{{ i.situacaoTxt }}</span></p>
              <p class="text-xs text-slate-500">{{ i.ultimaLeitura ? `lido em ${br(i.ultimaLeitura)}` : i.ultimaData ? 'nunca lido' : i.situacao === 'insumo' ? 'insumo, não entra na auditoria' : i.situacao === 'aguardando' ? `comprado em ${br(i.ultimaCompra)}, ainda sem auditoria` : 'nunca auditado' }}<template v-if="textoValidade(i)">, <span :class="i.venceEm !== null && i.venceEm <= 3 ? 'font-semibold text-red-700' : ''">{{ textoValidade(i) }}</span></template></p>
            </div>
            <div class="flex flex-wrap gap-1.5">
              <button v-for="p in problemas(i)" :key="p.tipo" type="button" class="ui-badge border-amber-200 bg-amber-50 text-[11px] text-amber-800 hover:bg-amber-100" :title="p.diagnostico" @click="emit('abrir', i.codigo)"><i :class="[TIPOS_PROBLEMA[p.tipo].icone, 'mr-1']"></i>{{ TIPOS_PROBLEMA[p.tipo].curto }}</button>
              <span v-if="!problemas(i).length" class="text-xs text-slate-400">Sem problemas</span>
            </div>
          </div>
        </template>
      </UiTabela>
    </template>
  </section>
</template>
