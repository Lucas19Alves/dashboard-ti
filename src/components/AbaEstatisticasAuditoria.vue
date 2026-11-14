<script setup>
import { computed } from 'vue'
import UiTabela from './ui/UiTabela.vue'

// Aba "Estatísticas" do detalhe da auditoria: parcial por setor e por local, na tabela padrão.
const props = defineProps({
  setores: { type: Array, default: () => [] },
  locais: { type: Array, default: () => [] },
  imprimir: { type: Function, default: null },
})
const emit = defineEmits(['abrir-setor-local'])
const setoresComAnalise = computed(() => props.setores)
const locaisComAnalise = computed(() => props.locais)
const abrirModalSetorLocal = (...args) => emit('abrir-setor-local', ...args)

const perc = v => `${(Number(v) || 0).toFixed(2)}%`
const COLUNAS_SETORES = [
  { chave: 'nome', titulo: 'Setor', tipo: 'texto' },
  { chave: 'total', titulo: 'Total', tipo: 'numero' },
  { chave: 'lidos', titulo: 'Lidos', tipo: 'numero' },
  { chave: 'pendentes', titulo: 'Pendentes', tipo: 'numero' },
  { chave: 'comProblema', titulo: 'Problemas', tipo: 'numero' },
  { chave: 'desatualizados', titulo: 'Desatualiz.', tipo: 'numero' },
  { chave: 'percentualConclusao', titulo: 'Conclusão', tipo: 'numero', formato: perc },
  { chave: 'percentualPendente', titulo: '% Pendente', tipo: 'numero', formato: perc, oculta: true },
  { chave: 'classificacao', titulo: 'Classificação', tipo: 'categoria', rapido: true, alinhamento: 'center' }
]
const COLUNAS_LOCAIS = [
  { chave: 'nome', titulo: 'Local', tipo: 'texto' },
  { chave: 'lidos', titulo: 'Lidos', tipo: 'numero' },
  { chave: 'pendentes', titulo: 'Pendentes', tipo: 'numero' },
  { chave: 'comProblema', titulo: 'Problemas', tipo: 'numero' },
  { chave: 'desatualizados', titulo: 'Desatualiz.', tipo: 'numero' },
  { chave: 'total', titulo: 'Total', tipo: 'numero' },
  { chave: 'percentualLido', titulo: '% Lido', tipo: 'numero', formato: perc }
]
const ATALHOS_SETORES = [{ rotulo: 'Acima da meta (3%)', icone: 'fas fa-triangle-exclamation', condicoes: [{ chave: 'percentualPendente', op: 'maior', valor: '3' }] }]
const ATALHOS_LOCAIS = [
  { rotulo: 'Com pendência', icone: 'fas fa-hourglass-half', condicoes: [{ chave: 'pendentes', op: 'maior', valor: '0' }] },
  { rotulo: 'Abaixo de 90% lido', icone: 'fas fa-arrow-down', condicoes: [{ chave: 'percentualLido', op: 'menor', valor: '90' }] }
]
</script>

<template>
  <div class="space-y-6">
    <!-- Setores -->
    <div class="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-3">
      <div class="flex items-center gap-2 flex-wrap">
        <i class="fas fa-chart-pie text-sm shrink-0 text-slate-400" aria-hidden="true"></i>
        <h2 class="text-sm font-bold text-slate-800">Parcial por setor</h2>
        <span v-if="setoresComAnalise.length" class="text-[10px] text-slate-400 font-medium">{{ setoresComAnalise.length }} setor(es)</span>
        <span v-if="setoresComAnalise.filter(s => s.percentualPendente > 3).length" class="text-[10px] px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 font-medium border border-orange-100">{{ setoresComAnalise.filter(s => s.percentualPendente > 3).length }} acima da meta</span>
      </div>
      <UiTabela id="auditoria-estat-setores" titulo="Parcial por setor" :itens="setoresComAnalise" :colunas="COLUNAS_SETORES" :atalhos="ATALHOS_SETORES" :ordem-inicial="{ chave: 'percentualPendente', direcao: 'desc' }" chave-item="nome" :tamanho-pagina="10" clicavel :agrupavel="false" vazio="Nenhum setor." @linha="abrirModalSetorLocal('setor', [$event])">
        <template #celula-percentualConclusao="{ item: s, texto }">
          <div class="flex items-center justify-end gap-2">
            <div class="hidden h-1.5 w-14 rounded-full bg-slate-100 sm:block"><div class="h-1.5 rounded-full bg-emerald-400" :style="{ width: Math.min(s.percentualConclusao, 100) + '%' }"></div></div>
            <span class="font-semibold text-slate-700">{{ texto }}</span>
          </div>
        </template>
        <template #celula-classificacao="{ item: s }"><span class="rounded-full px-2 py-1 text-[10px] font-bold" :class="s.classificacaoClass">{{ s.classificacao }}</span></template>
      </UiTabela>
    </div>

    <!-- Locais -->
    <div class="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-3">
      <div class="flex items-center gap-2 flex-wrap">
        <i class="fas fa-map-marker-alt text-sm shrink-0 text-slate-400" aria-hidden="true"></i>
        <h2 class="text-sm font-bold text-slate-800">Locais</h2>
        <span v-if="locaisComAnalise.length" class="text-[10px] text-slate-400 font-medium">{{ locaisComAnalise.length }} local(is)</span>
        <span v-if="locaisComAnalise.filter(l => l.pendentes > 0).length" class="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium border border-amber-100">{{ locaisComAnalise.filter(l => l.pendentes > 0).length }} com pendência</span>
      </div>
      <UiTabela id="auditoria-estat-locais" titulo="Locais" :itens="locaisComAnalise" :colunas="COLUNAS_LOCAIS" :atalhos="ATALHOS_LOCAIS" :ordem-inicial="{ chave: 'pendentes', direcao: 'desc' }" chave-item="nome" clicavel :agrupavel="false" vazio="Nenhum local." @linha="abrirModalSetorLocal('local', [$event])">
        <template #celula-percentualLido="{ item: l, texto }">
          <div class="flex items-center justify-end gap-2">
            <div class="hidden h-1.5 w-14 rounded-full bg-slate-100 sm:block"><div class="h-1.5 rounded-full" :class="l.percentualLido >= 97 ? 'bg-emerald-400' : l.percentualLido >= 90 ? 'bg-amber-400' : 'bg-red-400'" :style="{ width: Math.min(l.percentualLido, 100) + '%' }"></div></div>
            <span class="font-bold" :class="l.percentualLido >= 97 ? 'text-emerald-700' : l.percentualLido >= 90 ? 'text-amber-700' : 'text-red-700'">{{ texto }}</span>
          </div>
        </template>
      </UiTabela>
    </div>
  </div>
</template>
