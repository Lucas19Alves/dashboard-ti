<script setup>
import { computed, ref, watch } from 'vue'
import { gerarAcoes } from '../utils/planoAcao'
import { adicionarAcoes, listarAcoes, removerAcao, salvarAcao, STATUS_ACAO } from '../db/planosAcao'
import { correspondeBusca, formatarDataBR } from '../utils/busca'
import { baixarCsv } from '../utils/csv'
import { blocoBarras, blocoTabela, escapeHtml, selo } from '../utils/print'
import { useRelatorio } from '../composables/useRelatorio'
import { rotuloUsuario } from '../utils/usuario'
import { paraISOLocal } from '../utils/metricasAuditoria'

// Plano de ação da auditoria: uma ação por local com pendentes, com responsável, prazo e situação.
// Fica salvo apenas neste navegador.
const props = defineProps({
  auditoria: { type: Object, required: true }
})

const acoes = ref([])
const carregando = ref(true)
const carregar = async () => {
  carregando.value = true
  try {
    acoes.value = await listarAcoes(props.auditoria.id)
  } finally {
    carregando.value = false
  }
}
watch(() => props.auditoria?.id, carregar, { immediate: true })

const sugestoes = computed(() => gerarAcoes(props.auditoria))
const locaisNoPlano = computed(() => new Set(acoes.value.map(a => a.local)))
const novas = computed(() => sugestoes.value.filter(s => !locaisNoPlano.value.has(s.local)))
const usuarios = computed(() => props.auditoria?.analise?.usuarios || Object.keys(props.auditoria?.analise?.porUsuario || {}))

const prazoPadrao = () => {
  // Dia seguinte à auditoria; se já passou, amanhã.
  const base = new Date(`${String(props.auditoria?.data || paraISOLocal(new Date())).slice(0, 10)}T12:00:00`)
  base.setDate(base.getDate() + 1)
  const amanha = new Date()
  amanha.setDate(amanha.getDate() + 1)
  return paraISOLocal(base < amanha ? amanha : base)
}

const minimoPendentes = ref(1)
const gerando = ref(false)
const gerar = async () => {
  gerando.value = true
  try {
    const lista = novas.value.filter(s => s.pendentes >= minimoPendentes.value).map(s => ({
      auditoriaId: props.auditoria.id,
      local: s.local,
      area: s.area,
      setor: s.setor,
      pendentes: s.pendentes,
      perc: s.perc,
      prioridade: s.prioridade,
      descricao: s.semLeitura ? `Local sem leitura: auditar os ${s.pendentes} itens` : `Conferir ${s.pendentes} item(ns) pendente(s)`,
      responsavel: s.responsavelSugerido,
      prazo: prazoPadrao(),
      status: 'aberta',
      observacao: ''
    }))
    if (lista.length) acoes.value = [...acoes.value, ...(await adicionarAcoes(lista))]
  } finally {
    gerando.value = false
  }
}

const atualizar = async (acao, mudanca) => {
  const salvo = await salvarAcao({ ...acao, ...mudanca })
  acoes.value = acoes.value.map(a => (a.id === acao.id ? salvo : a))
}
// Remoção com "Desfazer" por alguns segundos.
const removida = ref(null)
let timerRemovida = null
const remover = async (acao) => {
  await removerAcao(acao.id)
  acoes.value = acoes.value.filter(a => a.id !== acao.id)
  removida.value = acao
  clearTimeout(timerRemovida)
  timerRemovida = setTimeout(() => { removida.value = null }, 6000)
}
const desfazerRemocao = async () => {
  const { id, ...acao } = removida.value || {}
  if (!id) return
  removida.value = null
  acoes.value = [...acoes.value, ...(await adicionarAcoes([acao]))]
}
const limparConcluidas = async () => {
  for (const a of acoes.value.filter(x => x.status === 'feita')) await removerAcao(a.id)
  acoes.value = acoes.value.filter(a => a.status !== 'feita')
}

