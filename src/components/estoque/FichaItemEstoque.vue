<script setup>
import { computed } from 'vue'
import { useVencimentosStore } from '../../stores/vencimentosStore'
import { useNaoVinculadosStore } from '../../stores/naoVinculadosStore'
import { TIPOS_PROBLEMA } from '../../utils/estoque'
import UiModal from '../ui/UiModal.vue'

// Tudo o que o sistema sabe de um código: situação atual, histórico nas auditorias de leitura,
// validades e não vinculado.
const props = defineProps({
  codigo: { type: String, required: true },
  indice: { type: Object, required: true },
  problemas: { type: Array, default: () => [] }
})
const emit = defineEmits(['close'])

const registro = computed(() => props.indice.itens.get(props.codigo) || null)
const validades = computed(() => useVencimentosStore().itens.filter(v => String(v._codigo).trim() === props.codigo).sort((a, b) => String(a._validadeISO).localeCompare(String(b._validadeISO))))
const naoVinculado = computed(() => useNaoVinculadosStore().itens.find(i => i.codigo === props.codigo) || null)
const titulo = computed(() => registro.value?.produto || naoVinculado.value?.produto || validades.value[0]?._produto || props.codigo)
const historico = computed(() => [...(registro.value?.historico || [])].reverse())

const br = iso => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}` : '—')
const SITUACAO = {
  lido: { rotulo: 'Lido', classe: 'text-emerald-700' },
  pendente: { rotulo: 'Não lido com estoque', classe: 'text-red-700' },
  lidoSemEstoque: { rotulo: 'Lido, estoque zerado', classe: 'text-amber-700' },
  semEstoque: { rotulo: 'Sem estoque', classe: 'text-slate-500' }
}
const resumo = computed(() => {
  const r = registro.value
  if (!r) return []
  return [
    { rotulo: 'Local vinculado', valor: r.local || '—' },
    { rotulo: 'Estoque', valor: r.estoque?.toLocaleString('pt-BR') ?? '—' },
    { rotulo: 'Dias sem venda', valor: r.diasSemVenda ?? '—' },
    { rotulo: 'Última leitura', valor: r.ultimaLeitura ? br(r.ultimaLeitura) : 'Nunca' },
    { rotulo: 'Lido', valor: `${r.leituras} de ${r.aparicoes}` },
    { rotulo: 'Ruptura acumulada', valor: r.custoAcumulado ? r.custoAcumulado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—' }
  ]
})
</script>

<template>
  <UiModal :title="titulo" :subtitle="`${codigo}${registro ? ` · ${registro.setor}` : ''}${registro?.fornecedor ? ` · ${registro.fornecedor}` : ''}`" width="max-w-3xl" @close="emit('close')">
    <div class="space-y-5">
      <div v-if="problemas.length" class="space-y-2">
        <article v-for="p in problemas" :key="p.tipo" class="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2.5">
          <p class="text-xs font-semibold text-slate-600"><i :class="[TIPOS_PROBLEMA[p.tipo].icone, 'mr-1']"></i>{{ TIPOS_PROBLEMA[p.tipo].rotulo }}</p>
          <p class="text-sm text-slate-800">{{ p.diagnostico }}</p>
        </article>
      </div>

      <dl v-if="resumo.length" class="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div v-for="r in resumo" :key="r.rotulo" class="rounded-lg bg-slate-50 px-3 py-2">
          <dt class="text-xs text-slate-500">{{ r.rotulo }}</dt>
          <dd class="font-semibold tabular-nums text-slate-900">{{ r.valor }}</dd>
        </div>
      </dl>
      <p v-else class="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-600">Este código não aparece em nenhuma auditoria de Presença ou Ruptura.</p>

      <section v-if="naoVinculado || validades.length" class="grid gap-3 md:grid-cols-2">
        <div v-if="naoVinculado" class="rounded-lg border border-slate-200 p-3 text-sm">
          <p class="text-xs font-semibold text-slate-500">Não vinculado</p>
          <p class="mt-1">{{ naoVinculado.status === 'resolvido' ? `Vinculado em ${br(naoVinculado.resolvidoEm)}` : `Sem local desde ${br(naoVinculado.primeiroVisto)}` }}</p>
          <p v-if="naoVinculado.status !== 'resolvido' && naoVinculado.sugestao?.local" class="text-xs text-slate-500">Sugerido: <b>{{ naoVinculado.sugestao.local }}</b></p>
        </div>
        <div v-if="validades.length" class="rounded-lg border border-slate-200 p-3 text-sm">
          <p class="text-xs font-semibold text-slate-500">Validades</p>
          <p v-for="v in validades.slice(0, 3)" :key="v._validadeISO" class="mt-1 tabular-nums">{{ br(v._validadeISO) }} <span class="text-xs text-slate-500">{{ v._estoque }} un.</span></p>
        </div>
      </section>

      <section v-if="historico.length">
        <h3 class="mb-2 text-sm font-semibold text-slate-900">Presença e Ruptura</h3>
        <div class="max-h-[40vh] overflow-y-auto rounded-lg border border-slate-200">
          <table class="w-full text-sm">
            <thead class="sticky top-0 bg-slate-50 text-left text-xs text-slate-500"><tr><th class="px-3 py-2">Data</th><th class="px-3">Local</th><th class="px-3">Situação</th><th class="px-3 text-right">Estoque</th><th class="px-3 text-right">Sem venda</th></tr></thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="h in historico" :key="h.auditoriaId">
                <td class="whitespace-nowrap px-3 py-1.5 tabular-nums"><RouterLink :to="`/auditoria/${h.auditoriaId}`" class="hover:text-blue-700 hover:underline">{{ br(h.data) }}</RouterLink> <span class="text-xs text-slate-500">{{ h.tipo }}</span></td>
                <td class="px-3">{{ h.local || '—' }}<span v-if="h.localLido" class="text-xs text-blue-700"> · achado em {{ h.localLido }}</span></td>
                <td class="px-3 font-medium" :class="SITUACAO[h.situacao]?.classe">{{ SITUACAO[h.situacao]?.rotulo }}</td>
                <td class="px-3 text-right tabular-nums">{{ h.estoque.toLocaleString('pt-BR') }}</td>
                <td class="px-3 text-right tabular-nums">{{ h.diasSemVenda ?? '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </UiModal>
</template>
