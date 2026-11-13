<script setup>
import { computed, onMounted, ref } from 'vue'
import { useAuditoriasStore } from '../../stores/auditoriasStore'
import { useNaoVinculadosStore } from '../../stores/naoVinculadosStore'
import { historicoDoCodigo } from '../../utils/naoVinculados'
import { useAnaliseEstoque } from '../../composables/useAnaliseEstoque'
import { baixarCsv } from '../../utils/csv'
import { blocoBarras, blocoTabela } from '../../utils/print'
import { abrirRelatorioTabela, useRelatorio } from '../../composables/useRelatorio'
import UiButton from '../ui/UiButton.vue'
import UiEmptyState from '../ui/UiEmptyState.vue'
import UiModal from '../ui/UiModal.vue'
import UiTabs from '../ui/UiTabs.vue'
import ImagemNaoVinculados from '../ImagemNaoVinculados.vue'

const store = useNaoVinculadosStore()
const auditoriasStore = useAuditoriasStore()
const toast = (m, t) => auditoriasStore.addToast(m, t)

// --- Importação ---
const mostrarUpload = ref(false)
const arquivo = ref(null)
const carregando = ref(false)
const hoverDrop = ref(false)
const inputRef = ref(null)
const soltar = e => { e.preventDefault(); hoverDrop.value = false; arquivo.value = e.dataTransfer?.files?.[0] || arquivo.value }
const importar = async () => {
  carregando.value = true
  try {
    // A sugestão de local usa o histórico: espera os itens das auditorias chegarem.
    await auditoriasStore.aguardarItens()
    const { total, resolvidos } = await store.importar(arquivo.value, auditoriasStore.auditorias)
    toast(`${total} itens sem local importados${resolvidos ? `; ${resolvidos} saíram da lista (já vinculados)` : ''}.`, 'success')
    mostrarUpload.value = false
    arquivo.value = null
  } catch (e) {
    toast(`Erro ao importar: ${e?.message || 'desconhecido'}`, 'error')
  } finally {
    carregando.value = false
  }
}
onMounted(() => { if (!store.itens.length) mostrarUpload.value = true })

// --- Dados ---
const hojeISO = new Date().toLocaleDateString('sv-SE')
const ativos = computed(() => store.itens.filter(i => i.status !== 'resolvido'))
const resolvidosHoje = computed(() => store.itens.filter(i => i.status === 'resolvido' && i.resolvidoEm === hojeISO).length)
const pendentes = ativos
// Mesmo cálculo da aba Estoque (compartilhado, não refaz ao trocar de aba).
const { suspeitos } = useAnaliseEstoque()
const temAuditorias = computed(() => !auditoriasStore.itensCarregados || auditoriasStore.auditorias.some(a => a.dados?.length))
const diasNaLista = i => Math.max(0, Math.round((new Date(hojeISO) - new Date(i.primeiroVisto)) / 86400000))

const resumo = computed(() => [
  { rotulo: 'Não vinculados', valor: pendentes.value.length, nota: `${pendentes.value.filter(i => i.primeiroVisto === hojeISO).length} recebidos hoje` },
  { rotulo: 'Local pelo histórico', valor: pendentes.value.filter(i => i.sugestao?.confianca === 'alta').length, nota: 'lido ou vinculado antes num local' },
  { rotulo: 'Sem local sugerido', valor: pendentes.value.filter(i => !i.sugestao?.local).length, nota: 'sem histórico nas auditorias' },
  { rotulo: 'Na lista há 3+ dias', valor: pendentes.value.filter(i => diasNaLista(i) >= 3).length, nota: 'voltaram em várias importações' },
  { rotulo: 'Saíram da lista hoje', valor: resolvidosHoje.value, nota: 'vinculados no sistema' }
])

// --- Abas e filtros ---
const aba = ref('tratar')
const abas = computed(() => [
  { value: 'tratar', label: `Itens (${ativos.value.length})`, icon: 'fas fa-link' },
  { value: 'locais', label: 'Por local sugerido', icon: 'fas fa-map-pin' },
  { value: 'suspeitos', label: `Vínculos suspeitos (${suspeitos.value.length})`, icon: 'fas fa-triangle-exclamation' }])
