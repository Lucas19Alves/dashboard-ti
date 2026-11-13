<script setup>
import { ref, computed } from 'vue'
import UploadAnaliseAuditoria from './UploadAnaliseAuditoria.vue'
import ComparativoAnterior from './ComparativoAnterior.vue'
import PrevisaoAuditoria from './PrevisaoAuditoria.vue'
import { isItemLido } from '../utils/itemLido'
import { getSetorItem } from '../utils/detalheAuditoria'
import { extrairDataISOPlanilha } from '../utils/auditoriaHorario'
import { useAuditoriasStore } from '../stores/auditoriasStore'

// Aba "Visão geral" do detalhe da auditoria: previsão, métricas, andamento e mapa de leituras por horário.
const props = defineProps({
  auditoria: { type: Object, required: true },
  metricas: { type: Object, default: () => ({}) },
  somenteLeitura: { type: Boolean, default: false },
  horaDoItem: { type: Function, default: null },
  valorHora: { type: Function, default: null },
  normalizar: { type: Function, default: null },
})
const emit = defineEmits(['abrir-metrica', 'upload-completo'])
const store = useAuditoriasStore()
const auditoria = computed(() => props.auditoria)
const metricasGerais = computed(() => props.metricas)
const readOnly = computed(() => props.somenteLeitura)
const abrirModalMetrica = (...args) => emit('abrir-metrica', ...args)
const handleUploadCompleto = (...args) => emit('upload-completo', ...args)
const getItemHour = (...args) => props.horaDoItem?.(...args)
const normalizar = (...args) => props.normalizar?.(...args)
const getHoraValor = (...args) => props.valorHora?.(...args)

// Extrai a data ISO (YYYY-MM-DD) de um item, tentando todas as colunas "Auditado em"
// (incluindo _1, _2 do XLSX) e, por fim, o valor de hora.
const getItemDateISO = (item) => {
  const chaves = Object.keys(item).filter(k => {
    const n = k.toLowerCase()
    return n.startsWith('auditado em') || n.startsWith('auditado_em')
  })
  for (const chave of chaves) {
    const resultado = extrairDataISOPlanilha(item[chave])
    if (resultado) return resultado
  }
  return extrairDataISOPlanilha(getHoraValor(item))
}

const filtroHorarioUsuario = ref('todos')
const filtroHorarioSetor = ref('todos')

const filtroAndamentoSetor = ref('todos')

