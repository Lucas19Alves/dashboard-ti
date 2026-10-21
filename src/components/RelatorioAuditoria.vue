<script setup>
import { computed, nextTick, ref } from 'vue'
import { toPng } from 'html-to-image'
import UiModal from './ui/UiModal.vue'
import { itensParaMeta } from '../utils/analiseHistorica'
import { META_PENDENTE_PERCENTUAL, metricasAuditoria } from '../utils/metricasAuditoria'
import { formatarDataBR } from '../utils/busca'
import { blocoBarras, blocoTabela, escapeHtml, selo } from '../utils/print'
import { useRelatorio } from '../composables/useRelatorio'
import { useAuditoriasStore } from '../stores/auditoriasStore'
import { listarAcoes } from '../db/planosAcao'
import { auditoriaAnteriorDoTipo, compararAuditorias } from '../utils/analiseHistorica'
import { ritmosDaAuditoria } from '../utils/planoAcao'
import { previsaoAuditoria } from '../utils/previsao'
import { rotuloUsuario } from '../utils/usuario'

// Relatório da auditoria: % pendente, indicadores e os três focos de ação
// (setores, locais com mais pendentes e locais sem leitura).
const props = defineProps({
  auditoria: { type: Object, required: true },
  setores: { type: Array, default: () => [] }, // setoresComAnalise da página
  locais: { type: Array, default: () => [] } // locaisComAnalise da página
})
const emit = defineEmits(['close'])
const META = META_PENDENTE_PERCENTUAL

const m = computed(() => metricasAuditoria(props.auditoria))
const analise = computed(() => props.auditoria?.analise || {})
const ehEtiqueta = computed(() => props.auditoria?.tipo === 'Etiqueta')
const problemas = computed(() => Number(analise.value.itensLidosComProblema ?? ((analise.value.itensComEstoqueZero || 0) + (analise.value.itensLidoNaoPertence || 0))))
const desatualizados = computed(() => Number(analise.value.itensDesatualizados || 0))
const faltam = computed(() => itensParaMeta(props.auditoria))
const naMeta = computed(() => m.value.percentualPendente <= META)
const dataBR = computed(() => formatarDataBR(props.auditoria?.data))

const cards = computed(() => [
  { rotulo: 'SKU', valor: m.value.total, detalhe: 'itens a auditar', classe: 'bg-slate-50', texto: 'text-slate-900' },
  { rotulo: 'Lidos', valor: m.value.lidos, detalhe: `${m.value.percentualConclusao.toFixed(1)}% concluído`, classe: 'bg-emerald-50', texto: 'text-emerald-800' },
  { rotulo: 'Pendentes', valor: m.value.pendentes, detalhe: faltam.value > 0 ? `faltam ${faltam.value.toLocaleString('pt-BR')} para a meta` : 'dentro da meta', classe: 'bg-amber-50', texto: 'text-amber-800' },
  { rotulo: 'Com problema', valor: problemas.value, detalhe: 'sem estoque ou fora do local', classe: problemas.value ? 'bg-red-50' : 'bg-slate-50', texto: problemas.value ? 'text-red-700' : 'text-slate-900' },
  ...(ehEtiqueta.value ? [{ rotulo: 'Desatualizados', valor: desatualizados.value, detalhe: 'etiquetas a corrigir', classe: 'bg-yellow-50', texto: 'text-yellow-800' }] : [])
])

