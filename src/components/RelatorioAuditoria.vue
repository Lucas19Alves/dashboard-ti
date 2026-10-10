<script setup>
import { computed, nextTick, ref } from 'vue'
import { toBlob, toPng } from 'html-to-image'
import UiModal from './ui/UiModal.vue'
import { itensParaMeta } from '../utils/analiseHistorica'
import { META_PENDENTE_PERCENTUAL, metricasAuditoria } from '../utils/metricasAuditoria'
import { formatarDataBR } from '../utils/busca'
import { paginarEquilibrado } from '../utils/paginas'
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

// ---------- Imagem: layout de 1920 px renderizado 4x (7680 px de largura) ----------
const area = ref(null)
const gerandoImagem = ref(false)
const LARGURA_LAYOUT = 1920
const MARGEM = 12
// Navegadores com limite de canvas menor (ex.: Safari no celular) caem para 2x ou 1x.
const ESCALAS = [4, 2, 1]
const nomeBase = computed(() => `relatorio-${props.auditoria.tipo}-${dataBR.value}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-'))

const salvarImagem = async () => {
  if (!area.value) return
  gerandoImagem.value = true
  // Clona o relatório fora da tela com largura fixa para o layout de desktop largo.
  const palco = document.createElement('div')
  palco.style.cssText = `position:fixed;left:-99999px;top:0;width:${LARGURA_LAYOUT}px;background:#fff;padding:${MARGEM}px;box-sizing:border-box;`
  palco.appendChild(area.value.cloneNode(true))
  document.body.appendChild(palco)
  try {
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    const altura = Math.ceil(palco.scrollHeight)
    let url = ''
    for (const escala of ESCALAS) {
      try {
        url = await toPng(palco, { cacheBust: true, pixelRatio: escala, width: LARGURA_LAYOUT, height: altura, backgroundColor: '#ffffff', style: { left: '0', position: 'static' } })
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

// ---------- Cartões para WhatsApp ----------
// O WhatsApp reduz imagens para ~1600 px no lado maior; uma imagem larga com tabela fica ilegível.
// Geramos cartões verticais 4:5 (1080×1350, renderizados em 2x) com letras grandes e poucas colunas.
const CARTAO = { largura: 1080, altura: 1350 }
const SETORES_POR_CARTAO = 11
const LOCAIS_SEM_LEITURA_POR_CARTAO = 40
const cartoes = computed(() => {
  const lista = [{ tipo: 'resumo' }]
  const paginasSetores = paginarEquilibrado(setoresOrdenados.value, SETORES_POR_CARTAO)
  if (setoresOrdenados.value.length) {
    paginasSetores.forEach((itens, i) => lista.push({ tipo: 'setores', itens, parte: paginasSetores.length > 1 ? `${i + 1}/${paginasSetores.length}` : '' }))
  }
  if (topLocais.value.length) lista.push({ tipo: 'locais' })
  const paginasSemLeitura = paginarEquilibrado(locaisSemLeitura.value, LOCAIS_SEM_LEITURA_POR_CARTAO)
  if (locaisSemLeitura.value.length) {
    paginasSemLeitura.forEach((itens, i) => lista.push({ tipo: 'semLeitura', itens, parte: paginasSemLeitura.length > 1 ? `${i + 1}/${paginasSemLeitura.length}` : '' }))
  }
  return lista
})
const gerandoCartoes = ref(false)
const elementosCartao = []

const baixarArquivo = (arquivo) => {
  const url = URL.createObjectURL(arquivo)
  const link = document.createElement('a')
  link.href = url
  link.download = arquivo.name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

const enviarWhatsapp = async () => {
  gerandoCartoes.value = true
  elementosCartao.length = 0
  const arquivos = []
  try {
    await nextTick()
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    for (const [i, el] of elementosCartao.entries()) {
      const blob = await toBlob(el, { cacheBust: true, pixelRatio: 2, width: CARTAO.largura, height: CARTAO.altura, backgroundColor: '#ffffff' })
      if (blob) arquivos.push(new File([blob], `${nomeBase.value}-${String(i + 1).padStart(2, '0')}.png`, { type: 'image/png' }))
    }
  } finally {
    gerandoCartoes.value = false
  }
  if (!arquivos.length) return
  // No celular abre a folha de compartilhamento (WhatsApp incluso); no computador baixa os arquivos.
  if (navigator.canShare?.({ files: arquivos })) {
    try {
      await navigator.share({ files: arquivos, title: `Auditoria de ${props.auditoria.tipo} · ${dataBR.value}` })
      return
    } catch (erro) {
      if (erro?.name === 'AbortError') return
    }
  }
  for (const arquivo of arquivos) {
    baixarArquivo(arquivo)
    await new Promise(r => setTimeout(r, 350))
  }
}

const corClassificacao = c => ({ Excelente: 'bg-emerald-50 text-emerald-700', Bom: 'bg-lime-50 text-lime-700', Regular: 'bg-amber-50 text-amber-700' })[c] || 'bg-red-50 text-red-700'
</script>

<template>
  <UiModal :title="`Relatório · ${auditoria.tipo}`" :subtitle="`${dataBR} · imprimir, salvar em PDF ou imagem`" width="max-w-7xl" @close="emit('close')">
    <div class="mb-4 flex flex-wrap items-center gap-2">
      <button type="button" class="ui-btn-primary py-2" @click="imprimir"><i class="fas fa-file-pdf"></i>Imprimir / PDF</button>
      <button type="button" class="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50" :disabled="gerandoCartoes" @click="enviarWhatsapp">
        <i :class="gerandoCartoes ? 'fas fa-spinner fa-spin' : 'fab fa-whatsapp'"></i>Imagens para WhatsApp
      </button>
      <button type="button" class="ui-btn-secondary py-2" :disabled="gerandoImagem" @click="salvarImagem"><i :class="gerandoImagem ? 'fas fa-spinner fa-spin' : 'fas fa-image'"></i>Salvar imagem</button>
      <span class="text-xs text-slate-500">{{ cartoes.length }} cartões verticais, legíveis no celular</span>
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
    <!-- Cartões para WhatsApp (renderizados fora da tela só durante a geração) -->
    <div v-if="gerandoCartoes" class="pointer-events-none fixed top-0" style="left: -99999px" aria-hidden="true">
      <div
        v-for="(c, i) in cartoes"
        :key="i"
        :ref="el => { if (el) elementosCartao[i] = el }"
        class="flex flex-col bg-white p-16 text-slate-900"
        :style="{ width: `${CARTAO.largura}px`, height: `${CARTAO.altura}px` }"
      >
        <div class="flex items-center justify-between text-[28px] font-semibold text-slate-500">
          <span>Auditoria de {{ auditoria.tipo }} · {{ dataBR }}</span>
          <span>{{ i + 1 }}/{{ cartoes.length }}</span>
        </div>

        <!-- Resumo -->
        <template v-if="c.tipo === 'resumo'">
          <div class="mt-7 rounded-[40px] bg-blue-700 px-12 py-9 text-white">
            <p class="text-[30px] font-semibold text-blue-100">% pendente</p>
            <p class="text-[132px] font-black leading-none tracking-tight">{{ m.percentualPendente.toFixed(2) }}%</p>
            <p class="mt-5 inline-flex items-center gap-3 rounded-full px-6 py-2 text-[30px] font-bold" :class="naMeta ? 'bg-emerald-400/25 text-emerald-50' : 'bg-red-400/30 text-red-50'">
              <i :class="naMeta ? 'fas fa-check' : 'fas fa-xmark'"></i>{{ naMeta ? 'Dentro da meta' : 'Fora da meta' }} ({{ META }}%)
            </p>
          </div>
          <div class="mt-7 grid grid-cols-2 gap-5">
            <div v-for="k in cards" :key="k.rotulo" class="rounded-[32px] px-8 py-5" :class="[k.classe, cards.length % 2 && k.rotulo === 'SKU' ? 'col-span-2' : '']">
              <p class="text-[26px] font-bold uppercase tracking-wide text-slate-500">{{ k.rotulo }}</p>
              <p class="text-[60px] font-black leading-tight" :class="k.texto">{{ k.valor.toLocaleString('pt-BR') }}</p>
              <p class="text-[24px] text-slate-500">{{ k.detalhe }}</p>
            </div>
          </div>
          <div class="mt-auto space-y-1 pt-5 text-[30px] font-semibold">
            <p :class="setoresAcima ? 'text-red-700' : 'text-emerald-700'">{{ setoresAcima }} de {{ setoresOrdenados.length }} setores acima da meta</p>
            <p v-if="locaisSemLeitura.length" class="text-red-700">{{ locaisSemLeitura.length }} local(is) sem leitura</p>
          </div>
        </template>

        <!-- Setores -->
        <template v-else-if="c.tipo === 'setores'">
          <p class="mt-6 text-[52px] font-black">% pendente por setor <span v-if="c.parte" class="text-[32px] font-bold text-slate-400">({{ c.parte }})</span></p>
          <p class="text-[26px] text-slate-500">{{ setoresAcima }} de {{ setoresOrdenados.length }} acima da meta de {{ META }}%</p>
          <table class="mt-6 w-full">
            <thead>
              <tr class="text-[22px] font-bold uppercase tracking-wide text-slate-500">
                <th class="pb-3 text-left">Setor</th>
                <th class="pb-3 text-right">Pend.</th>
                <th class="pb-3 text-right">%</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in c.itens" :key="s.nome" class="border-t-2 border-slate-100">
                <td class="py-3.5 pr-4 text-[29px] font-semibold leading-tight">{{ s.nome }}</td>
                <td class="py-3.5 text-right text-[30px] font-bold text-amber-700">{{ s.pendentes }}</td>
                <td class="w-48 py-3.5 text-right text-[36px] font-black" :class="s.percentualPendente > META ? 'text-red-700' : 'text-emerald-700'">{{ s.percentualPendente.toFixed(2) }}%</td>
              </tr>
            </tbody>
          </table>
        </template>

        <!-- Top 10 locais -->
        <template v-else-if="c.tipo === 'locais'">
          <p class="mt-6 text-[52px] font-black">Top 10 locais com mais pendentes</p>
          <ol class="mt-8 space-y-5">
            <li v-for="(l, j) in topLocais" :key="l.nome" class="flex items-center gap-5">
              <span class="inline-flex size-[60px] shrink-0 items-center justify-center rounded-2xl text-[28px] font-black" :class="j < 3 ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'">{{ j + 1 }}</span>
              <div class="min-w-0 flex-1">
                <div class="flex items-baseline justify-between gap-4">
                  <span class="truncate text-[32px] font-bold">{{ l.nome }}</span>
                  <span class="shrink-0 text-[32px] font-black">{{ l.pendentes }} <span class="text-[24px] font-semibold text-slate-500">pend. · {{ l.percentualPendente.toFixed(1) }}%</span></span>
                </div>
                <div class="mt-2 h-4 rounded-full bg-slate-100"><div class="h-full rounded-full bg-amber-500" :style="{ width: `${(l.pendentes / maiorLocal) * 100}%` }"></div></div>
              </div>
            </li>
          </ol>
        </template>

        <!-- Locais sem leitura -->
        <template v-else-if="c.tipo === 'semLeitura'">
          <div class="mt-6 flex items-baseline justify-between">
            <p class="text-[52px] font-black text-red-800">Locais sem leitura <span v-if="c.parte" class="text-[32px] font-bold text-red-400">({{ c.parte }})</span></p>
            <p class="text-[80px] font-black text-red-700">{{ locaisSemLeitura.length }}</p>
          </div>
          <p class="text-[26px] text-red-700">Nenhum item lido nesses locais.</p>
          <div class="mt-8 grid grid-cols-4 gap-4">
            <span v-for="l in c.itens" :key="l" class="truncate rounded-2xl bg-red-50 px-4 py-4 text-center text-[28px] font-bold text-red-700">{{ l }}</span>
          </div>
        </template>

        <p class="mt-auto pt-6 text-right text-[22px] text-slate-400">Dashboard TI · #{{ auditoria.id }}</p>
      </div>
    </div>
  </UiModal>
</template>

