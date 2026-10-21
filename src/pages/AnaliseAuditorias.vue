<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuditoriasStore } from '../stores/auditoriasStore'
import { blocoBarras, blocoColunas, blocoDestaques, blocoTabela, escapeHtml, selo, sparkline } from '../utils/print'
import { useRelatorio } from '../composables/useRelatorio'
import { reincidenciaLocais, rupturaEmValor } from '../utils/historicoAuditorias'
import { baixarCsv } from '../utils/csv'
import { correspondeBusca, formatarDataBR } from '../utils/busca'
import { consolidarParaMapa } from '../utils/mapaLoja'
import { isItemLido } from '../utils/itemLido'
import { separarUsuario } from '../utils/usuario'
import { META_PENDENTE_PERCENTUAL, dentroDaMeta, metricasAuditoria } from '../utils/metricasAuditoria'
import {
  agruparPorMes,
  agruparPorTipo,
  compararAuditorias,
  consolidarSetores,
  consolidarUsuarios,
  dentroDoIntervalo,
  gerarInsights,
  intervaloAnterior,
  intervaloDoPeriodo,
  resumirAuditorias,
  tendencia,
  variacao
} from '../utils/analiseHistorica'
import UiButton from '../components/ui/UiButton.vue'
import UiPageHeader from '../components/ui/UiPageHeader.vue'
import UiTabs from '../components/ui/UiTabs.vue'
import GraficoColunasMeta from '../components/ui/GraficoColunasMeta.vue'
import SparklineMeta from '../components/ui/SparklineMeta.vue'
import MapaLoja from '../components/MapaLoja.vue'
import AnaliseReincidencia from '../components/AnaliseReincidencia.vue'
import AnaliseRupturaValor from '../components/AnaliseRupturaValor.vue'
import EvolucaoUsuarios from '../components/EvolucaoUsuarios.vue'
import DuplasUsuarios from '../components/DuplasUsuarios.vue'

const store = useAuditoriasStore()
const router = useRouter()
const META = META_PENDENTE_PERCENTUAL

// ---------- Filtros (lembrados neste navegador) ----------
const CHAVE_FILTROS = 'dashboard_ti_filtros_analise'
const filtrosPadrao = { periodoTipo: 'rapido', periodo: '12m', inicio: '', fim: '', tipo: 'todos', status: 'todos', meta: 'todos' }
const lerFiltros = () => {
  try {
    return { ...filtrosPadrao, ...JSON.parse(localStorage.getItem(CHAVE_FILTROS) || '{}') }
  } catch {
    return { ...filtrosPadrao }
  }
}
const filtros = reactive(lerFiltros())
watch(filtros, valor => {
  try { localStorage.setItem(CHAVE_FILTROS, JSON.stringify(valor)) } catch {}
}, { deep: true })
const filtrosAlterados = computed(() => Object.keys(filtrosPadrao).some(k => filtros[k] !== filtrosPadrao[k]))
const limparFiltros = () => Object.assign(filtros, filtrosPadrao)

const periodosRapidos = [
  { valor: '1m', rotulo: '30 dias' },
  { valor: '3m', rotulo: '3 meses' },
  { valor: '6m', rotulo: '6 meses' },
  { valor: '12m', rotulo: '12 meses' },
  { valor: 'todos', rotulo: 'Tudo' }
]

const intervalo = computed(() => intervaloDoPeriodo({ tipo: filtros.periodoTipo, periodo: filtros.periodo, inicio: filtros.inicio, fim: filtros.fim }))
const intervaloComparacao = computed(() => intervaloAnterior(intervalo.value))

const passaFiltrosNaoTemporais = (a) => {
  if (filtros.tipo !== 'todos' && a.tipo !== filtros.tipo) return false
  if (filtros.status === 'abertas' && a.status === 'fechada') return false
  if (filtros.status === 'fechadas' && a.status !== 'fechada') return false
  if (filtros.meta === 'dentro' && !dentroDaMeta(a)) return false
  if (filtros.meta === 'fora' && dentroDaMeta(a)) return false
  return true
}

const auditoriasBase = computed(() => (Array.isArray(store.auditorias) ? store.auditorias.filter(Boolean) : []))
const auditoriasFiltradas = computed(() => auditoriasBase.value.filter(a => dentroDoIntervalo(a, intervalo.value) && passaFiltrosNaoTemporais(a)))
const auditoriasPeriodoAnterior = computed(() => (intervaloComparacao.value
  ? auditoriasBase.value.filter(a => dentroDoIntervalo(a, intervaloComparacao.value) && passaFiltrosNaoTemporais(a))
  : null))

const descricaoPeriodo = computed(() => {
  const { inicio, fim } = intervalo.value
  if (!inicio && !fim) return 'Todo o histórico'
  if (inicio && fim) return `${formatarDataBR(inicio)} a ${formatarDataBR(fim)}`
  return inicio ? `A partir de ${formatarDataBR(inicio)}` : `Até ${formatarDataBR(fim)}`
})

// ---------- Resumos ----------
const resumo = computed(() => resumirAuditorias(auditoriasFiltradas.value))
// Sem auditorias no período anterior não há base honesta de comparação.
const resumoAnterior = computed(() => (auditoriasPeriodoAnterior.value?.length ? resumirAuditorias(auditoriasPeriodoAnterior.value) : null))
const meses = computed(() => agruparPorMes(auditoriasFiltradas.value))
const tipos = computed(() => agruparPorTipo(auditoriasFiltradas.value).map(t => {
  const serie = auditoriasFiltradas.value
    .filter(a => a.tipo === t.tipo && metricasAuditoria(a).total > 0)
    .sort((a, b) => String(a.data).localeCompare(String(b.data)) || a.id - b.id)
    .slice(-12)
    .map(a => ({ id: a.id, data: String(a.data).slice(0, 10), valor: metricasAuditoria(a).percentualPendente }))
  return { ...t, serie, tendencia: tendencia(serie.map(p => p.valor)).direcao }
}))
const setores = computed(() => consolidarSetores(auditoriasFiltradas.value))
const usuarios = computed(() => consolidarUsuarios(auditoriasFiltradas.value))
const insights = computed(() => gerarInsights({ resumo: resumo.value, resumoAnterior: resumoAnterior.value, meses: meses.value, tipos: tipos.value, setores: setores.value }))

const pontosGrafico = computed(() => meses.value.map(m => ({
  chave: m.mes,
  rotulo: m.rotulo,
  valor: m.mediaPendente ?? NaN,
  detalhe: `${m.total} auditoria(s) · ${m.taxaMeta === null ? 'sem fechadas' : `${m.taxaMeta.toFixed(0)}% na meta`}`
})))

const kpis = computed(() => {
  const r = resumo.value
  const ant = resumoAnterior.value
  return [
    { titulo: 'Auditorias', valor: String(r.total), detalhe: `${r.fechadas} fechadas · ${r.abertas} abertas`, icone: 'fas fa-clipboard-list', delta: variacao(r.total, ant?.total), formatoDelta: v => `${v > 0 ? '+' : ''}${v}`, melhorQuandoMenor: null },
    { titulo: 'Taxa na meta', valor: r.taxaMeta === null ? '—' : `${r.taxaMeta.toFixed(0)}%`, detalhe: `${r.dentroMeta} dentro · ${r.foraMeta} fora`, icone: 'fas fa-bullseye', delta: variacao(r.taxaMeta, ant?.taxaMeta), formatoDelta: v => `${v > 0 ? '+' : ''}${v.toFixed(0)} p.p.`, melhorQuandoMenor: false, alerta: r.taxaMeta !== null && r.taxaMeta < 70 },
    { titulo: '% pendente médio', valor: r.mediaPendente === null ? '—' : `${r.mediaPendente.toFixed(2)}%`, detalhe: `Meta: até ${META}%`, icone: 'fas fa-hourglass-half', delta: variacao(r.mediaPendente, ant?.mediaPendente), formatoDelta: v => `${v > 0 ? '+' : ''}${v.toFixed(2)} p.p.`, melhorQuandoMenor: true, alerta: r.mediaPendente !== null && r.mediaPendente > META },
    { titulo: 'Itens auditados', valor: r.itensAuditados.toLocaleString('pt-BR'), detalhe: `${r.itensPendentes.toLocaleString('pt-BR')} ficaram pendentes`, icone: 'fas fa-boxes-stacked', delta: variacao(r.itensAuditados, ant?.itensAuditados), formatoDelta: v => `${v > 0 ? '+' : ''}${v.toLocaleString('pt-BR')}`, melhorQuandoMenor: null }
  ]
})
const classeDelta = (kpi) => {
  if (!kpi.delta) return 'bg-slate-100 text-slate-500'
  if (kpi.melhorQuandoMenor === null) return 'bg-slate-100 text-slate-600'
  const melhorou = kpi.melhorQuandoMenor ? kpi.delta < 0 : kpi.delta > 0
  return melhorou ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
}

