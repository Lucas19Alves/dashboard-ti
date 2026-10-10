<script setup>
import { computed, ref } from 'vue'
import { toPng } from 'html-to-image'
import UiModal from './ui/UiModal.vue'
import { auditoriaAnteriorDoTipo, compararAuditorias, itensParaMeta } from '../utils/analiseHistorica'
import { META_PENDENTE_PERCENTUAL, metricasAuditoria } from '../utils/metricasAuditoria'
import { formatarDataBR } from '../utils/busca'
import {
  blocoBarras,
  blocoColunas,
  blocoComposicao,
  blocoDestaques,
  blocoTabela,
  grade,
  imprimirRelatorioVisual
} from '../utils/print'

// Relatório visual de uma auditoria: tela, impressão/PDF, imagem e resumo em texto.
const props = defineProps({
  auditoria: { type: Object, required: true },
  historico: { type: Array, default: () => [] },
  setores: { type: Array, default: () => [] }, // setoresComAnalise da página
  locais: { type: Array, default: () => [] }, // locaisComAnalise da página
  isItemLido: { type: Function, required: true },
  getItemHour: { type: Function, required: true }
})
const emit = defineEmits(['close'])
const META = META_PENDENTE_PERCENTUAL

const m = computed(() => metricasAuditoria(props.auditoria))
const analise = computed(() => props.auditoria?.analise || {})
const problemas = computed(() => Number(analise.value.itensLidosComProblema ?? ((analise.value.itensComEstoqueZero || 0) + (analise.value.itensLidoNaoPertence || 0))))
const desatualizados = computed(() => Number(analise.value.itensDesatualizados || 0))
const faltam = computed(() => itensParaMeta(props.auditoria))
const naMeta = computed(() => m.value.percentualPendente <= META)
const anterior = computed(() => auditoriaAnteriorDoTipo(props.auditoria, props.historico))
const comparacao = computed(() => compararAuditorias(props.auditoria, anterior.value))
const dataBR = computed(() => formatarDataBR(props.auditoria?.data))

const setoresOrdenados = computed(() => [...props.setores].sort((a, b) => b.percentualPendente - a.percentualPendente))
const maiorSetor = computed(() => Math.max(META * 2, ...setoresOrdenados.value.map(s => s.percentualPendente)))
const topLocais = computed(() => [...props.locais].filter(l => l.pendentes > 0).sort((a, b) => b.pendentes - a.pendentes).slice(0, 10))
const maiorLocal = computed(() => Math.max(1, ...topLocais.value.map(l => l.pendentes)))
const locaisSemLeitura = computed(() => analise.value.locaisSemLeitura || [])

const usuariosTop = computed(() => Object.entries(analise.value.porUsuario || {})
  .map(([nome, d]) => ({ nome, leituras: (d?.lidos || 0) + (d?.comProblema || 0), problemas: d?.comProblema || 0 }))
  .sort((a, b) => b.leituras - a.leituras)
  .slice(0, 5))
const maiorUsuario = computed(() => Math.max(1, ...usuariosTop.value.map(u => u.leituras)))

const porHora = computed(() => {
  const contagem = new Map()
  for (const item of Array.isArray(props.auditoria?.dados) ? props.auditoria.dados : []) {
    if (!props.isItemLido(item)) continue
    const h = props.getItemHour(item)
    if (h !== null && h !== undefined && h >= 5 && h <= 23) contagem.set(h, (contagem.get(h) || 0) + 1)
  }
  if (!contagem.size) return []
  const horas = [...contagem.keys()]
  const lista = []
  for (let h = Math.min(...horas); h <= Math.max(...horas); h++) lista.push({ hora: h, valor: contagem.get(h) || 0 })
  return lista
})
const maiorHora = computed(() => Math.max(1, ...porHora.value.map(h => h.valor)))
const picoHora = computed(() => porHora.value.reduce((p, h) => (h.valor > (p?.valor || 0) ? h : p), null))

