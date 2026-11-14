<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAnaliseEstoque } from '../composables/useAnaliseEstoque'
import { useRelatorio } from '../composables/useRelatorio'
import { TIPOS_PROBLEMA, agruparProblemas, buscarItens } from '../utils/estoque'
import { formatarQuantidade } from '../utils/estoqueTotal'
import UiTabela from '../components/ui/UiTabela.vue'
import { blocoBarras, blocoTabela } from '../utils/print'
import UiButton from '../components/ui/UiButton.vue'
import UiEmptyState from '../components/ui/UiEmptyState.vue'
import UiPageHeader from '../components/ui/UiPageHeader.vue'
import UiTabs from '../components/ui/UiTabs.vue'
import ListaProblemasEstoque from '../components/estoque/ListaProblemasEstoque.vue'
import FichaItemEstoque from '../components/estoque/FichaItemEstoque.vue'
import AbaNaoVinculados from '../components/estoque/AbaNaoVinculados.vue'
import AbaEstoqueTotal from '../components/estoque/AbaEstoqueTotal.vue'
import ImportarEstoqueTotal from '../components/estoque/ImportarEstoqueTotal.vue'

const route = useRoute()
const router = useRouter()
const {
  carregando, indice, total, infoEstoqueTotal, reincidentes, semEstoque, parados, nuncaLidos, insumos, zeradosResolvidos,
  naoVinculados, suspeitos, prioridades, problemasPorCodigo, resumo, limiarReincidencia, limiarParado
} = useAnaliseEstoque()
const mostrarImportar = ref(false)

// --- Abas (na URL, para o Início e a busca abrirem direto) ---
const ABAS = ['visao', 'estoque-total', 'reincidencias', 'sem-estoque', 'parados', 'nunca-lidos', 'insumos', 'nao-vinculados', 'onde-agir', 'consultar']
const aba = ref(ABAS.includes(route.query.aba) ? route.query.aba : 'visao')
watch(() => route.query.aba, v => { if (ABAS.includes(v)) aba.value = v })
watch(aba, v => { if (route.query.aba !== v) router.replace({ query: { ...route.query, aba: v } }) })
const abas = computed(() => [
  { value: 'visao', label: 'Visão geral', icon: 'fas fa-gauge' },
  { value: 'estoque-total', label: total.value ? `Estoque da loja (${total.value.size.toLocaleString('pt-BR')})` : 'Estoque da loja', icon: 'fas fa-warehouse' },
  { value: 'reincidencias', label: `Reincidências (${resumo.value.reincidentes})`, icon: TIPOS_PROBLEMA.reincidencia.icone },
  { value: 'sem-estoque', label: `Estoque zerado (${resumo.value.semEstoque})`, icon: TIPOS_PROBLEMA.semEstoque.icone },
  { value: 'parados', label: `Parados (${resumo.value.parados})`, icon: TIPOS_PROBLEMA.parado.icone },
  ...(total.value ? [
    { value: 'nunca-lidos', label: `Nunca lidos (${resumo.value.nuncaLidos})`, icon: TIPOS_PROBLEMA.nuncaLido.icone },
    { value: 'insumos', label: `Insumos (${resumo.value.insumos})`, icon: 'fas fa-box-archive' }
  ] : []),
  { value: 'nao-vinculados', label: `Não vinculados (${resumo.value.naoVinculados})`, icon: 'fas fa-link-slash' },
  { value: 'onde-agir', label: 'Onde agir', icon: 'fas fa-map-location-dot' },
  { value: 'consultar', label: 'Consultar item', icon: 'fas fa-magnifying-glass' }
])

// Filtro vindo de "Onde agir" (local, setor ou fornecedor clicado): vale na próxima lista aberta.
const preFiltro = ref([])
let vindoDeOndeAgir = false
watch(aba, () => { if (vindoDeOndeAgir) vindoDeOndeAgir = false; else preFiltro.value = [] })
const temBase = computed(() => indice.value.auditorias > 0)

// --- Ficha do item ---
const fichaCodigo = ref('')
const problemasDoCodigo = codigo => problemasPorCodigo.value.get(codigo) || []

