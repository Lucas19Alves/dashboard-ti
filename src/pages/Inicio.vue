<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuditoriasStore } from '../stores/auditoriasStore'
import { useVencimentosStore } from '../stores/vencimentosStore'
import { exportarBackupJson, importarBackupJson } from '../utils/backup'
import { formatarDataBR } from '../utils/busca'
import {
  META_PENDENTE_PERCENTUAL,
  dentroDaMeta,
  metricasAuditoria,
  montarAgendaSemana,
  paraISOLocal,
  serieEvolucao
} from '../utils/metricasAuditoria'
import {
  descreverUltimoBackup,
  formatarBytes,
  obterUltimoBackup,
  obterUsoArmazenamento,
  precisaLembrarBackup,
  solicitarArmazenamentoPersistente
} from '../utils/saudeDados'
import { usePaleta } from '../composables/usePaleta'
import StatCard from '../components/ui/StatCard.vue'
import UiButton from '../components/ui/UiButton.vue'
import SparklineMeta from '../components/ui/SparklineMeta.vue'

const router = useRouter()
const auditoriasStore = useAuditoriasStore()
const vencStore = useVencimentosStore()
const { abrir: abrirBusca } = usePaleta()

const auditorias = computed(() => (Array.isArray(auditoriasStore.auditorias) ? auditoriasStore.auditorias.filter(Boolean) : []))
const totalAuditorias = computed(() => auditorias.value.length)
const auditoriasAbertas = computed(() => auditorias.value.filter(a => a.status !== 'fechada').length)
const auditoriasFechadas = computed(() => auditorias.value.filter(a => a.status === 'fechada'))
const taxaMeta = computed(() => {
  const fechadas = auditoriasFechadas.value
  if (!fechadas.length) return null
  return Math.round((fechadas.filter(dentroDaMeta).length / fechadas.length) * 100)
})

const resumoVenc = computed(() => vencStore.analise || { total: 0, vencidos: 0, hoje: 0, ate3: 0 })
const totalCriticosPrazo = computed(() => resumoVenc.value.vencidos + resumoVenc.value.hoje + resumoVenc.value.ate3)

// ---------- Saudação ----------
const agora = new Date()
const saudacao = agora.getHours() < 12 ? 'Bom dia' : agora.getHours() < 18 ? 'Boa tarde' : 'Boa noite'
const dataExtenso = (texto => texto.charAt(0).toUpperCase() + texto.slice(1))(agora.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }))
const tiposHoje = computed(() => auditoriasStore.tiposAuditoriaPorDia[agora.getDay()] || [])