const tomInsight = {
  bom: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  ruim: 'border-red-200 bg-red-50 text-red-900',
  neutro: 'border-slate-200 bg-slate-50 text-slate-800'
}
const iconeTendencia = {
  melhorando: { icone: 'fas fa-arrow-trend-down', classe: 'text-emerald-600', rotulo: 'Melhorando' },
  piorando: { icone: 'fas fa-arrow-trend-up', classe: 'text-red-600', rotulo: 'Piorando' },
  estavel: { icone: 'fas fa-minus', classe: 'text-slate-500', rotulo: 'Estável' },
  indefinida: { icone: 'fas fa-ellipsis', classe: 'text-slate-400', rotulo: 'Poucos dados' }
}
const tipoConfig = {
  'Etiqueta': { cor: 'bg-violet-100 text-violet-700', icone: 'fa-tag' },
  'Presença': { cor: 'bg-sky-100 text-sky-700', icone: 'fa-clipboard-check' },
  'Ruptura': { cor: 'bg-orange-100 text-orange-700', icone: 'fa-exclamation-triangle' }
}
const getTipoConfig = tipo => tipoConfig[tipo] || { cor: 'bg-slate-100 text-slate-600', icone: 'fa-question' }

// ---------- Abas ----------
const aba = ref('visao')
const abas = computed(() => [
  { value: 'visao', label: 'Visão geral', icon: 'fas fa-chart-pie' },
  { value: 'setores', label: `Setores (${setores.value.length})`, icon: 'fas fa-store-alt' },
  { value: 'usuarios', label: `Usuários (${usuarios.value.length})`, icon: 'fas fa-users' },
  { value: 'mapa', label: 'Mapa da loja', icon: 'fas fa-map-location-dot' },
  { value: 'reincidencia', label: 'Reincidência', icon: 'fas fa-fire' },
  { value: 'ruptura', label: 'Ruptura em valor', icon: 'fas fa-sack-dollar' },
  { value: 'auditorias', label: `Auditorias (${auditoriasFiltradas.value.length})`, icon: 'fas fa-table' }
])

// ---------- Mapa do período ----------
// Ruptura repete os pendentes da presença da semana; só entra quando o filtro é Ruptura.
const auditoriasMapa = computed(() => (filtros.tipo === 'Ruptura'
  ? auditoriasFiltradas.value
  : auditoriasFiltradas.value.filter(a => a.tipo !== 'Ruptura')))
const mapaPeriodo = computed(() => (aba.value === 'mapa' ? consolidarParaMapa(auditoriasMapa.value, isItemLido) : null))
const leituraConsolidada = () => true
const mostrarTabelaMeses = ref(false)

// Clique em uma coluna: filtra o mês e abre a lista de auditorias.
const filtrarMes = ({ chave }) => {
  const [ano, mes] = chave.split('-').map(Number)
  const ultimoDia = new Date(ano, mes, 0).getDate()
  Object.assign(filtros, { periodoTipo: 'personalizado', inicio: `${chave}-01`, fim: `${chave}-${String(ultimoDia).padStart(2, '0')}` })
  aba.value = 'auditorias'
}

// ---------- Ordenação genérica ----------
const ordenar = (lista, { coluna, direcao }) => [...lista].sort((a, b) => {
  const va = a[coluna]
  const vb = b[coluna]
  const r = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va ?? '').localeCompare(String(vb ?? ''), 'pt-BR')
  return direcao === 'asc' ? r : -r
})
const alternarOrdem = (estado, coluna, padraoDesc = true) => {
  if (estado.coluna === coluna) estado.direcao = estado.direcao === 'asc' ? 'desc' : 'asc'
  else Object.assign(estado, { coluna, direcao: padraoDesc ? 'desc' : 'asc' })
}
const iconeOrdem = (estado, coluna) => (estado.coluna !== coluna ? 'fa-sort text-slate-300' : estado.direcao === 'asc' ? 'fa-sort-up text-blue-600' : 'fa-sort-down text-blue-600')

// ---------- Setores ----------
const buscaSetor = ref('')
const ordemSetores = reactive({ coluna: 'reincidencia', direcao: 'desc' })
const setoresVisiveis = computed(() => ordenar(setores.value.filter(s => correspondeBusca(buscaSetor.value, [s.setor])), ordemSetores))
const totalSetores = computed(() => {
  const lista = setores.value
  if (!lista.length) return null
  const lidos = lista.reduce((s, x) => s + x.lidos, 0)
  const pendentes = lista.reduce((s, x) => s + x.pendentes, 0)
  const comProblema = lista.reduce((s, x) => s + x.comProblema, 0)
  const total = lidos + pendentes + comProblema
  return { lidos, pendentes, comProblema, total, percPendente: total ? (pendentes / total) * 100 : 0, percProblema: total ? (comProblema / total) * 100 : 0 }
})
const setoresReincidentes = computed(() => setores.value.filter(s => s.auditorias >= 2 && s.reincidencia >= 50).length)

// ---------- Usuários ----------
const buscaUsuario = ref('')
const ordemUsuarios = reactive({ coluna: 'leituras', direcao: 'desc' })
const paginaUsuarios = ref(1)
const POR_PAGINA_USUARIOS = 15
const usuariosOrdenados = computed(() => ordenar(usuarios.value.filter(u => correspondeBusca(buscaUsuario.value, [u.usuario])), ordemUsuarios))
const totalPaginasUsuarios = computed(() => Math.max(1, Math.ceil(usuariosOrdenados.value.length / POR_PAGINA_USUARIOS)))
const usuariosPagina = computed(() => usuariosOrdenados.value.slice((paginaUsuarios.value - 1) * POR_PAGINA_USUARIOS, paginaUsuarios.value * POR_PAGINA_USUARIOS))
const rankingLeituras = computed(() => new Map([...usuarios.value].sort((a, b) => b.leituras - a.leituras).map((u, i) => [u.usuario, i + 1])))
const maiorLeitura = computed(() => Math.max(1, ...usuarios.value.map(u => u.leituras)))
watch([buscaUsuario, () => ordemUsuarios.coluna, () => ordemUsuarios.direcao, auditoriasFiltradas], () => { paginaUsuarios.value = 1 })

