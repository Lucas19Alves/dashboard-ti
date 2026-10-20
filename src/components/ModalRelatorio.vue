<script setup>
import { computed, reactive, watch } from 'vue'
import UiModal from './ui/UiModal.vue'
import UiButton from './ui/UiButton.vue'
import { gerarRelatorio, lerPreferencias, salvarPreferencias, useRelatorio } from '../composables/useRelatorio'

// Escolha do que entra no relatório antes de imprimir (seções, colunas, orientação, observações, assinatura).
const { pendente, fechar } = useRelatorio()
const escolhas = reactive({ secoes: [], colunas: [], orientacao: 'auto', observacoes: '', assinaturas: false })

const secoesDisponiveis = computed(() => {
  const c = pendente.value
  if (!c) return []
  return [
    ...(c.indicadores?.length ? [{ id: '__indicadores', titulo: 'Indicadores do topo', descricao: c.indicadores.map(i => i.rotulo).join(' · '), padrao: true }] : []),
    ...(c.secoes || [])
  ]
})

watch(pendente, (c) => {
  if (!c) return
  const prefs = lerPreferencias(c.id) || {}
  const ids = secoesDisponiveis.value.map(s => s.id)
  escolhas.secoes = prefs.secoes ? prefs.secoes.filter(id => ids.includes(id)) : secoesDisponiveis.value.filter(s => s.padrao !== false).map(s => s.id)
  if (!escolhas.secoes.length) escolhas.secoes = secoesDisponiveis.value.filter(s => s.padrao !== false).map(s => s.id)
  const chaves = c.colunas?.lista.map(x => x.chave) || []
  escolhas.colunas = prefs.colunas?.filter(k => chaves.includes(k)).length ? prefs.colunas.filter(k => chaves.includes(k)) : (c.colunas?.padrao || chaves)
  escolhas.orientacao = prefs.orientacao || 'auto'
  escolhas.assinaturas = Boolean(prefs.assinaturas ?? c.assinaturaPadrao)
  escolhas.observacoes = ''
}, { immediate: true })

const alternar = (lista, valor) => (lista.includes(valor) ? lista.filter(v => v !== valor) : [...lista, valor])
const temTabela = computed(() => Boolean(pendente.value?.colunas) && escolhas.secoes.includes('tabela'))
const pode = computed(() => escolhas.secoes.length > 0 && (!temTabela.value || escolhas.colunas.length > 0))

const gerar = () => {
  const c = pendente.value
  salvarPreferencias(c.id, { secoes: escolhas.secoes, colunas: escolhas.colunas, orientacao: escolhas.orientacao, assinaturas: escolhas.assinaturas })
  // Mantém a ordem original das colunas.
  const ordem = c.colunas?.lista.map(x => x.chave) || []
  gerarRelatorio(c, { ...escolhas, colunas: ordem.filter(k => escolhas.colunas.includes(k)), secoes: [...escolhas.secoes] })
  fechar()
}
</script>

<template>
  <UiModal v-if="pendente" :title="pendente.titulo" subtitle="Escolha o que vai no relatório (A4)" width="max-w-2xl" @close="fechar">
    <div class="space-y-5">
      <fieldset>
        <legend class="ui-label">Conteúdo</legend>
        <div class="space-y-1.5">
          <label v-for="s in secoesDisponiveis" :key="s.id" class="flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2 transition" :class="escolhas.secoes.includes(s.id) ? 'border-blue-300 bg-blue-50/60' : 'border-slate-200 hover:border-slate-300'">
            <input type="checkbox" class="mt-0.5 size-4 accent-blue-600" :checked="escolhas.secoes.includes(s.id)" @change="escolhas.secoes = alternar(escolhas.secoes, s.id)">
            <span class="min-w-0">
              <span class="block text-sm font-semibold text-slate-800">{{ s.titulo }}</span>
              <span v-if="s.descricao" class="block text-xs text-slate-500">{{ s.descricao }}</span>
            </span>
          </label>
        </div>
      </fieldset>

      <fieldset v-if="temTabela">
        <legend class="ui-label">Colunas da tabela</legend>
        <div class="flex flex-wrap gap-1.5">
          <button v-for="c in pendente.colunas.lista" :key="c.chave" type="button" :aria-pressed="escolhas.colunas.includes(c.chave)"
            class="rounded-full px-2.5 py-1 text-xs font-semibold ring-1 transition" :class="escolhas.colunas.includes(c.chave) ? 'bg-blue-600 text-white ring-blue-600' : 'bg-white text-slate-600 ring-slate-200'"
            @click="escolhas.colunas = alternar(escolhas.colunas, c.chave)">{{ c.titulo }}</button>
        </div>
      </fieldset>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <fieldset>
          <legend class="ui-label">Orientação da folha</legend>
          <div class="flex rounded-xl bg-slate-100 p-1 text-sm" role="radiogroup" aria-label="Orientação">
            <button v-for="[v, r] in [['auto', 'Automática'], ['retrato', 'Retrato'], ['paisagem', 'Paisagem']]" :key="v" type="button" role="radio" :aria-checked="escolhas.orientacao === v"
              class="flex-1 rounded-lg px-2 py-1.5 font-semibold" :class="escolhas.orientacao === v ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'" @click="escolhas.orientacao = v">{{ r }}</button>
          </div>
          <p class="mt-1 text-[11px] text-slate-500">Automática usa paisagem só quando há tabela larga.</p>
        </fieldset>
        <label class="flex cursor-pointer items-start gap-3 self-end rounded-xl border border-slate-200 px-3 py-2">
          <input v-model="escolhas.assinaturas" type="checkbox" class="mt-0.5 size-4 accent-blue-600">
          <span><span class="block text-sm font-semibold text-slate-800">Campos de assinatura</span><span class="block text-xs text-slate-500">Responsável, liderança e data no fim.</span></span>
        </label>
      </div>

      <label class="block">
        <span class="ui-label">Observações (opcional)</span>
        <textarea v-model="escolhas.observacoes" rows="3" class="ui-input" placeholder="Ex.: combinados com a equipe, prazos, pontos de atenção..."></textarea>
      </label>
    </div>

    <template #footer>
      <UiButton variant="secondary" size="sm" @click="fechar">Cancelar</UiButton>
      <UiButton size="sm" :disabled="!pode" @click="gerar"><i class="fas fa-file-pdf" aria-hidden="true"></i>Gerar PDF</UiButton>
    </template>
  </UiModal>
</template>
