<script setup>
import { computed } from 'vue'
import { auditoriaAnteriorDoTipo, compararAuditorias, itensParaMeta } from '../utils/analiseHistorica'
import { META_PENDENTE_PERCENTUAL, metricasAuditoria } from '../utils/metricasAuditoria'
import { formatarDataBR } from '../utils/busca'

// Mostra o quanto falta para a meta e a evolução em relação à auditoria anterior do mesmo tipo.
const props = defineProps({
  auditoria: { type: Object, required: true },
  historico: { type: Array, default: () => [] }
})

const metricas = computed(() => metricasAuditoria(props.auditoria))
const faltam = computed(() => itensParaMeta(props.auditoria))
const anterior = computed(() => auditoriaAnteriorDoTipo(props.auditoria, props.historico))
const comparacao = computed(() => compararAuditorias(props.auditoria, anterior.value))
const progressoMeta = computed(() => {
  const { total, pendentes } = metricas.value
  if (!total) return 0
  const permitido = (total * META_PENDENTE_PERCENTUAL) / 100
  return pendentes <= permitido ? 100 : Math.max(0, Math.min(100, (permitido / pendentes) * 100))
})
</script>

<template>
  <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
    <!-- Distância até a meta -->
    <section class="rounded-2xl p-5 shadow-sm" :class="faltam > 0 ? 'bg-amber-50' : 'bg-emerald-50'">
      <div class="flex items-start gap-3">
        <span class="inline-flex size-10 shrink-0 items-center justify-center rounded-xl" :class="faltam > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'">
          <i :class="faltam > 0 ? 'fas fa-flag-checkered' : 'fas fa-circle-check'"></i>
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-xs font-semibold" :class="faltam > 0 ? 'text-amber-700' : 'text-emerald-700'">Caminho até a meta</p>
          <template v-if="faltam === null">
            <p class="mt-1 text-sm text-slate-600">Informe o SKU para calcular.</p>
          </template>
          <template v-else-if="faltam > 0">
            <p class="mt-1 text-xl font-bold text-slate-900">Faltam ler {{ faltam.toLocaleString('pt-BR') }} itens</p>
            <p class="text-xs text-slate-600">Para ficar com até {{ META_PENDENTE_PERCENTUAL }}% pendente ({{ Math.floor(metricas.total * META_PENDENTE_PERCENTUAL / 100).toLocaleString('pt-BR') }} de {{ metricas.total.toLocaleString('pt-BR') }} itens).</p>
          </template>
          <template v-else>
            <p class="mt-1 text-xl font-bold text-slate-900">Meta atingida</p>
            <p v-if="faltam === 0" class="text-xs text-slate-600">No limite: mais um item pendente tira a auditoria da meta.</p>
            <p v-else class="text-xs text-slate-600">Folga de {{ Math.abs(faltam).toLocaleString('pt-BR') }} {{ Math.abs(faltam) === 1 ? 'item' : 'itens' }} antes de sair da meta.</p>
          </template>
          <div v-if="faltam !== null" class="mt-3 h-2 overflow-hidden rounded-full bg-white">
            <div class="h-full rounded-full transition-all duration-700" :class="faltam > 0 ? 'bg-amber-500' : 'bg-emerald-500'" :style="{ width: `${progressoMeta}%` }"></div>
          </div>
        </div>
      </div>
    </section>

    <!-- Comparativo com a anterior -->
    <section class="rounded-2xl bg-white p-5 shadow-sm">
      <div class="flex items-start justify-between gap-2">
        <div>
          <p class="text-xs font-semibold text-slate-500">Comparado à {{ auditoria.tipo }} anterior</p>
          <RouterLink v-if="anterior" :to="`/auditoria/${anterior.id}`" class="text-xs font-semibold text-blue-600 hover:underline">
            {{ formatarDataBR(anterior.data) }} · #{{ anterior.id }}
          </RouterLink>
        </div>
        <span
          v-if="comparacao"
          class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold"
          :class="comparacao.diferencaPendente <= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'"
        >
          <i :class="comparacao.diferencaPendente <= 0 ? 'fas fa-arrow-down' : 'fas fa-arrow-up'"></i>
          {{ Math.abs(comparacao.diferencaPendente).toFixed(2) }} p.p.
        </span>
      </div>

      <p v-if="!comparacao" class="mt-3 text-sm text-slate-500">Sem auditoria anterior deste tipo para comparar.</p>
      <template v-else>
        <p class="mt-2 text-sm text-slate-700">
          Pendente foi de <b>{{ comparacao.anterior.percentualPendente.toFixed(2) }}%</b> para
          <b :class="comparacao.diferencaPendente <= 0 ? 'text-emerald-700' : 'text-red-700'">{{ comparacao.atual.percentualPendente.toFixed(2) }}%</b>
          ({{ comparacao.diferencaPendentes > 0 ? '+' : '' }}{{ comparacao.diferencaPendentes }} itens).
        </p>
        <div class="mt-3 grid grid-cols-2 gap-3 text-xs">
          <div>
            <p class="mb-1 font-semibold text-red-700"><i class="fas fa-arrow-trend-up mr-1"></i>Pioraram ({{ comparacao.pioraram.length }})</p>
            <p v-if="!comparacao.pioraram.length" class="text-slate-400">Nenhum</p>
            <p v-for="s in comparacao.pioraram.slice(0, 3)" :key="s.setor" class="flex justify-between gap-2">
              <span class="truncate text-slate-700" :title="s.setor">{{ s.setor }}</span>
              <span class="shrink-0 font-semibold text-red-700">+{{ s.diferenca.toFixed(1) }}</span>
            </p>
          </div>
          <div>
            <p class="mb-1 font-semibold text-emerald-700"><i class="fas fa-arrow-trend-down mr-1"></i>Melhoraram ({{ comparacao.melhoraram.length }})</p>
            <p v-if="!comparacao.melhoraram.length" class="text-slate-400">Nenhum</p>
            <p v-for="s in comparacao.melhoraram.slice(0, 3)" :key="s.setor" class="flex justify-between gap-2">
              <span class="truncate text-slate-700" :title="s.setor">{{ s.setor }}</span>
              <span class="shrink-0 font-semibold text-emerald-700">{{ s.diferenca.toFixed(1) }}</span>
            </p>
          </div>
        </div>
      </template>
    </section>
  </div>
</template>