// --- Visão geral ---
const br = iso => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—')
const int = v => (Number(v) || 0).toLocaleString('pt-BR')
const real = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const dataHora = iso => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '')
const diasPlanilha = computed(() => (infoEstoqueTotal.value?.importadoEm ? Math.floor((Date.now() - Date.parse(infoEstoqueTotal.value.importadoEm)) / 86400000) : null))
const cartoes = computed(() => [
  { aba: 'reincidencias', rotulo: 'Reincidências', valor: resumo.value.reincidentes, nota: `${limiarReincidencia.value}+ dias com estoque sem leitura${resumo.value.saiuDaAuditoria ? `, ${int(resumo.value.saiuDaAuditoria)} saíram da auditoria` : ''}${resumo.value.custoReincidentes ? `, ${real(resumo.value.custoReincidentes)} em estoque não achado` : ''}`, tom: 'bg-red-600' },
  { aba: 'sem-estoque', rotulo: 'Estoque zerado na gôndola', valor: resumo.value.semEstoque, nota: 'lidos com estoque zerado no sistema', tom: 'bg-amber-500' },
  { aba: 'parados', rotulo: 'Estoque parado', valor: resumo.value.parados, nota: `${limiarParado.value}+ dias sem venda com estoque`, tom: 'bg-indigo-500' },
  ...(total.value ? [{ aba: 'nunca-lidos', rotulo: 'Nunca lidos', valor: resumo.value.nuncaLidos, nota: 'com estoque, comprados antes da última Presença e nunca lidos', tom: 'bg-cyan-600' }] : []),
  { aba: 'nao-vinculados', rotulo: 'Não vinculados', valor: resumo.value.naoVinculados, nota: `${suspeitos.value.length} vínculos suspeitos`, tom: 'bg-blue-600' },
])

// --- Insumos (setor Outros): só consulta, fora das listas de problemas ---
const COLUNAS_INSUMOS = [
  { chave: 'codigo', titulo: 'Código', tipo: 'texto' },
  { chave: 'produto', titulo: 'Produto', tipo: 'texto' },
  { chave: 'classe', titulo: 'Classe', tipo: 'categoria', rapido: true },
  { chave: 'fornecedor', titulo: 'Fornecedor', tipo: 'categoria', rapido: true },
  { chave: 'estoque', titulo: 'Estoque', tipo: 'numero', formato: (v, i) => formatarQuantidade(v, i.unidade) },
  { chave: 'indisponivel', titulo: 'Indisponível', tipo: 'numero', formato: (v, i) => (v ? formatarQuantidade(v, i.unidade) : '—') },
  { chave: 'diasSemVenda', titulo: 'Dias sem venda', tipo: 'numero' },
  { chave: 'ultimaVenda', titulo: 'Última venda', tipo: 'data' },
  { chave: 'ultimaCompra', titulo: 'Última compra', tipo: 'data' },
  { chave: 'local', titulo: 'Local', tipo: 'categoria', rapido: true },
  { chave: 'gerenciado', titulo: 'Gerenciado', tipo: 'booleano' },
  { chave: 'ranking', titulo: 'Ranking de vendas', tipo: 'numero', oculta: true }
]
const ATALHOS_INSUMOS = [
  { rotulo: 'Sem venda há 30+ dias', icone: 'fas fa-hourglass-half', condicoes: [{ chave: 'diasSemVenda', op: 'maiorIgual', valor: '30' }] },
  { rotulo: 'Comprados nos últimos 30 dias', icone: 'fas fa-truck', condicoes: [{ chave: 'ultimaCompra', op: 'ultimos', valor: '30' }] }
]

// --- Onde agir (tabela padrão; cada número abre a lista filtrada) ---
const abrirCartao = (c) => {
  aba.value = c.aba
}