const leituraPorHoraFiltrada = computed(() => {
  if (!auditoria.value?.dados) return null
  const dados = auditoria.value.dados
  const auditoriaDia = String(auditoria.value.data || '').slice(0, 10)

  const contagem = {}
  for (let h = 6; h <= 22; h++) contagem[h] = 0

  let totalLeituras = 0

  dados.forEach(item => {
    if (!isItemLido(item)) return

    // Filtro de data: somente itens auditados no dia da auditoria
    if (auditoriaDia) {
      const dataItemISO = getItemDateISO(item)
      if (dataItemISO && dataItemISO !== auditoriaDia) return
    }

    // Filtro de usuário
    if (filtroHorarioUsuario.value !== 'todos') {
      const usuario = (item['Usuário'] || item['Usuario'] || '').toString().trim()
      if (usuario !== filtroHorarioUsuario.value) return
    }

    // Filtro de setor
    if (filtroHorarioSetor.value !== 'todos') {
      const setor = getSetorItem(item)
      if (setor !== filtroHorarioSetor.value) return
    }

    const h = getItemHour(item)
    if (h != null && h >= 6 && h <= 22) {
      contagem[h] = (contagem[h] || 0) + 1
      totalLeituras++
    }
  })

  // Construir a série do mapa de quantidade.
  const serie = []
  let horasComLeitura = 0
  for (let h = 6; h <= 22; h++) {
    const valor = contagem[h] || 0
    if (valor > 0) horasComLeitura++
    const label = String(h).padStart(2, '0') + ':00'
    serie.push({ hora: label, horaNum: h, valor, variacao: 0 })
  }

  // Calcular variação % entre horas consecutivas
  for (let i = 1; i < serie.length; i++) {
    const anterior = serie[i - 1].valor
    const atual = serie[i].valor
    if (anterior > 0 && atual > 0) {
      serie[i].variacao = Math.round(((atual - anterior) / anterior) * 100)
    } else if (anterior === 0 && atual > 0) {
      serie[i].variacao = 100
    } else if (anterior > 0 && atual === 0) {
      serie[i].variacao = -100
    }
  }

  const max = serie.reduce((m, p) => Math.max(m, p.valor), 0)
  const media = horasComLeitura > 0 ? Math.round(totalLeituras / horasComLeitura) : 0

  // Filtrar série para exibir somente horários relevantes (com dados OU entre horários com dados)
  let primeiroIdx = serie.findIndex(s => s.valor > 0)
  let ultimoIdx = serie.length - 1
  for (let i = serie.length - 1; i >= 0; i--) {
    if (serie[i].valor > 0) { ultimoIdx = i; break }
  }
  const serieVisivel = primeiroIdx >= 0 ? serie.slice(Math.max(0, primeiroIdx - 1), ultimoIdx + 2) : serie

  // Insights
  const comLeitura = serie.filter(s => s.valor > 0)
  const pico = comLeitura.length > 0 ? comLeitura.reduce((a, b) => a.valor >= b.valor ? a : b) : null
  const baixa = comLeitura.length > 0 ? comLeitura.reduce((a, b) => a.valor <= b.valor ? a : b) : null

  let maiorSubida = null
  let maiorQueda = null
  for (let i = 1; i < serie.length; i++) {
    if (serie[i].valor === 0 && serie[i - 1].valor === 0) continue
    if (serie[i].variacao > 0 && (!maiorSubida || serie[i].variacao > maiorSubida.variacao)) {
      maiorSubida = { de: serie[i - 1].hora, para: serie[i].hora, variacao: serie[i].variacao }
    }
    if (serie[i].variacao < 0 && (!maiorQueda || serie[i].variacao < maiorQueda.variacao)) {
      maiorQueda = { de: serie[i - 1].hora, para: serie[i].hora, variacao: serie[i].variacao }
    }
  }

  return {
    serie: serieVisivel,
    max,
    totalLeituras,
    media,
    pico,
    baixa,
    maiorSubida,
    maiorQueda
  }
})

const isItemConcluidoNaAuditoria = (item) => {
  if (!item) return false
  const situacao = normalizar(item._situacao || item['Situação'] || item['Situação atual da auditoria'] || '')
  if (
    item._lidoNaoPertence === true ||
    situacao.includes('lido nao pertence') ||
    situacao.includes('lido sem estoque')
  ) return false

  if (auditoria.value?.tipo === 'Etiqueta') {
    return situacao.includes('atualizado') || situacao.includes('desatualizado')
  }

  if (item._temPresenca !== true) return false
  if (item._temEstoqueSituacao === false) return false
  if (item._estoque !== undefined && Number(item._estoque) <= 0) return false
  return true
}

// Evolução acumulada da auditoria, com visão geral ou recorte por setor.