// Ação manual
const nova = ref({ local: '', descricao: '' })
const adicionarManual = async () => {
  if (!nova.value.descricao.trim()) return
  const [salva] = await adicionarAcoes([{
    auditoriaId: props.auditoria.id, local: nova.value.local.trim() || '—', area: '', setor: '', pendentes: 0, perc: 0,
    prioridade: 'media', descricao: nova.value.descricao.trim(), responsavel: '', prazo: prazoPadrao(), status: 'aberta', observacao: ''
  }])
  acoes.value = [...acoes.value, salva]
  nova.value = { local: '', descricao: '' }
}

// Filtros
const filtroStatus = ref('pendentes')
const filtroPrioridade = ref('todas')
const busca = ref('')
const ORDEM_PRIORIDADE = { alta: 0, media: 1, baixa: 2 }
const hoje = paraISOLocal(new Date())
const atrasada = a => a.status !== 'feita' && a.prazo && a.prazo < hoje
const venceHoje = a => a.status !== 'feita' && a.prazo === hoje

// Filtros rápidos (valem para o quadro e a lista).
const RAPIDOS = [
  { valor: 'todas', rotulo: 'Todas', teste: () => true },
  { valor: 'alta', rotulo: 'Prioridade alta', teste: a => a.prioridade === 'alta' && a.status !== 'feita' },
  { valor: 'atrasadas', rotulo: 'Atrasadas', teste: atrasada },
  { valor: 'hoje', rotulo: 'Vencem hoje', teste: venceHoje },
  { valor: 'semResponsavel', rotulo: 'Sem responsável', teste: a => !a.responsavel && a.status !== 'feita' }
]
const rapido = ref('todas')
const contagemRapidos = computed(() => Object.fromEntries(RAPIDOS.map(r => [r.valor, acoes.value.filter(r.teste).length])))
const passaRapido = a => (RAPIDOS.find(r => r.valor === rapido.value)?.teste || (() => true))(a)

// Quadro (arrastar entre colunas) ou lista; lembrado neste navegador.
const CHAVE_VISAO = 'dashboard_ti_plano_visao'
const visao = ref((() => { try { return localStorage.getItem(CHAVE_VISAO) || 'quadro' } catch { return 'quadro' } })())
watch(visao, v => { try { localStorage.setItem(CHAVE_VISAO, v) } catch {} })
const filtradasQuadro = computed(() => acoes.value
  .filter(passaRapido)
  .filter(a => filtroPrioridade.value === 'todas' || a.prioridade === filtroPrioridade.value)
  .filter(a => correspondeBusca(busca.value, [a.local, a.setor, a.responsavel, a.descricao, a.observacao]))
  .sort((a, b) => ORDEM_PRIORIDADE[a.prioridade] - ORDEM_PRIORIDADE[b.prioridade] || (atrasada(b) - atrasada(a)) || b.pendentes - a.pendentes))
const colunas = computed(() => STATUS_ACAO.map(s => ({ ...s, acoes: filtradasQuadro.value.filter(a => a.status === s.valor) })))
const COR_COLUNA = { aberta: 'bg-slate-400', andamento: 'bg-blue-500', feita: 'bg-emerald-500' }
const ORDEM_STATUS = STATUS_ACAO.map(s => s.valor)
const mover = (acao, passo) => {
  const destino = ORDEM_STATUS[ORDEM_STATUS.indexOf(acao.status) + passo]
  if (destino) atualizar(acao, { status: destino })
}
const arrastando = ref(null)
const colunaAlvo = ref(null)
const soltar = (status) => {
  const acao = acoes.value.find(a => a.id === arrastando.value)
  if (acao && acao.status !== status) atualizar(acao, { status })
  arrastando.value = null
  colunaAlvo.value = null
}
const editando = ref(null) // id do cartão aberto para edição
const proximaPrioridade = { alta: 'media', media: 'baixa', baixa: 'alta' }
const textoPrazo = (a) => {
  if (!a.prazo) return 'Sem prazo'
  if (a.status === 'feita') return formatarDataBR(a.prazo)
  if (atrasada(a)) return `Atrasada · ${formatarDataBR(a.prazo)}`
  if (venceHoje(a)) return 'Vence hoje'
  return formatarDataBR(a.prazo)
}
const iniciais = u => (rotuloUsuario(u).split(' ').filter(Boolean).slice(0, 2).map(x => x[0]).join('') || '?').toUpperCase()

