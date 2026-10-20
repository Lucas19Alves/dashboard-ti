<script setup>
import { computed, ref } from 'vue'
import MapaLoja from './MapaLoja.vue'
import UiListaItens from './ui/UiListaItens.vue'
import { cruzarValidadeRuptura, mapaVencimentos, PRAZOS_CRITICOS } from '../utils/vencimentosCruzados'
import { formatarDataBR } from '../utils/busca'

// Vencimentos no mapa da loja e produtos que vencem no estoque enquanto faltam na gôndola.
const props = defineProps({
  itens: { type: Array, default: () => [] },
  auditorias: { type: Array, default: () => [] }
})

const mapa = computed(() => mapaVencimentos(props.itens, props.auditorias))
const criticos = computed(() => props.itens.filter(i => PRAZOS_CRITICOS.includes(i._prazo)).length)
const metricaMapa = { meta: 10, rotulo: '% crítico', curto: 'dos itens críticos', pendentes: 'críticos', lidos: 'no prazo' }

const diasLimite = ref(30)
const cruzamento = computed(() => cruzarValidadeRuptura(props.itens, props.auditorias, { diasLimite: diasLimite.value }))
const recorrentes = computed(() => cruzamento.value.filter(l => l.vezesRuptura >= 2).length)
const comEstoque = computed(() => cruzamento.value.filter(l => l.estoque > 0).length)
const moeda = v => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const temAuditoriasPresenca = computed(() => props.auditorias.some(a => (a.tipo === 'Presença' || a.tipo === 'Ruptura') && a.dados?.length))

const colunas = [
  { chave: 'codigo', titulo: 'Código' },
  { chave: 'produto', titulo: 'Produto', largura: 'max-w-64' },
  { chave: 'setor', titulo: 'Setor', largura: 'max-w-40' },
  { chave: 'validade', titulo: 'Validade', valor: l => l.validade, formato: v => formatarDataBR(v) },
  { chave: 'dias', titulo: 'Dias', alinhamento: 'right', formato: v => (v < 0 ? `vencido há ${-v}` : v === 0 ? 'hoje' : `${v}`) },
  { chave: 'estoque', titulo: 'Estoque', alinhamento: 'right' },
  { chave: 'vezesRuptura', titulo: 'Rupturas', alinhamento: 'right' },
  { chave: 'custoRuptura', titulo: 'Custo ruptura', alinhamento: 'right', valor: l => Math.round(l.custoRuptura * 100) / 100, formato: v => moeda(v) },
  { chave: 'diagnostico', titulo: 'O que fazer', largura: 'max-w-96' }
]
const facetas = [{ chave: 'setor', titulo: 'Setor' }, { chave: 'fornecedor', titulo: 'Fornecedor' }, { chave: 'vezesRuptura', titulo: 'Rupturas' }]
</script>

<template>
  <div class="space-y-6">
    <!-- Mapa -->
    <section class="space-y-3">
      <div>
        <h2 class="text-lg font-bold text-slate-900"><i class="fas fa-map-location-dot mr-2 text-blue-600" aria-hidden="true"></i>Vencimentos no mapa da loja</h2>
        <p class="text-xs text-slate-500">Cor = % dos itens monitorados do local que estão vencidos ou vencem em até 3 dias (verde até 10%, amarelo até 20%, vermelho acima). Local da planilha de vencimentos; sem ele, o último local do produto nas auditorias.</p>
      </div>
      <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div class="ui-card p-4"><p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Itens monitorados</p><p class="text-2xl font-black text-slate-900">{{ itens.length.toLocaleString('pt-BR') }}</p></div>
        <div class="ui-card p-4"><p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Críticos</p><p class="text-2xl font-black" :class="criticos ? 'text-red-700' : 'text-slate-900'">{{ criticos.toLocaleString('pt-BR') }}</p><p class="text-xs text-slate-500">vencidos ou até 3 dias</p></div>
        <div class="ui-card p-4"><p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Local pela auditoria</p><p class="text-2xl font-black text-slate-900">{{ mapa.pelaAuditoria.toLocaleString('pt-BR') }}</p><p class="text-xs text-slate-500">sem local na planilha</p></div>
        <div class="ui-card p-4"><p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Sem local</p><p class="text-2xl font-black" :class="mapa.semLocal ? 'text-amber-700' : 'text-slate-900'">{{ mapa.semLocal.toLocaleString('pt-BR') }}</p><p class="text-xs text-slate-500">fora do mapa</p></div>
      </div>
      <MapaLoja :auditoria="mapa.auditoria" :is-item-lido="() => true" :itens-disponiveis="false" :metrica="metricaMapa" />
    </section>

    <!-- Validade × ruptura -->
    <section class="ui-card p-5">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-lg font-bold text-slate-900"><i class="fas fa-arrows-to-circle mr-2 text-red-500" aria-hidden="true"></i>Vence no estoque, falta na gôndola</h2>
          <p class="text-xs text-slate-500">Produtos com validade curta que já ficaram sem presença em auditorias de Presença ou Ruptura: sinal de pedido grande demais para o giro ou de reposição/exposição falhando.</p>
        </div>
        <label class="flex items-center gap-2 text-xs font-semibold text-slate-600">
          Vencendo em até
          <select v-model.number="diasLimite" class="ui-input w-auto py-1.5 text-xs">
            <option v-for="d in [7, 15, 30, 60, 90]" :key="d" :value="d">{{ d }} dias</option>
          </select>
        </label>
      </div>
      <p v-if="!temAuditoriasPresenca" class="mt-4 rounded-xl bg-slate-50 py-8 text-center text-sm text-slate-500">Sem auditorias de Presença ou Ruptura com itens para cruzar.</p>
      <template v-else>
        <div class="mt-4 grid grid-cols-3 gap-3">
          <div class="rounded-xl bg-slate-50 p-3"><p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Produtos</p><p class="text-xl font-black text-slate-900">{{ cruzamento.length }}</p></div>
          <div class="rounded-xl p-3" :class="recorrentes ? 'bg-red-50' : 'bg-slate-50'"><p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Ruptura recorrente</p><p class="text-xl font-black" :class="recorrentes ? 'text-red-700' : 'text-slate-900'">{{ recorrentes }}</p><p class="text-[11px] text-slate-500">2+ auditorias</p></div>
          <div class="rounded-xl bg-amber-50 p-3"><p class="text-[11px] font-bold uppercase tracking-wider text-amber-700">Com estoque</p><p class="text-xl font-black text-amber-800">{{ comEstoque }}</p><p class="text-[11px] text-amber-700">dá para repor agora</p></div>
        </div>
        <div class="mt-4">
          <UiListaItens :itens="cruzamento" :colunas="colunas" :facetas="facetas" titulo="Validade curta e ruptura" :ordem-inicial="{ chave: null, direcao: 'desc' }" />
        </div>
      </template>
    </section>
  </div>
</template>