// Evolução acumulada da auditoria, com visão geral ou recorte por setor.
const andamentoAuditoriaPorHora = computed(() => {
  if (!auditoria.value?.dados || !metricasGerais.value?.totalItens) return null

  const auditoriaDia = String(auditoria.value.data || '').slice(0, 10)
  const setorSelecionado = filtroAndamentoSetor.value
  const dadosSetor = setorSelecionado !== 'todos'
    ? auditoria.value.analise?.porSetor?.[setorSelecionado]
    : null
  const totalAuditavel = setorSelecionado === 'todos'
    ? Number(metricasGerais.value.totalItens || 0)
    : Number((dadosSetor?.lidos || 0) + (dadosSetor?.pendentes || 0))
  const totalLidosAtual = setorSelecionado === 'todos'
    ? Number(metricasGerais.value.totalLidos || 0)
    : Number(dadosSetor?.lidos || 0)

  if (totalAuditavel <= 0) return null

  const contagem = {}
  for (let h = 0; h <= 23; h++) contagem[h] = 0

  auditoria.value.dados.forEach(item => {
    if (setorSelecionado !== 'todos' && getSetorItem(item) !== setorSelecionado) return
    if (!isItemConcluidoNaAuditoria(item)) return
    if (auditoriaDia) {
      const dataItemISO = getItemDateISO(item)
      if (dataItemISO && dataItemISO !== auditoriaDia) return
    }
    const hora = getItemHour(item)
    if (hora != null && hora >= 0 && hora <= 23) contagem[hora]++
  })

  let acumulado = 0
  const serie = []
  for (let h = 0; h <= 23; h++) {
    const leituras = contagem[h] || 0
    acumulado += leituras
    serie.push({
      hora: `${String(h).padStart(2, '0')}:00`,
      leituras,
      acumulado,
      percentual: totalAuditavel > 0 ? Math.min(100, (acumulado / totalAuditavel) * 100) : 0
    })
  }

  const primeiroIdx = serie.findIndex(ponto => ponto.leituras > 0)
  let ultimoIdx = -1
  for (let i = serie.length - 1; i >= 0; i--) {
    if (serie[i].leituras > 0) { ultimoIdx = i; break }
  }
  if (primeiroIdx < 0 || ultimoIdx < 0) {
    return {
      serie: [],
      totalAuditavel,
      totalComHorario: 0,
      semHorario: totalLidosAtual,
      percentualFinal: totalAuditavel > 0 ? Math.min(100, (totalLidosAtual / totalAuditavel) * 100) : 0
    }
  }

  const semHorario = Math.max(0, totalLidosAtual - acumulado)
  const serieVisivel = serie.slice(Math.max(0, primeiroIdx - 1), Math.min(serie.length, ultimoIdx + 2))
  // Ruptura: itens sem horário já tinham presença confirmada (não precisaram de leitura),
  // então contam desde o início do dia; a curva mostra só o avanço das leituras.
  const baseInicial = auditoria.value?.tipo === 'Ruptura' && semHorario > 0
  if (baseInicial) {
    for (const ponto of serieVisivel) {
      ponto.acumulado += semHorario
      ponto.percentual = Math.min(100, (ponto.acumulado / totalAuditavel) * 100)
    }
  } else if (semHorario > 0) {
    serieVisivel.push({
      hora: 'Sem horário',
      leituras: semHorario,
      acumulado: totalLidosAtual,
      percentual: totalAuditavel > 0 ? Math.min(100, (totalLidosAtual / totalAuditavel) * 100) : 0
    })
  }

  return {
    serie: serieVisivel,
    totalAuditavel,
    totalComHorario: acumulado,
    semHorario,
    baseInicial,
    percentualFinal: totalAuditavel > 0 ? Math.min(100, (totalLidosAtual / totalAuditavel) * 100) : 0
  }
})