const visiveis = computed(() => acoes.value
  .filter(passaRapido)
  .filter(a => filtroStatus.value === 'todas' || (filtroStatus.value === 'pendentes' ? a.status !== 'feita' : a.status === filtroStatus.value))
  .filter(a => filtroPrioridade.value === 'todas' || a.prioridade === filtroPrioridade.value)
  .filter(a => correspondeBusca(busca.value, [a.local, a.setor, a.responsavel, a.descricao, a.observacao]))
  .sort((a, b) => (a.status === 'feita') - (b.status === 'feita') || ORDEM_PRIORIDADE[a.prioridade] - ORDEM_PRIORIDADE[b.prioridade] || b.pendentes - a.pendentes))

const resumo = computed(() => {
  const total = acoes.value.length
  const feitas = acoes.value.filter(a => a.status === 'feita').length
  return {
    total,
    feitas,
    andamento: acoes.value.filter(a => a.status === 'andamento').length,
    atrasadas: acoes.value.filter(atrasada).length,
    itensAbertos: acoes.value.filter(a => a.status !== 'feita').reduce((s, a) => s + (a.pendentes || 0), 0),
    progresso: total ? (feitas / total) * 100 : 0
  }
})

const CLASSE_PRIORIDADE = { alta: 'bg-red-100 text-red-700', media: 'bg-amber-100 text-amber-800', baixa: 'bg-slate-100 text-slate-600' }
const ROTULO_PRIORIDADE = { alta: 'Alta', media: 'Média', baixa: 'Baixa' }
const rotuloStatus = v => STATUS_ACAO.find(s => s.valor === v)?.rotulo || v