const composicao = computed(() => {
  const total = m.value.total
  const corretos = Math.max(0, total - m.value.pendentes - problemas.value)
  return [
    { rotulo: 'Lidos corretamente', valor: corretos, cor: 'bg-emerald-500', tom: 'bom' },
    { rotulo: 'Com problema', valor: problemas.value, cor: 'bg-red-500', tom: 'ruim' },
    { rotulo: 'Pendentes', valor: m.value.pendentes, cor: 'bg-amber-400', tom: 'alerta' }
  ]
})

const destaques = computed(() => {
  const lista = []
  lista.push(naMeta.value
    ? { tom: 'bom', texto: `Dentro da meta: ${m.value.percentualPendente.toFixed(2)}% pendente (limite ${META}%).` }
    : { tom: 'ruim', texto: `Fora da meta: ${m.value.percentualPendente.toFixed(2)}% pendente. Faltam ler ${Math.max(0, faltam.value || 0).toLocaleString('pt-BR')} itens.` })
  if (comparacao.value) {
    const d = comparacao.value.diferencaPendente
    lista.push({ tom: d <= 0 ? 'bom' : 'ruim', texto: `${d <= 0 ? 'Melhorou' : 'Piorou'} ${Math.abs(d).toFixed(2)} p.p. em relação à ${props.auditoria.tipo} de ${formatarDataBR(anterior.value.data)}.` })
  }
  const pior = setoresOrdenados.value[0]
  if (pior && pior.percentualPendente > META) lista.push({ tom: 'ruim', texto: `Setor mais crítico: ${pior.nome} com ${pior.percentualPendente.toFixed(1)}% pendente (${pior.pendentes} itens).` })
  const acima = setoresOrdenados.value.filter(s => s.percentualPendente > META).length
  if (setoresOrdenados.value.length) lista.push({ tom: acima ? 'neutro' : 'bom', texto: `${acima} de ${setoresOrdenados.value.length} setores acima da meta.` })
  if (topLocais.value[0]) lista.push({ tom: 'neutro', texto: `Local com mais pendentes: ${topLocais.value[0].nome} (${topLocais.value[0].pendentes} itens).` })
  if (locaisSemLeitura.value.length) lista.push({ tom: 'ruim', texto: `${locaisSemLeitura.value.length} local(is) ainda sem nenhuma leitura.` })
  if (picoHora.value) lista.push({ tom: 'neutro', texto: `Maior volume de leituras às ${String(picoHora.value.hora).padStart(2, '0')}h (${picoHora.value.valor} itens).` })
  return lista
})

const tomClasse = { bom: 'border-emerald-400 bg-emerald-50 text-emerald-900', ruim: 'border-red-400 bg-red-50 text-red-900', neutro: 'border-blue-400 bg-blue-50 text-blue-900' }