const graficoAndamento = computed(() => {
  const serie = andamentoAuditoriaPorHora.value?.serie || []
  if (serie.length === 0) return null

  const largura = 1000
  const altura = 300
  const margem = { esquerda: 55, direita: 25, topo: 25, base: 55 }
  const larguraUtil = largura - margem.esquerda - margem.direita
  const alturaUtil = altura - margem.topo - margem.base
  const divisor = Math.max(1, serie.length - 1)
  // Eixo Y começa em 0; na Ruptura com itens já confirmados, aproxima para ver o avanço das leituras.
  const menor = Math.min(...serie.map(p => p.percentual))
  const bruto = andamentoAuditoriaPorHora.value?.baseInicial ? Math.max(0, menor - 5) : 0
  const passo = 100 - bruto <= 20 ? 5 : 100 - bruto <= 50 ? 10 : 25
  const minimo = Math.floor(bruto / passo) * passo
  const y = valor => margem.topo + ((100 - Math.min(100, Math.max(minimo, valor))) / (100 - minimo)) * alturaUtil
  const niveis = Array.from({ length: (100 - minimo) / passo + 1 }, (_, i) => 100 - i * passo)
  const pontos = serie.map((ponto, indice) => ({
    ...ponto,
    rotulo: ponto.hora === 'Sem horário' ? 'Atual' : ponto.hora,
    x: margem.esquerda + (indice / divisor) * larguraUtil,
    y: y(ponto.percentual)
  }))

  return {
    largura,
    altura,
    margem,
    alturaUtil,
    niveis,
    y,
    pontos,
    linha: pontos.map(ponto => `${ponto.x},${ponto.y}`).join(' '),
    area: `${margem.esquerda},${margem.topo + alturaUtil} ${pontos.map(ponto => `${ponto.x},${ponto.y}`).join(' ')} ${pontos[pontos.length - 1].x},${margem.topo + alturaUtil}`
  }
})

// =========== USUÁRIOS ===========
</script>