const busca = ref('')
const filtroConfianca = ref('')
const filtroSetor = ref('')
const setores = computed(() => [...new Set(ativos.value.map(i => i.setor))].sort())
const casa = (i, termo) => !termo || `${i.codigo} ${i.produto} ${i.fornecedor} ${i.sugestao?.local || ''}`.toLowerCase().includes(termo)
const ORDEM = { alta: 0, media: 1, baixa: 2 }
const filtrados = computed(() => {
  const termo = busca.value.trim().toLowerCase()
  return ativos.value
    .filter(i => (!filtroSetor.value || i.setor === filtroSetor.value) && (!filtroConfianca.value || i.sugestao?.confianca === filtroConfianca.value) && casa(i, termo))
    .sort((a, b) => ORDEM[a.prioridade] - ORDEM[b.prioridade] || b.estoque - a.estoque)
})
const porLocal = computed(() => {
  const m = new Map()
  for (const i of pendentes.value) {
    const chave = i.sugestao?.local || ''
    m.set(chave, [...(m.get(chave) || []), i])
  }
  return [...m.entries()].sort((a, b) => (!a[0]) - (!b[0]) || a[0].localeCompare(b[0], 'pt-BR', { numeric: true }))
})

// --- Ações ---
const recalcular = async () => {
  await auditoriasStore.aguardarItens()
  await store.atualizarSugestoes(auditoriasStore.auditorias)
  toast('Sugestões recalculadas com as auditorias atuais.', 'success')
}
const limpar = async () => {
  if (!confirm('Apagar todos os itens não vinculados e o histórico do tratamento?')) return
  await store.limpar()
  mostrarUpload.value = true
}

// --- Histórico do item ---
const itemHistorico = ref(null)
const eventos = computed(() => (itemHistorico.value ? historicoDoCodigo(itemHistorico.value.codigo, auditoriasStore.auditorias) : []))

// --- Exportar ---
const imagem = ref(null)
const salvarImagem = async () => {
  try { await imagem.value.salvar() } catch (e) { toast(e?.message || 'Não foi possível gerar a imagem.', 'error') }
}
const exportarCsv = () => baixarCsv(filtrados.value.map(i => ({ ...i, sugerido: i.sugestao?.local, motivo: i.sugestao?.motivo, confianca: i.sugestao?.confianca, dias: diasNaLista(i) })), [
  ['codigo', 'Código'], ['produto', 'Produto'], ['setor', 'Setor'], ['estoque', 'Estoque'], ['diasSemVenda', 'Dias sem venda'],
  ['prioridade', 'Prioridade'], ['sugerido', 'Local sugerido'], ['confianca', 'Confiança'], ['motivo', 'Motivo'], ['dias', 'Dias na lista']
], `nao-vinculados-${hojeISO}`)
const exportarSuspeitos = () => baixarCsv(suspeitos.value, [
  ['codigo', 'Código'], ['produto', 'Produto'], ['setor', 'Setor'], ['vinculadoEm', 'Vinculado em'], ['local', 'Lido/está em'], ['vezes', 'Vezes'], ['ultima', 'Última auditoria'], ['motivo', 'Motivo']
], `vinculos-suspeitos-${hojeISO}`)

// --- Relatórios (mesmo modal de escolha de seções/colunas dos outros relatórios) ---
const int = v => (Number(v) || 0).toLocaleString('pt-BR')
const COLUNAS_ITENS = [
  { chave: 'codigo', titulo: 'Código' },
  { chave: 'produto', titulo: 'Produto' },
  { chave: 'setor', titulo: 'Setor' },
  { chave: 'fornecedor', titulo: 'Fornecedor' },
  { chave: 'estoque', titulo: 'Estoque', alinhamento: 'right' },
  { chave: 'diasSemVenda', titulo: 'Dias sem venda', alinhamento: 'right' },
  { chave: 'local', titulo: 'Local sugerido', valor: i => i.sugestao?.local },
  { chave: 'origem', titulo: 'Origem da sugestão', valor: i => (i.sugestao?.local ? CONFIANCA[i.sugestao.confianca] : '') },
  { chave: 'motivo', titulo: 'Motivo', valor: i => i.sugestao?.motivo },
  { chave: 'diasLista', titulo: 'Dias na lista', alinhamento: 'right', valor: diasNaLista }
]
const COLUNAS_PADRAO = ['codigo', 'produto', 'setor', 'estoque', 'diasSemVenda', 'local', 'motivo']
const COLUNAS_SUSPEITOS = [
  { chave: 'codigo', titulo: 'Código' }, { chave: 'produto', titulo: 'Produto' }, { chave: 'setor', titulo: 'Setor' },
  { chave: 'vinculadoEm', titulo: 'Vinculado em' }, { chave: 'local', titulo: 'Lido em' },
  { chave: 'vezes', titulo: 'Vezes', alinhamento: 'right' }, { chave: 'ultima', titulo: 'Última auditoria', valor: s => br(s.ultima) }
]
const celula = (item, c) => {
  const v = c.valor ? c.valor(item) : item[c.chave]
  return v === null || v === undefined || v === '' ? '—' : typeof v === 'number' ? int(v) : v
}
const tabela = (lista, colunas, chaves = colunas.map(c => c.chave)) => {
  const usadas = colunas.filter(c => chaves.includes(c.chave))
  return blocoTabela({ colunas: usadas, linhas: lista.map(i => Object.fromEntries(usadas.map(c => [c.chave, celula(i, c)]))) })
}
const porEstoque = lista => [...lista].sort((a, b) => b.estoque - a.estoque)
const { abrir: abrirRelatorio } = useRelatorio()