// ---------- Auditorias ----------
const buscaAuditoria = ref('')
const ordemAuditorias = reactive({ coluna: 'data', direcao: 'desc' })
const paginaAuditorias = ref(1)
const POR_PAGINA_AUDITORIAS = 20
const linhasAuditorias = computed(() => auditoriasFiltradas.value.map(a => {
  const m = metricasAuditoria(a)
  const fechada = a.status === 'fechada'
  return {
    id: a.id,
    data: String(a.data).slice(0, 10),
    dataFormatada: formatarDataBR(a.data),
    tipo: a.tipo,
    fechada,
    status: fechada ? 'Fechada' : 'Em andamento',
    meta: dentroDaMeta(a) ? 'Dentro' : 'Fora',
    dentroMeta: dentroDaMeta(a),
    pendente: m.percentualPendente,
    conclusao: m.percentualConclusao,
    total: m.total,
    pendentes: m.pendentes,
    lidos: m.lidos
  }
}))
const auditoriasOrdenadas = computed(() => ordenar(
  linhasAuditorias.value.filter(l => correspondeBusca(buscaAuditoria.value, [l.tipo, l.dataFormatada, `#${l.id}`, l.status, l.meta])),
  ordemAuditorias
))
const totalPaginasAuditorias = computed(() => Math.max(1, Math.ceil(auditoriasOrdenadas.value.length / POR_PAGINA_AUDITORIAS)))
const auditoriasPagina = computed(() => auditoriasOrdenadas.value.slice((paginaAuditorias.value - 1) * POR_PAGINA_AUDITORIAS, paginaAuditorias.value * POR_PAGINA_AUDITORIAS))
watch([buscaAuditoria, () => ordemAuditorias.coluna, () => ordemAuditorias.direcao, auditoriasFiltradas], () => { paginaAuditorias.value = 1 })

const abrirAuditoria = (id) => {
  if (id) router.push(`/auditoria/${id}`)
}

// Comparar duas auditorias (a mais antiga é a base).
const selecionadas = ref([])
const alternarSelecao = (id) => {
  const atual = selecionadas.value
  if (atual.includes(id)) selecionadas.value = atual.filter(x => x !== id)
  else selecionadas.value = [...atual, id].slice(-2)
}
watch(auditoriasFiltradas, lista => {
  const ids = new Set(lista.map(a => a.id))
  selecionadas.value = selecionadas.value.filter(id => ids.has(id))
})
const comparacao = computed(() => {
  if (selecionadas.value.length !== 2) return null
  const [x, y] = selecionadas.value.map(id => auditoriasBase.value.find(a => a.id === id)).filter(Boolean)
  if (!x || !y) return null
  const [anterior, atual] = [x, y].sort((a, b) => String(a.data).localeCompare(String(b.data)) || a.id - b.id)
  return { anterior, atual, resultado: compararAuditorias(atual, anterior) }
})
const setoresComparacao = computed(() => (comparacao.value?.resultado.setores || []).slice(0, 12))

const exportarCsv = () => {
  const colunas = [
    { chave: 'dataFormatada', titulo: 'Data' }, { chave: 'tipo', titulo: 'Tipo' }, { chave: 'status', titulo: 'Status' },
    { chave: 'meta', titulo: 'Meta' }, { chave: 'pendenteFmt', titulo: '% Pendente' }, { chave: 'conclusaoFmt', titulo: '% Conclusão' },
    { chave: 'total', titulo: 'Itens (SKU)' }, { chave: 'pendentes', titulo: 'Pendentes' }, { chave: 'lidos', titulo: 'Lidos' }
  ]
  const linhas = auditoriasOrdenadas.value.map(l => ({ ...l, pendenteFmt: l.pendente.toFixed(2).replace('.', ','), conclusaoFmt: l.conclusao.toFixed(2).replace('.', ',') }))
  baixarCsv(linhas, colunas, `analise-auditorias-${new Date().toISOString().slice(0, 10)}`)
  store.addToast(`${linhas.length} auditorias exportadas em CSV.`, 'success')
}