// ---------- Agenda ----------
const agenda = computed(() => montarAgendaSemana(auditorias.value, auditoriasStore.tiposAuditoriaPorDia, agora))
const estadosAgenda = {
  meta: { rotulo: 'Na meta', icone: 'fas fa-circle-check', classe: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  foraMeta: { rotulo: 'Fora da meta', icone: 'fas fa-circle-xmark', classe: 'border-red-200 bg-red-50 text-red-800' },
  andamento: { rotulo: 'Em andamento', icone: 'fas fa-spinner', classe: 'border-blue-200 bg-blue-50 text-blue-800' },
  hoje: { rotulo: 'Criar hoje', icone: 'fas fa-plus', classe: 'border-blue-300 border-dashed bg-white text-blue-700' },
  atrasada: { rotulo: 'Não criada', icone: 'fas fa-triangle-exclamation', classe: 'border-amber-200 bg-amber-50 text-amber-800' },
  futura: { rotulo: 'Planejada', icone: 'fas fa-clock', classe: 'border-slate-200 bg-slate-50 text-slate-500' }
}
const abrirItemAgenda = (dia, item) => {
  if (item.auditoria) router.push(`/auditoria/${item.auditoria.id}`)
  else router.push({ path: '/auditorias', query: { data: dia.data, tipo: item.tipo } })
}

// ---------- Evolução ----------
const evolucao = computed(() => ['Etiqueta', 'Presença', 'Ruptura'].map(tipo => {
  const pontos = serieEvolucao(auditorias.value, tipo, 10)
  const atual = pontos.at(-1)
  const anterior = pontos.at(-2)
  return {
    tipo,
    pontos,
    atual: atual?.valor ?? null,
    variacao: atual && anterior ? atual.valor - anterior.valor : null,
    naMeta: atual ? atual.valor <= META_PENDENTE_PERCENTUAL : null
  }
}))

// ---------- Vencimentos ----------
const statusValidades = computed(() => {
  const r = resumoVenc.value
  if (!r.total) return { titulo: 'Sem dados de validades', classe: 'bg-slate-100 text-slate-600', icone: 'fas fa-circle-info' }
  if (r.vencidos > 0) return { titulo: 'Risco alto em validades', classe: 'bg-red-50 text-red-700', icone: 'fas fa-circle-exclamation' }
  if (r.hoje + r.ate3 > 0) return { titulo: 'Atenção aos próximos dias', classe: 'bg-amber-50 text-amber-700', icone: 'fas fa-triangle-exclamation' }
  return { titulo: 'Validades sob controle', classe: 'bg-emerald-50 text-emerald-700', icone: 'fas fa-circle-check' }
})

const faixasPrazo = computed(() => {
  const r = resumoVenc.value
  return [
    { chave: 'vencidos', rotulo: 'Vencidos', valor: r.vencidos, dica: 'Ação imediata na gôndola', icone: 'fas fa-exclamation-triangle', cor: 'red' },
    { chave: 'hoje', rotulo: 'Vencem hoje', valor: r.hoje, dica: 'Quebras e promoções', icone: 'fas fa-sun', cor: 'orange' },
    { chave: 'ate3', rotulo: 'Até 3 dias', valor: r.ate3, dica: 'Planejar giro e remarcação', icone: 'fas fa-hourglass-half', cor: 'amber' }
  ]
})
const coresFaixa = {
  red: 'border-red-100 bg-red-50 text-red-700 hover:border-red-300',
  orange: 'border-orange-100 bg-orange-50 text-orange-700 hover:border-orange-300',
  amber: 'border-amber-100 bg-amber-50 text-amber-700 hover:border-amber-300'
}

const setoresCriticos = computed(() => {
  const mapa = vencStore.analise?.porSetor || {}
  return Object.entries(mapa)
    .map(([nome, v]) => ({ nome, vencidos: v?.vencidos || 0, hoje: v?.hoje || 0, ate3: v?.ate3 || 0, total: v?.total || 0 }))
    .filter(s => s.vencidos || s.hoje || s.ate3)
    .sort((a, b) => (b.vencidos - a.vencidos) || (b.hoje - a.hoje) || (b.ate3 - a.ate3))
    .slice(0, 5)
})
const maiorCriticoSetor = computed(() => Math.max(1, ...setoresCriticos.value.map(s => s.vencidos + s.hoje + s.ate3)))

const itensCriticos = computed(() => {
  const rank = { vencidos: 0, hoje: 1, ate3: 2 }
  return (Array.isArray(vencStore.itens) ? vencStore.itens : [])
    .filter(i => i?._prazo in rank)
    .sort((a, b) => (rank[a._prazo] - rank[b._prazo]) || ((a._diasParaVencer ?? 9999) - (b._diasParaVencer ?? 9999)))
    .slice(0, 6)
})
const rotuloPrazo = { vencidos: 'Vencido', hoje: 'Hoje', ate3: 'Até 3 dias' }
const classePrazo = {
  vencidos: 'border-red-200 bg-red-50 text-red-700',
  hoje: 'border-orange-200 bg-orange-50 text-orange-700',
  ate3: 'border-amber-200 bg-amber-50 text-amber-700'
}
const descreverDias = (dias) => {
  if (dias === null || dias === undefined) return '-'
  if (dias < 0) return `há ${Math.abs(dias)} dia${Math.abs(dias) === 1 ? '' : 's'}`
  if (dias === 0) return 'hoje'
  return `em ${dias} dia${dias === 1 ? '' : 's'}`
}

// ---------- Últimas auditorias ----------
const ultimasAuditorias = computed(() => [...auditorias.value]
  .sort((a, b) => String(b.data).localeCompare(String(a.data)) || b.id - a.id)
  .slice(0, 5)
  .map(a => ({ ...a, metricas: metricasAuditoria(a) })))

// ---------- Backup e armazenamento ----------
const ultimoBackup = ref(obterUltimoBackup())
const armazenamento = ref(null)
const temDados = computed(() => totalAuditorias.value > 0 || resumoVenc.value.total > 0)
const lembrarBackup = computed(() => precisaLembrarBackup(ultimoBackup.value, temDados.value))
const percentualUso = computed(() => {
  const a = armazenamento.value
  return a?.cota ? Math.min(100, (a.usado / a.cota) * 100) : 0
})

onMounted(async () => {
  armazenamento.value = await obterUsoArmazenamento()
})

const protegerArmazenamento = async () => {
  const ok = await solicitarArmazenamentoPersistente()
  armazenamento.value = await obterUsoArmazenamento()
  auditoriasStore.addToast(
    ok ? 'Armazenamento protegido: o navegador não apagará os dados automaticamente.' : 'O navegador não permitiu proteger o armazenamento. Mantenha backups regulares.',
    ok ? 'success' : 'warning'
  )
}

const importarInput = ref(null)
const exportando = ref(false)

const handleExportarBackup = async () => {
  exportando.value = true
  try {
    const resultado = await exportarBackupJson()
    const reducao = resultado.tamanhoOriginal > 0 ? Math.round((1 - resultado.tamanhoFinal / resultado.tamanhoOriginal) * 100) : 0
    const detalhe = resultado.compactado ? `${formatarBytes(resultado.tamanhoFinal)} (${reducao}% menor)` : formatarBytes(resultado.tamanhoFinal)
    ultimoBackup.value = obterUltimoBackup()
    auditoriasStore.addToast(`Backup exportado: ${detalhe}.`, 'success')
  } catch (err) {
    auditoriasStore.addToast('Erro ao exportar backup: ' + (err?.message || 'desconhecido'), 'error')
  } finally {
    exportando.value = false
  }
}

const handleArquivoBackup = async (e) => {
  const arquivo = e.target.files?.[0]
  if (!arquivo) return
  try {
    const resultado = await importarBackupJson(arquivo)
    await auditoriasStore.carregarAuditoriasPersistidas()
    await vencStore.carregarVencimentosPersistidos()
    armazenamento.value = await obterUsoArmazenamento()
    const mensagem = resultado.origem === 'backup-regional'
      ? `Backup regional convertido: ${resultado.auditorias.length} auditorias importadas.`
      : 'Backup importado com sucesso!'
    auditoriasStore.addToast(mensagem, 'success')
  } catch (err) {
    auditoriasStore.addToast('Erro ao importar backup: ' + (err?.message || 'desconhecido'), 'error')
  } finally {
    e.target.value = ''
  }
}
</script>

<template>
  <div class="ui-page">
    <!-- Cabeçalho -->
    <header class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p class="text-sm font-semibold text-blue-600">{{ dataExtenso }}</p>
        <h1 class="mt-1 text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">{{ saudacao }}! Painel operacional</h1>
        <p class="mt-1 text-sm text-slate-500">
          <template v-if="tiposHoje.length">Hoje é dia de auditoria de <span class="font-semibold text-slate-700">{{ tiposHoje.join(', ') }}</span>.</template>
          <template v-else>Sem auditorias planejadas para hoje.</template>
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <UiButton variant="secondary" @click="abrirBusca">
          <i class="fas fa-search"></i>Buscar
        </UiButton>
        <UiButton v-for="tipo in tiposHoje" :key="tipo" :to="{ path: '/auditorias', query: { data: paraISOLocal(agora), tipo } }">
          <i class="fas fa-plus"></i>Nova {{ tipo }}
        </UiButton>
        <UiButton to="/vencimentos" variant="warning">
          <i class="fas fa-clock"></i>Validades
        </UiButton>
      </div>
    </header>

    <!-- Lembrete de backup -->
    <div v-if="lembrarBackup" class="ui-fade-in flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center">
      <span class="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
        <i class="fas fa-shield-halved"></i>
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-bold text-amber-900">{{ descreverUltimoBackup(ultimoBackup) }}</p>
        <p class="text-xs text-amber-800">Os dados ficam apenas neste navegador. Exporte um backup para não perder o histórico.</p>
      </div>
      <UiButton variant="warning" size="sm" :disabled="exportando" @click="handleExportarBackup">
        <i :class="exportando ? 'fas fa-spinner fa-spin' : 'fas fa-download'"></i>Fazer backup agora
      </UiButton>
    </div>

    <!-- KPIs -->
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard title="Itens críticos" :value="totalCriticosPrazo" description="Vencidos, hoje ou até 3 dias." icon="fas fa-bolt" tone="red" :critical="totalCriticosPrazo > 0" />
      <StatCard title="Itens monitorados" :value="resumoVenc.total" description="Itens com validade acompanhada." icon="fas fa-box-open" tone="green" />
      <StatCard title="Auditorias abertas" :value="auditoriasAbertas" :description="`${totalAuditorias} no histórico.`" icon="fas fa-clipboard-list" tone="blue" />
      <StatCard
        title="Taxa na meta"
        :value="taxaMeta === null ? '—' : `${taxaMeta}%`"
        :description="`Fechadas com até ${META_PENDENTE_PERCENTUAL}% pendente.`"
        icon="fas fa-bullseye"
        :tone="taxaMeta === null || taxaMeta >= 80 ? 'indigo' : 'amber'"
      />
    </div>

    <div class="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <div class="space-y-6 xl:col-span-2">
        <!-- Agenda da semana -->
        <section class="ui-card p-5 md:p-6">
          <div class="flex items-center justify-between gap-2">
            <div>
              <h2 class="text-lg font-bold text-slate-900">Agenda da semana</h2>
              <p class="text-xs text-slate-500">Auditorias planejadas e situação de cada uma.</p>
            </div>
            <RouterLink to="/auditorias" class="text-xs font-semibold text-blue-600 hover:underline">Calendário</RouterLink>
          </div>
          <div class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div
              v-for="dia in agenda"
              :key="dia.data"
              class="rounded-xl border p-3"
              :class="dia.ehHoje ? 'border-blue-300 bg-blue-50/40 ring-2 ring-blue-100' : 'border-slate-100'"
            >
              <p class="flex items-center justify-between text-xs font-semibold capitalize" :class="dia.ehHoje ? 'text-blue-700' : 'text-slate-500'">
                {{ dia.dia.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }) }}
                <span v-if="dia.ehHoje" class="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">Hoje</span>
              </p>
              <button
                v-for="item in dia.itens"
                :key="item.tipo"
                type="button"
                class="mt-2 flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition hover:-translate-y-0.5 hover:shadow-sm"
                :class="estadosAgenda[item.estado].classe"
                @click="abrirItemAgenda(dia, item)"
              >
                <i :class="[estadosAgenda[item.estado].icone, 'text-xs']"></i>
                <span class="min-w-0">
                  <span class="block truncate text-sm font-bold">{{ item.tipo }}</span>
                  <span class="block text-[11px] font-medium opacity-80">
                    {{ estadosAgenda[item.estado].rotulo }}<template v-if="item.auditoria"> · {{ metricasAuditoria(item.auditoria).percentualPendente.toFixed(1) }}%</template>
                  </span>
                </span>
              </button>
            </div>
          </div>
        </section>

        <!-- Evolução -->
        <section class="ui-card p-5 md:p-6">
          <div>
            <h2 class="text-lg font-bold text-slate-900">Evolução do % pendente</h2>
            <p class="text-xs text-slate-500">Últimas 10 auditorias de cada tipo. Linha tracejada = meta de {{ META_PENDENTE_PERCENTUAL }}%. Menor é melhor.</p>
          </div>
          <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <article v-for="serie in evolucao" :key="serie.tipo" class="rounded-xl border border-slate-100 p-4">
              <div class="flex items-start justify-between gap-2">
                <p class="text-xs font-bold uppercase tracking-wider text-slate-500">{{ serie.tipo }}</p>
                <span
                  v-if="serie.naMeta !== null"
                  class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold"
                  :class="serie.naMeta ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'"
                >
                  <i :class="serie.naMeta ? 'fas fa-check' : 'fas fa-xmark'"></i>{{ serie.naMeta ? 'Na meta' : 'Fora' }}
                </span>
              </div>
              <template v-if="serie.pontos.length">
                <div class="mt-1 flex items-baseline gap-2">
                  <p class="text-2xl font-bold tracking-tight text-slate-900">{{ serie.atual.toFixed(1) }}%</p>
                  <p v-if="serie.variacao !== null" class="text-xs font-semibold text-slate-500">
                    <i :class="serie.variacao <= 0 ? 'fas fa-arrow-down' : 'fas fa-arrow-up'"></i>
                    {{ Math.abs(serie.variacao).toFixed(1) }} p.p.
                  </p>
                </div>
                <SparklineMeta
                  class="mt-3"
                  :pontos="serie.pontos"
                  :meta="META_PENDENTE_PERCENTUAL"
                  @selecionar="p => router.push(`/auditoria/${p.id}`)"
                />
              </template>
              <p v-else class="mt-6 pb-6 text-center text-xs text-slate-400">Sem auditorias deste tipo.</p>
            </article>
          </div>
        </section>

        <!-- Validades -->
        <section class="ui-card p-5 md:p-6">
          <div class="flex items-center justify-between gap-2">
            <div>
              <h2 class="text-lg font-bold text-slate-900">Saúde das validades</h2>
              <p class="text-xs text-slate-500">{{ resumoVenc.total }} itens monitorados. Clique para filtrar.</p>
            </div>
            <span class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold" :class="statusValidades.classe">
              <i :class="statusValidades.icone"></i>{{ statusValidades.titulo }}
            </span>
          </div>
          <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <RouterLink
              v-for="faixa in faixasPrazo"
              :key="faixa.chave"
              :to="{ path: '/vencimentos', query: { prazo: faixa.chave } }"
              class="group rounded-xl border p-4 transition"
              :class="coresFaixa[faixa.cor]"
            >
              <div class="flex items-center justify-between">
                <p class="text-xs font-semibold">{{ faixa.rotulo }}</p>
                <i :class="[faixa.icone, 'text-xs opacity-70']"></i>
              </div>
              <p class="mt-2 text-3xl font-bold">{{ faixa.valor }}</p>
              <p class="mt-1 flex items-center justify-between text-[11px] opacity-80">
                {{ faixa.dica }}
                <i class="fas fa-arrow-right opacity-0 transition group-hover:opacity-100"></i>
              </p>
            </RouterLink>
          </div>

          <div class="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div>
              <div class="mb-2 flex items-center justify-between">
                <h3 class="text-sm font-semibold text-slate-900">Setores mais críticos</h3>
                <RouterLink to="/vencimentos" class="text-xs font-medium text-blue-600 hover:underline">Ver todos</RouterLink>
              </div>
              <p v-if="!setoresCriticos.length" class="rounded-xl bg-slate-50 px-3 py-6 text-center text-xs text-slate-500">Sem setores críticos.</p>
              <ul v-else class="space-y-2">
                <li v-for="s in setoresCriticos" :key="s.nome">
                  <RouterLink :to="{ path: '/vencimentos', query: { setor: s.nome } }" class="block rounded-lg px-2 py-1.5 transition hover:bg-slate-50">
                    <div class="flex items-center justify-between gap-2 text-xs">
                      <span class="truncate font-semibold text-slate-800">{{ s.nome }}</span>
                      <span class="shrink-0 text-slate-500">{{ s.vencidos }} venc. · {{ s.hoje }} hoje · {{ s.ate3 }} até 3d</span>
                    </div>
                    <div class="mt-1.5 flex h-2 gap-0.5 overflow-hidden rounded-full bg-slate-100">
                      <span v-if="s.vencidos" class="rounded-full bg-red-500" :style="{ width: `${(s.vencidos / maiorCriticoSetor) * 100}%` }"></span>
                      <span v-if="s.hoje" class="rounded-full bg-orange-400" :style="{ width: `${(s.hoje / maiorCriticoSetor) * 100}%` }"></span>
                      <span v-if="s.ate3" class="rounded-full bg-amber-300" :style="{ width: `${(s.ate3 / maiorCriticoSetor) * 100}%` }"></span>
                    </div>
                  </RouterLink>
                </li>
              </ul>
            </div>

            <div>
              <div class="mb-2 flex items-center justify-between">
                <h3 class="text-sm font-semibold text-slate-900">Itens mais urgentes</h3>
                <RouterLink :to="{ path: '/vencimentos', query: { prazo: 'vencidos' } }" class="text-xs font-medium text-blue-600 hover:underline">Ver todos</RouterLink>
              </div>
              <p v-if="!itensCriticos.length" class="rounded-xl bg-slate-50 px-3 py-6 text-center text-xs text-slate-500">Sem itens críticos.</p>
              <ul v-else class="divide-y divide-slate-100">
                <li v-for="i in itensCriticos" :key="i._codigo + '-' + i._validadeISO" class="flex items-center justify-between gap-3 py-2">
                  <div class="min-w-0">
                    <p class="truncate text-xs font-semibold text-slate-900">{{ i._produto || i['Produto'] || '-' }}</p>
                    <p class="truncate text-[11px] text-slate-500">{{ i._codigo || '-' }} · {{ i._setor || '-' }}</p>
                  </div>
                  <div class="shrink-0 text-right">
                    <span class="inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold" :class="classePrazo[i._prazo]">{{ rotuloPrazo[i._prazo] }}</span>
                    <p class="mt-0.5 text-[11px] text-slate-500">{{ formatarDataBR(i._validadeISO) }} · {{ descreverDias(i._diasParaVencer) }}</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </section>
      </div>

      <aside class="space-y-6">
        <!-- Últimas auditorias -->
        <section class="ui-card">
          <div class="flex items-center justify-between border-b border-slate-100 p-4">
            <div>
              <h2 class="text-sm font-bold text-slate-900 md:text-base">Últimas auditorias</h2>
              <p class="text-[11px] text-slate-500">{{ auditoriasAbertas }} em andamento · {{ auditoriasFechadas.length }} fechadas</p>
            </div>
            <RouterLink to="/auditorias" class="text-xs font-medium text-blue-600 hover:underline">Ver todas</RouterLink>
          </div>
          <p v-if="!ultimasAuditorias.length" class="p-6 text-center text-sm text-slate-500">Sem auditorias registradas.</p>
          <ul v-else class="divide-y divide-slate-100">
            <li v-for="a in ultimasAuditorias" :key="a.id">
              <RouterLink :to="'/auditoria/' + a.id" class="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50">
                <span
                  class="inline-flex size-9 shrink-0 items-center justify-center rounded-xl"
                  :class="a.status === 'fechada' ? 'bg-slate-100 text-slate-500' : 'bg-blue-50 text-blue-600'"
                >
                  <i :class="a.status === 'fechada' ? 'fas fa-lock' : 'fas fa-clipboard-list'" class="text-xs"></i>
                </span>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-semibold text-slate-900">{{ a.tipo || '-' }}</p>
                  <p class="text-[11px] text-slate-500">{{ formatarDataBR(a.data) }} · {{ a.status === 'fechada' ? 'Fechada' : 'Em andamento' }}</p>
                </div>
                <div class="text-right">
                  <p class="text-sm font-bold" :class="a.metricas.percentualPendente <= META_PENDENTE_PERCENTUAL ? 'text-emerald-700' : 'text-red-700'">
                    {{ a.metricas.percentualPendente.toFixed(1) }}%
                  </p>
                  <p class="text-[10px] text-slate-400">pendente</p>
                </div>
              </RouterLink>
            </li>
          </ul>
        </section>

        <!-- Dados locais -->
        <section class="ui-card space-y-4 p-5">
          <div>
            <h2 class="text-sm font-bold text-slate-900 md:text-base">Dados e backup</h2>
            <p class="text-[11px] text-slate-500">Tudo fica salvo apenas neste navegador.</p>
          </div>

          <div class="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
            <i class="fas fa-clock-rotate-left text-slate-400"></i>
            <p class="text-xs font-medium" :class="lembrarBackup ? 'text-amber-700' : 'text-slate-700'">{{ descreverUltimoBackup(ultimoBackup) }}</p>
          </div>

          <div v-if="armazenamento" class="space-y-1.5">
            <div class="flex justify-between text-xs">
              <span class="font-medium text-slate-600">Espaço usado</span>
              <span class="text-slate-500">{{ formatarBytes(armazenamento.usado) }} de {{ formatarBytes(armazenamento.cota) }}</span>
            </div>
            <div class="h-2 overflow-hidden rounded-full bg-slate-100">
              <div class="h-full rounded-full" :class="percentualUso > 80 ? 'bg-red-500' : 'bg-blue-600'" :style="{ width: `${Math.max(1, percentualUso)}%` }"></div>
            </div>
            <p class="flex items-center gap-1.5 text-[11px]" :class="armazenamento.persistente ? 'text-emerald-700' : 'text-slate-500'">
              <i :class="armazenamento.persistente ? 'fas fa-lock' : 'fas fa-lock-open'"></i>
              {{ armazenamento.persistente ? 'Armazenamento protegido contra limpeza automática' : 'O navegador pode apagar os dados se faltar espaço' }}
            </p>
            <button
              v-if="!armazenamento.persistente"
              type="button"
              class="text-xs font-semibold text-blue-600 hover:underline"
              @click="protegerArmazenamento"
            >
              Proteger armazenamento
            </button>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <UiButton variant="success" size="sm" :disabled="exportando" @click="handleExportarBackup">
              <i :class="exportando ? 'fas fa-spinner fa-spin' : 'fas fa-download'"></i>Exportar
            </UiButton>
            <UiButton variant="dark" size="sm" @click="importarInput?.click()">
              <i class="fas fa-upload"></i>Importar
            </UiButton>
          </div>
          <input
            ref="importarInput"
            type="file"
            accept=".json,.gz,.json.gz,application/json,application/gzip"
            class="hidden"
            @change="handleArquivoBackup"
          >
        </section>
      </aside>
    </div>
  </div>
</template>