const linhasExport = () => visiveis.value.map(a => ({
  ...a, prioridadeTexto: ROTULO_PRIORIDADE[a.prioridade], statusTexto: rotuloStatus(a.status), prazoBR: formatarDataBR(a.prazo),
  responsavelTexto: a.responsavel ? rotuloUsuario(a.responsavel) : '', percTexto: a.pendentes ? `${Number(a.perc || 0).toFixed(1)}%` : ''
}))
const COLUNAS = [
  { chave: 'prioridadeTexto', titulo: 'Prioridade' }, { chave: 'local', titulo: 'Local' }, { chave: 'setor', titulo: 'Setor' },
  { chave: 'descricao', titulo: 'Ação' }, { chave: 'pendentes', titulo: 'Pendentes' }, { chave: 'percTexto', titulo: '% pendente' },
  { chave: 'responsavelTexto', titulo: 'Responsável' }, { chave: 'prazoBR', titulo: 'Prazo' }, { chave: 'statusTexto', titulo: 'Situação' }, { chave: 'observacao', titulo: 'Observação' }
]
const exportarCsv = () => baixarCsv(linhasExport(), COLUNAS, `plano-acao-auditoria-${props.auditoria.id}`)
const { abrir: abrirSeletor } = useRelatorio()
const imprimir = () => {
  const todas = acoes.value.map(a => ({
    ...a, prioridadeTexto: ROTULO_PRIORIDADE[a.prioridade], statusTexto: rotuloStatus(a.status), prazoBR: formatarDataBR(a.prazo),
    responsavelTexto: a.responsavel ? rotuloUsuario(a.responsavel) : '—', percTexto: a.pendentes ? `${Number(a.perc || 0).toFixed(1).replace('.', ',')}%` : '',
    atrasada: atrasada(a)
  })).sort((a, b) => (a.status === 'feita') - (b.status === 'feita') || ORDEM_PRIORIDADE[a.prioridade] - ORDEM_PRIORIDADE[b.prioridade] || b.pendentes - a.pendentes)
  const tabela = (linhas, colunas) => blocoTabela({
    colunas: COLUNAS.filter(c => colunas.includes(c.chave)).map(c => ({
      ...c, alinhamento: c.chave === 'pendentes' || c.chave === 'percTexto' ? 'right' : undefined,
      ...(c.chave === 'prazoBR' ? { html: (v, l) => (l.atrasada ? selo(`${v} · atrasada`, 'ruim') : escapeHtml(v || '—')) } : {})
    })),
    linhas
  })
  const porResponsavel = new Map()
  for (const a of todas.filter(x => x.status !== 'feita')) porResponsavel.set(a.responsavelTexto, (porResponsavel.get(a.responsavelTexto) || 0) + 1)
  abrirSeletor({
    id: 'plano-acao',
    titulo: `Plano de ação · ${props.auditoria.tipo}`,
    subtitulo: `Auditoria de ${formatarDataBR(String(props.auditoria.data).slice(0, 10))}`,
    contexto: [
      { rotulo: 'Auditoria', valor: `${props.auditoria.tipo} · ${formatarDataBR(String(props.auditoria.data).slice(0, 10))}` },
      { rotulo: 'Progresso', valor: `${resumo.value.feitas} de ${resumo.value.total} resolvidas (${resumo.value.progresso.toFixed(0)}%)` },
    ],
    indicadores: [
      { rotulo: 'Ações', valor: resumo.value.total, detalhe: `${resumo.value.feitas} resolvidas`, tom: 'neutro' },
      { rotulo: 'Em andamento', valor: resumo.value.andamento, tom: 'neutro' },
      { rotulo: 'Itens em aberto', valor: resumo.value.itensAbertos, detalhe: 'nas ações não resolvidas', tom: 'alerta' },
      { rotulo: 'Atrasadas', valor: resumo.value.atrasadas, detalhe: 'prazo vencido', tom: resumo.value.atrasadas ? 'ruim' : 'bom' }
    ],
    assinaturaPadrao: true,
    colunas: { lista: COLUNAS.map(c => ({ chave: c.chave, titulo: c.titulo })), padrao: ['prioridadeTexto', 'local', 'descricao', 'pendentes', 'responsavelTexto', 'prazoBR', 'statusTexto'] },
    secoes: [
      ...(porResponsavel.size ? [{ id: 'responsaveis', titulo: 'Ações em aberto por responsável', descricao: 'Quantas ações cada pessoa tem pendentes.', gerar: () => blocoBarras({ titulo: 'Ações em aberto por responsável', barras: [...porResponsavel].sort((a, b) => b[1] - a[1]).map(([rotulo, valor]) => ({ rotulo, valor })) }) }] : []),
      { id: 'tabela', titulo: 'Ações em aberto', descricao: 'A fazer e em andamento, por prioridade.', gerar: ({ colunas }) => tabela(todas.filter(a => a.status !== 'feita'), colunas) },
      { id: 'resolvidas', titulo: 'Ações resolvidas', descricao: 'Histórico do que já foi concluído.', padrao: false, gerar: ({ colunas }) => tabela(todas.filter(a => a.status === 'feita'), colunas) }
    ]
  })
}
</script>