// ---------- Relatório PDF ----------
// Antes de imprimir, o seletor deixa escolher: resumo, setores, usuários, reincidência, ruptura e auditorias.
const { abrir: abrirSeletor } = useRelatorio()
const gerarRelatorioPDF = () => {
  if (!linhasAuditorias.value.length) return
  const pct = (v, casas = 2) => (Number.isFinite(v) ? `${v.toFixed(casas).replace('.', ',')}%` : '—')
  const int = v => (Number(v) || 0).toLocaleString('pt-BR')
  const tomPend = v => (v > META ? 'ruim' : 'bom')
  const seloTendencia = t => ({ melhorando: selo('▼ Melhorando', 'bom'), piorando: selo('▲ Piorando', 'ruim'), estavel: selo('— Estável', 'cinza') }[t] || selo('Poucos dados', 'cinza'))
  const r = resumo.value
  const ant = resumoAnterior.value
  const filtrosTexto = [
    filtros.tipo !== 'todos' && filtros.tipo,
    filtros.status === 'abertas' && 'somente abertas',
    filtros.status === 'fechadas' && 'somente fechadas',
    filtros.meta === 'dentro' && 'dentro da meta',
    filtros.meta === 'fora' && 'fora da meta'
  ].filter(Boolean)

  const setoresOrd = ordenar(setores.value, { coluna: 'percPendente', direcao: 'desc' })
  const reincidentes = setoresOrd.filter(s => s.auditorias >= 2 && s.reincidencia >= 50)
  const usuariosOrd = ordenar(usuarios.value, { coluna: 'leituras', direcao: 'desc' })
  const maxLeituras = Math.max(1, ...usuariosOrd.map(u => u.leituras))
  const maxPendSetor = Math.max(META * 2, ...setoresOrd.map(s => s.percPendente))
  const auditoriasOrd = ordenar(linhasAuditorias.value, { coluna: 'data', direcao: 'desc' })
  const maxPendAud = Math.max(META * 2, ...auditoriasOrd.map(l => l.pendente))
  const locaisCronicos = reincidenciaLocais(auditoriasFiltradas.value).filter(l => l.auditorias >= 2 && l.foraMeta >= 2).slice(0, 30)
  const ruptura = rupturaEmValor(auditoriasFiltradas.value.filter(a => a.tipo === 'Ruptura' || a.tipo === 'Presença'))
  const moeda = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const comparacaoAnterior = ant ? blocoTabela({
    titulo: 'Período atual x anterior',
    colunas: [
      { chave: 'indicador', titulo: 'Indicador' }, { chave: 'atual', titulo: 'Atual', alinhamento: 'right' },
      { chave: 'anterior', titulo: 'Anterior', alinhamento: 'right' }, { chave: 'variacao', titulo: 'Variação', alinhamento: 'right', html: (v, l) => selo(v, l.tom) }
    ],
    linhas: kpis.value.map((k, i) => {
      const anterior = [ant.total, ant.taxaMeta, ant.mediaPendente, ant.itensAuditados][i]
      const fmt = [int, v => pct(v, 0), v => pct(v), int][i]
      const melhorou = k.melhorQuandoMenor === null || !k.delta ? null : (k.melhorQuandoMenor ? k.delta < 0 : k.delta > 0)
      return { indicador: k.titulo, atual: k.valor, anterior: anterior === null ? '—' : fmt(anterior), variacao: k.delta === null ? '—' : k.delta === 0 ? 'igual' : k.formatoDelta(k.delta), tom: melhorou === null ? 'cinza' : melhorou ? 'bom' : 'ruim' }
    })
  }) : ''

  abrirSeletor({
    id: 'analise-auditorias',
    titulo: 'Análise de auditorias',
    subtitulo: `${descricaoPeriodo.value} · ${r.total} auditoria(s)`,
    contexto: [
      { rotulo: 'Período', valor: descricaoPeriodo.value },
      { rotulo: 'Auditorias', valor: int(r.total) },
      { rotulo: 'Filtros', valor: filtrosTexto.length ? filtrosTexto.join(', ') : 'nenhum' },
      { rotulo: 'Meta', valor: `até ${META}% pendente` },
      ...(ant ? [{ rotulo: 'Comparado a', valor: `${formatarDataBR(intervaloComparacao.value.inicio)} a ${formatarDataBR(intervaloComparacao.value.fim)}` }] : [])
    ],
    indicadores: kpis.value.map(k => ({ rotulo: k.titulo, valor: k.valor, detalhe: k.detalhe, tom: k.alerta ? 'alerta' : 'neutro' })),
    secoes: [
      { id: 'resumo', titulo: 'Resumo do período', descricao: 'Conclusões, evolução mensal, tipos e comparação com o período anterior.', gerar: () => [
        insights.value.length ? blocoDestaques({ titulo: 'Principais conclusões', itens: insights.value }) : '',
        blocoColunas({ titulo: '% pendente médio por mês', subtitulo: 'Menor é melhor · tracejado = meta', colunas: meses.value.map(m => ({ rotulo: m.rotulo, valor: m.mediaPendente ?? 0, tom: tomPend(m.mediaPendente ?? 0) })), meta: META, sufixo: '%' }),
        blocoTabela({
          titulo: 'Por tipo de auditoria',
          colunas: [
            { chave: 'tipo', titulo: 'Tipo' }, { chave: 'total', titulo: 'Auditorias', alinhamento: 'right' },
            { chave: 'mediaPendente', titulo: '% pend. médio', alinhamento: 'right', html: v => (v === null ? '—' : `<b style="color:${v > META ? '#dc2626' : '#059669'}">${pct(v)}</b>`) },
            { chave: 'taxaMeta', titulo: 'Na meta', alinhamento: 'right', html: v => pct(v, 0) },
            { chave: 'tendencia', titulo: 'Tendência', html: seloTendencia },
            { chave: 'serie', titulo: 'Últimas 12', html: v => sparkline(v.map(p => p.valor), { meta: META }) }
          ],
          linhas: tipos.value
        }),
        comparacaoAnterior
      ].filter(Boolean).join('') },
      { id: 'setores', titulo: `Setores (${setoresOrd.length})`, descricao: `Ordenados pelo % pendente. "Acima da meta" = em quantas auditorias passou de ${META}%.`, novaPagina: true, gerar: () => [
        reincidentes.length ? `<div class="secao painel"><h2>Setores reincidentes (acima da meta em metade ou mais das auditorias)</h2><div class="chips">${reincidentes.map(s => `<span>${escapeHtml(s.setor)} · ${s.acimaDaMeta}/${s.auditorias}</span>`).join('')}</div></div>` : '',
        blocoTabela({
        colunas: [
          { chave: 'setor', titulo: 'Setor' }, { chave: 'auditorias', titulo: 'Aud.', alinhamento: 'right' },
          { chave: 'lidos', titulo: 'Lidos', alinhamento: 'right', format: int }, { chave: 'pendentes', titulo: 'Pendentes', alinhamento: 'right', format: int },
          { chave: 'percPendente', titulo: '% Pendente', alinhamento: 'right', format: v => pct(v), barra: { max: maxPendSetor, tom: tomPend } },
          { chave: 'percProblema', titulo: '% Problema', alinhamento: 'right', format: v => pct(v) },
          { chave: 'acimaDaMeta', titulo: 'Acima da meta', alinhamento: 'center', html: (v, s) => selo(`${v}/${s.auditorias}`, s.auditorias >= 2 && s.reincidencia >= 50 ? 'ruim' : v ? 'alerta' : 'bom') },
          { chave: 'ultimo', titulo: 'Última', alinhamento: 'right', format: v => pct(v, 1) },
          { chave: 'tendencia', titulo: 'Tendência', html: seloTendencia },
          { chave: 'historico', titulo: 'Evolução', html: v => sparkline(v.slice(-12).map(h => h.valor), { meta: META }) }
        ],
        linhas: setoresOrd
      }),
        totalSetores.value ? `<p class="nota">Geral do período: ${int(totalSetores.value.lidos)} lidos, ${int(totalSetores.value.pendentes)} pendentes (${pct(totalSetores.value.percPendente)}), ${pct(totalSetores.value.percProblema)} com problema.</p>` : ''
      ].join('') },
      ...(usuariosOrd.length ? [{ id: 'usuarios', titulo: `Usuários (${usuariosOrd.length})`, descricao: 'Leituras = itens lidos + leituras com problema, somadas no período.', novaPagina: true, gerar: () => blocoTabela({
          colunas: [
            { chave: 'posicao', titulo: '#', alinhamento: 'right' }, { chave: 'matricula', titulo: 'Matrícula' }, { chave: 'nome', titulo: 'Nome' },
            { chave: 'auditorias', titulo: 'Aud.', alinhamento: 'right' },
            { chave: 'leituras', titulo: 'Leituras', format: int, barra: { max: maxLeituras } },
            { chave: 'mediaPorAuditoria', titulo: 'Média/aud.', alinhamento: 'right', format: v => int(Math.round(v)) },
            { chave: 'comProblema', titulo: 'Com problema', alinhamento: 'right', format: int },
            { chave: 'percProblema', titulo: '% Problema', alinhamento: 'right', html: v => selo(pct(v), v > 5 ? 'ruim' : v > 2 ? 'alerta' : 'cinza') },
            { chave: 'ultima', titulo: 'Última', alinhamento: 'right' }
          ],
          linhas: usuariosOrd.map((u, i) => {
            const { matricula, nome } = separarUsuario(u.usuario)
            return { ...u, posicao: i + 1, matricula: matricula || '—', nome: nome || u.usuario, ultima: formatarDataBR(u.ultimaData) }
          })
        }) }] : []),
      ...(locaisCronicos.length ? [{ id: 'reincidencia', titulo: 'Locais reincidentes', descricao: 'Locais fora da meta em várias auditorias (top 30).', padrao: false, gerar: () => blocoTabela({
        colunas: [
          { chave: 'local', titulo: 'Local' }, { chave: 'auditorias', titulo: 'Aud.', alinhamento: 'right' },
          { chave: 'foraMeta', titulo: 'Fora da meta', alinhamento: 'right', html: (v, l) => selo(`${v}/${l.auditorias}`, l.taxaFora >= 50 ? 'ruim' : 'alerta') },
          { chave: 'sequencia', titulo: 'Seguidas', alinhamento: 'right' },
          { chave: 'percMedio', titulo: '% pend. médio', alinhamento: 'right', format: v => pct(v, 1) },
          { chave: 'historico', titulo: 'Evolução', html: v => sparkline(v.map(h => h.perc), { meta: META }) },
          { chave: 'ultimaData', titulo: 'Última', format: v => formatarDataBR(v) }
        ],
        linhas: locaisCronicos
      }) }] : []),
      ...(ruptura.total > 0 ? [{ id: 'ruptura', titulo: 'Ruptura em valor', descricao: 'Custo dos itens pendentes por setor e fornecedor.', padrao: false, gerar: () => [
        `<p class="nota">Total estimado: <b>${moeda(ruptura.total)}</b> em ${int(ruptura.itens)} item(ns) pendente(s).</p>`,
        blocoBarras({ titulo: 'Por setor (top 12)', barras: ruptura.porSetor.slice(0, 12).map(x => ({ rotulo: x.chave, valor: x.valor, texto: `${moeda(x.valor)} · ${pct(x.participacao, 0)}`, tom: 'ruim' })) }),
        blocoBarras({ titulo: 'Por fornecedor (top 12)', barras: ruptura.porFornecedor.slice(0, 12).map(x => ({ rotulo: x.chave, valor: x.valor, texto: `${moeda(x.valor)} · ${pct(x.participacao, 0)}`, tom: 'alerta' })) })
      ].join('') }] : []),
      { id: 'auditorias', titulo: `Auditorias do período (${auditoriasOrd.length})`, descricao: 'Da mais recente para a mais antiga, com o resumo por mês.', novaPagina: true, gerar: () => [
        blocoTabela({
        colunas: [
          { chave: 'dataFormatada', titulo: 'Data' }, { chave: 'tipo', titulo: 'Tipo' },
          { chave: 'status', titulo: 'Status', html: (v, l) => selo(v, l.fechada ? 'cinza' : 'neutro') },
          { chave: 'meta', titulo: 'Meta', html: (v, l) => selo(v, l.dentroMeta ? 'bom' : 'ruim') },
          { chave: 'pendente', titulo: '% Pendente', alinhamento: 'right', format: v => pct(v), barra: { max: maxPendAud, tom: tomPend } },
          { chave: 'conclusao', titulo: '% Conclusão', alinhamento: 'right', format: v => pct(v) },
          { chave: 'total', titulo: 'Itens (SKU)', alinhamento: 'right', format: int }, { chave: 'pendentes', titulo: 'Pendentes', alinhamento: 'right', format: int },
          { chave: 'lidos', titulo: 'Lidos', alinhamento: 'right', format: int }
        ],
        linhas: auditoriasOrd
      }),
        blocoTabela({
        titulo: 'Resumo por mês',
        colunas: [
          { chave: 'rotulo', titulo: 'Mês' }, { chave: 'total', titulo: 'Auditorias', alinhamento: 'right' },
          { chave: 'mediaPendente', titulo: '% Pendente médio', alinhamento: 'right', format: v => pct(v), barra: { max: Math.max(META * 2, ...meses.value.map(m => m.mediaPendente ?? 0)), tom: tomPend } },
          { chave: 'mediaConclusao', titulo: '% Conclusão média', alinhamento: 'right', format: v => pct(v) },
          { chave: 'naMeta', titulo: 'Na meta', alinhamento: 'right' }
        ],
        linhas: meses.value.map(m => ({ ...m, naMeta: m.taxaMeta === null ? '—' : `${m.dentroMeta}/${m.fechadas} (${pct(m.taxaMeta, 0)})` }))
      })
      ].join('') }
    ]
  })
}
</script>