const setoresOrdenados = computed(() => [...props.setores].sort((a, b) => b.percentualPendente - a.percentualPendente))
const setoresAcima = computed(() => setoresOrdenados.value.filter(s => s.percentualPendente > META).length)
const topLocais = computed(() => [...props.locais].filter(l => l.pendentes > 0).sort((a, b) => b.pendentes - a.pendentes).slice(0, 10))
const maiorLocal = computed(() => Math.max(1, ...topLocais.value.map(l => l.pendentes)))
const locaisSemLeitura = computed(() => [...(analise.value.locaisSemLeitura || [])].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR', { numeric: true })))

// ---------- Imagem quadrada (1080×1080 renderizada em 4x) ----------
// Tudo em uma imagem: cards do topo, % pendente por setor (completo) e top 10 locais.
const QUADRADO = 1080
// Navegadores com limite de canvas menor (ex.: Safari no celular) caem para 2x ou 1x.
const ESCALAS = [4, 2, 1]
const gerandoImagem = ref(false)
const imagemQuadrada = ref(null)
const nomeBase = computed(() => `relatorio-${props.auditoria.tipo}-${dataBR.value}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-'))

// Linhas da tabela de setores se ajustam para caber todos os setores no quadrado.
const ALTURA_TABELA = 560
const linhaSetor = computed(() => Math.max(24, Math.min(46, Math.floor(ALTURA_TABELA / (setoresOrdenados.value.length + 1)))))
const fonteSetor = computed(() => Math.max(13, Math.min(21, Math.round(linhaSetor.value * 0.46))))
const cardsImagem = computed(() => cards.value.map((c, i) => ({
  ...c,
  // Os três primeiros cards são mais estreitos: textos curtos para não cortar.
  detalhe: c.rotulo === 'Pendentes' ? (faltam.value > 0 ? `faltam ${faltam.value.toLocaleString('pt-BR')} p/ meta` : 'dentro da meta') : c.rotulo === 'Lidos' ? `${m.value.percentualConclusao.toFixed(1)}% concluído` : c.detalhe,
  coluna: cards.value.length === 5 ? (i < 3 ? 'col-span-2' : 'col-span-3') : 'col-span-3'
})))

const salvarImagem = async () => {
  gerandoImagem.value = true
  try {
    await nextTick()
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    let url = ''
    for (const escala of ESCALAS) {
      try {
        url = await toPng(imagemQuadrada.value, { cacheBust: true, pixelRatio: escala, width: QUADRADO, height: QUADRADO, backgroundColor: '#ffffff' })
      } catch {
        url = ''
      }
      if (url.length > 100) break
    }
    if (!url) throw new Error('Não foi possível gerar a imagem.')
    const link = document.createElement('a')
    link.download = `${nomeBase.value}.png`
    link.href = url
    link.click()
  } finally {
    gerandoImagem.value = false
  }
}

// ---------- Relatório A4 (seletor de conteúdo) ----------
const store = useAuditoriasStore()
const { abrir: abrirSeletor } = useRelatorio()
const pct = (v, casas = 1) => `${Number(v || 0).toFixed(casas).replace('.', ',')}%`
const int = v => (Number(v) || 0).toLocaleString('pt-BR')
const imprimir = async () => {
  const a = props.auditoria
  const acoes = await listarAcoes(a.id).catch(() => [])
  const anterior = auditoriaAnteriorDoTipo(a, store.auditorias)
  const comparacao = anterior ? compararAuditorias(a, anterior) : null
  const usuarios = Object.entries(a.analise?.porUsuario || {})
    .map(([nome, d]) => ({ nome, leituras: (d.lidos || 0) + (d.comProblema || 0), comProblema: d.comProblema || 0 }))
    .filter(u => u.leituras > 0)
    .sort((x, y) => y.leituras - x.leituras)
  const ritmos = new Map(ritmosDaAuditoria(a).map(r => [r.usuario, r.ritmo]))
  const zero = a.analise?.itensComEstoqueZeroDetalhes || []
  const foraLocal = a.analise?.itensLidoNaoPertenceDetalhes || []
  const previsao = a.status !== 'fechada' ? previsaoAuditoria(a, { fim: store.horariosAuditoria?.fim || '20:00' }) : null
  const tomPend = v => (v > META ? 'ruim' : 'bom')
  const ROT_PRIOR = { alta: 'Alta', media: 'Média', baixa: 'Baixa' }
  const ROT_STATUS = { aberta: 'A fazer', andamento: 'Em andamento', feita: 'Resolvida' }

  abrirSeletor({
    id: 'auditoria',
    titulo: `Relatório de auditoria · ${a.tipo}`,
    subtitulo: `${dataBR.value} · ${a.status === 'fechada' ? 'Fechada' : 'Em andamento'}`,
    contexto: [
      { rotulo: 'Tipo', valor: a.tipo },
      { rotulo: 'Data', valor: dataBR.value },
      { rotulo: 'Situação', valor: a.status === 'fechada' ? 'Fechada' : 'Em andamento' },
      { rotulo: 'Meta', valor: `até ${META}% pendente` },
    ],
    indicadores: [
      { rotulo: '% Pendente', valor: pct(m.value.percentualPendente, 2), detalhe: naMeta.value ? 'dentro da meta' : 'fora da meta', tom: naMeta.value ? 'bom' : 'ruim' },
      ...cards.value.map(c => ({ rotulo: c.rotulo, valor: c.valor, detalhe: c.detalhe, tom: c.rotulo === 'Pendentes' ? 'alerta' : c.rotulo === 'Com problema' && c.valor ? 'ruim' : 'neutro' }))
    ],
    secoes: [
      ...(previsao ? [{ id: 'previsao', titulo: 'Previsão de fechamento', descricao: 'Ritmo da última hora aplicado até o fim do expediente.', gerar: () => blocoTabela({
        colunas: [{ chave: 'i', titulo: 'Indicador' }, { chave: 'v', titulo: 'Valor', alinhamento: 'right' }],
        linhas: [
          { i: 'Última leitura', v: new Date(previsao.ultima).toISOString().slice(11, 16) },
          { i: 'Ritmo atual (última hora)', v: `${int(Math.round(previsao.ritmo))}/h · ${previsao.pessoasAtivas} pessoa(s)` },
          { i: 'Faltam para a meta', v: int(previsao.faltam) },
          { i: 'Previsão no fim do expediente', v: pct(previsao.percentualPrevisto, 2) },
          { i: 'Ritmo necessário', v: Number.isFinite(previsao.ritmoNecessario) ? `${int(Math.round(previsao.ritmoNecessario))}/h` : '—' },
          { i: 'Pessoas necessárias', v: previsao.pessoasNecessarias ?? '—' }
        ]
      }) }] : []),
      { id: 'setores', titulo: '% pendente por setor', descricao: `Setores do maior para o menor % pendente (${setoresAcima.value} acima da meta).`, gerar: () => blocoTabela({
        subtitulo: `${setoresAcima.value} de ${setoresOrdenados.value.length} setores acima da meta de ${META}%`,
        colunas: [
          { chave: 'nome', titulo: 'Setor' }, { chave: 'total', titulo: 'Itens', alinhamento: 'right', format: int }, { chave: 'lidos', titulo: 'Lidos', alinhamento: 'right', format: int },
          { chave: 'pendentes', titulo: 'Pendentes', alinhamento: 'right', format: int }, { chave: 'comProblema', titulo: 'Problemas', alinhamento: 'right', format: int },
          ...(ehEtiqueta.value ? [{ chave: 'desatualizados', titulo: 'Desatualizados', alinhamento: 'right', format: int }] : []),
          { chave: 'percentualPendente', titulo: '% Pendente', alinhamento: 'right', format: v => pct(v, 2), barra: { max: Math.max(META * 2, ...setoresOrdenados.value.map(x => x.percentualPendente)), tom: tomPend } },
          { chave: 'classificacao', titulo: 'Classificação' }
        ],
        linhas: setoresOrdenados.value
      }) },
      { id: 'locais', titulo: 'Locais com mais pendentes', descricao: 'Top 15 locais e a lista de locais sem nenhuma leitura.', gerar: () => [
        blocoBarras({ titulo: 'Top 15 locais com mais pendentes', barras: [...props.locais].filter(l => l.pendentes > 0).sort((x, y) => y.pendentes - x.pendentes).slice(0, 15).map(l => ({ rotulo: l.nome, valor: l.pendentes, texto: `${l.pendentes} · ${pct(l.percentualPendente)}`, tom: 'alerta' })) }),
        locaisSemLeitura.value.length ? `<div class="secao painel"><h2>Locais sem leitura (${locaisSemLeitura.value.length})</h2><div class="chips">${locaisSemLeitura.value.map(l => `<span>${escapeHtml(l)}</span>`).join('')}</div></div>` : ''
      ].filter(Boolean).join('') },
      ...(comparacao ? [{ id: 'comparacao', titulo: 'Comparação com a auditoria anterior', descricao: `${anterior.tipo} de ${formatarDataBR(String(anterior.data).slice(0, 10))}: variação do % pendente geral e por setor.`, gerar: () => blocoTabela({
        subtitulo: `Geral: ${pct(comparacao.anterior.percentualPendente, 2)} → ${pct(comparacao.atual.percentualPendente, 2)} (${comparacao.diferencaPendente > 0 ? '+' : ''}${comparacao.diferencaPendente.toFixed(2).replace('.', ',')} p.p.)`,
        colunas: [
          { chave: 'setor', titulo: 'Setor' }, { chave: 'anterior', titulo: 'Anterior', alinhamento: 'right', format: v => pct(v, 2) }, { chave: 'atual', titulo: 'Atual', alinhamento: 'right', format: v => pct(v, 2) },
          { chave: 'diferenca', titulo: 'Variação (p.p.)', alinhamento: 'right', html: v => (v === null ? '—' : selo(`${v > 0 ? '+' : ''}${v.toFixed(2).replace('.', ',')}`, v > 0.5 ? 'ruim' : v < -0.5 ? 'bom' : 'cinza')) }
        ],
        linhas: comparacao.setores
      }) }] : []),
      ...(usuarios.length ? [{ id: 'usuarios', titulo: 'Equipe', descricao: 'Leituras, ritmo e problemas por pessoa.', gerar: () => blocoTabela({
        colunas: [
          { chave: 'pos', titulo: '#', alinhamento: 'right' }, { chave: 'nome', titulo: 'Colaborador' }, { chave: 'leituras', titulo: 'Leituras', alinhamento: 'right', format: int, barra: { max: usuarios[0].leituras } },
          { chave: 'ritmo', titulo: 'Ritmo (/h)', alinhamento: 'right' }, { chave: 'comProblema', titulo: 'Com problema', alinhamento: 'right', format: int }
        ],
        linhas: usuarios.map((u, i) => ({ pos: i + 1, nome: rotuloUsuario(u.nome), leituras: u.leituras, ritmo: ritmos.has(u.nome) ? Math.round(ritmos.get(u.nome)) : '—', comProblema: u.comProblema }))
      }) }] : []),
      ...(zero.length || foraLocal.length ? [{ id: 'problemas', titulo: 'Leituras com problema', descricao: `${zero.length} com estoque zero · ${foraLocal.length} fora do local.`, padrao: false, gerar: () => blocoTabela({
        colunas: [{ chave: 'motivo', titulo: 'Motivo' }, { chave: 'codigo', titulo: 'Código' }, { chave: 'produto', titulo: 'Produto' }, { chave: 'local', titulo: 'Local' }, { chave: 'usuario', titulo: 'Usuário' }],
        linhas: [...zero.map(x => ({ ...x, motivo: 'Estoque zero' })), ...foraLocal.map(x => ({ ...x, motivo: 'Fora do local' }))].map(x => ({ ...x, usuario: rotuloUsuario(x.usuario || '') || '—' }))
      }) }] : []),
      ...(acoes.length ? [{ id: 'plano', titulo: 'Plano de ação', descricao: `${acoes.filter(x => x.status !== 'feita').length} ação(ões) em aberto de ${acoes.length}.`, gerar: () => blocoTabela({
        colunas: [{ chave: 'prioridade', titulo: 'Prioridade' }, { chave: 'local', titulo: 'Local' }, { chave: 'descricao', titulo: 'Ação' }, { chave: 'responsavel', titulo: 'Responsável' }, { chave: 'prazo', titulo: 'Prazo' }, { chave: 'status', titulo: 'Situação' }],
        linhas: acoes.map(x => ({ ...x, prioridade: ROT_PRIOR[x.prioridade] || x.prioridade, responsavel: x.responsavel ? rotuloUsuario(x.responsavel) : '—', prazo: formatarDataBR(x.prazo), status: ROT_STATUS[x.status] || x.status }))
      }) }] : [])
    ]
  })
}

const corClassificacao = c => ({ Excelente: 'bg-emerald-50 text-emerald-700', Bom: 'bg-lime-50 text-lime-700', Regular: 'bg-amber-50 text-amber-700' })[c] || 'bg-red-50 text-red-700'
</script>

<template>
  <UiModal :title="`Relatório · ${auditoria.tipo}`" :subtitle="`${dataBR} · imprimir, salvar em PDF ou imagem`" width="max-w-7xl" @close="emit('close')">
    <div class="mb-4 flex flex-wrap items-center gap-2">
      <button type="button" class="ui-btn-primary py-2" @click="imprimir"><i class="fas fa-file-pdf"></i>Imprimir / PDF</button>
      <button type="button" class="ui-btn-secondary py-2" :disabled="gerandoImagem" @click="salvarImagem"><i :class="gerandoImagem ? 'fas fa-spinner fa-spin' : 'fas fa-image'"></i>Salvar imagem</button>
    </div>

    <div class="relatorio space-y-5 bg-white">
      <!-- % pendente -->
      <div class="flex flex-col gap-4 rounded-2xl bg-blue-700 p-5 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-xs font-semibold text-blue-200">Relatório de auditoria</p>
          <p class="mt-1 text-2xl font-bold">{{ auditoria.tipo }} · {{ dataBR }}</p>
          <p class="text-sm text-blue-100">{{ auditoria.status === 'fechada' ? 'Fechada' : 'Em andamento' }} · #{{ auditoria.id }}</p>
        </div>
        <div class="text-left sm:text-right">
          <p class="text-4xl font-black tracking-tight">{{ m.percentualPendente.toFixed(2) }}%</p>
          <p class="text-sm text-blue-100">pendente</p>
          <span class="mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold" :class="naMeta ? 'bg-emerald-400/20 text-emerald-100' : 'bg-red-400/25 text-red-100'">
            <i :class="naMeta ? 'fas fa-check' : 'fas fa-xmark'"></i>{{ naMeta ? 'Dentro da meta' : 'Fora da meta' }} ({{ META }}%)
          </span>
        </div>
      </div>

      <!-- Indicadores -->
      <div class="grid grid-cols-2 gap-3" :class="cards.length === 5 ? 'md:grid-cols-5' : 'md:grid-cols-4'">
        <div v-for="c in cards" :key="c.rotulo" class="rounded-2xl p-4" :class="c.classe">
          <p class="text-xs font-semibold text-slate-500">{{ c.rotulo }}</p>
          <p class="text-2xl font-bold" :class="c.texto">{{ c.valor.toLocaleString('pt-BR') }}</p>
          <p class="text-xs text-slate-500">{{ c.detalhe }}</p>
        </div>
      </div>

      <!-- % pendente por setor (destaque) -->
      <section class="rounded-2xl p-5 ring-1 ring-slate-200">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h3 class="text-lg font-bold text-slate-900"><i class="fas fa-store-alt mr-2 text-blue-600"></i>% pendente por setor</h3>
          <p class="text-xs text-slate-500">
            <b :class="setoresAcima ? 'text-red-700' : 'text-emerald-700'">{{ setoresAcima }} de {{ setoresOrdenados.length }}</b> acima da meta de {{ META }}%
          </p>
        </div>
        <p v-if="!setoresOrdenados.length" class="mt-4 text-sm text-slate-500">Sem dados por setor.</p>
        <div v-else class="mt-4 overflow-x-auto rounded-xl ring-1 ring-slate-200">
          <table class="w-full text-sm">
            <thead class="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th class="px-4 py-3 text-left font-semibold">Setor</th>
                <th class="px-4 py-3 text-right font-semibold">Itens</th>
                <th class="px-4 py-3 text-right font-semibold">Lidos</th>
                <th class="px-4 py-3 text-right font-semibold">Pendentes</th>
                <th class="px-4 py-3 text-right font-semibold">Com problema</th>
                <th v-if="ehEtiqueta" class="px-4 py-3 text-right font-semibold">Desatualizados</th>
                <th class="px-4 py-3 text-right font-semibold">% Pendente</th>
                <th class="px-4 py-3 text-center font-semibold">Classificação</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="s in setoresOrdenados" :key="s.nome" :class="s.percentualPendente > META ? 'bg-red-50/40' : ''">
                <td class="px-4 py-2.5 font-semibold text-slate-800">{{ s.nome }}</td>
                <td class="px-4 py-2.5 text-right tabular-nums text-slate-600">{{ (s.total || 0).toLocaleString('pt-BR') }}</td>
                <td class="px-4 py-2.5 text-right tabular-nums text-slate-600">{{ (s.lidos || 0).toLocaleString('pt-BR') }}</td>
                <td class="px-4 py-2.5 text-right tabular-nums font-semibold text-amber-700">{{ (s.pendentes || 0).toLocaleString('pt-BR') }}</td>
                <td class="px-4 py-2.5 text-right tabular-nums text-slate-600">{{ (s.comProblema || 0).toLocaleString('pt-BR') }}</td>
                <td v-if="ehEtiqueta" class="px-4 py-2.5 text-right tabular-nums text-slate-600">{{ (s.desatualizados || 0).toLocaleString('pt-BR') }}</td>
                <td class="px-4 py-2.5 text-right tabular-nums text-base font-bold" :class="s.percentualPendente > META ? 'text-red-700' : 'text-emerald-700'">{{ s.percentualPendente.toFixed(2) }}%</td>
                <td class="px-4 py-2.5 text-center"><span class="rounded-full px-2.5 py-0.5 text-xs font-semibold" :class="corClassificacao(s.classificacao)">{{ s.classificacao }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div class="grid grid-cols-1 gap-5" :class="locaisSemLeitura.length ? 'lg:grid-cols-2' : ''">
        <!-- Top 10 locais (destaque) -->
        <section class="rounded-2xl p-5 ring-1 ring-slate-200">
          <h3 class="text-lg font-bold text-slate-900"><i class="fas fa-map-marker-alt mr-2 text-amber-600"></i>Top 10 locais com mais pendentes</h3>
          <p v-if="!topLocais.length" class="mt-4 text-sm text-slate-500">Nenhum local com pendências.</p>
          <ol v-else class="mt-4 space-y-3">
            <li v-for="(l, i) in topLocais" :key="l.nome" class="grid items-center gap-3" :class="locaisSemLeitura.length ? 'grid-cols-[1.75rem_minmax(0,8rem)_1fr_auto]' : 'grid-cols-[1.75rem_minmax(0,14rem)_1fr_auto]'">
              <span class="inline-flex size-7 items-center justify-center rounded-lg text-xs font-bold" :class="i < 3 ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'">{{ i + 1 }}</span>
              <span class="truncate text-sm font-semibold text-slate-800" :title="l.nome">{{ l.nome }}</span>
              <span class="h-4 rounded-full bg-slate-100"><span class="block h-full rounded-full bg-amber-500" :style="{ width: `${(l.pendentes / maiorLocal) * 100}%` }"></span></span>
              <span class="w-28 text-right text-sm"><b class="text-slate-900">{{ l.pendentes }}</b> <span class="text-xs text-slate-500">pend. · {{ l.percentualPendente.toFixed(1) }}%</span></span>
            </li>
          </ol>
        </section>

        <!-- Locais sem leitura (só quando houver) -->
        <section v-if="locaisSemLeitura.length" class="rounded-2xl bg-red-50 p-5">
          <div class="flex items-baseline justify-between gap-2">
            <h3 class="text-lg font-bold text-red-800"><i class="fas fa-ban mr-2"></i>Locais sem leitura</h3>
            <span class="text-3xl font-black text-red-700">{{ locaisSemLeitura.length }}</span>
          </div>
          <p class="mt-1 text-xs text-red-700">Nenhum item lido nesses locais até agora.</p>
          <div class="mt-4 flex flex-wrap gap-2">
            <span v-for="l in locaisSemLeitura" :key="l" class="rounded-lg bg-white px-3 py-1.5 text-sm font-bold text-red-700 shadow-sm">{{ l }}</span>
          </div>
        </section>
      </div>
    </div>
    <!-- Imagem quadrada (renderizada fora da tela só durante a geração) -->
    <div v-if="gerandoImagem" class="pointer-events-none fixed top-0" style="left: -99999px" aria-hidden="true">
      <div ref="imagemQuadrada" class="flex flex-col gap-5 bg-white p-9 text-slate-900" :style="{ width: `${QUADRADO}px`, height: `${QUADRADO}px` }">
        <div class="flex items-baseline justify-between">
          <p class="text-[30px] font-black">Auditoria de {{ auditoria.tipo }} · {{ dataBR }}</p>
          <p class="text-[20px] font-semibold text-slate-500">{{ auditoria.status === 'fechada' ? 'Fechada' : 'Em andamento' }} · #{{ auditoria.id }}</p>
        </div>

        <!-- Topo: % pendente em destaque + cards -->
        <div class="grid h-[270px] shrink-0 grid-cols-[430px_1fr] gap-5">
          <div class="flex flex-col justify-center rounded-[28px] bg-blue-700 px-8 text-white">
            <p class="text-[24px] font-semibold text-blue-100">% pendente</p>
            <p class="font-black leading-[1.05] tracking-tight" :style="{ fontSize: `${m.percentualPendente >= 10 ? 92 : 108}px` }">{{ m.percentualPendente.toFixed(2) }}%</p>
            <p class="mt-2 inline-flex w-fit items-center gap-2 rounded-full px-4 py-1 text-[20px] font-bold" :class="naMeta ? 'bg-emerald-400/25 text-emerald-50' : 'bg-red-400/30 text-red-50'">
              <i :class="naMeta ? 'fas fa-check' : 'fas fa-xmark'"></i>{{ naMeta ? 'Dentro da meta' : 'Fora da meta' }} ({{ META }}%)
            </p>
          </div>
          <div class="grid grid-cols-6 grid-rows-2 gap-4">
            <div v-for="c in cardsImagem" :key="c.rotulo" class="flex flex-col justify-center rounded-[22px] px-5" :class="[c.classe, c.coluna]">
              <p class="text-[16px] font-semibold text-slate-500">{{ c.rotulo }}</p>
              <p class="text-[40px] font-black leading-tight" :class="c.texto">{{ c.valor.toLocaleString('pt-BR') }}</p>
              <p class="truncate text-[15px] text-slate-500">{{ c.detalhe }}</p>
            </div>
          </div>
        </div>

        <!-- Setores (esquerda) e top 10 locais (direita) -->
        <div class="grid min-h-0 flex-1 grid-cols-2 gap-5">
          <section class="flex min-h-0 flex-col rounded-[24px] p-6 ring-2 ring-slate-200">
            <div class="flex items-baseline justify-between">
              <p class="text-[24px] font-black">% pendente por setor</p>
              <p class="text-[15px] font-semibold" :class="setoresAcima ? 'text-red-700' : 'text-emerald-700'">{{ setoresAcima }}/{{ setoresOrdenados.length }} acima</p>
            </div>
            <table class="mt-3 w-full table-fixed">
              <thead>
                <tr class="text-left text-[14px] font-semibold text-slate-500" :style="{ height: `${linhaSetor}px` }">
                  <th>Setor</th>
                  <th class="w-16 text-right">Pend.</th>
                  <th class="w-24 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="s in setoresOrdenados" :key="s.nome" class="border-t border-slate-100" :style="{ height: `${linhaSetor}px`, fontSize: `${fonteSetor}px` }">
                  <td class="pr-2 font-semibold leading-[1.1]"><span :class="setoresOrdenados.length <= 14 ? 'line-clamp-2' : 'block truncate'">{{ s.nome }}</span></td>
                  <td class="text-right font-bold text-amber-700">{{ s.pendentes }}</td>
                  <td class="text-right font-black" :class="s.percentualPendente > META ? 'text-red-700' : 'text-emerald-700'">{{ s.percentualPendente.toFixed(2) }}%</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section class="flex min-h-0 flex-col rounded-[24px] p-6 ring-2 ring-slate-200">
            <p class="text-[24px] font-black">Top 10 locais com mais pendentes</p>
            <p v-if="!topLocais.length" class="mt-6 text-[20px] text-slate-500">Nenhum local com pendências.</p>
            <ol v-else class="mt-4 flex flex-1 flex-col justify-between">
              <li v-for="(l, j) in topLocais" :key="l.nome" class="flex items-center gap-3">
                <span class="inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-[17px] font-black" :class="j < 3 ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'">{{ j + 1 }}</span>
                <div class="min-w-0 flex-1">
                  <div class="flex items-baseline justify-between gap-3">
                    <span class="truncate text-[19px] font-bold">{{ l.nome }}</span>
                    <span class="shrink-0 text-[19px] font-black">{{ l.pendentes }} <span class="text-[14px] font-semibold text-slate-500">· {{ l.percentualPendente.toFixed(1) }}%</span></span>
                  </div>
                  <div class="mt-1 h-2.5 rounded-full bg-slate-100"><div class="h-full rounded-full bg-amber-500" :style="{ width: `${(l.pendentes / maiorLocal) * 100}%` }"></div></div>
                </div>
              </li>
            </ol>
          </section>
        </div>
      </div>
    </div>
  </UiModal>
</template>

