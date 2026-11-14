<script setup>
import { computed, ref } from 'vue'
import { duplas } from '../utils/fichaColaborador'
import { rotuloUsuario, separarUsuario } from '../utils/usuario'
import UiTabela from './ui/UiTabela.vue'

// Duplas que rendem mais (ou menos) quando leem o mesmo setor na mesma auditoria.
// O mínimo de auditorias juntas muda o cálculo, por isso fica fora da tabela padrão.
const props = defineProps({
  auditorias: { type: Array, required: true }
})
const minimo = ref(2)
const lista = computed(() => duplas(props.auditorias, { minimo: minimo.value }))
const link = u => `/colaborador/${encodeURIComponent(u)}`

const COLUNAS = [
  { chave: 'dupla', titulo: 'Dupla', tipo: 'texto', valor: d => `${rotuloUsuario(d.a)} + ${rotuloUsuario(d.b)}` },
  { chave: 'matriculas', titulo: 'Matrículas', tipo: 'texto', oculta: true, valor: d => [separarUsuario(d.a).matricula, separarUsuario(d.b).matricula].filter(Boolean).join(' ') },
  { chave: 'setores', titulo: 'Setores em comum', tipo: 'texto', valor: d => d.setores.join(', '), formato: v => v.split(', ').slice(0, 3).join(', ') },
  { chave: 'juntas', titulo: 'Juntas', tipo: 'numero' },
  { chave: 'rendimento', titulo: 'Rendimento (%)', tipo: 'numero', formato: v => `${v >= 0 ? '+' : ''}${v.toFixed(0)}%` }
]
const ATALHOS = [
  { rotulo: 'Rendem mais', icone: 'fas fa-arrow-trend-up', condicoes: [{ chave: 'rendimento', op: 'maior', valor: '0' }], ordem: [{ chave: 'rendimento', direcao: 'desc' }] },
  { rotulo: 'Rendem menos', icone: 'fas fa-arrow-trend-down', condicoes: [{ chave: 'rendimento', op: 'menor', valor: '0' }], ordem: [{ chave: 'rendimento', direcao: 'asc' }] }
]
</script>

<template>
  <section class="ui-card p-5 md:p-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="text-base font-bold text-slate-900">Duplas que rendem juntas</h2>
        <p class="text-xs text-slate-500">Pessoas que leram o mesmo setor na mesma auditoria. % = ritmo das duas acima (+) ou abaixo (−) do normal de cada uma.</p>
      </div>
      <select v-model.number="minimo" class="ui-input w-auto py-2 text-xs" aria-label="Mínimo de auditorias juntas">
        <option v-for="n in [1, 2, 3, 5]" :key="n" :value="n">{{ n }}+ auditoria(s) juntas</option>
      </select>
    </div>
    <div class="mt-4">
      <UiTabela id="duplas-usuarios" titulo="Duplas que rendem juntas" :itens="lista" :colunas="COLUNAS" :atalhos="ATALHOS" :ordem-inicial="{ chave: 'rendimento', direcao: 'desc' }" :chave-item="d => d.a + d.b" :tamanho-pagina="10" :agrupavel="false" vazio="Sem duplas com auditorias suficientes no período (precisa de horário nas leituras)." placeholder="Nome, matrícula ou setor...">
        <template #celula-dupla="{ item: d }">
          <router-link :to="link(d.a)" class="font-semibold text-slate-800 hover:text-blue-700">{{ rotuloUsuario(d.a) }}</router-link>
          <span class="mx-1 text-slate-400">+</span>
          <router-link :to="link(d.b)" class="font-semibold text-slate-800 hover:text-blue-700">{{ rotuloUsuario(d.b) }}</router-link>
        </template>
        <template #celula-rendimento="{ item: d, texto }"><span class="font-black" :class="d.rendimento >= 0 ? 'text-emerald-700' : 'text-red-700'">{{ texto }}</span></template>
      </UiTabela>
    </div>
  </section>
</template>
