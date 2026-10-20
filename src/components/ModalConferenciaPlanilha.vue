<script setup>
import { computed, ref, watch } from 'vue'
import UiModal from './ui/UiModal.vue'
import UiButton from './ui/UiButton.vue'
import { useConferencia } from '../composables/useConferencia'
import { formatarDataBR } from '../utils/busca'

// Prévia da planilha antes de salvar: o que foi encontrado e o que vale conferir.
const { pendente } = useConferencia()
const r = computed(() => pendente.value?.resultado)
const aberto = ref(null)
watch(pendente, () => { aberto.value = null })

const ESTILO = {
  ok: { icone: 'fas fa-circle-check', cor: 'text-emerald-600', fundo: 'bg-emerald-50' },
  aviso: { icone: 'fas fa-triangle-exclamation', cor: 'text-amber-600', fundo: 'bg-amber-50' },
  erro: { icone: 'fas fa-circle-xmark', cor: 'text-red-600', fundo: 'bg-red-50' }
}
const TITULO = { ok: 'Tudo certo com a planilha', aviso: 'Planilha com pontos para conferir', erro: 'Planilha com problemas' }
</script>

<template>
  <UiModal v-if="pendente" title="Conferência da planilha" :subtitle="`${pendente.contexto.tipo || 'Auditoria'}${pendente.contexto.data ? ' · ' + formatarDataBR(pendente.contexto.data) : ''}${pendente.contexto.arquivo ? ' · ' + pendente.contexto.arquivo : ''}`" width="max-w-2xl" @close="pendente.responder(false)">
    <div class="space-y-4">
      <div class="flex items-center gap-3 rounded-xl p-3" :class="ESTILO[r.nivel].fundo" role="status">
        <i :class="[ESTILO[r.nivel].icone, ESTILO[r.nivel].cor, 'text-xl']" aria-hidden="true"></i>
        <p class="font-bold text-slate-900">{{ TITULO[r.nivel] }}</p>
      </div>

      <div class="grid grid-cols-3 gap-2 text-center">
        <div class="rounded-xl bg-slate-50 py-2"><p class="text-xl font-black text-slate-900">{{ r.total.toLocaleString('pt-BR') }}</p><p class="text-[11px] text-slate-500">linhas</p></div>
        <div class="rounded-xl bg-emerald-50 py-2"><p class="text-xl font-black text-emerald-700">{{ r.lidos.toLocaleString('pt-BR') }}</p><p class="text-[11px] text-emerald-700">lidas</p></div>
        <div class="rounded-xl bg-amber-50 py-2"><p class="text-xl font-black text-amber-700">{{ r.pendentes.toLocaleString('pt-BR') }}</p><p class="text-[11px] text-amber-700">não lidas</p></div>
      </div>

      <ul class="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
        <li v-for="v in r.verificacoes" :key="v.chave">
          <button type="button" class="flex w-full items-start gap-3 px-3 py-2.5 text-left" :disabled="!v.exemplos?.length" :aria-expanded="aberto === v.chave" @click="aberto = aberto === v.chave ? null : v.chave">
            <i :class="[ESTILO[v.nivel].icone, ESTILO[v.nivel].cor, 'mt-0.5']" aria-hidden="true"></i>
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-semibold text-slate-800">{{ v.titulo }}</span>
              <span class="block text-xs text-slate-600">{{ v.resumo }}</span>
              <span v-if="v.detalhe" class="block text-[11px] text-slate-500">{{ v.detalhe }}</span>
            </span>
            <i v-if="v.exemplos?.length" :class="['fas text-xs text-slate-400 mt-1', aberto === v.chave ? 'fa-chevron-up' : 'fa-chevron-down']" aria-hidden="true"></i>
          </button>
          <div v-if="aberto === v.chave" class="flex flex-wrap gap-1.5 px-3 pb-3 pl-9">
            <span v-for="e in v.exemplos" :key="e" class="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">{{ e }}</span>
          </div>
        </li>
      </ul>
    </div>

    <template #footer>
      <UiButton variant="secondary" size="sm" @click="pendente.responder(false)">Cancelar</UiButton>
      <UiButton size="sm" :variant="r.nivel === 'erro' ? 'danger' : 'primary'" @click="pendente.responder(true)">
        {{ r.nivel === 'ok' ? 'Salvar' : 'Salvar mesmo assim' }}
      </UiButton>
    </template>
  </UiModal>
</template>