const relatorioGeral = () => {
  const recebidos = pendentes.value.filter(i => i.primeiroVisto === hojeISO).length
  const comLocal = pendentes.value.filter(i => i.sugestao?.local).length
  const setoresBarras = [...pendentes.value.reduce((m, i) => m.set(i.setor, (m.get(i.setor) || 0) + 1), new Map())]
    .sort((a, b) => b[1] - a[1]).slice(0, 15).map(([rotulo, valor]) => ({ rotulo, valor }))
  abrirRelatorio({
    id: 'nao-vinculados',
    titulo: 'Relatório de itens não vinculados',
    subtitulo: `Situação em ${new Date().toLocaleDateString('pt-BR')}`,
    contexto: [
      { rotulo: 'Última importação', valor: br(store.itens.reduce((m, i) => (i.ultimoVisto > m ? i.ultimoVisto : m), '')) },
      { rotulo: 'Auditorias no histórico', valor: int(auditoriasStore.auditorias.length) }
    ],
    indicadores: [
      { rotulo: 'Não vinculados', valor: int(pendentes.value.length), detalhe: 'fora da auditoria', tom: pendentes.value.length ? 'ruim' : 'bom' },
      { rotulo: 'Recebidos hoje', valor: int(recebidos), detalhe: 'novos na planilha', tom: recebidos ? 'alerta' : 'bom' },
      { rotulo: 'Com local sugerido', valor: int(comLocal), detalhe: 'pelas auditorias', tom: 'neutro' },
      { rotulo: 'Saíram da lista hoje', valor: int(resolvidosHoje.value), detalhe: 'vinculados no sistema', tom: 'bom' },
      { rotulo: 'Vínculos suspeitos', valor: int(suspeitos.value.length), detalhe: 'lidos em outro local', tom: suspeitos.value.length ? 'alerta' : 'bom' }
    ],
    assinaturaPadrao: true,
    colunas: { lista: COLUNAS_ITENS.map(c => ({ chave: c.chave, titulo: c.titulo })), padrao: COLUNAS_PADRAO },
    secoes: [
      { id: 'itens', titulo: `Itens não vinculados (${pendentes.value.length})`, descricao: 'Do maior para o menor estoque, com o local sugerido.', padrao: true, gerar: ({ colunas }) => tabela(porEstoque(pendentes.value), COLUNAS_ITENS, colunas) || '<p class="nota">Nenhum item sem local.</p>' },
      { id: 'locais', titulo: 'Por local sugerido', descricao: 'Lista para conferir local a local.', padrao: true, gerar: () => {
        const linhas = porLocal.value.flatMap(([local, lista]) => [
          { __grupo: local || 'Sem local sugerido', __detalhe: `${lista.length} item(ns)` },
          ...porEstoque(lista).map(i => ({ codigo: i.codigo, produto: i.produto, estoque: int(i.estoque), diasSemVenda: celula(i, COLUNAS_ITENS[5]) }))
        ])
        return blocoTabela({ colunas: [{ chave: 'codigo', titulo: 'Código' }, { chave: 'produto', titulo: 'Produto' }, { chave: 'estoque', titulo: 'Estoque', alinhamento: 'right' }, { chave: 'diasSemVenda', titulo: 'Dias sem venda', alinhamento: 'right' }], linhas })
      } },
      ...(setoresBarras.length > 1 ? [{ id: 'setores', titulo: 'Por setor', descricao: 'Itens sem local em cada setor.', padrao: true, gerar: () => blocoBarras({ titulo: 'Itens sem local por setor', barras: setoresBarras }) }] : []),
      { id: 'suspeitos', titulo: `Vínculos suspeitos (${suspeitos.value.length})`, descricao: 'Vinculados num local, lidos em outro em 2+ auditorias.', padrao: suspeitos.value.length > 0, gerar: () => tabela(suspeitos.value, COLUNAS_SUSPEITOS) || '<p class="nota">Nenhum vínculo suspeito.</p>' }
    ]
  })
}