<template>
  <section class="rounded-2xl bg-white p-5 shadow-sm">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h3 class="text-lg font-bold text-slate-900"><i class="fas fa-list-check mr-2 text-blue-600"></i>Plano de ação</h3>
        <p class="text-xs text-slate-500">Uma ação por local com pendentes. Responsável sugerido = quem mais leu naquela área nesta auditoria. Salvo só neste navegador (entra no backup).</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <label class="text-xs font-semibold text-slate-600" for="minimo-pendentes">Locais com</label>
        <select id="minimo-pendentes" v-model.number="minimoPendentes" class="ui-input w-auto py-2 text-xs">
          <option v-for="n in [1, 3, 5, 10, 20]" :key="n" :value="n">{{ n }}+ pendente(s)</option>
        </select>
        <button type="button" class="ui-btn-primary py-2" :disabled="gerando || !novas.filter(s => s.pendentes >= minimoPendentes).length" @click="gerar">
          <i :class="gerando ? 'fas fa-spinner fa-spin' : 'fas fa-wand-magic-sparkles'"></i>
          Gerar {{ novas.filter(s => s.pendentes >= minimoPendentes).length }} ação(ões)
        </button>
        <button type="button" class="ui-btn-secondary py-2" :disabled="!acoes.length" @click="exportarCsv"><i class="fas fa-file-csv"></i>CSV</button>
        <button type="button" class="ui-btn-secondary py-2" :disabled="!acoes.length" @click="imprimir"><i class="fas fa-print"></i>Imprimir</button>
      </div>
    </div>

    <div class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
      <div class="rounded-xl bg-slate-50 p-3 md:col-span-2">
        <div class="flex items-baseline justify-between">
          <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Progresso</p>
          <p class="text-sm font-black text-slate-900">{{ resumo.feitas }}/{{ resumo.total }}</p>
        </div>
        <div class="mt-2 flex h-2.5 overflow-hidden rounded-full bg-white ring-1 ring-slate-200" role="progressbar" :aria-valuenow="Math.round(resumo.progresso)" aria-valuemin="0" aria-valuemax="100" aria-label="Ações resolvidas">
          <div class="h-full bg-emerald-500 transition-all duration-500" :style="{ width: `${resumo.progresso}%` }"></div>
          <div class="h-full bg-blue-400 transition-all duration-500" :style="{ width: `${resumo.total ? (resumo.andamento / resumo.total) * 100 : 0}%` }"></div>
        </div>
        <p class="mt-1 text-[10px] text-slate-500"><span class="mr-1 inline-block size-2 rounded-full bg-emerald-500"></span>resolvidas <span class="ml-2 mr-1 inline-block size-2 rounded-full bg-blue-400"></span>em andamento</p>
      </div>
      <div class="rounded-xl bg-slate-50 p-3"><p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Em andamento</p><p class="text-xl font-black text-slate-900">{{ resumo.andamento }}</p></div>
      <div class="rounded-xl p-3" :class="resumo.atrasadas ? 'bg-red-50' : 'bg-slate-50'"><p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Atrasadas</p><p class="text-xl font-black" :class="resumo.atrasadas ? 'text-red-700' : 'text-slate-900'">{{ resumo.atrasadas }}</p></div>
      <div class="rounded-xl bg-amber-50 p-3"><p class="text-[11px] font-bold uppercase tracking-wider text-amber-700">Itens em aberto</p><p class="text-xl font-black text-amber-800">{{ resumo.itensAbertos.toLocaleString('pt-BR') }}</p></div>
    </div>

    <div v-if="acoes.length" class="mt-4 flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtros rápidos">
      <button v-for="r in RAPIDOS" :key="r.valor" type="button" :aria-pressed="rapido === r.valor"
        class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 transition"
        :class="rapido === r.valor ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-600 ring-slate-200 hover:ring-slate-400'" @click="rapido = r.valor">
        {{ r.rotulo }}<span class="rounded-full px-1.5 text-[10px]" :class="rapido === r.valor ? 'bg-white/20' : r.valor === 'atrasadas' && contagemRapidos[r.valor] ? 'bg-red-100 text-red-700' : 'bg-slate-100'">{{ contagemRapidos[r.valor] }}</span>
      </button>
      <div class="ml-auto inline-flex rounded-lg bg-slate-100 p-0.5" role="radiogroup" aria-label="Visualização">
        <button v-for="[v, r, i] in [['quadro', 'Quadro', 'fas fa-table-columns'], ['lista', 'Lista', 'fas fa-list']]" :key="v" type="button" role="radio" :aria-checked="visao === v"
          class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition" :class="visao === v ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'" @click="visao = v">
          <i :class="i" aria-hidden="true"></i>{{ r }}
        </button>
      </div>
    </div>

    <div v-if="acoes.length" class="mt-2 flex flex-wrap items-center gap-2">
      <div class="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
        <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" aria-hidden="true"></i>
        <input v-model="busca" type="search" class="ui-input py-2 pl-8 text-xs" placeholder="Local, setor, responsável..." aria-label="Buscar ações">
      </div>
      <select v-if="visao === 'lista'" v-model="filtroStatus" class="ui-input w-auto py-2 text-xs" aria-label="Situação">
        <option value="pendentes">Não resolvidas</option>
        <option value="todas">Todas</option>
        <option v-for="s in STATUS_ACAO" :key="s.valor" :value="s.valor">{{ s.rotulo }}</option>
      </select>
      <select v-model="filtroPrioridade" class="ui-input w-auto py-2 text-xs" aria-label="Prioridade">
        <option value="todas">Todas as prioridades</option>
        <option value="alta">Alta</option><option value="media">Média</option><option value="baixa">Baixa</option>
      </select>
      <button v-if="resumo.feitas" type="button" class="ui-btn-secondary ml-auto py-2 text-xs" @click="limparConcluidas"><i class="fas fa-broom"></i>Remover resolvidas</button>
    </div>

    <p v-if="carregando" class="py-8 text-center text-sm text-slate-500"><i class="fas fa-spinner fa-spin mr-2"></i>Carregando...</p>
    <div v-else-if="!acoes.length" class="mt-4 rounded-xl bg-slate-50 px-6 py-10 text-center">
      <i class="fas fa-clipboard-check text-2xl text-slate-300"></i>
      <p class="mt-2 text-sm font-semibold text-slate-700">{{ sugestoes.length ? `${sugestoes.length} local(is) com pendentes` : 'Nenhum local com pendentes' }}</p>
      <p class="mt-1 text-xs text-slate-500">{{ sugestoes.length ? 'Use “Gerar ações” para montar o plano.' : 'Não há o que planejar nesta auditoria.' }}</p>
    </div>

    <!-- Quadro -->
    <div v-else-if="visao === 'quadro'" class="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
      <section v-for="c in colunas" :key="c.valor" class="flex min-h-40 flex-col rounded-xl bg-slate-50 p-2.5 transition"
        :class="colunaAlvo === c.valor ? 'bg-blue-50 ring-2 ring-blue-300' : ''" :aria-label="c.rotulo"
        @dragover.prevent="colunaAlvo = c.valor" @dragleave.self="colunaAlvo = null" @drop.prevent="soltar(c.valor)">
        <header class="mb-2 flex items-center gap-2 px-1">
          <span class="size-2.5 rounded-full" :class="COR_COLUNA[c.valor]"></span>
          <h4 class="text-sm font-bold text-slate-800">{{ c.rotulo }}</h4>
          <span class="rounded-full bg-white px-2 text-xs font-bold text-slate-600 ring-1 ring-slate-200">{{ c.acoes.length }}</span>
          <span v-if="c.valor !== 'feita'" class="ml-auto text-[11px] text-slate-500">{{ c.acoes.reduce((s, a) => s + (a.pendentes || 0), 0).toLocaleString('pt-BR') }} itens</span>
        </header>
        <TransitionGroup tag="ul" name="cartao" class="relative flex max-h-[620px] flex-1 flex-col gap-2 overflow-y-auto p-0.5">
          <li v-for="a in c.acoes" :key="a.id" draggable="true"
            class="group cursor-grab rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200 transition hover:shadow-md active:cursor-grabbing"
            :class="[arrastando === a.id ? 'opacity-40' : '', atrasada(a) ? 'ring-red-200' : '']"
            @dragstart="arrastando = a.id" @dragend="arrastando = null; colunaAlvo = null">
            <div class="flex items-start gap-2">
              <button type="button" class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase transition hover:brightness-95" :class="CLASSE_PRIORIDADE[a.prioridade]" :title="'Clique para trocar a prioridade'" @click="atualizar(a, { prioridade: proximaPrioridade[a.prioridade] })">{{ ROTULO_PRIORIDADE[a.prioridade] }}</button>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-bold text-slate-900">{{ a.local }}<span v-if="a.setor" class="font-medium text-slate-500"> · {{ a.setor }}</span></p>
                <p class="text-xs text-slate-600" :class="a.status === 'feita' ? 'line-through' : ''">{{ a.descricao }}</p>
              </div>
              <span v-if="a.pendentes" class="shrink-0 text-right"><b class="block text-sm text-amber-700">{{ a.pendentes }}</b><span class="text-[10px] text-slate-500">{{ Number(a.perc || 0).toFixed(1) }}%</span></span>
            </div>
            <div class="mt-2 flex items-center gap-2 text-[11px]">
              <span v-if="a.responsavel" class="inline-flex min-w-0 items-center gap-1 text-slate-600" :title="rotuloUsuario(a.responsavel)"><span class="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[9px] font-black text-blue-700">{{ iniciais(a.responsavel) }}</span><span class="truncate">{{ rotuloUsuario(a.responsavel) }}</span></span>
              <span v-else class="text-slate-400">Sem responsável</span>
              <span class="ml-auto shrink-0 rounded-full px-2 py-0.5 font-semibold" :class="atrasada(a) ? 'bg-red-100 text-red-700' : venceHoje(a) ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'"><i class="far fa-calendar mr-1"></i>{{ textoPrazo(a) }}</span>
              <i v-if="a.observacao" class="fas fa-note-sticky text-slate-400" :title="a.observacao"></i>
            </div>
            <div class="mt-2 flex items-center gap-1 border-t border-slate-100 pt-2">
              <button v-if="a.status !== 'aberta'" type="button" class="rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100" :aria-label="`Voltar ${a.local}`" @click="mover(a, -1)"><i class="fas fa-arrow-left"></i></button>
              <button type="button" class="rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100" :aria-expanded="editando === a.id" @click="editando = editando === a.id ? null : a.id"><i class="fas fa-pen mr-1"></i>Editar</button>
              <button v-if="a.status !== 'feita'" type="button" class="ml-auto rounded-lg px-2.5 py-1 text-[11px] font-bold transition" :class="a.status === 'aberta' ? 'bg-blue-50 text-blue-700 hover:bg-blue-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'" @click="mover(a, 1)">
                {{ a.status === 'aberta' ? 'Iniciar' : 'Concluir' }}<i class="fas ml-1" :class="a.status === 'aberta' ? 'fa-play' : 'fa-check'"></i>
              </button>
            </div>
            <div v-if="editando === a.id" class="mt-2 grid grid-cols-2 gap-2">
              <input :value="a.responsavel" list="usuarios-plano" class="ui-input col-span-2 py-1.5 text-xs" placeholder="Responsável" :aria-label="`Responsável por ${a.local}`" @change="atualizar(a, { responsavel: $event.target.value.trim() })">
              <input :value="a.prazo" type="date" class="ui-input py-1.5 text-xs" :aria-label="`Prazo de ${a.local}`" @change="atualizar(a, { prazo: $event.target.value })">
              <button type="button" class="rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50" @click="remover(a)"><i class="fas fa-trash-can mr-1"></i>Remover</button>
              <input :value="a.observacao" class="ui-input col-span-2 py-1.5 text-xs" placeholder="Anotação" :aria-label="`Observação de ${a.local}`" @change="atualizar(a, { observacao: $event.target.value })">
            </div>
          </li>
        </TransitionGroup>
        <p v-if="!c.acoes.length" class="px-2 py-6 text-center text-xs text-slate-400">{{ arrastando ? 'Solte aqui' : 'Nada aqui' }}</p>
      </section>
    </div>

    <!-- Lista -->
    <div v-else class="mt-3 overflow-x-auto rounded-xl ring-1 ring-slate-200">
      <table class="w-full min-w-[1100px] text-sm">
        <thead class="bg-slate-50 text-xs text-slate-500">
          <tr>
            <th scope="col" class="px-3 py-2 text-left font-semibold">Prioridade</th>
            <th scope="col" class="px-3 py-2 text-left font-semibold">Local / ação</th>
            <th scope="col" class="px-3 py-2 text-right font-semibold">Pendentes</th>
            <th scope="col" class="px-3 py-2 text-left font-semibold">Responsável</th>
            <th scope="col" class="px-3 py-2 text-left font-semibold">Prazo</th>
            <th scope="col" class="px-3 py-2 text-left font-semibold">Situação</th>
            <th scope="col" class="px-3 py-2 text-left font-semibold">Observação</th>
            <th scope="col" class="px-3 py-2"><span class="sr-only">Remover</span></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="a in visiveis" :key="a.id" :class="a.status === 'feita' ? 'bg-emerald-50/40 opacity-70' : ''">
            <td class="px-3 py-2">
              <select :value="a.prioridade" class="rounded-full border-0 px-2 py-0.5 text-xs font-bold" :class="CLASSE_PRIORIDADE[a.prioridade]" :aria-label="`Prioridade de ${a.local}`" @change="atualizar(a, { prioridade: $event.target.value })">
                <option value="alta">Alta</option><option value="media">Média</option><option value="baixa">Baixa</option>
              </select>
            </td>
            <td class="px-3 py-2">
              <p class="font-bold text-slate-900">{{ a.local }} <span v-if="a.setor" class="text-xs font-medium text-slate-500">· {{ a.setor }}</span></p>
              <p class="text-xs text-slate-600" :class="a.status === 'feita' ? 'line-through' : ''">{{ a.descricao }}</p>
            </td>
            <td class="px-3 py-2 text-right tabular-nums">
              <span v-if="a.pendentes" class="font-bold text-amber-700">{{ a.pendentes }}</span><span v-else class="text-slate-400">—</span>
              <p v-if="a.pendentes" class="text-[11px] text-slate-500">{{ Number(a.perc || 0).toFixed(1) }}%</p>
            </td>
            <td class="px-3 py-2">
              <input :value="a.responsavel" list="usuarios-plano" class="ui-input w-48 py-1.5 text-xs" placeholder="Responsável" :aria-label="`Responsável por ${a.local}`" @change="atualizar(a, { responsavel: $event.target.value.trim() })">
            </td>
            <td class="px-3 py-2">
              <input :value="a.prazo" type="date" class="ui-input w-36 py-1.5 text-xs" :class="atrasada(a) ? 'border-red-300 text-red-700' : ''" :aria-label="`Prazo de ${a.local}`" @change="atualizar(a, { prazo: $event.target.value })">
            </td>
            <td class="px-3 py-2">
              <select :value="a.status" class="ui-input w-36 py-1.5 text-xs" :aria-label="`Situação de ${a.local}`" @change="atualizar(a, { status: $event.target.value })">
                <option v-for="s in STATUS_ACAO" :key="s.valor" :value="s.valor">{{ s.rotulo }}</option>
              </select>
            </td>
            <td class="px-3 py-2">
              <input :value="a.observacao" class="ui-input w-56 py-1.5 text-xs" placeholder="Anotação" :aria-label="`Observação de ${a.local}`" @change="atualizar(a, { observacao: $event.target.value })">
            </td>
            <td class="px-3 py-2 text-right">
              <button type="button" class="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" :aria-label="`Remover ação de ${a.local}`" @click="remover(a)"><i class="fas fa-trash-can"></i></button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="!visiveis.length" class="py-6 text-center text-sm text-slate-500">Nenhuma ação com esses filtros.</p>
    </div>
    <transition name="aviso">
      <div v-if="removida" class="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg">
        <span>Ação de <b>{{ removida.local }}</b> removida</span>
        <button type="button" class="font-bold text-blue-300 hover:text-blue-200" @click="desfazerRemocao">Desfazer</button>
      </div>
    </transition>

    <datalist id="usuarios-plano">
      <option v-for="u in usuarios" :key="u" :value="u">{{ rotuloUsuario(u) }}</option>
    </datalist>

    <form class="mt-3 flex flex-wrap items-center gap-2" @submit.prevent="adicionarManual">
      <input v-model="nova.local" class="ui-input w-32 py-2 text-xs" placeholder="Local (opcional)" aria-label="Local da nova ação">
      <input v-model="nova.descricao" class="ui-input min-w-0 flex-1 py-2 text-xs" placeholder="Nova ação manual (ex.: repor etiquetas do corredor 4)" aria-label="Descrição da nova ação">
      <button type="submit" class="ui-btn-secondary py-2 text-xs" :disabled="!nova.descricao.trim()"><i class="fas fa-plus"></i>Adicionar</button>
    </form>
  </section>
</template>

<style scoped>
.cartao-move, .cartao-enter-active, .cartao-leave-active { transition: all 0.25s ease; }
.cartao-enter-from, .cartao-leave-to { opacity: 0; transform: translateY(6px); }
.cartao-leave-active { position: absolute; width: calc(100% - 4px); }
.aviso-enter-active, .aviso-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.aviso-enter-from, .aviso-leave-to { opacity: 0; transform: translateY(8px); }
</style>
