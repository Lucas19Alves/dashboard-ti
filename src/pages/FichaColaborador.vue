<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuditoriasStore } from '../stores/auditoriasStore'
import UiPageHeader from '../components/ui/UiPageHeader.vue'
import UiListaItens from '../components/ui/UiListaItens.vue'
import GraficoEvolucaoUsuario from '../components/GraficoEvolucaoUsuario.vue'
import MapaLoja from '../components/MapaLoja.vue'
import TrajetoUsuario from '../components/TrajetoUsuario.vue'
import { evolucaoUsuarios } from '../utils/historicoAuditorias'
import { historicoLeitores } from '../utils/planoAcao'
import { duplas, mapaLeiturasColaborador, problemasColaborador, ritmoPorSetor } from '../utils/fichaColaborador'
import { isItemLido } from '../utils/itemLido'
import { formatarDataBR } from '../utils/busca'
import { rotuloUsuario, separarUsuario } from '../utils/usuario'

// Ficha do colaborador: tudo sobre uma pessoa ao longo das auditorias, pronta para imprimir no feedback.
const route = useRoute()
const router = useRouter()
const store = useAuditoriasStore()
const usuario = computed(() => String(route.params.usuario || ''))
const pessoa = computed(() => separarUsuario(usuario.value))

const auditorias = computed(() => (store.auditorias || []).filter(Boolean))
const comLeituras = computed(() => auditorias.value.filter(a => (a.analise?.porUsuario || {})[usuario.value]))
const evolucao = computed(() => evolucaoUsuarios(comLeituras.value).find(u => u.usuario === usuario.value) || null)
const historico = computed(() => historicoLeitores(comLeituras.value).get(usuario.value) || null)
const setores = computed(() => ritmoPorSetor(comLeituras.value, usuario.value))
const mapa = computed(() => mapaLeiturasColaborador(comLeituras.value, usuario.value))
const problemas = computed(() => problemasColaborador(comLeituras.value, usuario.value))
const parceiros = computed(() => duplas(auditorias.value, { minimo: 1 })
  .filter(d => d.a === usuario.value || d.b === usuario.value)
  .map(d => ({ ...d, outro: d.a === usuario.value ? d.b : d.a })))
const ultimaAuditoria = computed(() => [...comLeituras.value].filter(a => a.dados?.length)
  .sort((a, b) => String(b.data).localeCompare(String(a.data)) || b.id - a.id)[0] || null)
const periodo = computed(() => {
  const datas = comLeituras.value.map(a => String(a.data).slice(0, 10)).filter(Boolean).sort()
  return datas.length ? `${formatarDataBR(datas[0])} a ${formatarDataBR(datas.at(-1))}` : '—'
})

const fmt = v => (v === null || v === undefined ? '—' : Math.round(v).toLocaleString('pt-BR'))
const TENDENCIA = { subindo: 'subindo', caindo: 'caindo', estavel: 'estável', indefinida: 'poucas auditorias' }
const kpis = computed(() => {
  const e = evolucao.value
  return [
    { rotulo: 'Auditorias', valor: comLeituras.value.length, detalhe: periodo.value },
    { rotulo: 'Leituras', valor: (e?.leituras || 0).toLocaleString('pt-BR'), detalhe: `${fmt(e ? e.leituras / Math.max(1, e.auditorias) : 0)} por auditoria` },
    { rotulo: 'Ritmo médio', valor: `${fmt(e?.ritmoMedio)}/h`, detalhe: 'leituras por hora ativa' },
    { rotulo: 'Ritmo recente', valor: `${fmt(e?.ritmoRecente)}/h`, detalhe: `últimas 3 · ${TENDENCIA[e?.tendenciaRitmo || 'indefinida']}`, tom: e?.tendenciaRitmo === 'subindo' ? 'bom' : e?.tendenciaRitmo === 'caindo' ? 'ruim' : '' },
    { rotulo: '% com problema', valor: e?.percProblemaMedio === null || e?.percProblemaMedio === undefined ? '—' : `${e.percProblemaMedio.toFixed(1)}%`, detalhe: TENDENCIA[e?.tendenciaProblema || 'indefinida'], tom: (e?.percProblemaMedio || 0) > 5 ? 'ruim' : '' },
    { rotulo: 'Setores', valor: setores.value.length, detalhe: setores.value[0] ? `principal: ${setores.value[0].setor}` : '' }
  ]
})
const maiorRitmoSetor = computed(() => Math.max(1, ...setores.value.map(s => s.ritmo || 0)))

