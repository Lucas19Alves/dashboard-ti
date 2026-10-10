<script setup>
import { computed, ref } from 'vue'
import { toPng } from 'html-to-image'
import UiModal from './ui/UiModal.vue'
import { itensParaMeta } from '../utils/analiseHistorica'
import { META_PENDENTE_PERCENTUAL, metricasAuditoria } from '../utils/metricasAuditoria'
import { formatarDataBR } from '../utils/busca'
import { blocoBarras, blocoTabela, escapeHtml, grade, imprimirRelatorioVisual } from '../utils/print'

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
const maiorSetor = computed(() => Math.max(META * 2, ...setoresOrdenados.value.map(s => s.percentualPendente)) * 1.05)
const setoresAcima = computed(() => setoresOrdenados.value.filter(s => s.percentualPendente > META).length)
const topLocais = computed(() => [...props.locais].filter(l => l.pendentes > 0).sort((a, b) => b.pendentes - a.pendentes).slice(0, 10))
const maiorLocal = computed(() => Math.max(1, ...topLocais.value.map(l => l.pendentes)))
const locaisSemLeitura = computed(() => [...(analise.value.locaisSemLeitura || [])].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR', { numeric: true })))

// ---------- Imagem Full HD (1920 px de largura) ----------
const area = ref(null)
const gerandoImagem = ref(false)
const copiado = ref(false)
const LARGURA_IMAGEM = 1920
const ALTURA_MINIMA = 1080
const nomeBase = computed(() => `relatorio-${props.auditoria.tipo}-${dataBR.value}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-'))

const salvarImagem = async () => {
  if (!area.value) return
  gerandoImagem.value = true
  // Clona o relatório fora da tela com 1920 px para o layout de desktop largo.
  const palco = document.createElement('div')
  palco.style.cssText = `position:fixed;left:-99999px;top:0;width:${LARGURA_IMAGEM}px;background:#fff;padding:48px;box-sizing:border-box;`
  const clone = area.value.cloneNode(true)
  palco.appendChild(clone)
  document.body.appendChild(palco)
  try {
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    const altura = Math.max(ALTURA_MINIMA, Math.ceil(palco.scrollHeight))
    palco.style.height = `${altura}px`
    const url = await toPng(palco, { cacheBust: true, pixelRatio: 1, width: LARGURA_IMAGEM, height: altura, backgroundColor: '#ffffff', style: { left: '0', position: 'static' } })
    const link = document.createElement('a')
    link.download = `${nomeBase.value}.png`
    link.href = url
    link.click()
  } finally {
    palco.remove()
    gerandoImagem.value = false
  }
}

const textoResumo = computed(() => [
  `*Auditoria de ${props.auditoria.tipo} · ${dataBR.value}*`,
  `${naMeta.value ? '✅ Dentro da meta' : '⚠️ Fora da meta'}: ${m.value.percentualPendente.toFixed(2)}% pendente (meta ${META}%)`,
  `SKU ${m.value.total.toLocaleString('pt-BR')} · Lidos ${m.value.lidos.toLocaleString('pt-BR')} · Pendentes ${m.value.pendentes.toLocaleString('pt-BR')} · Com problema ${problemas.value}${ehEtiqueta.value ? ` · Desatualizados ${desatualizados.value}` : ''}`,
  setoresAcima.value
    ? `Setores acima da meta: ${setoresOrdenados.value.filter(s => s.percentualPendente > META).map(s => `${s.nome} (${s.percentualPendente.toFixed(1)}%)`).join(', ')}`
    : 'Todos os setores dentro da meta',
  topLocais.value.length ? `Locais com mais pendentes: ${topLocais.value.map(l => `${l.nome} (${l.pendentes})`).join(', ')}` : '',
  locaisSemLeitura.value.length ? `Locais sem leitura (${locaisSemLeitura.value.length}): ${locaisSemLeitura.value.join(', ')}` : ''
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
  const chips = locaisSemLeitura.value.length
    ? `<div class="secao painel"><h2>Locais sem leitura (${locaisSemLeitura.value.length})</h2><p class="sub">Nenhum item lido nesses locais.</p>
        <div style="display:flex;flex-wrap:wrap;gap:5px">${locaisSemLeitura.value.map(l => `<span style="padding:3px 8px;border-radius:6px;background:#fee2e2;color:#b91c1c;font-weight:700;font-size:10.5px">${escapeHtml(l)}</span>`).join('')}</div></div>`
    : ''
  imprimirRelatorioVisual({
    titulo: `Relatório de Auditoria · ${props.auditoria.tipo}`,
    subtitulo: `${dataBR.value} · ${props.auditoria.status === 'fechada' ? 'Fechada' : 'Em andamento'}`,
    indicadores: [
      { rotulo: '% Pendente', valor: `${m.value.percentualPendente.toFixed(2)}%`, detalhe: naMeta.value ? `Dentro da meta (${META}%)` : `Fora da meta (${META}%)`, tom: naMeta.value ? 'bom' : 'ruim' },
      ...cards.value.map(c => ({ rotulo: c.rotulo, valor: c.valor, detalhe: c.detalhe, tom: c.rotulo === 'Pendentes' ? 'alerta' : c.rotulo === 'Com problema' && c.valor ? 'ruim' : 'neutro' }))
    ],
    blocos: [
      blocoBarras({
        titulo: '% pendente por setor',
        subtitulo: `${setoresAcima.value} de ${setoresOrdenados.value.length} setores acima da meta · tracejado = ${META}%`,
        barras: setoresOrdenados.value.map(s => ({ rotulo: s.nome, valor: s.percentualPendente, texto: `${s.percentualPendente.toFixed(1)}% · ${s.pendentes} pend.`, tom: tomPend(s.percentualPendente) })),
        meta: META,
        maximo: maiorSetor.value
      }),
      grade(
        blocoBarras({ titulo: 'Top 10 locais com mais pendentes', barras: topLocais.value.map(l => ({ rotulo: l.nome, valor: l.pendentes, texto: `${l.pendentes} · ${l.percentualPendente.toFixed(1)}%`, tom: 'alerta' })) }),
        chips
      ),
      blocoTabela({
        titulo: 'Setores',
        colunas: [
          { chave: 'nome', titulo: 'Setor' }, { chave: 'total', titulo: 'Itens', alinhamento: 'right' }, { chave: 'pendentes', titulo: 'Pendentes', alinhamento: 'right' },
          { chave: 'comProblema', titulo: 'Problemas', alinhamento: 'right' },
          ...(ehEtiqueta.value ? [{ chave: 'desatualizados', titulo: 'Desatualizados', alinhamento: 'right' }] : []),
          { chave: 'percentualPendente', titulo: '% Pendente', alinhamento: 'right', format: v => `${v.toFixed(2)}%`, barra: { max: maiorSetor.value, tom: tomPend } },
          { chave: 'classificacao', titulo: 'Classificação' }
        ],
        linhas: setoresOrdenados.value
      })
    ]
  })
}

const corClassificacao = c => ({ Excelente: 'bg-emerald-50 text-emerald-700', Bom: 'bg-lime-50 text-lime-700', Regular: 'bg-amber-50 text-amber-700' })[c] || 'bg-red-50 text-red-700'
</script>

<template>
  <UiModal :title="`Relatório · ${auditoria.tipo}`" :subtitle="`${dataBR} · imprimir, salvar em PDF ou imagem Full HD`" width="max-w-7xl" @close="emit('close')">
    <div class="mb-4 flex flex-wrap items-center gap-2">
      <button type="button" class="ui-btn-primary py-2" @click="imprimir"><i class="fas fa-file-pdf"></i>Imprimir / PDF</button>
      <button type="button" class="ui-btn-secondary py-2" :disabled="gerandoImagem" @click="salvarImagem"><i :class="gerandoImagem ? 'fas fa-spinner fa-spin' : 'fas fa-image'"></i>Salvar imagem (Full HD)</button>
      <button type="button" class="ui-btn-secondary py-2" @click="copiarResumo"><i :class="copiado ? 'fas fa-check text-emerald-600' : 'fab fa-whatsapp'"></i>{{ copiado ? 'Resumo copiado' : 'Copiar resumo' }}</button>
    </div>

    <div ref="area" class="relatorio space-y-5 bg-white">
      <!-- % pendente -->
      <div class="flex flex-col gap-4 rounded-2xl bg-blue-700 p-5 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wider text-blue-200">Relatório de auditoria</p>
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
          <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">{{ c.rotulo }}</p>
          <p class="text-2xl font-bold" :class="c.texto">{{ c.valor.toLocaleString('pt-BR') }}</p>
          <p class="text-xs text-slate-500">{{ c.detalhe }}</p>
        </div>
      </div>

      <!-- % pendente por setor (destaque) -->
      <section class="rounded-2xl p-5 ring-1 ring-slate-200">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h3 class="text-lg font-bold text-slate-900"><i class="fas fa-store-alt mr-2 text-blue-600"></i>% pendente por setor</h3>
          <p class="text-xs text-slate-500">
            <b :class="setoresAcima ? 'text-red-700' : 'text-emerald-700'">{{ setoresAcima }} de {{ setoresOrdenados.length }}</b> acima da meta · tracejado = {{ META }}%
          </p>
        </div>
        <p v-if="!setoresOrdenados.length" class="mt-4 text-sm text-slate-500">Sem dados por setor.</p>
        <ul v-else class="mt-4 grid grid-cols-1 gap-x-10 gap-y-3" :class="setoresOrdenados.length > 8 ? 'lg:grid-cols-2' : ''">
          <li v-for="s in setoresOrdenados" :key="s.nome" class="grid grid-cols-[minmax(0,15rem)_1fr_auto] items-center gap-3">
            <span class="truncate text-sm font-semibold text-slate-800" :title="s.nome">{{ s.nome }}</span>
            <span class="relative h-4 rounded-full bg-slate-100">
              <span class="absolute inset-y-0 left-0 rounded-full" :class="s.percentualPendente > META ? 'bg-red-500' : 'bg-emerald-500'" :style="{ width: `${(s.percentualPendente / maiorSetor) * 100}%` }"></span>
              <span class="absolute -top-1 -bottom-1 border-l-2 border-dashed border-slate-500" :style="{ left: `${(META / maiorSetor) * 100}%` }"></span>
            </span>
            <span class="w-44 text-right text-sm">
              <b :class="s.percentualPendente > META ? 'text-red-700' : 'text-emerald-700'">{{ s.percentualPendente.toFixed(1) }}%</b>
              <span class="text-xs text-slate-500"> · {{ s.pendentes }} pend.</span>
              <span class="ml-1 rounded px-1.5 py-0.5 text-[10px] font-semibold" :class="corClassificacao(s.classificacao)">{{ s.classificacao }}</span>
            </span>
          </li>
        </ul>
      </section>

      <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <!-- Top 10 locais (destaque) -->
        <section class="rounded-2xl p-5 ring-1 ring-slate-200">
          <h3 class="text-lg font-bold text-slate-900"><i class="fas fa-map-marker-alt mr-2 text-amber-600"></i>Top 10 locais com mais pendentes</h3>
          <p v-if="!topLocais.length" class="mt-4 text-sm text-slate-500">Nenhum local com pendências.</p>
          <ol v-else class="mt-4 space-y-3">
            <li v-for="(l, i) in topLocais" :key="l.nome" class="grid grid-cols-[1.75rem_minmax(0,8rem)_1fr_auto] items-center gap-3">
              <span class="inline-flex size-7 items-center justify-center rounded-lg text-xs font-bold" :class="i < 3 ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'">{{ i + 1 }}</span>
              <span class="truncate text-sm font-semibold text-slate-800" :title="l.nome">{{ l.nome }}</span>
              <span class="h-4 rounded-full bg-slate-100"><span class="block h-full rounded-full bg-amber-500" :style="{ width: `${(l.pendentes / maiorLocal) * 100}%` }"></span></span>
              <span class="w-28 text-right text-sm"><b class="text-slate-900">{{ l.pendentes }}</b> <span class="text-xs text-slate-500">pend. · {{ l.percentualPendente.toFixed(1) }}%</span></span>
            </li>
          </ol>
        </section>

        <!-- Locais sem leitura (destaque) -->
        <section class="rounded-2xl p-5" :class="locaisSemLeitura.length ? 'bg-red-50' : 'bg-emerald-50'">
          <div class="flex items-baseline justify-between gap-2">
            <h3 class="text-lg font-bold" :class="locaisSemLeitura.length ? 'text-red-800' : 'text-emerald-800'">
              <i :class="locaisSemLeitura.length ? 'fas fa-ban' : 'fas fa-circle-check'" class="mr-2"></i>Locais sem leitura
            </h3>
            <span class="text-3xl font-black" :class="locaisSemLeitura.length ? 'text-red-700' : 'text-emerald-700'">{{ locaisSemLeitura.length }}</span>
          </div>
          <p class="mt-1 text-xs" :class="locaisSemLeitura.length ? 'text-red-700' : 'text-emerald-700'">
            {{ locaisSemLeitura.length ? 'Nenhum item lido nesses locais até agora.' : 'Todos os locais tiveram leitura.' }}
          </p>
          <div v-if="locaisSemLeitura.length" class="mt-4 flex flex-wrap gap-2">
            <span v-for="l in locaisSemLeitura" :key="l" class="rounded-lg bg-white px-3 py-1.5 text-sm font-bold text-red-700 shadow-sm">{{ l }}</span>
          </div>
        </section>
      </div>
    </div>
  </UiModal>
</template>