const relatorioItens = () => abrirRelatorioTabela({
  id: 'nao-vinculados-itens',
  titulo: 'Não vinculados · itens filtrados',
  subtitulo: `${filtrados.value.length} item(ns)`,
  contexto: [
    filtroSetor.value && { rotulo: 'Setor', valor: filtroSetor.value },
    filtroConfianca.value && { rotulo: 'Sugestão', valor: CONFIANCA[filtroConfianca.value] },
    busca.value.trim() && { rotulo: 'Busca', valor: busca.value.trim() }
  ].filter(Boolean),
  colunas: COLUNAS_ITENS,
  itens: filtrados.value,
  assinaturaPadrao: true
})
const relatorioSuspeitos = () => abrirRelatorioTabela({
  id: 'nao-vinculados-suspeitos',
  titulo: 'Vínculos suspeitos',
  subtitulo: 'Vinculados num local, lidos em outro em 2+ auditorias',
  colunas: COLUNAS_SUSPEITOS,
  itens: suspeitos.value,
  assinaturaPadrao: true
})

// --- Formatação ---
const br = iso => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—')
const CONFIANCA = { alta: 'Histórico do item', media: 'Itens parecidos', baixa: 'Palpite fraco', nenhuma: 'Sem local sugerido' }
const corConfianca = c => ({ alta: 'bg-blue-700', media: 'bg-blue-400', baixa: 'bg-slate-300', nenhuma: 'bg-amber-400' })[c] || 'bg-slate-300'
const PRIORIDADE = { alta: 'Vende toda semana', media: 'Com estoque', baixa: 'Sem estoque' }
</script>