const colunasProblemas = [
  { chave: 'data', titulo: 'Data', formato: v => formatarDataBR(v) },
  { chave: 'tipo', titulo: 'Tipo' },
  { chave: 'codigo', titulo: 'Código' },
  { chave: 'produto', titulo: 'Produto', largura: 'max-w-72' },
  { chave: 'local', titulo: 'Local' },
  { chave: 'motivo', titulo: 'Motivo', alinhamento: 'center', badge: v => (v === 'Estoque zero' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700') }
]
const imprimir = () => window.print()
</script>

<template>
  <div class="ui-page ficha">
    <button type="button" class="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-700 print:hidden" @click="router.back()">
      <i class="fas fa-arrow-left" aria-hidden="true"></i>Voltar
    </button>

    <UiPageHeader :title="pessoa.nome || usuario" :subtitle="`${pessoa.matricula ? `Matrícula ${pessoa.matricula} · ` : ''}Ficha do colaborador · ${periodo}`" icon="fas fa-id-badge">
      <template #actions>
        <button type="button" class="ui-btn-secondary print:hidden" @click="imprimir"><i class="fas fa-print" aria-hidden="true"></i>Imprimir</button>
      </template>
    </UiPageHeader>

    <div v-if="!comLeituras.length" class="ui-card px-6 py-14 text-center">
      <i class="fas fa-user-slash text-3xl text-slate-300" aria-hidden="true"></i>
      <p class="mt-3 font-semibold text-slate-700">Nenhuma leitura deste colaborador nas auditorias salvas</p>
    </div>

    <template v-else>
      <div class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <div v-for="k in kpis" :key="k.rotulo" class="ui-card p-4">
          <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">{{ k.rotulo }}</p>
          <p class="mt-1 text-2xl font-black" :class="k.tom === 'bom' ? 'text-emerald-700' : k.tom === 'ruim' ? 'text-red-700' : 'text-slate-900'">{{ k.valor }}</p>
          <p class="truncate text-xs text-slate-500" :title="k.detalhe">{{ k.detalhe }}</p>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section class="ui-card p-5">
          <h2 class="text-base font-bold text-slate-900">Evolução por auditoria</h2>
          <p class="text-xs text-slate-500">Ritmo (linha) e % de leituras com problema (barras).</p>
          <GraficoEvolucaoUsuario v-if="evolucao" class="mt-3" :usuario="evolucao" />
        </section>

        <section class="ui-card p-5">
          <h2 class="text-base font-bold text-slate-900">Setores</h2>
          <p class="text-xs text-slate-500">Onde lê e em que ritmo (tempo entre leituras seguidas, sem pausas).</p>
          <ul class="mt-4 space-y-3">
            <li v-for="s in setores.slice(0, 10)" :key="s.setor" class="text-sm">
              <div class="flex items-baseline justify-between gap-2">
                <span class="truncate font-semibold text-slate-800">{{ s.setor }}</span>
                <span class="shrink-0 text-xs text-slate-500">{{ s.leituras.toLocaleString('pt-BR') }} leituras · {{ s.participacao.toFixed(0) }}%</span>
              </div>
              <div class="mt-1 flex items-center gap-2">
                <span class="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><span class="block h-full rounded-full bg-blue-500" :style="{ width: `${((s.ritmo || 0) / maiorRitmoSetor) * 100}%` }"></span></span>
                <span class="w-14 text-right text-xs font-bold text-slate-700">{{ s.ritmo === null ? '—' : `${fmt(s.ritmo)}/h` }}</span>
              </div>
            </li>
          </ul>
        </section>
      </div>

      <section class="space-y-2">
        <h2 class="text-base font-bold text-slate-900">Onde costuma ler</h2>
        <p class="text-xs text-slate-500">Leituras do colaborador por área, somando {{ comLeituras.length }} auditoria(s).</p>
        <MapaLoja :auditoria="mapa" :is-item-lido="() => true" :itens-disponiveis="false" modo-inicial="leituras" />
      </section>

      <TrajetoUsuario v-if="ultimaAuditoria" :auditoria="ultimaAuditoria" :is-item-lido="isItemLido"
        :usuarios="[{ nome: usuario, exibicao: pessoa.nome, leituras: historico?.total || 0 }]" :usuario-inicial="usuario" />

      <div class="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <section class="ui-card p-5">
          <h2 class="text-base font-bold text-slate-900">Com quem rende mais</h2>
          <p class="text-xs text-slate-500">Auditorias lendo o mesmo setor que outra pessoa; % = ritmo das duas acima ou abaixo do normal de cada uma.</p>
          <p v-if="!parceiros.length" class="mt-4 text-sm text-slate-500">Ainda não há auditorias em setor compartilhado com horário suficiente.</p>
          <ul v-else class="mt-3 divide-y divide-slate-100">
            <li v-for="p in parceiros.slice(0, 8)" :key="p.outro" class="flex items-center gap-3 py-2 text-sm">
              <router-link :to="`/colaborador/${encodeURIComponent(p.outro)}`" class="min-w-0 flex-1 truncate font-semibold text-slate-800 hover:text-blue-700">{{ rotuloUsuario(p.outro) }}</router-link>
              <span class="hidden truncate text-xs text-slate-500 sm:block" :title="p.setores.join(', ')">{{ p.setores.slice(0, 2).join(', ') }}</span>
              <span class="shrink-0 text-xs text-slate-500">{{ p.juntas }}×</span>
              <span class="w-16 shrink-0 text-right font-black" :class="p.rendimento >= 0 ? 'text-emerald-700' : 'text-red-700'">{{ p.rendimento >= 0 ? '+' : '' }}{{ p.rendimento.toFixed(0) }}%</span>
            </li>
          </ul>
        </section>

        <section class="ui-card p-5">
          <h2 class="text-base font-bold text-slate-900">Leituras com problema ({{ problemas.length }})</h2>
          <p class="mb-3 text-xs text-slate-500">Estoque zero ou produto fora do local, das mais recentes.</p>
          <UiListaItens :itens="problemas" :colunas="colunasProblemas" :facetas="[{ chave: 'motivo', titulo: 'Motivo' }, { chave: 'tipo', titulo: 'Tipo' }]" :titulo="`Problemas de ${rotuloUsuario(usuario)}`" :passo="20" />
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
@media print {
  .ficha :deep(section), .ficha :deep(.ui-card) { break-inside: avoid; box-shadow: none; }
}
</style>
