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
const setoresAcima = computed(() => setoresOrdenados.value.filter(s => s.percentualPendente > META).length)
const topLocais = computed(() => [...props.locais].filter(l => l.pendentes > 0).sort((a, b) => b.pendentes - a.pendentes).slice(0, 10))
const maiorLocal = computed(() => Math.max(1, ...topLocais.value.map(l => l.pendentes)))
const locaisSemLeitura = computed(() => [...(analise.value.locaisSemLeitura || [])].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR', { numeric: true })))

// ---------- Imagem Full HD (1920 px de largura) ----------
const area = ref(null)
const gerandoImagem = ref(false)
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



const imprimir = () => {
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
      blocoTabela({
        titulo: '% pendente por setor',
        subtitulo: `${setoresAcima.value} de ${setoresOrdenados.value.length} setores acima da meta de ${META}%`,
        colunas: [
          { chave: 'nome', titulo: 'Setor' }, { chave: 'total', titulo: 'Itens', alinhamento: 'right' }, { chave: 'lidos', titulo: 'Lidos', alinhamento: 'right' }, { chave: 'pendentes', titulo: 'Pendentes', alinhamento: 'right' },
          { chave: 'comProblema', titulo: 'Problemas', alinhamento: 'right' },
          ...(ehEtiqueta.value ? [{ chave: 'desatualizados', titulo: 'Desatualizados', alinhamento: 'right' }] : []),
          { chave: 'percentualPendente', titulo: '% Pendente', alinhamento: 'right', format: v => `${v.toFixed(2)}%` },
          { chave: 'classificacao', titulo: 'Classificação' }
        ],
        linhas: setoresOrdenados.value
      }),
      grade(
        blocoBarras({ titulo: 'Top 10 locais com mais pendentes', barras: topLocais.value.map(l => ({ rotulo: l.nome, valor: l.pendentes, texto: `${l.pendentes} · ${l.percentualPendente.toFixed(1)}%`, tom: 'alerta' })) }),
        chips
      ),
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
            <b :class="setoresAcima ? 'text-red-700' : 'text-emerald-700'">{{ setoresAcima }} de {{ setoresOrdenados.length }}</b> acima da meta de {{ META }}%
          </p>
        </div>
        <p v-if="!setoresOrdenados.length" class="mt-4 text-sm text-slate-500">Sem dados por setor.</p>
        <div v-else class="mt-4 overflow-x-auto rounded-xl ring-1 ring-slate-200">
          <table class="w-full text-sm">
            <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
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
  </UiModal>
</template>

