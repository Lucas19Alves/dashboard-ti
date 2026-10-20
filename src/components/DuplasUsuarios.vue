<script setup>
import { computed, ref } from 'vue'
import { duplas } from '../utils/fichaColaborador'
import { correspondeBusca } from '../utils/busca'
import { rotuloUsuario, separarUsuario } from '../utils/usuario'

// Duplas que rendem mais (ou menos) quando leem o mesmo setor na mesma auditoria.
const props = defineProps({
  auditorias: { type: Array, required: true }
})
const minimo = ref(2)
const busca = ref('')
const lista = computed(() => duplas(props.auditorias, { minimo: minimo.value }))
const filtradas = computed(() => lista.value.filter(d => correspondeBusca(busca.value, [d.a, d.b, ...d.setores, separarUsuario(d.a).matricula, separarUsuario(d.b).matricula])))
const visao = ref('melhores')
const exibidas = computed(() => (visao.value === 'melhores' ? filtradas.value : [...filtradas.value].reverse()).slice(0, 15))
const link = u => `/colaborador/${encodeURIComponent(u)}`
</script>

<template>
  <section class="ui-card p-5 md:p-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="text-base font-bold text-slate-900">Duplas que rendem juntas</h2>
        <p class="text-xs text-slate-500">Pessoas que leram o mesmo setor na mesma auditoria. % = ritmo das duas acima (+) ou abaixo (−) do normal de cada uma.</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <input v-model="busca" type="search" class="ui-input w-48 py-2 text-xs" placeholder="Nome, matrícula ou setor..." aria-label="Buscar dupla">
        <select v-model.number="minimo" class="ui-input w-auto py-2 text-xs" aria-label="Mínimo de auditorias juntas">
          <option v-for="n in [1, 2, 3, 5]" :key="n" :value="n">{{ n }}+ auditoria(s) juntas</option>
        </select>
        <div class="flex rounded-xl bg-slate-100 p-1 text-xs" role="tablist" aria-label="Ordem">
          <button v-for="[v, r] in [['melhores', 'Rendem mais'], ['piores', 'Rendem menos']]" :key="v" type="button" role="tab" :aria-selected="visao === v"
            class="rounded-lg px-3 py-1.5 font-semibold" :class="visao === v ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'" @click="visao = v">{{ r }}</button>
        </div>
      </div>
    </div>
    <p v-if="!exibidas.length" class="py-8 text-center text-sm text-slate-500">Sem duplas com auditorias suficientes no período (precisa de horário nas leituras).</p>
    <div v-else class="mt-4 overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="text-xs text-slate-500">
          <tr class="border-b-2 border-slate-100">
            <th scope="col" class="px-3 py-2 text-left font-semibold">Dupla</th>
            <th scope="col" class="px-3 py-2 text-left font-semibold">Setores em comum</th>
            <th scope="col" class="px-3 py-2 text-right font-semibold">Juntas</th>
            <th scope="col" class="px-3 py-2 text-right font-semibold">Rendimento</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-50">
          <tr v-for="d in exibidas" :key="d.a + d.b">
            <td class="px-3 py-2">
              <router-link :to="link(d.a)" class="font-semibold text-slate-800 hover:text-blue-700">{{ rotuloUsuario(d.a) }}</router-link>
              <span class="mx-1 text-slate-400">+</span>
              <router-link :to="link(d.b)" class="font-semibold text-slate-800 hover:text-blue-700">{{ rotuloUsuario(d.b) }}</router-link>
            </td>
            <td class="px-3 py-2 text-xs text-slate-600">{{ d.setores.slice(0, 3).join(', ') }}</td>
            <td class="px-3 py-2 text-right tabular-nums text-slate-600">{{ d.juntas }}</td>
            <td class="px-3 py-2 text-right font-black tabular-nums" :class="d.rendimento >= 0 ? 'text-emerald-700' : 'text-red-700'">{{ d.rendimento >= 0 ? '+' : '' }}{{ d.rendimento.toFixed(0) }}%</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