// --- Onde agir ---
const campoGrupo = ref('local')
const CAMPOS = [{ valor: 'local', rotulo: 'Local' }, { valor: 'setor', rotulo: 'Setor' }, { valor: 'fornecedor', rotulo: 'Fornecedor' }]
const listasProblemas = () => ({ reincidentes: reincidentes.value, semEstoque: semEstoque.value, parados: parados.value, nuncaLidos: nuncaLidos.value, naoVinculados: naoVinculados.value, suspeitos: suspeitos.value })
const grupos = computed(() => agruparProblemas(listasProblemas(), campoGrupo.value))
const locaisTopo = computed(() => agruparProblemas(listasProblemas(), 'local').slice(0, 8))
const maiorGrupo = computed(() => Math.max(1, ...locaisTopo.value.map(g => g.total)))
const COLUNAS_GRUPO = [
  { chave: 'reincidentes', rotulo: 'Reincidências', aba: 'reincidencias', cor: 'bg-red-500' },
  { chave: 'semEstoque', rotulo: 'Zerados', aba: 'sem-estoque', cor: 'bg-amber-400' },
  { chave: 'parados', rotulo: 'Parados', aba: 'parados', cor: 'bg-indigo-400' },
  { chave: 'nuncaLidos', rotulo: 'Nunca lidos', aba: 'nunca-lidos', cor: 'bg-cyan-500' },
  { chave: 'naoVinculados', rotulo: 'Não vinc.', aba: 'nao-vinculados', cor: 'bg-blue-400' },
  { chave: 'suspeitos', rotulo: 'Suspeitos', aba: 'nao-vinculados', cor: 'bg-slate-400' }
]
const irPara = (campo, chave, destino) => {
  preFiltro.value = destino !== 'nao-vinculados' && chave !== 'Sem local' && chave !== 'Não informado' ? [{ chave: campo, op: 'em', valor: [chave] }] : []
  vindoDeOndeAgir = true
  aba.value = destino
}
const colunasGrupo = computed(() => [
  { chave: 'chave', titulo: CAMPOS.find(c => c.valor === campoGrupo.value).rotulo, tipo: 'texto' },
  ...COLUNAS_GRUPO.filter(c => !(c.chave === 'suspeitos' && campoGrupo.value === 'fornecedor')).map(c => ({ chave: c.chave, titulo: c.rotulo, tipo: 'numero' })),
  { chave: 'custo', titulo: 'Valor em falta', tipo: 'numero', formato: v => (v ? real(v) : '—') },
  { chave: 'total', titulo: 'Total', tipo: 'numero' }
])

// --- Consultar ---
const termo = ref('')
const resultados = computed(() => buscarItens(indice.value, termo.value, 30, total.value))

// --- Relatório geral ---
const { abrir: abrirRelatorio } = useRelatorio()
const COLS = [
  { chave: 'codigo', titulo: 'Código' }, { chave: 'produto', titulo: 'Produto' }, { chave: 'local', titulo: 'Local' },
  { chave: 'estoque', titulo: 'Estoque', alinhamento: 'right' }, { chave: 'situacao', titulo: 'Situação' }, { chave: 'diagnostico', titulo: 'O que fazer' }
]
const linhasRel = (lista, situacao) => lista.map(l => ({ codigo: l.codigo, produto: l.produto, local: l.local || l.sugerido || '—', estoque: formatarQuantidade(l.estoque, l.unidade), situacao: situacao(l), diagnostico: l.diagnostico }))
const relatorioGeral = () => abrirRelatorio({
  id: 'estoque-geral',
  titulo: 'Relatório de estoque',
  subtitulo: `Situação em ${new Date().toLocaleDateString('pt-BR')}`,
  contexto: [
    { rotulo: 'Auditorias de Presença e Ruptura', valor: `${indice.value.auditorias} (${br(indice.value.primeiraData)} a ${br(indice.value.ultimaData)})` },
    ...(total.value ? [{ rotulo: 'Estoque total', valor: `${int(total.value.size)} itens, planilha de ${dataHora(infoEstoqueTotal.value?.importadoEm)}` }] : []),
    { rotulo: 'Reincidência a partir de', valor: `${limiarReincidencia.value} dias` },
    { rotulo: 'Parado a partir de', valor: `${limiarParado.value} dias sem venda` }
  ],
  indicadores: cartoes.value.map(c => ({ rotulo: c.rotulo, valor: int(c.valor), detalhe: c.nota, tom: c.valor ? 'alerta' : 'bom' })),
  assinaturaPadrao: true,
  secoes: [
    { id: 'locais', titulo: 'Locais com mais problemas', descricao: 'Soma de reincidências, zerados, parados, fora das auditorias e não vinculados por local.', padrao: true, gerar: () => blocoBarras({ titulo: 'Problemas por local (até 15)', barras: agruparProblemas({ ...listasProblemas(), suspeitos: [] }, 'local').slice(0, 15).map(g => ({ rotulo: g.chave, valor: g.total })) }) },
    { id: 'reincidencias', titulo: `Reincidências (${reincidentes.value.length})`, descricao: 'Itens com estoque e sem leitura na Presença/Ruptura, incluindo os que saíram da auditoria.', padrao: true, gerar: () => blocoTabela({ colunas: COLS, linhas: linhasRel(reincidentes.value, l => `${l.dias} dias sem leitura${l.saiuDaAuditoria ? ', saiu da auditoria' : ''}`) }) || '<p class="nota">Nenhuma reincidência.</p>' },
    { id: 'zerados', titulo: `Estoque zerado na gôndola (${semEstoque.value.length})`, descricao: 'Lidos com estoque zerado no sistema.', padrao: true, gerar: () => blocoTabela({ colunas: COLS, linhas: linhasRel(semEstoque.value, l => `zerado em ${l.vezes} auditoria(s)`) }) || '<p class="nota">Nenhum item.</p>' },
    { id: 'parados', titulo: `Estoque parado (${parados.value.length})`, descricao: 'Itens com estoque e muitos dias sem venda.', padrao: true, gerar: () => blocoTabela({ colunas: COLS, linhas: linhasRel(parados.value, l => `${l.dias} dias sem venda`) }) || '<p class="nota">Nenhum item.</p>' },
    ...(total.value ? [{ id: 'nunca-lidos', titulo: `Nunca lidos (${nuncaLidos.value.length})`, descricao: 'Itens com estoque, comprados antes da última Presença, que nunca apareceram nas auditorias e não estão na lista de não vinculados. Insumos ficam de fora.', padrao: true, gerar: () => blocoTabela({ colunas: COLS, linhas: linhasRel(nuncaLidos.value, l => (l.diasSemVenda === null ? 'sem venda registrada' : `sem venda há ${l.diasSemVenda} d`)) }) || '<p class="nota">Nenhum item.</p>' }] : [])
  ]
})
</script>