<template>
  <div class="space-y-8">
    <p v-if="!auditoria.dados?.length && !store.itensCarregados" class="ui-card flex items-center gap-2 px-4 py-6 text-sm text-slate-500">
      <i class="fas fa-spinner fa-spin"></i>Carregando os itens desta auditoria...
    </p>
    <div v-else-if="(!auditoria.dados || auditoria.dados.length === 0) && !readOnly" class="bg-blue-50 border-2 border-blue-300 rounded-lg p-12">
      <div class="text-center">
        <i class="fas fa-cloud-upload-alt text-6xl text-blue-500 mb-6"></i>
        <h3 class="text-2xl font-bold text-gray-800 mb-3">Nenhum dado carregado</h3>
        <p class="text-gray-600 mb-8 text-lg">Faça upload de um arquivo Excel para começar a análise</p>
        <UploadAnaliseAuditoria 
          :auditoria="auditoria"
          @analiseCompleta="handleUploadCompleto"
        />
      </div>
    </div>

    <!-- Métricas Gerais -->
    <template v-else>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          @click="abrirModalMetrica('total')"
          class="bg-white rounded-xl p-5 shadow-sm cursor-pointer transition flex flex-col gap-2"
        >
          <div class="flex items-center justify-between">
            <p class="text-xs font-semibold text-slate-500">Total Auditável</p>
            <i class="fas fa-clipboard-list text-sm shrink-0 text-slate-400" aria-hidden="true"></i>
          </div>
          <p class="text-3xl font-bold text-slate-900">{{ metricasGerais?.totalItens }}</p>
          <p class="text-[11px] text-slate-400">Itens para auditar</p>
        </div>
        <div
          @click="abrirModalMetrica('lidos')"
          class="bg-white rounded-xl p-5 shadow-sm cursor-pointer transition flex flex-col gap-2"
        >
          <div class="flex items-center justify-between">
            <p class="text-xs font-semibold text-slate-500">Total Lidos</p>
            <i class="fas fa-check-circle text-sm shrink-0 text-slate-400" aria-hidden="true"></i>
          </div>
          <p class="text-3xl font-bold text-slate-900">{{ metricasGerais?.totalLidos }}</p>
          <p class="text-[11px] text-slate-400">{{ metricasGerais?.percentualConclusao?.toFixed(2) }}% concluído  |  Meta: {{ metricasGerais?.metaConclusao }}%</p>
        </div>
        <div
          @click="abrirModalMetrica('pendentes')"
          class="bg-white rounded-xl p-5 shadow-sm cursor-pointer transition flex flex-col gap-2"
        >
          <div class="flex items-center justify-between">
            <p class="text-xs font-semibold text-slate-500">Pendentes</p>
            <i class="fas fa-hourglass-half text-sm shrink-0 text-slate-400" aria-hidden="true"></i>
          </div>
          <p class="text-3xl font-bold text-amber-700">{{ metricasGerais?.pendentes }}</p>
          <p class="text-[11px]" :class="metricasGerais?.percentualPendente <= 3 ? 'text-emerald-500' : 'text-red-500'">
            {{ metricasGerais?.percentualPendente?.toFixed(2) }}% pendente  |  Meta: {{ metricasGerais?.metaPendente }}%
            <span v-if="metricasGerais?.faltaParaMeta > 0"> (+{{ metricasGerais?.faltaParaMeta.toFixed(2) }}%)</span>
          </p>
        </div>
        <div
          @click="abrirModalMetrica('problema')"
          class="bg-white rounded-xl p-5 shadow-sm cursor-pointer transition flex flex-col gap-2"
        >
          <div class="flex items-center justify-between">
            <p class="text-xs font-semibold text-slate-500">Com Problema</p>
            <i class="fas fa-exclamation-triangle text-sm shrink-0 text-slate-400" aria-hidden="true"></i>
          </div>
          <p class="text-3xl font-bold text-red-700">{{ metricasGerais?.comProblema }}</p>
          <p class="text-[11px] text-slate-400">Requer atenção</p>
        </div>
      </div>

      <ComparativoAnterior :auditoria="auditoria" :historico="store.auditorias" />

      <div v-if="auditoria?.tipo === 'Etiqueta'" class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div class="bg-white rounded-xl p-5 shadow-sm flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <p class="text-xs font-semibold text-slate-500">Atualizado</p>
            <i class="fas fa-sync-alt text-sm shrink-0 text-slate-400" aria-hidden="true"></i>
          </div>
          <p class="text-3xl font-bold text-slate-900">{{ metricasGerais?.atualizados || 0 }}</p>
          <p class="text-[11px] text-slate-400">Lidos e corretos</p>
        </div>
        <div
          @click="abrirModalMetrica('desatualizado')"
          class="bg-white rounded-xl p-5 shadow-sm cursor-pointer transition flex flex-col gap-2"
        >
          <div class="flex items-center justify-between">
            <p class="text-xs font-semibold text-slate-500">Desatualizado</p>
            <i class="fas fa-history text-sm shrink-0 text-slate-400" aria-hidden="true"></i>
          </div>
          <p class="text-3xl font-bold text-yellow-600">{{ metricasGerais?.desatualizados || 0 }}</p>
          <p class="text-[11px] text-slate-400">Lidos mas desatualizados</p>
        </div>
      </div>

      <!-- Previsão de fechamento (auditoria em andamento) -->
      <PrevisaoAuditoria v-if="auditoria.status !== 'fechada'" :auditoria="auditoria" :fim="store.horariosAuditoria?.fim || '20:00'" />

      <!-- Andamento acumulado da auditoria completa por horário -->
      <div v-if="auditoria?.dados?.length" class="bg-white rounded-xl p-6 shadow-sm">
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
          <div>
            <h3 class="font-bold text-lg text-gray-800 flex items-center gap-2">
              <i class="fas fa-chart-line text-sm shrink-0 text-slate-400" aria-hidden="true"></i>
              Andamento da Auditoria por Horário
            </h3>
            <p class="text-xs text-slate-400 mt-1">Percentual acumulado ao longo do dia{{ filtroAndamentoSetor === 'todos' ? ' na auditoria completa' : ` no setor ${filtroAndamentoSetor}` }}.</p>
          </div>
          <div class="flex flex-col sm:flex-row gap-2 sm:items-center">
            <select
              v-model="filtroAndamentoSetor"
              class="px-3 py-2 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500 max-w-xs"
              aria-label="Filtrar andamento por setor"
            >
              <option value="todos">Todos os setores</option>
              <option v-for="s in Object.keys(auditoria?.analise?.porSetor || {})" :key="s" :value="s">{{ s }}</option>
            </select>
            <div v-if="andamentoAuditoriaPorHora" class="rounded-lg bg-slate-50 px-4 py-2 text-right shrink-0">
              <p class="text-xs font-semibold text-slate-500">Progresso atual</p>
              <p class="text-xl font-semibold text-slate-900">{{ andamentoAuditoriaPorHora.percentualFinal.toFixed(2) }}%</p>
            </div>
          </div>
        </div>

        <div v-if="graficoAndamento" class="overflow-x-auto">
          <div class="min-w-[720px]">
            <svg
              class="w-full h-auto"
              :viewBox="`0 0 ${graficoAndamento.largura} ${graficoAndamento.altura}`"
              role="img"
              :aria-label="`Evolução percentual por horário para ${filtroAndamentoSetor === 'todos' ? 'todos os setores' : filtroAndamentoSetor}`"
            >
              <defs>
                <linearGradient id="andamento-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#1d4ed8" stop-opacity="0.10" />
                  <stop offset="100%" stop-color="#1d4ed8" stop-opacity="0.10" />
                </linearGradient>
              </defs>

              <g v-for="nivel in graficoAndamento.niveis" :key="nivel">
                <line
                  :x1="graficoAndamento.margem.esquerda"
                  :x2="graficoAndamento.largura - graficoAndamento.margem.direita"
                  :y1="graficoAndamento.y(nivel)"
                  :y2="graficoAndamento.y(nivel)"
                  stroke="#e2e8f0"
                  stroke-width="1"
                />
                <text
                  :x="graficoAndamento.margem.esquerda - 10"
                  :y="graficoAndamento.y(nivel) + 4"
                  text-anchor="end"
                  class="fill-slate-400 text-[11px]"
                >{{ nivel }}%</text>
              </g>

              <polygon :points="graficoAndamento.area" fill="url(#andamento-area)" />
              <polyline
                :points="graficoAndamento.linha"
                fill="none"
                stroke="#1d4ed8"
                stroke-width="4"
                stroke-linecap="round"
                stroke-linejoin="round"
              />

              <g v-for="p in graficoAndamento.pontos" :key="`ponto-${p.rotulo}`">
                <line
                  :x1="p.x"
                  :x2="p.x"
                  :y1="p.y"
                  :y2="graficoAndamento.margem.topo + graficoAndamento.alturaUtil"
                  stroke="#c4b5fd"
                  stroke-width="1"
                  stroke-dasharray="3 4"
                />
                <circle :cx="p.x" :cy="p.y" r="6" fill="#ffffff" stroke="#1d4ed8" stroke-width="4" />
                <text :x="p.x" :y="Math.max(14, p.y - 13)" text-anchor="middle" class="fill-slate-700 text-[11px] font-bold">
                  {{ p.percentual.toFixed(1) }}%
                </text>
                <text :x="p.x" :y="graficoAndamento.altura - 22" text-anchor="middle" class="fill-slate-500 text-[11px] font-medium">
                  {{ p.rotulo }}
                </text>
              </g>
            </svg>

            <div v-if="andamentoAuditoriaPorHora?.semHorario > 0" class="mt-1 text-right text-[11px] text-slate-400">
              <template v-if="andamentoAuditoriaPorHora.baseInicial">{{ andamentoAuditoriaPorHora.semHorario.toLocaleString('pt-BR') }} item(ns) com presença confirmada sem leitura contam desde o início; a curva mostra o avanço das leituras.</template>
              <template v-else>{{ andamentoAuditoriaPorHora.semHorario.toLocaleString('pt-BR') }} item(ns) sem horário foram incorporados no ponto “Atual”.</template>
            </div>
          </div>
        </div>
        <div v-else class="py-8 text-center text-sm text-slate-400">
          Não há leituras com horário para o setor selecionado.
        </div>
      </div>

      <!-- Progress Geral -->
      <div class="bg-white rounded-xl p-6 shadow-sm">
        <h3 class="font-bold text-lg text-gray-800 mb-4">Progresso Geral da Auditoria</h3>
        <div class="space-y-3">
          <div class="space-y-4">
            <!-- Conclusão -->
            <div>
              <div class="flex justify-between text-sm mb-2">
                <span class="text-gray-700 font-medium">Concluído (Lidos + Problemas)</span>
                <span class="font-bold text-green-600">{{ metricasGerais?.percentualConclusao?.toFixed(2) }}%</span>
              </div>
              <div class="w-full h-6 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  :style="{ width: Math.min(metricasGerais?.percentualConclusao || 0, 100) + '%' }"
                  class="h-full bg-green-600 transition-all duration-500"
                />
              </div>
              <p class="text-xs text-gray-600 mt-1">
                {{ metricasGerais?.totalLidos }} de {{ metricasGerais?.totalItens }} itens lidos | Meta: {{ metricasGerais?.metaConclusao }}%
              </p>
            </div>
                
            <!-- Pendente -->
            <div>
              <div class="flex justify-between text-sm mb-2">
                <span class="text-gray-700 font-medium">Pendente</span>
                <span class="font-bold" :class="metricasGerais?.percentualPendente <= 3 ? 'text-green-600' : 'text-orange-600'">
                  {{ metricasGerais?.percentualPendente?.toFixed(2) }}%
                </span>
              </div>
              <div class="w-full h-6 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  :style="{ width: Math.min(metricasGerais?.percentualPendente || 0, 100) + '%' }"
                  class="h-full bg-orange-600 transition-all duration-500"
                />
              </div>
              <p class="text-xs mt-1" :class="metricasGerais?.percentualPendente <= 3 ? 'text-green-600' : 'text-orange-600'">
                {{ metricasGerais?.pendentes }} itens pendentes | Meta: {{ metricasGerais?.metaPendente }}%
                <span v-if="metricasGerais?.faltaParaMeta > 0" class="font-bold">
                  (Faltam {{ metricasGerais?.faltaParaMeta.toFixed(2) }}% para meta)
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Mapa de Leituras por Horário -->
      <div class="bg-white rounded-xl p-6 shadow-sm">
        <div>
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h3 class="font-bold text-lg text-gray-800">
              <i class="fas fa-clock text-blue-600 mr-2"></i>Mapa de Leituras por Horário
            </h3>
            <div class="flex flex-wrap gap-2">
              <select
                v-model="filtroHorarioUsuario"
                class="px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="todos">Todos os usuários</option>
                <option v-for="u in (auditoria?.analise?.usuarios || [])" :key="u" :value="u">{{ u }}</option>
              </select>
              <select
                v-model="filtroHorarioSetor"
                class="px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="todos">Todos os setores</option>
                <option v-for="s in Object.keys(auditoria?.analise?.porSetor || {})" :key="s" :value="s">{{ s }}</option>
              </select>
            </div>
          </div>

          <div v-if="leituraPorHoraFiltrada && leituraPorHoraFiltrada.totalLeituras > 0">
            <!-- Cards Resumo -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <div class="rounded-xl bg-blue-50/70 p-3 text-center">
                <p class="text-xs font-semibold text-blue-500">Total Leituras</p>
                <p class="text-2xl font-bold text-slate-900 mt-1">{{ leituraPorHoraFiltrada.totalLeituras.toLocaleString() }}</p>
              </div>
              <div class="rounded-xl bg-emerald-50/70 p-3 text-center">
                <p class="text-xs font-semibold text-emerald-500">Horário de Pico</p>
                <p class="text-2xl font-bold text-slate-900 mt-1">{{ leituraPorHoraFiltrada.pico?.hora || '--' }}</p>
                <p class="text-[10px] text-emerald-500">{{ leituraPorHoraFiltrada.pico?.valor || 0 }} leituras</p>
              </div>
              <div class="rounded-xl bg-slate-50 p-3 text-center">
                <p class="text-xs font-semibold text-slate-500">Média/Hora</p>
                <p class="text-2xl font-bold text-slate-900 mt-1">{{ leituraPorHoraFiltrada.media }}</p>
              </div>
              <div class="rounded-xl bg-amber-50/70 p-3 text-center">
                <p class="text-xs font-semibold text-amber-500">Horário de Baixa</p>
                <p class="text-2xl font-bold text-amber-700 mt-1">{{ leituraPorHoraFiltrada.baixa?.hora || '--' }}</p>
                <p class="text-[10px] text-amber-500">{{ leituraPorHoraFiltrada.baixa?.valor || 0 }} leituras</p>
              </div>
            </div>

            <!-- Quantidade de leituras em cada hora -->
            <div class="rounded-xl border border-slate-100 bg-white p-4">
                <div class="mb-3">
                  <p class="text-sm font-semibold text-slate-800">Leituras por horário</p>
                  <p class="text-[11px] text-slate-400">Quantidade registrada em cada faixa horária</p>
                </div>
                <div class="space-y-1.5">
                  <div v-for="(p, idx) in leituraPorHoraFiltrada.serie" :key="`leituras-${p.hora}`" class="flex items-center gap-2">
                    <div class="w-12 text-[11px] font-medium text-gray-600 text-right">{{ p.hora }}</div>
                    <div class="flex-1 h-5 bg-gray-100 rounded-md overflow-hidden relative">
                      <div
                        class="h-5 rounded-md transition-all duration-300"
                        :class="[
                          p.valor === leituraPorHoraFiltrada.max ? 'bg-green-500' :
                          p.valor === leituraPorHoraFiltrada.baixa?.valor && p.valor > 0 ? 'bg-orange-400' :
                          'bg-blue-500'
                        ]"
                        :style="{ width: leituraPorHoraFiltrada.max > 0 ? ((p.valor / leituraPorHoraFiltrada.max) * 100) + '%' : '0%' }"
                      />
                      <span v-if="p.valor > 0" class="absolute inset-y-0 left-2 flex items-center text-[10px] font-bold text-white drop-shadow">
                        {{ p.valor }}
                      </span>
                    </div>
                    <div class="w-14 text-right">
                      <span
                        v-if="idx > 0 && p.variacao !== 0 && p.valor > 0"
                        class="text-[10px] font-semibold px-1 py-0.5 rounded"
                        :class="p.variacao > 0 ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100'"
                      >
                        {{ p.variacao > 0 ? '+' : '' }}{{ p.variacao }}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

            <!-- Insights de Variação -->
            <div v-if="leituraPorHoraFiltrada.maiorSubida || leituraPorHoraFiltrada.maiorQueda" class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div v-if="leituraPorHoraFiltrada.maiorSubida" class="flex items-center gap-3 rounded-xl bg-emerald-50/70 p-3">
                <i class="fas fa-arrow-up text-sm shrink-0 text-slate-400" aria-hidden="true"></i>
                <div>
                  <p class="text-xs font-semibold text-emerald-500">Maior Subida</p>
                  <p class="text-xs text-emerald-700 font-medium">
                    {{ leituraPorHoraFiltrada.maiorSubida.de }} → {{ leituraPorHoraFiltrada.maiorSubida.para }}
                    <span class="font-bold">(+{{ leituraPorHoraFiltrada.maiorSubida.variacao }}%)</span>
                  </p>
                </div>
              </div>
              <div v-if="leituraPorHoraFiltrada.maiorQueda" class="flex items-center gap-3 rounded-xl bg-red-50/70 p-3">
                <i class="fas fa-arrow-down text-sm shrink-0 text-slate-400" aria-hidden="true"></i>
                <div>
                  <p class="text-xs font-semibold text-red-500">Maior Queda</p>
                  <p class="text-xs text-red-700 font-medium">
                    {{ leituraPorHoraFiltrada.maiorQueda.de }} → {{ leituraPorHoraFiltrada.maiorQueda.para }}
                    <span class="font-bold">({{ leituraPorHoraFiltrada.maiorQueda.variacao }}%)</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="text-sm text-gray-500 py-4 text-center">
            <i class="fas fa-chart-bar text-gray-300 text-2xl mb-2"></i>
            <p>Não há dados de horário suficientes para montar o mapa.</p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