// ---------- Ações ----------
const area = ref(null)
const gerandoImagem = ref(false)
const copiado = ref(false)
const nomeBase = computed(() => `relatorio-${props.auditoria.tipo}-${dataBR.value}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-'))

const salvarImagem = async () => {
  if (!area.value) return
  gerandoImagem.value = true
  try {
    const url = await toPng(area.value, { cacheBust: true, pixelRatio: 2, backgroundColor: '#ffffff' })
    const link = document.createElement('a')
    link.download = `${nomeBase.value}.png`
    link.href = url
    link.click()
  } finally {
    gerandoImagem.value = false
  }
}

const textoResumo = computed(() => [
  `*Auditoria de ${props.auditoria.tipo} · ${dataBR.value}*`,
  `${naMeta.value ? '✅ Dentro da meta' : '⚠️ Fora da meta'}: ${m.value.percentualPendente.toFixed(2)}% pendente (meta ${META}%)`,
  `Lidos: ${m.value.lidos.toLocaleString('pt-BR')} de ${m.value.total.toLocaleString('pt-BR')} · Pendentes: ${m.value.pendentes.toLocaleString('pt-BR')}`,
  comparacao.value ? `vs anterior (${formatarDataBR(anterior.value.data)}): ${comparacao.value.diferencaPendente > 0 ? '+' : ''}${comparacao.value.diferencaPendente.toFixed(2)} p.p.` : '',
  setoresOrdenados.value.filter(s => s.percentualPendente > META).length
    ? `Setores acima da meta: ${setoresOrdenados.value.filter(s => s.percentualPendente > META).slice(0, 5).map(s => `${s.nome} (${s.percentualPendente.toFixed(1)}%)`).join(', ')}`
    : 'Todos os setores dentro da meta',
  topLocais.value.length ? `Locais com mais pendentes: ${topLocais.value.slice(0, 5).map(l => `${l.nome} (${l.pendentes})`).join(', ')}` : ''
].filter(Boolean).join('\n'))

const copiarResumo = async () => {
  try {
    await navigator.clipboard.writeText(textoResumo.value)
    copiado.value = true
    setTimeout(() => { copiado.value = false }, 1800)
  } catch {}
}

const imprimir = () => {
  const tomPend = v => (v > META ? 'ruim' : 'bom')
  imprimirRelatorioVisual({
    titulo: `Relatório de Auditoria · ${props.auditoria.tipo}`,
    subtitulo: `${dataBR.value} · SKU ${m.value.total.toLocaleString('pt-BR')} · ${props.auditoria.status === 'fechada' ? 'Fechada' : 'Em andamento'}`,
    indicadores: [
      { rotulo: '% Pendente', valor: `${m.value.percentualPendente.toFixed(2)}%`, detalhe: naMeta.value ? 'Dentro da meta' : 'Fora da meta', tom: naMeta.value ? 'bom' : 'ruim' },
      { rotulo: 'Lidos', valor: m.value.lidos, detalhe: `${m.value.percentualConclusao.toFixed(1)}% concluído` },
      { rotulo: 'Pendentes', valor: m.value.pendentes, detalhe: faltam.value > 0 ? `faltam ${faltam.value} p/ meta` : `folga de ${Math.abs(faltam.value || 0)}`, tom: 'alerta' },
      { rotulo: 'Com problema', valor: problemas.value, tom: problemas.value ? 'ruim' : 'neutro' },
      ...(comparacao.value ? [{ rotulo: 'vs anterior', valor: `${comparacao.value.diferencaPendente > 0 ? '+' : ''}${comparacao.value.diferencaPendente.toFixed(2)} p.p.`, detalhe: formatarDataBR(anterior.value.data), tom: comparacao.value.diferencaPendente <= 0 ? 'bom' : 'ruim' }] : [])
    ],
    blocos: [
      blocoComposicao({ titulo: 'Composição da auditoria', partes: composicao.value }),
      blocoDestaques({ itens: destaques.value }),
      grade(
        blocoBarras({ titulo: '% pendente por setor', subtitulo: `Linha tracejada = meta de ${META}%`, barras: setoresOrdenados.value.map(s => ({ rotulo: s.nome, valor: s.percentualPendente, texto: `${s.percentualPendente.toFixed(1)}%`, tom: tomPend(s.percentualPendente) })), meta: META }),
        blocoBarras({ titulo: 'Top 10 locais com mais pendentes', barras: topLocais.value.map(l => ({ rotulo: l.nome, valor: l.pendentes, texto: `${l.pendentes} (${l.percentualPendente.toFixed(1)}%)`, tom: 'alerta' })) })
      ),
      grade(
        porHora.value.length ? blocoColunas({ titulo: 'Leituras por hora', colunas: porHora.value.map(h => ({ rotulo: `${String(h.hora).padStart(2, '0')}h`, valor: h.valor })) }) : '',
        usuariosTop.value.length ? blocoBarras({ titulo: 'Usuários com mais leituras', barras: usuariosTop.value.map(u => ({ rotulo: u.nome, valor: u.leituras, texto: `${u.leituras} (${u.problemas} probl.)` })) }) : ''
      ),
      blocoTabela({
        titulo: 'Setores',
        colunas: [
          { chave: 'nome', titulo: 'Setor' }, { chave: 'total', titulo: 'Itens', alinhamento: 'right' }, { chave: 'pendentes', titulo: 'Pendentes', alinhamento: 'right' },
          { chave: 'comProblema', titulo: 'Problemas', alinhamento: 'right' }, { chave: 'desatualizados', titulo: 'Desatual.', alinhamento: 'right' },
          { chave: 'percentualPendente', titulo: '% Pendente', alinhamento: 'right', format: v => `${v.toFixed(2)}%`, barra: { max: maiorSetor.value, tom: tomPend } },
          { chave: 'classificacao', titulo: 'Classificação' }
        ],
        linhas: setoresOrdenados.value
      }),
      locaisSemLeitura.value.length ? blocoDestaques({ titulo: `Locais sem leitura (${locaisSemLeitura.value.length})`, itens: [{ tom: 'ruim', texto: locaisSemLeitura.value.join(' · ') }] }) : ''
    ]
  })
}

const corClassificacao = c => ({ Excelente: 'bg-emerald-50 text-emerald-700', Bom: 'bg-lime-50 text-lime-700', Regular: 'bg-amber-50 text-amber-700' })[c] || 'bg-red-50 text-red-700'
</script>

<template>
  <UiModal :title="`Relatório · ${auditoria.tipo}`" :subtitle="`${dataBR} · pronto para imprimir, salvar em PDF ou compartilhar`" width="max-w-6xl" @close="emit('close')">
    <div class="mb-4 flex flex-wrap items-center gap-2">
      <button type="button" class="ui-btn-primary py-2" @click="imprimir"><i class="fas fa-file-pdf"></i>Imprimir / PDF</button>
      <button type="button" class="ui-btn-secondary py-2" :disabled="gerandoImagem" @click="salvarImagem"><i :class="gerandoImagem ? 'fas fa-spinner fa-spin' : 'fas fa-image'"></i>Salvar imagem</button>
      <button type="button" class="ui-btn-secondary py-2" @click="copiarResumo"><i :class="copiado ? 'fas fa-check text-emerald-600' : 'fab fa-whatsapp'"></i>{{ copiado ? 'Resumo copiado' : 'Copiar resumo' }}</button>
    </div>

    <div ref="area" class="space-y-5 bg-white">
      <!-- Cabeçalho -->
      <div class="flex flex-col gap-4 rounded-2xl bg-blue-700 p-5 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wider text-blue-200">Relatório de auditoria</p>
          <p class="mt-1 text-2xl font-bold">{{ auditoria.tipo }} · {{ dataBR }}</p>
          <p class="text-sm text-blue-100">SKU {{ m.total.toLocaleString('pt-BR') }} · {{ auditoria.status === 'fechada' ? 'Fechada' : 'Em andamento' }} · #{{ auditoria.id }}</p>
        </div>
        <div class="text-left sm:text-right">
          <p class="text-4xl font-black tracking-tight">{{ m.percentualPendente.toFixed(2) }}%</p>
          <span class="mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold" :class="naMeta ? 'bg-emerald-400/20 text-emerald-100' : 'bg-red-400/25 text-red-100'">
            <i :class="naMeta ? 'fas fa-check' : 'fas fa-xmark'"></i>{{ naMeta ? 'Dentro da meta' : 'Fora da meta' }} ({{ META }}%)
          </span>
        </div>
      </div>

      <!-- Indicadores -->
      <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div class="rounded-2xl bg-slate-50 p-4">
          <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Lidos</p>
          <p class="text-2xl font-bold text-slate-900">{{ m.lidos.toLocaleString('pt-BR') }}</p>
          <p class="text-xs text-slate-500">{{ m.percentualConclusao.toFixed(1) }}% concluído</p>
        </div>
        <div class="rounded-2xl bg-amber-50 p-4">
          <p class="text-[11px] font-bold uppercase tracking-wider text-amber-700">Pendentes</p>
          <p class="text-2xl font-bold text-amber-800">{{ m.pendentes.toLocaleString('pt-BR') }}</p>
          <p class="text-xs text-amber-700">{{ faltam > 0 ? `faltam ${faltam} para a meta` : `folga de ${Math.abs(faltam || 0)} itens` }}</p>
        </div>
        <div class="rounded-2xl p-4" :class="problemas ? 'bg-red-50' : 'bg-slate-50'">
          <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Com problema</p>
          <p class="text-2xl font-bold" :class="problemas ? 'text-red-700' : 'text-slate-900'">{{ problemas.toLocaleString('pt-BR') }}</p>
          <p class="text-xs text-slate-500">sem estoque ou fora do local</p>
        </div>
        <div class="rounded-2xl bg-slate-50 p-4">
          <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">vs anterior</p>
          <template v-if="comparacao">
            <p class="text-2xl font-bold" :class="comparacao.diferencaPendente <= 0 ? 'text-emerald-700' : 'text-red-700'">
              <i :class="comparacao.diferencaPendente <= 0 ? 'fas fa-arrow-down' : 'fas fa-arrow-up'" class="text-base"></i>
              {{ Math.abs(comparacao.diferencaPendente).toFixed(2) }} p.p.
            </p>
            <p class="text-xs text-slate-500">{{ formatarDataBR(anterior.data) }}: {{ comparacao.anterior.percentualPendente.toFixed(2) }}%</p>
          </template>
          <p v-else class="mt-1 text-sm text-slate-500">Sem auditoria anterior</p>
        </div>
      </div>

      <!-- Composição -->
      <div class="rounded-2xl bg-slate-50 p-4">
        <p class="text-xs font-bold text-slate-700">Composição da auditoria</p>
        <div class="mt-2 flex h-4 gap-0.5 overflow-hidden rounded-full bg-white">
          <span v-for="p in composicao" :key="p.rotulo" :class="p.cor" :style="{ width: `${m.total ? (p.valor / m.total) * 100 : 0}%` }"></span>
        </div>
        <div class="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
          <span v-for="p in composicao" :key="p.rotulo"><i class="mr-1 inline-block size-2 rounded-full" :class="p.cor"></i>{{ p.rotulo }}: <b class="text-slate-800">{{ p.valor.toLocaleString('pt-BR') }}</b></span>
          <span v-if="desatualizados">Desatualizados: <b class="text-slate-800">{{ desatualizados.toLocaleString('pt-BR') }}</b></span>
        </div>
      </div>

      <!-- Destaques -->
      <ul class="grid grid-cols-1 gap-2 md:grid-cols-2">
        <li v-for="(d, i) in destaques" :key="i" class="rounded-xl border-l-4 px-3 py-2 text-sm font-medium" :class="tomClasse[d.tom]">{{ d.texto }}</li>
      </ul>

      <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <!-- Setores -->
        <section class="rounded-2xl ring-1 ring-slate-200 p-4">
          <div class="flex items-baseline justify-between">
            <p class="text-sm font-bold text-slate-900">% pendente por setor</p>
            <p class="text-[11px] text-slate-500">tracejado = meta {{ META }}%</p>
          </div>
          <ul class="mt-3 space-y-2">
            <li v-for="s in setoresOrdenados" :key="s.nome" class="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-xs">
              <span class="truncate font-semibold text-slate-700" :title="s.nome">{{ s.nome }}</span>
              <span class="relative h-2.5 rounded-full bg-slate-100">
                <span class="absolute inset-y-0 left-0 rounded-full" :class="s.percentualPendente > META ? 'bg-red-500' : 'bg-emerald-500'" :style="{ width: `${(s.percentualPendente / maiorSetor) * 100}%` }"></span>
                <span class="absolute -top-1 -bottom-1 border-l-2 border-dashed border-slate-500" :style="{ left: `${(META / maiorSetor) * 100}%` }"></span>
              </span>
              <span class="w-24 text-right">
                <b :class="s.percentualPendente > META ? 'text-red-700' : 'text-emerald-700'">{{ s.percentualPendente.toFixed(1) }}%</b>
                <span class="ml-1 rounded px-1 py-0.5 text-[10px] font-semibold" :class="corClassificacao(s.classificacao)">{{ s.classificacao }}</span>
              </span>
            </li>
          </ul>
        </section>

        <!-- Locais -->
        <section class="rounded-2xl ring-1 ring-slate-200 p-4">
          <p class="text-sm font-bold text-slate-900">Top 10 locais com mais pendentes</p>
          <p v-if="!topLocais.length" class="mt-4 text-sm text-slate-500">Nenhum local com pendências.</p>
          <ul v-else class="mt-3 space-y-2">
            <li v-for="(l, i) in topLocais" :key="l.nome" class="grid grid-cols-[1.25rem_minmax(0,7rem)_1fr_auto] items-center gap-3 text-xs">
              <span class="text-center font-bold text-slate-400">{{ i + 1 }}</span>
              <span class="truncate font-semibold text-slate-700">{{ l.nome }}</span>
              <span class="h-2.5 rounded-full bg-slate-100"><span class="block h-full rounded-full bg-amber-500" :style="{ width: `${(l.pendentes / maiorLocal) * 100}%` }"></span></span>
              <span class="w-24 text-right"><b class="text-slate-800">{{ l.pendentes }}</b> <span class="text-slate-500">· {{ l.percentualPendente.toFixed(1) }}%</span></span>
            </li>
          </ul>
        </section>

        <!-- Horas -->
        <section v-if="porHora.length" class="rounded-2xl ring-1 ring-slate-200 p-4">
          <p class="text-sm font-bold text-slate-900">Leituras por hora</p>
          <div class="mt-4 flex h-32 items-end gap-1">
            <div v-for="h in porHora" :key="h.hora" class="group relative flex h-full flex-1 flex-col justify-end">
              <span class="pointer-events-none absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-1.5 py-0.5 text-[10px] text-white group-hover:block">{{ h.valor }}</span>
              <span class="w-full rounded-t" :class="h.hora === picoHora?.hora ? 'bg-blue-700' : 'bg-blue-400'" :style="{ height: `${(h.valor / maiorHora) * 100}%`, minHeight: h.valor ? '2px' : '0' }"></span>
            </div>
          </div>
          <div class="mt-1 flex gap-1"><span v-for="h in porHora" :key="h.hora" class="flex-1 text-center text-[10px] text-slate-400">{{ h.hora }}</span></div>
        </section>

        <!-- Usuários -->
        <section v-if="usuariosTop.length" class="rounded-2xl ring-1 ring-slate-200 p-4">
          <p class="text-sm font-bold text-slate-900">Usuários com mais leituras</p>
          <ul class="mt-3 space-y-2.5">
            <li v-for="u in usuariosTop" :key="u.nome" class="text-xs">
              <div class="flex justify-between"><span class="font-semibold text-slate-700">{{ u.nome }}</span><span class="text-slate-500"><b class="text-slate-800">{{ u.leituras.toLocaleString('pt-BR') }}</b> · {{ u.problemas }} probl.</span></div>
              <div class="mt-1 h-2 rounded-full bg-slate-100"><div class="h-full rounded-full bg-blue-600" :style="{ width: `${(u.leituras / maiorUsuario) * 100}%` }"></div></div>
            </li>
          </ul>
        </section>
      </div>

      <section v-if="locaisSemLeitura.length" class="rounded-2xl bg-red-50 p-4">
        <p class="text-sm font-bold text-red-800"><i class="fas fa-triangle-exclamation mr-1"></i>Locais sem nenhuma leitura ({{ locaisSemLeitura.length }})</p>
        <div class="mt-2 flex flex-wrap gap-1.5">
          <span v-for="l in locaisSemLeitura" :key="l" class="rounded-md bg-white px-2 py-1 text-xs font-semibold text-red-700 shadow-sm">{{ l }}</span>
        </div>
      </section>
    </div>
  </UiModal>
</template>
