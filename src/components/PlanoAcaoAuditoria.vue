<script setup>
import { computed, ref, watch } from 'vue'
import { gerarAcoes } from '../utils/planoAcao'
import { adicionarAcoes, listarAcoes, removerAcao, salvarAcao, STATUS_ACAO } from '../db/planosAcao'
import { correspondeBusca, formatarDataBR } from '../utils/busca'
import { baixarCsv } from '../utils/csv'
import { blocoTabela, imprimirRelatorioVisual } from '../utils/print'
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
const remover = async (acao) => {
  await removerAcao(acao.id)
  acoes.value = acoes.value.filter(a => a.id !== acao.id)
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
const visiveis = computed(() => acoes.value
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
const imprimir = () => imprimirRelatorioVisual({
  titulo: `Plano de ação · ${props.auditoria.tipo}`,
  subtitulo: `Auditoria de ${formatarDataBR(String(props.auditoria.data).slice(0, 10))} · ${resumo.value.feitas} de ${resumo.value.total} resolvidas`,
  indicadores: [
    { rotulo: 'Ações', valor: resumo.value.total, detalhe: `${resumo.value.feitas} resolvidas`, tom: 'neutro' },
    { rotulo: 'Itens em aberto', valor: resumo.value.itensAbertos, detalhe: 'nas ações não resolvidas', tom: 'alerta' },
    { rotulo: 'Atrasadas', valor: resumo.value.atrasadas, detalhe: 'prazo vencido', tom: resumo.value.atrasadas ? 'ruim' : 'bom' }
  ],
  blocos: [blocoTabela({ titulo: 'Ações', colunas: COLUNAS.map(c => ({ ...c, alinhamento: c.chave === 'pendentes' ? 'right' : undefined })), linhas: linhasExport() })]
})
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
        <div class="mt-2 h-2.5 overflow-hidden rounded-full bg-white ring-1 ring-slate-200" role="progressbar" :aria-valuenow="Math.round(resumo.progresso)" aria-valuemin="0" aria-valuemax="100" aria-label="Ações resolvidas">
          <div class="h-full rounded-full bg-emerald-500 transition-all" :style="{ width: `${resumo.progresso}%` }"></div>
        </div>
      </div>
      <div class="rounded-xl bg-slate-50 p-3"><p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Em andamento</p><p class="text-xl font-black text-slate-900">{{ resumo.andamento }}</p></div>
      <div class="rounded-xl p-3" :class="resumo.atrasadas ? 'bg-red-50' : 'bg-slate-50'"><p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Atrasadas</p><p class="text-xl font-black" :class="resumo.atrasadas ? 'text-red-700' : 'text-slate-900'">{{ resumo.atrasadas }}</p></div>
      <div class="rounded-xl bg-amber-50 p-3"><p class="text-[11px] font-bold uppercase tracking-wider text-amber-700">Itens em aberto</p><p class="text-xl font-black text-amber-800">{{ resumo.itensAbertos.toLocaleString('pt-BR') }}</p></div>
    </div>

    <div v-if="acoes.length" class="mt-4 flex flex-wrap items-center gap-2">
      <div class="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
        <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" aria-hidden="true"></i>
        <input v-model="busca" type="search" class="ui-input py-2 pl-8 text-xs" placeholder="Local, setor, responsável..." aria-label="Buscar ações">
      </div>
      <select v-model="filtroStatus" class="ui-input w-auto py-2 text-xs" aria-label="Situação">
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