<template>
  <div class="ui-page">
    <UiPageHeader title="Análise de Auditorias" :subtitle="`Desempenho histórico · ${descricaoPeriodo}`" icon="fas fa-chart-line" tone="blue">
      <template #actions>
        <UiButton variant="secondary" :disabled="!linhasAuditorias.length" @click="exportarCsv">
          <i class="fas fa-file-csv"></i>CSV
        </UiButton>
        <UiButton variant="dark" :disabled="!linhasAuditorias.length" @click="gerarRelatorioPDF">
          <i class="fas fa-file-pdf"></i>Relatório PDF
        </UiButton>
      </template>
    </UiPageHeader>

    <!-- Filtros -->
    <section class="ui-card p-4 md:p-5">
      <div class="flex flex-wrap items-end gap-x-4 gap-y-3">
        <div>
          <p class="ui-label">Período</p>
          <div class="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1">
            <button
              v-for="p in periodosRapidos"
              :key="p.valor"
              type="button"
              class="rounded-lg px-3 py-1.5 text-xs font-semibold transition"
              :class="filtros.periodoTipo === 'rapido' && filtros.periodo === p.valor ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'"
              @click="filtros.periodoTipo = 'rapido'; filtros.periodo = p.valor"
            >{{ p.rotulo }}</button>
            <button
              type="button"
              class="rounded-lg px-3 py-1.5 text-xs font-semibold transition"
              :class="filtros.periodoTipo === 'personalizado' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'"
              @click="filtros.periodoTipo = 'personalizado'"
            ><i class="fas fa-calendar-days mr-1"></i>Datas</button>
          </div>
        </div>
        <div v-if="filtros.periodoTipo === 'personalizado'" class="flex items-end gap-2">
          <label class="block">
            <span class="ui-label">De</span>
            <input v-model="filtros.inicio" type="date" class="ui-input py-1.5 text-xs">
          </label>
          <label class="block">
            <span class="ui-label">Até</span>
            <input v-model="filtros.fim" type="date" class="ui-input py-1.5 text-xs">
          </label>
        </div>
        <label class="block">
          <span class="ui-label">Tipo</span>
          <select v-model="filtros.tipo" class="ui-input py-1.5 text-xs">
            <option value="todos">Todos</option>
            <option value="Etiqueta">Etiqueta</option>
            <option value="Presença">Presença</option>
            <option value="Ruptura">Ruptura</option>
          </select>
        </label>
        <label class="block">
          <span class="ui-label">Status</span>
          <select v-model="filtros.status" class="ui-input py-1.5 text-xs">
            <option value="todos">Abertas e fechadas</option>
            <option value="abertas">Somente abertas</option>
            <option value="fechadas">Somente fechadas</option>
          </select>
        </label>
        <label class="block">
          <span class="ui-label">Meta</span>
          <select v-model="filtros.meta" class="ui-input py-1.5 text-xs">
            <option value="todos">Todas</option>
            <option value="dentro">Dentro da meta</option>
            <option value="fora">Fora da meta</option>
          </select>
        </label>
        <div class="ml-auto flex items-center gap-2">
          <button v-if="filtrosAlterados" type="button" class="text-xs font-semibold text-slate-500 hover:text-red-600" @click="limparFiltros">
            <i class="fas fa-rotate-left mr-1"></i>Limpar
          </button>
          <span class="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
            <i class="fas fa-filter text-[10px]"></i>{{ auditoriasFiltradas.length }} auditoria(s)
          </span>
        </div>
      </div>
    </section>

    <!-- KPIs com comparação ao período anterior -->
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <article v-for="k in kpis" :key="k.titulo" class="ui-card p-4">
        <div class="flex items-center justify-between gap-2">
          <p class="text-xs font-semibold text-slate-500">{{ k.titulo }}</p>
          <i :class="[k.icone, 'text-xs', k.alerta ? 'text-amber-500' : 'text-slate-300']" aria-hidden="true"></i>
        </div>
        <p class="mt-2 text-2xl font-semibold tracking-tight tabular-nums md:text-3xl" :class="k.alerta ? 'text-amber-700' : 'text-slate-900'">{{ k.valor }}</p>
        <p class="mt-1 text-xs text-slate-500">{{ k.detalhe }}</p>
        <p v-if="k.delta !== null && resumoAnterior" class="mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" :class="classeDelta(k)" :title="`Período anterior: ${formatarDataBR(intervaloComparacao.inicio)} a ${formatarDataBR(intervaloComparacao.fim)}`">
          <i :class="k.delta > 0 ? 'fas fa-arrow-up' : k.delta < 0 ? 'fas fa-arrow-down' : 'fas fa-equals'" class="text-[9px]"></i>
          {{ k.delta === 0 ? 'igual' : k.formatoDelta(k.delta) }} vs anterior
        </p>
      </article>
    </div>

    <UiTabs v-model="aba" :items="abas" sticky />

    <div v-if="!auditoriasFiltradas.length" class="ui-card px-6 py-14 text-center">
      <i class="fas fa-magnifying-glass-chart text-3xl text-slate-300"></i>
      <p class="mt-3 font-semibold text-slate-700">Nenhuma auditoria encontrada</p>
      <p class="mt-1 text-sm text-slate-500">Ajuste o período ou os filtros.</p>
      <UiButton v-if="filtrosAlterados" class="mt-4" variant="secondary" size="sm" @click="limparFiltros">Limpar filtros</UiButton>
    </div>

    <!-- ===== VISÃO GERAL ===== -->
    <template v-else-if="aba === 'visao'">
      <section v-if="insights.length" class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div v-for="(i, idx) in insights" :key="idx" class="flex items-start gap-3 rounded-xl border p-4" :class="tomInsight[i.tom]">
          <i :class="[i.icone, 'mt-0.5']"></i>
          <p class="text-sm font-medium leading-snug">{{ i.texto }}</p>
        </div>
      </section>

      <section class="ui-card p-5 md:p-6">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 class="text-base font-bold text-slate-900">% pendente médio por mês</h2>
            <p class="text-xs text-slate-500">Menor é melhor. Clique em um mês para ver as auditorias dele.</p>
          </div>
          <button type="button" class="text-xs font-semibold text-blue-600 hover:underline" @click="mostrarTabelaMeses = !mostrarTabelaMeses">
            <i :class="mostrarTabelaMeses ? 'fas fa-chart-column' : 'fas fa-table'" class="mr-1"></i>{{ mostrarTabelaMeses ? 'Ver gráfico' : 'Ver tabela' }}
          </button>
        </div>
        <GraficoColunasMeta v-if="!mostrarTabelaMeses" class="mt-5" :pontos="pontosGrafico" :meta="META" @selecionar="filtrarMes" />
        <div v-else class="mt-4 overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="border-b border-slate-100 text-slate-500">
                <th class="px-3 py-2 text-left font-semibold">Mês</th>
                <th class="px-3 py-2 text-right font-semibold">Auditorias</th>
                <th class="px-3 py-2 text-right font-semibold">% Pendente médio</th>
                <th class="px-3 py-2 text-right font-semibold">% Conclusão média</th>
                <th class="px-3 py-2 text-right font-semibold">Na meta</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="m in meses" :key="m.mes" class="hover:bg-slate-50">
                <td class="px-3 py-2 font-medium text-slate-700">{{ m.rotulo }}</td>
                <td class="px-3 py-2 text-right">{{ m.total }}</td>
                <td class="px-3 py-2 text-right font-semibold" :class="(m.mediaPendente ?? 0) > META ? 'text-red-700' : 'text-emerald-700'">{{ m.mediaPendente === null ? '—' : m.mediaPendente.toFixed(2) + '%' }}</td>
                <td class="px-3 py-2 text-right">{{ m.mediaConclusao === null ? '—' : m.mediaConclusao.toFixed(2) + '%' }}</td>
                <td class="px-3 py-2 text-right">{{ m.taxaMeta === null ? '—' : `${m.dentroMeta}/${m.fechadas} (${m.taxaMeta.toFixed(0)}%)` }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="grid grid-cols-1 gap-3 md:grid-cols-3">
        <article v-for="t in tipos" :key="t.tipo" class="ui-card p-5">
          <div class="flex items-center justify-between">
            <span class="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-bold" :class="getTipoConfig(t.tipo).cor">
              <i class="fas text-[10px]" :class="getTipoConfig(t.tipo).icone"></i>{{ t.tipo }}
            </span>
            <span class="inline-flex items-center gap-1 text-xs font-semibold" :class="iconeTendencia[t.tendencia].classe">
              <i :class="iconeTendencia[t.tendencia].icone"></i>{{ iconeTendencia[t.tendencia].rotulo }}
            </span>
          </div>
          <div class="mt-3 grid grid-cols-3 gap-2 text-center">
            <div class="rounded-xl bg-slate-50 p-2">
              <p class="text-lg font-bold text-slate-900">{{ t.total }}</p>
              <p class="text-[10px] text-slate-500">auditorias</p>
            </div>
            <div class="rounded-xl bg-slate-50 p-2">
              <p class="text-lg font-bold" :class="(t.mediaPendente ?? 0) > META ? 'text-red-700' : 'text-emerald-700'">{{ t.mediaPendente === null ? '—' : t.mediaPendente.toFixed(1) + '%' }}</p>
              <p class="text-[10px] text-slate-500">pendente médio</p>
            </div>
            <div class="rounded-xl bg-slate-50 p-2">
              <p class="text-lg font-bold text-slate-900">{{ t.taxaMeta === null ? '—' : t.taxaMeta.toFixed(0) + '%' }}</p>
              <p class="text-[10px] text-slate-500">na meta</p>
            </div>
          </div>
          <SparklineMeta v-if="t.serie.length > 1" class="mt-4" :pontos="t.serie" :meta="META" @selecionar="p => abrirAuditoria(p.id)" />
        </article>
      </section>
    </template>

    <!-- ===== SETORES ===== -->
    <section v-else-if="aba === 'setores'" class="ui-card p-5 md:p-6">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-base font-bold text-slate-900">Setores no período</h2>
          <p class="text-xs text-slate-500">
            "Acima da meta" conta em quantas auditorias o setor passou de {{ META }}% pendente.
            <span v-if="setoresReincidentes" class="font-semibold text-red-600">{{ setoresReincidentes }} setor(es) reincidente(s).</span>
          </p>
        </div>
        <div class="relative w-full sm:w-64">
          <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400"></i>
          <input v-model="buscaSetor" type="search" class="ui-input py-2 pl-8 text-xs" placeholder="Buscar setor...">
        </div>
      </div>
      <div class="mt-4 overflow-x-auto">
        <table class="w-full text-xs">
          <thead>
            <tr class="border-b-2 border-slate-100 text-slate-600">
              <th v-for="[col, titulo, dir] in [['setor', 'Setor', 'left'], ['auditorias', 'Auditorias', 'right'], ['lidos', 'Lidos', 'right'], ['pendentes', 'Pendentes', 'right'], ['percPendente', '% Pendente', 'right'], ['percProblema', '% Problema', 'right'], ['reincidencia', 'Acima da meta', 'right'], ['ultimo', 'Última', 'right']]" :key="col"
                class="cursor-pointer select-none px-3 py-2.5 font-semibold hover:text-blue-600" :class="dir === 'right' ? 'text-right' : 'text-left'"
                @click="alternarOrdem(ordemSetores, col, col !== 'setor')">
                {{ titulo }} <i class="fas text-[10px]" :class="iconeOrdem(ordemSetores, col)"></i>
              </th>
              <th class="px-3 py-2.5 text-left font-semibold">Últimas 12</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-50">
            <tr v-if="totalSetores && !buscaSetor" class="bg-slate-50 font-bold text-slate-800">
              <td class="px-3 py-2.5">GERAL</td>
              <td class="px-3 py-2.5 text-right">{{ auditoriasFiltradas.length }}</td>
              <td class="px-3 py-2.5 text-right">{{ totalSetores.lidos.toLocaleString('pt-BR') }}</td>
              <td class="px-3 py-2.5 text-right">{{ totalSetores.pendentes.toLocaleString('pt-BR') }}</td>
              <td class="px-3 py-2.5 text-right" :class="totalSetores.percPendente > META ? 'text-red-700' : 'text-emerald-700'">{{ totalSetores.percPendente.toFixed(2) }}%</td>
              <td class="px-3 py-2.5 text-right">{{ totalSetores.percProblema.toFixed(2) }}%</td>
              <td class="px-3 py-2.5 text-right">—</td>
              <td class="px-3 py-2.5 text-right">—</td>
              <td></td>
            </tr>
            <tr v-for="s in setoresVisiveis" :key="s.setor" class="hover:bg-slate-50">
              <td class="max-w-56 truncate px-3 py-2.5 font-medium text-slate-800" :title="s.setor">{{ s.setor }}</td>
              <td class="px-3 py-2.5 text-right text-slate-600">{{ s.auditorias }}</td>
              <td class="px-3 py-2.5 text-right text-slate-600">{{ s.lidos.toLocaleString('pt-BR') }}</td>
              <td class="px-3 py-2.5 text-right text-slate-600">{{ s.pendentes.toLocaleString('pt-BR') }}</td>
              <td class="px-3 py-2.5 text-right font-semibold" :class="s.percPendente > META ? 'text-red-700' : 'text-emerald-700'">{{ s.percPendente.toFixed(2) }}%</td>
              <td class="px-3 py-2.5 text-right text-slate-600">{{ s.percProblema.toFixed(2) }}%</td>
              <td class="px-3 py-2.5 text-right">
                <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold" :class="s.reincidencia >= 50 && s.auditorias >= 2 ? 'bg-red-50 text-red-700' : s.acimaDaMeta ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'">
                  <i v-if="s.reincidencia >= 50 && s.auditorias >= 2" class="fas fa-repeat text-[9px]"></i>{{ s.acimaDaMeta }}/{{ s.auditorias }}
                </span>
              </td>
              <td class="px-3 py-2.5 text-right">
                <span class="font-semibold" :class="(s.ultimo ?? 0) > META ? 'text-red-700' : 'text-slate-700'">{{ s.ultimo === null ? '—' : s.ultimo.toFixed(1) + '%' }}</span>
                <i class="ml-1 text-[10px]" :class="[iconeTendencia[s.tendencia].icone, iconeTendencia[s.tendencia].classe]" :title="iconeTendencia[s.tendencia].rotulo"></i>
              </td>
              <td class="w-32 px-3 py-1.5">
                <SparklineMeta v-if="s.historico.length > 1" altura-classe="h-7" :pontos="s.historico.slice(-12)" :meta="META" @selecionar="p => abrirAuditoria(p.id)" />
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="!setoresVisiveis.length" class="py-10 text-center text-sm text-slate-500">Nenhum setor encontrado.</p>
      </div>
    </section>

    <!-- ===== USUÁRIOS ===== -->
    <template v-else-if="aba === 'usuarios'">
    <section class="ui-card p-5 md:p-6">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-base font-bold text-slate-900">Produtividade por usuário</h2>
          <p class="text-xs text-slate-500">Leituras = itens lidos + leituras com problema, somadas no período.</p>
        </div>
        <div class="relative w-full sm:w-64">
          <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400"></i>
          <input v-model="buscaUsuario" type="search" class="ui-input py-2 pl-8 text-xs" placeholder="Buscar usuário...">
        </div>
      </div>
      <div class="mt-4 overflow-x-auto">
        <table class="w-full text-xs">
          <thead>
            <tr class="border-b-2 border-slate-100 text-slate-600">
              <th class="w-10 px-3 py-2.5 text-left font-semibold">#</th>
              <th v-for="[col, titulo, dir] in [['usuario', 'Usuário', 'left'], ['auditorias', 'Auditorias', 'right'], ['leituras', 'Leituras', 'left'], ['mediaPorAuditoria', 'Média/auditoria', 'right'], ['comProblema', 'Com problema', 'right'], ['percProblema', '% Problema', 'right'], ['ultimaData', 'Última', 'right']]" :key="col"
                class="cursor-pointer select-none px-3 py-2.5 font-semibold hover:text-blue-600" :class="dir === 'right' ? 'text-right' : 'text-left'"
                @click="alternarOrdem(ordemUsuarios, col, col !== 'usuario')">
                {{ titulo }} <i class="fas text-[10px]" :class="iconeOrdem(ordemUsuarios, col)"></i>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-50">
            <tr v-for="u in usuariosPagina" :key="u.usuario" class="hover:bg-slate-50">
              <td class="px-3 py-2.5">
                <span class="inline-flex size-6 items-center justify-center rounded-full text-[10px] font-bold" :class="rankingLeituras.get(u.usuario) <= 3 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'">{{ rankingLeituras.get(u.usuario) }}</span>
              </td>
              <td class="px-3 py-2.5">
                <router-link :to="`/colaborador/${encodeURIComponent(u.usuario)}`" class="font-medium text-slate-800 hover:text-blue-600 hover:underline">{{ separarUsuario(u.usuario).nome || u.usuario }}</router-link>
                <p v-if="separarUsuario(u.usuario).matricula" class="text-[10px] text-slate-500">Matrícula: {{ separarUsuario(u.usuario).matricula }}</p>
              </td>
              <td class="px-3 py-2.5 text-right text-slate-600">{{ u.auditorias }}</td>
              <td class="px-3 py-2.5">
                <div class="flex items-center gap-2">
                  <div class="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                    <div class="h-full rounded-full bg-blue-500" :style="{ width: `${(u.leituras / maiorLeitura) * 100}%` }"></div>
                  </div>
                  <span class="font-semibold text-slate-800">{{ u.leituras.toLocaleString('pt-BR') }}</span>
                </div>
              </td>
              <td class="px-3 py-2.5 text-right text-slate-600">{{ Math.round(u.mediaPorAuditoria).toLocaleString('pt-BR') }}</td>
              <td class="px-3 py-2.5 text-right text-slate-600">{{ u.comProblema.toLocaleString('pt-BR') }}</td>
              <td class="px-3 py-2.5 text-right font-semibold" :class="u.percProblema > 5 ? 'text-red-700' : u.percProblema > 2 ? 'text-amber-700' : 'text-slate-700'">{{ u.percProblema.toFixed(2) }}%</td>
              <td class="px-3 py-2.5 text-right text-slate-500">{{ formatarDataBR(u.ultimaData) }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="!usuariosOrdenados.length" class="py-10 text-center text-sm text-slate-500">Nenhum usuário encontrado. Auditorias importadas de backups regionais podem não ter dados por usuário.</p>
      </div>
      <div v-if="totalPaginasUsuarios > 1" class="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
        <span>Página {{ paginaUsuarios }} de {{ totalPaginasUsuarios }}</span>
        <div class="flex gap-1">
          <UiButton size="sm" variant="secondary" :disabled="paginaUsuarios === 1" @click="paginaUsuarios--"><i class="fas fa-angle-left"></i></UiButton>
          <UiButton size="sm" variant="secondary" :disabled="paginaUsuarios === totalPaginasUsuarios" @click="paginaUsuarios++"><i class="fas fa-angle-right"></i></UiButton>
        </div>
      </div>
    </section>

    <EvolucaoUsuarios :auditorias="auditoriasFiltradas" />
    <DuplasUsuarios :auditorias="auditoriasFiltradas" />
    </template>

    <!-- ===== REINCIDÊNCIA ===== -->
    <template v-else-if="aba === 'reincidencia'">
      <p class="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
        <i class="fas fa-circle-info text-blue-500"></i>
        Base: <b class="text-slate-700">{{ auditoriasMapa.length }}</b> auditoria(s) do período ({{ descricaoPeriodo }}).
        <span v-if="auditoriasMapa.length < auditoriasFiltradas.length">Rupturas ficam de fora (repetem os pendentes da presença); filtre por Ruptura para vê-las.</span>
      </p>
      <AnaliseReincidencia :auditorias="auditoriasMapa" />
    </template>

    <!-- ===== RUPTURA EM VALOR ===== -->
    <AnaliseRupturaValor v-else-if="aba === 'ruptura'" :auditorias="auditoriasFiltradas" />

    <!-- ===== MAPA DA LOJA ===== -->
    <template v-else-if="aba === 'mapa'">
      <p class="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
        <i class="fas fa-circle-info text-blue-500"></i>
        Soma de <b class="text-slate-700">{{ auditoriasMapa.length }}</b> auditoria(s) do período ({{ descricaoPeriodo }}). Cores pelo % pendente acumulado e leituras de todo o período.
        <span v-if="auditoriasMapa.length < auditoriasFiltradas.length">Rupturas ficam de fora (repetem os pendentes da presença); filtre por Ruptura para vê-las.</span>
      </p>
      <MapaLoja v-if="mapaPeriodo" :auditoria="mapaPeriodo" :is-item-lido="leituraConsolidada" :itens-disponiveis="false" />
    </template>

    <!-- ===== AUDITORIAS ===== -->
    <template v-else-if="aba === 'auditorias'">
      <!-- Comparação -->
      <section v-if="comparacao" class="ui-card ui-fade-in border-blue-200 p-5 md:p-6">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-base font-bold text-slate-900">Comparação de auditorias</h2>
            <p class="text-xs text-slate-500">
              Base: {{ comparacao.anterior.tipo }} de {{ formatarDataBR(comparacao.anterior.data) }} → {{ comparacao.atual.tipo }} de {{ formatarDataBR(comparacao.atual.data) }}
              <span v-if="comparacao.anterior.tipo !== comparacao.atual.tipo" class="font-semibold text-amber-600">(tipos diferentes)</span>
            </p>
          </div>
          <button type="button" class="text-xs font-semibold text-slate-500 hover:text-red-600" @click="selecionadas = []"><i class="fas fa-times mr-1"></i>Fechar</button>
        </div>
        <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div class="rounded-xl bg-slate-50 p-3">
            <p class="text-xs font-semibold text-slate-500">% Pendente</p>
            <p class="mt-1 text-lg font-bold text-slate-900">{{ comparacao.resultado.anterior.percentualPendente.toFixed(2) }}% → {{ comparacao.resultado.atual.percentualPendente.toFixed(2) }}%</p>
            <p class="text-xs font-semibold" :class="comparacao.resultado.diferencaPendente <= 0 ? 'text-emerald-700' : 'text-red-700'">
              <i :class="comparacao.resultado.diferencaPendente <= 0 ? 'fas fa-arrow-down' : 'fas fa-arrow-up'"></i>
              {{ Math.abs(comparacao.resultado.diferencaPendente).toFixed(2) }} p.p.
            </p>
          </div>
          <div class="rounded-xl bg-slate-50 p-3">
            <p class="text-xs font-semibold text-slate-500">Itens pendentes</p>
            <p class="mt-1 text-lg font-bold text-slate-900">{{ comparacao.resultado.anterior.pendentes }} → {{ comparacao.resultado.atual.pendentes }}</p>
            <p class="text-xs text-slate-500">SKU {{ comparacao.resultado.anterior.total }} → {{ comparacao.resultado.atual.total }}</p>
          </div>
          <div class="rounded-xl bg-slate-50 p-3">
            <p class="text-xs font-semibold text-slate-500">Setores</p>
            <p class="mt-1 text-sm font-semibold"><span class="text-emerald-700">{{ comparacao.resultado.melhoraram.length }} melhoraram</span> · <span class="text-red-700">{{ comparacao.resultado.pioraram.length }} pioraram</span></p>
            <p v-if="comparacao.resultado.novos.length || comparacao.resultado.ausentes.length" class="text-xs text-slate-500">{{ comparacao.resultado.novos.length }} novos · {{ comparacao.resultado.ausentes.length }} ausentes</p>
          </div>
        </div>
        <div v-if="setoresComparacao.length" class="mt-4 overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="border-b border-slate-100 text-slate-500">
                <th class="px-3 py-2 text-left font-semibold">Setor (maiores mudanças)</th>
                <th class="px-3 py-2 text-right font-semibold">Antes</th>
                <th class="px-3 py-2 text-right font-semibold">Depois</th>
                <th class="px-3 py-2 text-right font-semibold">Diferença</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="s in setoresComparacao" :key="s.setor">
                <td class="px-3 py-2 font-medium text-slate-700">{{ s.setor }}</td>
                <td class="px-3 py-2 text-right">{{ s.anterior === null ? '—' : s.anterior.toFixed(1) + '%' }}</td>
                <td class="px-3 py-2 text-right">{{ s.atual === null ? '—' : s.atual.toFixed(1) + '%' }}</td>
                <td class="px-3 py-2 text-right font-semibold" :class="s.diferenca === null ? 'text-slate-400' : s.diferenca > 0 ? 'text-red-700' : 'text-emerald-700'">
                  {{ s.diferenca === null ? (s.atual === null ? 'ausente' : 'novo') : `${s.diferenca > 0 ? '+' : ''}${s.diferenca.toFixed(1)} p.p.` }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="ui-card p-5 md:p-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-base font-bold text-slate-900">Auditorias do período</h2>
            <p class="text-xs text-slate-500">
              Marque duas para comparar.
              <span v-if="selecionadas.length === 1" class="font-semibold text-blue-600">Selecione mais uma.</span>
            </p>
          </div>
          <div class="relative w-full sm:w-64">
            <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400"></i>
            <input v-model="buscaAuditoria" type="search" class="ui-input py-2 pl-8 text-xs" placeholder="Data, tipo, #id, fora...">
          </div>
        </div>
        <div class="mt-4 overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="border-b-2 border-slate-100 text-slate-600">
                <th class="w-8 px-3 py-2.5"><span class="sr-only">Comparar</span></th>
                <th v-for="[col, titulo, dir] in [['data', 'Data', 'left'], ['tipo', 'Tipo', 'left'], ['status', 'Status', 'left'], ['meta', 'Meta', 'left'], ['pendente', '% Pendente', 'right'], ['total', 'Itens', 'right'], ['pendentes', 'Pendentes', 'right'], ['lidos', 'Lidos', 'right']]" :key="col"
                  class="cursor-pointer select-none px-3 py-2.5 font-semibold hover:text-blue-600" :class="dir === 'right' ? 'text-right' : 'text-left'"
                  @click="alternarOrdem(ordemAuditorias, col)">
                  {{ titulo }} <i class="fas text-[10px]" :class="iconeOrdem(ordemAuditorias, col)"></i>
                </th>
                <th class="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="l in auditoriasPagina" :key="l.id" class="group" :class="selecionadas.includes(l.id) ? 'bg-blue-50/70' : 'hover:bg-slate-50'">
                <td class="px-3 py-2.5">
                  <input type="checkbox" class="size-4 cursor-pointer rounded accent-blue-600" :checked="selecionadas.includes(l.id)" :aria-label="`Comparar auditoria ${l.id}`" @change="alternarSelecao(l.id)">
                </td>
                <td class="px-3 py-2.5 font-medium text-slate-800">{{ l.dataFormatada }} <span class="text-[10px] text-slate-400">#{{ l.id }}</span></td>
                <td class="px-3 py-2.5">
                  <span class="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold" :class="getTipoConfig(l.tipo).cor">
                    <i class="fas text-[9px]" :class="getTipoConfig(l.tipo).icone"></i>{{ l.tipo }}
                  </span>
                </td>
                <td class="px-3 py-2.5">
                  <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" :class="l.fechada ? 'bg-slate-100 text-slate-600' : 'bg-sky-50 text-sky-700'">
                    <i :class="l.fechada ? 'fas fa-lock' : 'fas fa-spinner'" class="text-[9px]"></i>{{ l.status }}
                  </span>
                </td>
                <td class="px-3 py-2.5">
                  <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" :class="l.dentroMeta ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'">
                    <i class="fas text-[9px]" :class="l.dentroMeta ? 'fa-check' : 'fa-times'"></i>{{ l.meta }}
                  </span>
                </td>
                <td class="px-3 py-2.5 text-right font-semibold" :class="l.pendente > META ? 'text-red-700' : 'text-emerald-700'">{{ l.pendente.toFixed(2) }}%</td>
                <td class="px-3 py-2.5 text-right text-slate-600">{{ l.total.toLocaleString('pt-BR') }}</td>
                <td class="px-3 py-2.5 text-right text-slate-600">{{ l.pendentes.toLocaleString('pt-BR') }}</td>
                <td class="px-3 py-2.5 text-right text-slate-600">{{ l.lidos.toLocaleString('pt-BR') }}</td>
                <td class="px-3 py-2.5 text-right">
                  <button type="button" class="rounded-lg px-2 py-1 font-semibold text-blue-600 hover:bg-blue-50" @click="abrirAuditoria(l.id)">Abrir</button>
                </td>
              </tr>
            </tbody>
          </table>
          <p v-if="!auditoriasOrdenadas.length" class="py-10 text-center text-sm text-slate-500">Nenhuma auditoria corresponde à busca.</p>
        </div>
        <div v-if="totalPaginasAuditorias > 1" class="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
          <span>{{ auditoriasOrdenadas.length }} auditorias · página {{ paginaAuditorias }} de {{ totalPaginasAuditorias }}</span>
          <div class="flex gap-1">
            <UiButton size="sm" variant="secondary" :disabled="paginaAuditorias === 1" @click="paginaAuditorias--"><i class="fas fa-angle-left"></i></UiButton>
            <UiButton size="sm" variant="secondary" :disabled="paginaAuditorias === totalPaginasAuditorias" @click="paginaAuditorias++"><i class="fas fa-angle-right"></i></UiButton>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