<template>
  <div>
    <div class="space-y-6">
      <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p class="max-w-[72ch] text-sm leading-relaxed text-slate-600">Itens que chegaram sem local no sistema. Sem local, o item fica fora da auditoria: vincule no local certo para a auditoria acertar.</p>
        <div class="flex flex-wrap items-center gap-2">
          <UiButton @click="mostrarUpload = true"><i class="fas fa-file-upload"></i>Importar planilha</UiButton>
          <template v-if="store.itens.length">
            <UiButton variant="secondary" @click="relatorioGeral"><i class="fas fa-file-pdf"></i>Relatório</UiButton>
            <UiButton variant="secondary" :disabled="imagem?.gerando" @click="salvarImagem"><i :class="imagem?.gerando ? 'fas fa-spinner fa-spin' : 'fas fa-image'"></i>Salvar imagem</UiButton>
            <UiButton variant="secondary" title="Refaz as sugestões com as auditorias importadas depois desta planilha" @click="recalcular"><i class="fas fa-rotate"></i>Recalcular</UiButton>
            <UiButton variant="dangerSoft" @click="limpar"><i class="fas fa-trash-alt"></i>Limpar</UiButton>
          </template>
        </div>
      </div>

      <UiModal v-if="mostrarUpload" title="Importar itens não vinculados" subtitle="Planilha do dia exportada do sistema (.xlsx ou .csv)" @close="mostrarUpload = false">
        <div class="space-y-4">
          <button
            type="button"
            class="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 p-8 text-center transition"
            :class="hoverDrop ? 'bg-blue-50' : 'hover:bg-slate-50'"
            @dragover.prevent="hoverDrop = true" @dragleave="hoverDrop = false" @drop="soltar" @click="inputRef?.click()"
          >
            <i class="fas fa-file-excel mb-3 text-4xl text-green-600"></i>
            <span class="font-medium text-slate-700">{{ arquivo ? `${arquivo.name} (${Math.ceil(arquivo.size / 1024)} KB)` : 'Solte o arquivo aqui ou clique para selecionar' }}</span>
          </button>
          <input ref="inputRef" type="file" accept=".xlsx,.csv" class="hidden" @change="arquivo = $event.target.files?.[0] || null" />
          <p class="text-xs leading-relaxed text-slate-500">Itens que já estavam na lista mantêm o tratamento. Os que não vierem mais contam como vinculados no sistema.</p>
          <UiButton :disabled="!arquivo || carregando" @click="importar">
            <i :class="carregando ? 'fas fa-spinner fa-spin' : 'fas fa-file-import'"></i>{{ carregando ? 'Processando...' : 'Importar' }}
          </UiButton>
        </div>
      </UiModal>

      <UiEmptyState v-if="!store.itens.length && !mostrarUpload" title="Nenhum item sem local" description="Importe a planilha de itens não vinculados do dia para ver onde cada um deve ficar." icon="fas fa-link-slash">
        <template #actions><UiButton @click="mostrarUpload = true"><i class="fas fa-file-upload"></i>Importar planilha</UiButton></template>
      </UiEmptyState>

      <template v-if="store.itens.length">
        <p v-if="!temAuditorias" class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Ainda não há auditorias com itens neste navegador. Sem histórico, a sugestão de local vem só da classe do produto.
        </p>

        <section class="grid grid-cols-2 gap-3 md:grid-cols-5" aria-label="Resumo">
          <div v-for="(r, i) in resumo" :key="r.rotulo" class="ui-card p-4" :class="i === 0 ? 'col-span-2 md:col-span-1 border-blue-200 bg-blue-50/60' : ''">
            <p class="text-[13px] font-semibold text-slate-600">{{ r.rotulo }}</p>
            <p class="mt-2 text-[2rem] font-semibold leading-none tabular-nums" :class="i === 0 ? 'text-blue-800' : 'text-slate-900'">{{ r.valor.toLocaleString('pt-BR') }}</p>
            <p class="mt-2 text-xs text-slate-500">{{ r.nota }}</p>
          </div>
        </section>

        <UiTabs v-model="aba" :items="abas" />

        <!-- Tratar -->
        <section v-if="aba === 'tratar'" class="space-y-4">
          <div class="flex flex-wrap items-end gap-3">
            <label class="min-w-56 flex-1"><span class="ui-label">Buscar</span><input v-model="busca" class="ui-input" placeholder="Código, produto, fornecedor ou local" /></label>
            <label><span class="ui-label">Sugestão</span>
              <select v-model="filtroConfianca" class="ui-input"><option value="">Todas</option><option v-for="(r, v) in CONFIANCA" :key="v" :value="v">{{ r }}</option></select>
            </label>
            <label><span class="ui-label">Setor</span>
              <select v-model="filtroSetor" class="ui-input"><option value="">Todos</option><option v-for="s in setores" :key="s">{{ s }}</option></select>
            </label>
            <UiButton variant="secondary" :disabled="!filtrados.length" @click="relatorioItens"><i class="fas fa-file-pdf"></i>Relatório</UiButton>
            <UiButton variant="secondary" @click="exportarCsv"><i class="fas fa-file-csv"></i>CSV</UiButton>
          </div>

          <p v-if="!filtrados.length" class="ui-card px-4 py-10 text-center text-sm text-slate-500">Nenhum item com esses filtros.</p>
          <ul v-else class="ui-card divide-y divide-slate-100">
            <li v-for="i in filtrados" :key="i.codigo" class="grid gap-3 p-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.3fr)] lg:items-center">
              <div class="min-w-0">
                <button type="button" class="truncate text-left font-semibold text-slate-900 hover:text-blue-700 hover:underline" :title="`Ver ${i.produto} nas auditorias`" @click="itemHistorico = i">{{ i.produto }}</button>
                <p class="truncate text-xs text-slate-500">{{ i.codigo }}, {{ i.setor }}<template v-if="i.fornecedor">, {{ i.fornecedor }}</template></p>
              </div>
              <div class="text-sm text-slate-700">
                <p><span class="font-semibold tabular-nums">{{ i.estoque.toLocaleString('pt-BR') }}</span> em estoque<template v-if="i.diasSemVenda !== null">, sem venda há {{ i.diasSemVenda }} d</template></p>
                <p class="text-xs text-slate-500">{{ PRIORIDADE[i.prioridade] }}<template v-if="diasNaLista(i)">, na lista há {{ diasNaLista(i) }} d</template></p>
              </div>
              <div v-if="i.sugestao?.local" class="flex min-w-0 items-start gap-2.5">
                <span class="mt-1.5 size-2 shrink-0 rounded-full" :class="corConfianca(i.sugestao.confianca)" :title="CONFIANCA[i.sugestao.confianca]"></span>
                <div class="min-w-0">
                  <p class="text-sm"><span class="text-xs text-slate-500">Local sugerido</span> <span class="font-semibold">{{ i.sugestao.local }}</span> <span class="text-xs text-slate-500">{{ CONFIANCA[i.sugestao.confianca] }}</span></p>
                  <p class="text-xs text-slate-500">{{ i.sugestao.motivo }}</p>
                </div>
              </div>
            </li>
          </ul>
          <p class="text-xs text-slate-500">O vínculo é feito no sistema da loja. O item sai desta lista quando a próxima planilha não o trouxer mais.</p>
        </section>

        <!-- Por local -->
        <section v-else-if="aba === 'locais'" class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <p v-if="!porLocal.length" class="ui-card px-4 py-10 text-center text-sm text-slate-500 md:col-span-2 xl:col-span-3">Nada pendente.</p>
          <article v-for="[local, lista] in porLocal" :key="local || 'sem'" class="ui-card p-4">
            <header class="flex items-baseline justify-between border-b border-slate-100 pb-2">
              <h2 class="text-lg font-semibold" :class="local ? 'text-slate-900' : 'text-amber-800'">{{ local || 'Sem local sugerido' }}</h2>
              <span class="text-sm text-slate-500">{{ lista.length }} {{ lista.length === 1 ? 'item' : 'itens' }}</span>
            </header>
            <ul class="mt-2 space-y-1.5">
              <li v-for="i in lista" :key="i.codigo" class="flex justify-between gap-3 text-sm">
                <span class="truncate">{{ i.produto }}</span><span class="shrink-0 text-xs text-slate-500 tabular-nums">{{ i.codigo }}</span>
              </li>
            </ul>
          </article>
        </section>

        <!-- Suspeitos -->
        <section v-else-if="aba === 'suspeitos'" class="space-y-4">
          <p class="max-w-[80ch] text-sm leading-relaxed text-slate-600">Itens vinculados num local, mas lidos em outro ("lido não pertence") em duas ou mais auditorias e não lidos no local vinculado depois disso. Itens lidos no próprio local vinculado ou sem local vinculado conhecido ficam de fora.</p>
          <div class="flex flex-wrap items-end gap-3">
            <UiButton variant="secondary" :disabled="!suspeitos.length" @click="relatorioSuspeitos"><i class="fas fa-file-pdf"></i>Relatório</UiButton>
            <UiButton variant="secondary" :disabled="!suspeitos.length" @click="exportarSuspeitos"><i class="fas fa-file-csv"></i>CSV</UiButton>
          </div>
          <p v-if="!suspeitos.length" class="ui-card px-4 py-10 text-center text-sm text-slate-500">{{ temAuditorias ? 'Nenhum vínculo suspeito nas auditorias.' : 'Importe auditorias para cruzar os vínculos.' }}</p>
          <div v-else class="ui-card overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="text-left text-xs text-slate-500"><tr><th class="px-4 py-2.5">Produto</th><th class="px-4">Vinculado em</th><th class="px-4">Está em</th><th class="px-4">Motivo</th><th class="px-4">Última</th></tr></thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="s in suspeitos" :key="s.codigo + s.local">
                  <td class="px-4 py-2.5"><p class="font-semibold">{{ s.produto }}</p><p class="text-xs text-slate-500">{{ s.codigo }}, {{ s.setor }}</p></td>
                  <td class="px-4">{{ s.vinculadoEm || '—' }}</td>
                  <td class="px-4 font-semibold text-blue-800">{{ s.local }}</td>
                  <td class="px-4 text-slate-600">{{ s.motivo }}</td>
                  <td class="px-4 tabular-nums">{{ br(s.ultima) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>

      <UiModal v-if="itemHistorico" :title="itemHistorico.produto" :subtitle="`${itemHistorico.codigo} nas auditorias`" width="max-w-2xl" @close="itemHistorico = null">
        <p v-if="!eventos.length" class="text-sm text-slate-500">Este código não aparece em nenhuma auditoria salva. Item novo ou nunca vinculado.</p>
        <ul v-else class="max-h-[60vh] divide-y divide-slate-100 overflow-y-auto text-sm">
          <li v-for="(e, n) in eventos" :key="n" class="flex justify-between gap-3 py-2">
            <span class="tabular-nums text-slate-500">{{ br(e.data) }} {{ e.tipo }}</span>
            <span><b>{{ e.local }}</b> <span class="text-slate-500">{{ e.naoPertence ? 'lido, não pertence' : e.lido ? 'lido' : 'não lido' }}</span></span>
          </li>
        </ul>
      </UiModal>
    </div>
    <ImagemNaoVinculados ref="imagem" :itens="ativos" />
  </div>
</template>