<template>
  <div class="ui-page">
    <UiPageHeader title="Estoque" subtitle="Itens que somem da gôndola, estoque que não bate com o sistema, produtos parados e itens sem local. A planilha de estoque total é a base; auditorias, validades e não vinculados completam cada item.">
      <template #actions>
        <UiButton :variant="total ? 'secondary' : 'primary'" @click="mostrarImportar = true"><i class="fas fa-file-import"></i>{{ total ? 'Atualizar estoque total' : 'Importar estoque total' }}</UiButton>
        <UiButton variant="secondary" :disabled="!temBase" @click="relatorioGeral"><i class="fas fa-file-pdf"></i>Relatório</UiButton>
      </template>
    </UiPageHeader>

    <UiTabs v-model="aba" :items="abas" sticky />

    <!-- Visão geral -->
    <template v-if="aba === 'visao'">
      <div v-if="!total" class="flex flex-wrap items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <i class="fas fa-warehouse text-blue-600"></i>
        <p class="min-w-0 flex-1">Importe a planilha de <b>estoque total</b> da loja: as listas passam a usar o estoque e os dias sem venda dela, entram os itens que não aparecem nas auditorias e somem os que já zeraram.</p>
        <UiButton size="sm" @click="mostrarImportar = true"><i class="fas fa-file-import"></i>Importar</UiButton>
      </div>
      <div v-else-if="diasPlanilha >= 2" class="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <i class="fas fa-clock text-amber-600"></i>
        <p class="min-w-0 flex-1">A planilha de estoque total é de {{ dataHora(infoEstoqueTotal?.importadoEm) }} ({{ diasPlanilha }} dias). Importe a de hoje para o estoque bater com o sistema.</p>
        <UiButton size="sm" variant="secondary" @click="mostrarImportar = true"><i class="fas fa-rotate"></i>Atualizar</UiButton>
      </div>
      <UiEmptyState v-if="carregando && !temBase" title="Carregando os itens das auditorias" description="Leva só um instante. As análises aparecem assim que os itens chegarem." icon="fas fa-spinner fa-spin" />
      <UiEmptyState v-else-if="!temBase" title="Sem auditorias de Presença ou Ruptura" description="As análises de estoque usam as auditorias de Presença e Ruptura. Importe auditorias para ver reincidências, estoque zerado e parados." icon="fas fa-boxes-stacked">
        <template #actions><UiButton to="/auditorias"><i class="fas fa-clipboard-check"></i>Ir para Auditorias</UiButton></template>
      </UiEmptyState>
      <template v-else>
        <section class="grid grid-cols-2 gap-3" :class="cartoes.length > 4 ? 'md:grid-cols-3 xl:grid-cols-5' : 'xl:grid-cols-4'" aria-label="Resumo">
          <button v-for="c in cartoes" :key="c.rotulo" type="button" class="ui-card ui-card-hover p-4 text-left" @click="abrirCartao(c)">
            <span class="flex items-center gap-2"><span class="size-2 rounded-full" :class="c.tom"></span><span class="text-[13px] font-semibold text-slate-600">{{ c.rotulo }}</span></span>
            <span class="mt-2 block text-[2rem] font-semibold leading-none tabular-nums text-slate-900">{{ int(c.valor) }}</span>
            <span class="mt-2 block text-xs leading-relaxed text-slate-500">{{ c.nota }}</span>
          </button>
        </section>

        <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
          <section class="space-y-3">
            <div class="flex items-end justify-between gap-2">
              <div>
                <h2 class="text-lg font-semibold text-slate-900">Mais graves</h2>
                <p class="text-xs text-slate-500">Os itens mais graves de todas as listas: reincidências, estoque zerado, parados{{ total ? ' e sem local' : '' }}.</p>
              </div>
              <span class="text-xs text-slate-500">{{ int(prioridades.length) }} itens</span>
            </div>
            <ListaProblemasEstoque :linhas="prioridades" compacto :limite="10" vazio="Nenhum problema de estoque." @abrir="fichaCodigo = $event" />
          </section>

          <aside class="space-y-6">
            <section class="ui-card p-5">
              <div class="flex items-center justify-between">
                <h2 class="font-semibold text-slate-900">Locais com mais problemas</h2>
                <button type="button" class="text-xs font-semibold text-blue-700 hover:underline" @click="campoGrupo = 'local'; aba = 'onde-agir'">Ver todos</button>
              </div>
              <p v-if="!locaisTopo.length" class="py-6 text-center text-sm text-slate-500">Nenhum problema encontrado.</p>
              <ul v-else class="mt-3 space-y-2.5">
                <li v-for="g in locaisTopo" :key="g.chave">
                  <button type="button" class="block w-full rounded-lg px-2 py-1 text-left hover:bg-slate-50" @click="irPara('local', g.chave, g.reincidentes ? 'reincidencias' : g.semEstoque ? 'sem-estoque' : g.parados ? 'parados' : 'nao-vinculados')">
                    <span class="flex justify-between text-sm"><b class="font-semibold text-slate-900">{{ g.chave }}</b><span class="tabular-nums text-slate-500">{{ g.total }}</span></span>
                    <span class="mt-1 flex h-2 gap-0.5 overflow-hidden rounded-full bg-slate-100">
                      <template v-for="c in COLUNAS_GRUPO" :key="c.chave"><span v-if="g[c.chave]" :class="c.cor" :style="{ width: `${(g[c.chave] / maiorGrupo) * 100}%` }"></span></template>
                    </span>
                  </button>
                </li>
              </ul>
              <p class="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                <span v-for="c in COLUNAS_GRUPO" :key="c.chave" class="inline-flex items-center gap-1"><span class="size-2 rounded-full" :class="c.cor"></span>{{ c.rotulo }}</span>
              </p>
            </section>
            <section class="ui-card p-5 text-sm leading-relaxed text-slate-600">
              <h2 class="font-semibold text-slate-900">Base do cálculo</h2>
              <p v-if="total" class="mt-1"><b class="text-slate-800">Estoque total:</b> {{ int(total.size) }} itens da planilha de {{ dataHora(infoEstoqueTotal?.importadoEm) }}. Só entram os itens dela, com o estoque e os dias sem venda dela.</p>
              <p class="mt-1">{{ indice.auditorias }} auditorias de Presença e Ruptura, de {{ br(indice.primeiraData) }} a {{ br(indice.ultimaData) }}. Leituras e local vêm dos itens que apareceram desde a última Presença ({{ br(indice.inicioCiclo) }}).</p>
              <p class="mt-2">"Lido não pertence" não conta como leitura: o local vinculado continuou vazio.</p>
            </section>
          </aside>
        </div>
      </template>
    </template>

    <!-- Estoque da loja -->
    <AbaEstoqueTotal v-else-if="aba === 'estoque-total'" @abrir="fichaCodigo = $event" @importar="mostrarImportar = true" />

    <!-- Reincidências -->
    <section v-else-if="aba === 'reincidencias'" class="space-y-4">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <p class="max-w-[80ch] text-sm leading-relaxed text-slate-600">Itens com estoque que não são lidos nas auditorias de Presença ou Ruptura há {{ limiarReincidencia }} dias ou mais. Ou o produto não está no local (depósito, outro local), ou o estoque do sistema não existe.<template v-if="total"> Entram também os que têm estoque na planilha e saíram da auditoria (não estão na última Presença), qualquer que seja o tempo sem leitura.</template></p>
        <label><span class="ui-label">Sem leitura há</span>
          <select v-model.number="limiarReincidencia" class="ui-input"><option :value="14">14+ dias</option><option :value="21">21+ dias</option><option :value="30">30+ dias</option><option :value="60">60+ dias</option></select>
        </label>
      </div>
      <ListaProblemasEstoque id="estoque-reincidencias" titulo="Reincidências de estoque" :linhas="reincidentes" :filtros-iniciais="preFiltro" :vazio="carregando ? 'Carregando os itens das auditorias...' : temBase ? 'Nenhum item com estoque sem leitura nesse período.' : 'Importe auditorias de Presença ou Ruptura.'" @abrir="fichaCodigo = $event" />
    </section>

    <!-- Estoque zerado -->
    <section v-else-if="aba === 'sem-estoque'" class="space-y-4">
      <p class="max-w-[80ch] text-sm leading-relaxed text-slate-600">Itens lidos na gôndola na última auditoria, mas com estoque zerado no sistema. Normalmente é nota de entrada não lançada ou ajuste errado: o item some das próximas auditorias e da reposição automática.<template v-if="total"> Continuam fora da planilha de estoque total (zerados).</template></p>
      <p v-if="zeradosResolvidos" class="text-xs text-emerald-700"><i class="fas fa-check mr-1"></i>{{ int(zeradosResolvidos) }} {{ zeradosResolvidos === 1 ? 'item saiu' : 'itens saíram' }} da lista: a planilha de estoque total já mostra estoque (entrada lançada depois da auditoria).</p>
      <ListaProblemasEstoque id="estoque-zerados" titulo="Estoque zerado na gôndola" :linhas="semEstoque" :filtros-iniciais="preFiltro" vazio="Nenhum item lido com estoque zerado." @abrir="fichaCodigo = $event" />
    </section>

    <!-- Parados -->
    <section v-else-if="aba === 'parados'" class="space-y-4">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <p class="max-w-[80ch] text-sm leading-relaxed text-slate-600">Itens com estoque e sem venda há {{ limiarParado }} dias ou mais, cruzados com as validades importadas. Os que vencem logo aparecem primeiro.<template v-if="total"> Com a planilha de estoque total, entram todos os itens da loja, também os que não aparecem nas auditorias.</template></p>
        <label><span class="ui-label">Sem venda há</span>
          <select v-model.number="limiarParado" class="ui-input"><option :value="30">30+ dias</option><option :value="60">60+ dias</option><option :value="90">90+ dias</option></select>
        </label>
      </div>
      <ListaProblemasEstoque id="estoque-parados" titulo="Estoque parado" :linhas="parados" :filtros-iniciais="preFiltro" vazio="Nenhum item parado nesse período." @abrir="fichaCodigo = $event" />
    </section>

    <!-- Nunca lidos -->
    <section v-else-if="aba === 'nunca-lidos'" class="space-y-4">
      <p class="max-w-[80ch] text-sm leading-relaxed text-slate-600">Itens com estoque na planilha que nunca apareceram em nenhuma auditoria de Presença ou Ruptura, embora tenham sido comprados antes da última Presença ({{ br(indice.inicioCiclo) }}). Ficam de fora: os que chegaram depois da última auditoria (ainda não houve como ler), os da lista de não vinculados (aba Não vinculados) e os insumos.</p>
      <ListaProblemasEstoque id="estoque-nunca-lidos" titulo="Nunca lidos" :linhas="nuncaLidos" :filtros-iniciais="preFiltro" :vazio="indice.auditorias ? 'Todos os itens com estoque já apareceram nas auditorias.' : 'Importe auditorias de Presença para cruzar com a planilha.'" @abrir="fichaCodigo = $event" />
    </section>

    <!-- Insumos -->
    <section v-else-if="aba === 'insumos'" class="space-y-4">
      <p class="max-w-[80ch] text-sm leading-relaxed text-slate-600">Itens do setor Outros (sacolas, bobinas, pallets, tabloides, material de uso da loja). Não entram na auditoria e ficam fora das listas de reincidência, parados e sem local. Aqui dá para acompanhar o estoque e o consumo deles.</p>
      <UiTabela id="estoque-insumos" titulo="Insumos" :itens="insumos" :colunas="COLUNAS_INSUMOS" :atalhos="ATALHOS_INSUMOS" :ordem-inicial="{ chave: 'estoque', direcao: 'desc' }" chave-item="codigo" clicavel vazio="Nenhum insumo na planilha de estoque total." @linha="fichaCodigo = $event.codigo" />
    </section>

    <!-- Não vinculados -->
    <AbaNaoVinculados v-else-if="aba === 'nao-vinculados'" />

    <!-- Onde agir -->
    <section v-else-if="aba === 'onde-agir'" class="space-y-4">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <p class="max-w-[80ch] text-sm leading-relaxed text-slate-600">Problemas somados por {{ CAMPOS.find(c => c.valor === campoGrupo).rotulo.toLowerCase() }}. Clique num número para ver os itens.</p>
        <div class="inline-flex rounded-lg border border-slate-200 bg-white p-0.5" role="group">
          <button v-for="c in CAMPOS" :key="c.valor" type="button" class="rounded-md px-3 py-1.5 text-sm font-medium transition" :class="campoGrupo === c.valor ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'" @click="campoGrupo = c.valor">{{ c.rotulo }}</button>
        </div>
      </div>
      <UiTabela :id="`estoque-onde-agir-${campoGrupo}`" :key="campoGrupo" :titulo="`Problemas por ${CAMPOS.find(c => c.valor === campoGrupo).rotulo.toLowerCase()}`" :itens="grupos" :colunas="colunasGrupo" :ordem-inicial="{ chave: 'total', direcao: 'desc' }" chave-item="chave" :agrupavel="false" vazio="Nenhum problema encontrado.">
        <template v-for="c in COLUNAS_GRUPO" :key="c.chave" #[`celula-${c.chave}`]="{ item: g }">
          <button v-if="g[c.chave]" type="button" class="rounded px-1.5 font-semibold text-blue-700 hover:bg-blue-50 hover:underline" @click="irPara(campoGrupo, g.chave, c.aba)">{{ int(g[c.chave]) }}</button>
          <span v-else class="text-slate-300">0</span>
        </template>
      </UiTabela>
    </section>

    <!-- Consultar -->
    <section v-else class="space-y-4">
      <label class="block max-w-xl"><span class="ui-label">Código ou nome do produto</span><input v-model="termo" class="ui-input" placeholder="Ex.: 100245 ou CAFE" autofocus /></label>
      <p v-if="termo.trim().length < 2" class="text-sm text-slate-500">Digite pelo menos 2 caracteres. A ficha mostra o estoque total, o histórico do item em todas as auditorias de Presença e Ruptura, validades e não vinculado.</p>
      <p v-else-if="!resultados.length" class="ui-card px-4 py-10 text-center text-sm text-slate-500">Nenhum item encontrado{{ total ? ' nas auditorias nem na planilha de estoque' : ' nas auditorias' }}.</p>
      <ul v-else class="ui-card divide-y divide-slate-100">
        <li v-for="r in resultados" :key="r.codigo">
          <button type="button" class="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left hover:bg-slate-50" @click="fichaCodigo = r.codigo">
            <span class="min-w-0"><span class="block truncate font-semibold text-slate-900">{{ r.produto }}</span><span class="text-xs text-slate-500">{{ r.codigo }}, {{ r.local || 'sem local' }}, {{ r.setor }}</span></span>
            <span class="flex flex-wrap gap-1.5">
              <span v-for="p in problemasDoCodigo(r.codigo)" :key="p.tipo" class="ui-badge border-amber-200 bg-amber-50 text-[11px] text-amber-800">{{ TIPOS_PROBLEMA[p.tipo].curto }}</span>
              <span class="text-xs text-slate-500">{{ formatarQuantidade(r.estoque, r.unidade) }} em estoque<template v-if="total && !r.noEstoqueTotal"> (na última auditoria; fora da planilha)</template> · última leitura {{ r.ultimaLeitura ? br(r.ultimaLeitura) : 'nunca' }}</span>
            </span>
          </button>
        </li>
      </ul>
    </section>

    <ImportarEstoqueTotal v-if="mostrarImportar" @close="mostrarImportar = false" />
    <FichaItemEstoque v-if="fichaCodigo" :codigo="fichaCodigo" :indice="indice" :problemas="problemasDoCodigo(fichaCodigo)" @close="fichaCodigo = ''" />
  </div>
</template>
