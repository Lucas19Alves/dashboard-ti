<script setup>
import { computed, ref } from 'vue'
import MapaLoja from './MapaLoja.vue'
import UiModal from './ui/UiModal.vue'
import UiListaItens from './ui/UiListaItens.vue'
import { CATEGORIAS_VENCIMENTO, categoriaVencimento, cruzarValidadeRuptura, mapaVencimentos } from '../utils/vencimentosCruzados'
import { formatarDataBR } from '../utils/busca'

// Vencimentos no mapa da loja (vencidos, vencem hoje, a vencer) e produtos que vencem
// no estoque enquanto faltam na gôndola.
const props = defineProps({
  itens: { type: Array, default: () => [] },
  auditorias: { type: Array, default: () => [] }
})

const ROTULO = Object.fromEntries(CATEGORIAS_VENCIMENTO.map(c => [c.valor, c.rotulo]))
const contagem = computed(() => {
  const c = { vencidos: 0, hoje: 0, aVencer: 0 }
  props.itens.forEach(i => { const k = categoriaVencimento(i); if (k) c[k]++ })
  return c
})
const alternar = (lista, valor) => (lista.includes(valor) ? lista.filter(v => v !== valor) : [...lista, valor])

// ---------- Mapa ----------
const categoriasMapa = ref(CATEGORIAS_VENCIMENTO.map(c => c.valor))
const mapa = computed(() => mapaVencimentos(props.itens, props.auditorias, categoriasMapa.value))
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`
// No mapa: pendentes = vencidos, comProblema = vencem hoje, lidos = a vencer.
const pintura = {
  id: 'situacao',
  rotulo: 'Situação',
  icone: 'fas fa-calendar-xmark',
  semItens: 'Sem itens nas categorias escolhidas',
  classe: d => (d.pendentes ? 'bg-red-500 text-white' : d.comProblema ? 'bg-orange-400 text-orange-950' : d.lidos ? 'bg-amber-200 text-amber-900' : 'bg-slate-100 text-slate-400'),
  texto: d => String(d.total || ''),
  dica: d => [d.pendentes ? plural(d.pendentes, 'vencido', 'vencidos') : '', d.comProblema ? plural(d.comProblema, 'vence hoje', 'vencem hoje') : '', d.lidos ? `${d.lidos} a vencer` : ''].filter(Boolean).join(' · ') || 'Sem itens',
  resumo: d => [
    { rotulo: 'vencidos', valor: d.pendentes || 0, classe: 'bg-red-50 text-red-700' },
    { rotulo: 'vencem hoje', valor: d.comProblema || 0, classe: 'bg-orange-50 text-orange-700' },
    { rotulo: 'a vencer', valor: d.lidos || 0, classe: 'bg-amber-50 text-amber-800' }
  ],
  colunasFace: [
    { rotulo: 'Venc.', valor: d => d.pendentes || 0, classe: 'text-red-700 font-bold' },
    { rotulo: 'Hoje', valor: d => d.comProblema || 0, classe: 'text-orange-700' },
    { rotulo: 'A vencer', valor: d => d.lidos || 0, classe: 'text-amber-800' }
  ],
  legenda: [
    { classe: 'bg-red-500', rotulo: 'Tem vencidos' },
    { classe: 'bg-orange-400', rotulo: 'Vencem hoje' },
    { classe: 'bg-amber-200', rotulo: 'Só a vencer' }
  ]
}

// Aba "Quantidade": cada local do vermelho (mais itens) ao amarelo (menos itens).
const totalDe = d => (d?.lidos || 0) + (d?.pendentes || 0) + (d?.comProblema || 0)
const maiorLocal = computed(() => Math.max(1, ...Object.values(mapa.value.auditoria.analise.porLocal).map(totalDe)))
const FAIXAS_QTD = [
  { ate: 0.2, classe: 'bg-yellow-200 text-yellow-900', rotulo: 'Poucos' },
  { ate: 0.4, classe: 'bg-amber-300 text-amber-950', rotulo: '' },
  { ate: 0.6, classe: 'bg-orange-400 text-orange-950', rotulo: '' },
  { ate: 0.8, classe: 'bg-red-400 text-white', rotulo: '' },
  { ate: Infinity, classe: 'bg-red-600 text-white', rotulo: 'Muitos' }
]
const faixaQtd = d => FAIXAS_QTD.find(f => totalDe(d) / maiorLocal.value <= f.ate)
const pinturaQuantidade = computed(() => ({
  id: 'quantidade',
  rotulo: 'Quantidade',
  icone: 'fas fa-layer-group',
  semItens: 'Sem itens nas categorias escolhidas',
  classe: d => (totalDe(d) ? faixaQtd(d).classe : 'bg-slate-100 text-slate-400'),
  texto: d => String(totalDe(d) || ''),
  dica: d => (totalDe(d) ? plural(totalDe(d), 'item', 'itens') : 'Sem itens'),
  resumo: pintura.resumo,
  colunasFace: [{ rotulo: 'Itens', valor: d => totalDe(d), classe: 'font-bold' }, ...pintura.colunasFace],
  legenda: [
    ...FAIXAS_QTD.map((f, i) => ({ classe: f.classe.split(' ')[0], rotulo: i === 0 ? `até ${Math.max(1, Math.round(maiorLocal.value * 0.2))}` : i === FAIXAS_QTD.length - 1 ? `até ${maiorLocal.value} itens` : '' }))
  ]
}))
const pinturasMapa = computed(() => [pintura, pinturaQuantidade.value])

// ---------- Modal de itens do local ----------
const modal = ref(null) // { local, itens }
const abrirItens = ({ local, itens }) => { modal.value = { local, itens } }
const diasTexto = v => (v === null || v === undefined || v === '' ? '—' : v < 0 ? `vencido há ${-v}` : v === 0 ? 'hoje' : `${v}`)
const colunasItens = [
  { chave: '_codigo', titulo: 'Código' },
  { chave: '_produto', titulo: 'Produto', largura: 'max-w-72' },
  { chave: 'Local', titulo: 'Local' },
  { chave: '_validadeISO', titulo: 'Validade', formato: v => formatarDataBR(v) },
  { chave: '_diasParaVencer', titulo: 'Dias', alinhamento: 'right', valor: i => (i._diasParaVencer === null || i._diasParaVencer === undefined ? null : Number(i._diasParaVencer)), formato: diasTexto },
  { chave: '_estoque', titulo: 'Estoque', alinhamento: 'right', valor: i => Number(i._estoque) || 0 },
  { chave: '_categoria', titulo: 'Situação', alinhamento: 'center', valor: i => ROTULO[i._categoria], badge: v => (v === 'Vencidos' ? 'bg-red-50 text-red-700' : v === 'Vencem hoje' ? 'bg-orange-50 text-orange-700' : 'bg-amber-50 text-amber-800') }
]
const facetasItens = [{ chave: '_categoria', titulo: 'Situação', valor: i => ROTULO[i._categoria] }, { chave: '_setor', titulo: 'Setor' }, { chave: 'Local', titulo: 'Local' }]

// ---------- Vence no estoque, falta na gôndola ----------
const categoriasCruzamento = ref(CATEGORIAS_VENCIMENTO.map(c => c.valor))
const cruzamento = computed(() => cruzarValidadeRuptura(props.itens, props.auditorias, { categorias: categoriasCruzamento.value }))
const recorrentes = computed(() => cruzamento.value.filter(l => l.vezesRuptura >= 2).length)
const comEstoque = computed(() => cruzamento.value.filter(l => l.estoque > 0).length)
const moeda = v => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const temAuditoriasPresenca = computed(() => props.auditorias.some(a => (a.tipo === 'Presença' || a.tipo === 'Ruptura') && a.dados?.length))

const colunas = [
  { chave: 'codigo', titulo: 'Código' },
  { chave: 'produto', titulo: 'Produto', largura: 'max-w-64' },
  { chave: 'setor', titulo: 'Setor', largura: 'max-w-40' },
  { chave: 'categoria', titulo: 'Situação', alinhamento: 'center', valor: l => ROTULO[l.categoria], badge: v => (v === 'Vencidos' ? 'bg-red-50 text-red-700' : v === 'Vencem hoje' ? 'bg-orange-50 text-orange-700' : 'bg-amber-50 text-amber-800') },
  { chave: 'validade', titulo: 'Validade', formato: v => formatarDataBR(v) },
  { chave: 'dias', titulo: 'Dias', alinhamento: 'right', formato: diasTexto },
  { chave: 'estoque', titulo: 'Estoque', alinhamento: 'right' },
  { chave: 'vezesRuptura', titulo: 'Rupturas', alinhamento: 'right' },
  { chave: 'custoRuptura', titulo: 'Custo ruptura', alinhamento: 'right', valor: l => Math.round(l.custoRuptura * 100) / 100, formato: v => moeda(v) },
  { chave: 'diagnostico', titulo: 'O que fazer', largura: 'max-w-96' }
]
const facetas = [{ chave: 'categoria', titulo: 'Situação', valor: l => ROTULO[l.categoria] }, { chave: 'setor', titulo: 'Setor' }, { chave: 'fornecedor', titulo: 'Fornecedor' }, { chave: 'vezesRuptura', titulo: 'Rupturas' }]
const ESTILO_CHIP = { vencidos: 'bg-red-600 ring-red-600', hoje: 'bg-orange-500 ring-orange-500', aVencer: 'bg-amber-500 ring-amber-500' }
</script>

<template>
  <div class="space-y-6">
    <!-- Mapa -->
    <section class="space-y-3">
      <div>
        <h2 class="text-lg font-bold text-slate-900"><i class="fas fa-map-location-dot mr-2 text-blue-600" aria-hidden="true"></i>Vencimentos no mapa da loja</h2>
        <p class="text-xs text-slate-500">Número na área = itens das situações escolhidas. Clique numa área para ver o detalhe e os itens. Local da planilha de vencimentos; sem ele, o último local do produto nas auditorias.</p>
      </div>

      <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Situações no mapa">
        <button v-for="c in CATEGORIAS_VENCIMENTO" :key="c.valor" type="button" :aria-pressed="categoriasMapa.includes(c.valor)"
          class="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ring-1 transition"
          :class="categoriasMapa.includes(c.valor) ? `${ESTILO_CHIP[c.valor]} text-white` : 'bg-white text-slate-600 ring-slate-200 hover:ring-slate-300'"
          @click="categoriasMapa = alternar(categoriasMapa, c.valor)">
          <i :class="categoriasMapa.includes(c.valor) ? 'fas fa-check' : 'fas fa-plus opacity-50'" aria-hidden="true"></i>{{ c.rotulo }}
          <span class="rounded-full bg-black/10 px-1.5 text-xs">{{ contagem[c.valor] }}</span>
        </button>
        <span class="ml-auto text-xs text-slate-500">
          {{ mapa.auditoria.dados.length.toLocaleString('pt-BR') }} no mapa
          <template v-if="mapa.pelaAuditoria"> · {{ mapa.pelaAuditoria }} com local pela auditoria</template>
          <template v-if="mapa.semLocal"> · <b class="text-amber-700">{{ mapa.semLocal }} sem local</b></template>
        </span>
      </div>

      <MapaLoja :auditoria="mapa.auditoria" :is-item-lido="() => false" :itens-disponiveis="true" :laterais="false" :pinturas="pinturasMapa" @ver-itens="abrirItens" />
    </section>

    <UiModal v-if="modal" :title="modal.local" :subtitle="`${modal.itens.length} item(ns) neste local`" width="max-w-6xl" @close="modal = null">
      <UiListaItens :itens="modal.itens" :colunas="colunasItens" :facetas="facetasItens" :titulo="`Vencimentos · ${modal.local}`" :ordem-inicial="{ chave: '_diasParaVencer', direcao: 'asc' }" />
    </UiModal>

    <!-- Vence no estoque, falta na gôndola -->
    <section class="ui-card p-5">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-lg font-bold text-slate-900"><i class="fas fa-arrows-to-circle mr-2 text-red-500" aria-hidden="true"></i>Vence no estoque, falta na gôndola</h2>
          <p class="text-xs text-slate-500">Produtos da planilha de vencimentos que já ficaram sem presença em auditorias de Presença ou Ruptura: sinal de pedido grande demais para o giro ou de reposição/exposição falhando.</p>
        </div>
        <div class="flex flex-wrap gap-2" role="group" aria-label="Situações">
          <button v-for="c in CATEGORIAS_VENCIMENTO" :key="c.valor" type="button" :aria-pressed="categoriasCruzamento.includes(c.valor)"
            class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition"
            :class="categoriasCruzamento.includes(c.valor) ? `${ESTILO_CHIP[c.valor]} text-white` : 'bg-white text-slate-600 ring-slate-200 hover:ring-slate-300'"
            @click="categoriasCruzamento = alternar(categoriasCruzamento, c.valor)">
            <i :class="categoriasCruzamento.includes(c.valor) ? 'fas fa-check' : 'fas fa-plus opacity-50'" aria-hidden="true"></i>{{ c.rotulo }}
          </button>
        </div>
      </div>
      <p v-if="!temAuditoriasPresenca" class="mt-4 rounded-xl bg-slate-50 py-8 text-center text-sm text-slate-500">Sem auditorias de Presença ou Ruptura com itens para cruzar.</p>
      <template v-else>
        <div class="mt-4 grid grid-cols-3 gap-3">
          <div class="rounded-xl bg-slate-50 p-3"><p class="text-xs font-semibold text-slate-500">Produtos</p><p class="text-xl font-black text-slate-900">{{ cruzamento.length }}</p></div>
          <div class="rounded-xl p-3" :class="recorrentes ? 'bg-red-50' : 'bg-slate-50'"><p class="text-xs font-semibold text-slate-500">Ruptura recorrente</p><p class="text-xl font-black" :class="recorrentes ? 'text-red-700' : 'text-slate-900'">{{ recorrentes }}</p><p class="text-[11px] text-slate-500">2+ auditorias</p></div>
          <div class="rounded-xl bg-amber-50 p-3"><p class="text-xs font-semibold text-amber-700">Com estoque</p><p class="text-xl font-black text-amber-800">{{ comEstoque }}</p><p class="text-[11px] text-amber-700">dá para repor agora</p></div>
        </div>
        <div class="mt-4">
          <UiListaItens :itens="cruzamento" :colunas="colunas" :facetas="facetas" titulo="Vence no estoque, falta na gôndola" :ordem-inicial="{ chave: null, direcao: 'desc' }" />
        </div>
      </template>
    </section>
  </div>
</template>
