<script setup>
import { computed } from 'vue'
import { TAMANHOS_PAGINA, paginasVisiveis } from '../../utils/filtroTabela'

// Rodapé de paginação padrão: "1–25 de 1.234", itens por página e páginas.
const props = defineProps({
  pagina: { type: Number, required: true },
  paginas: { type: Number, required: true },
  inicio: { type: Number, default: 0 },
  fim: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  tamanho: { type: Number, required: true }
})
const emit = defineEmits(['update:pagina', 'update:tamanho'])
const numeros = computed(() => paginasVisiveis(props.pagina, props.paginas))
const ir = p => emit('update:pagina', Math.min(props.paginas, Math.max(1, p)))
const int = v => v.toLocaleString('pt-BR')
</script>

<template>
  <nav class="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600" aria-label="Paginação">
    <p class="tabular-nums"><b class="text-slate-900">{{ int(inicio) }}–{{ int(fim) }}</b> de {{ int(total) }}</p>
    <label class="inline-flex items-center gap-1.5">Por página
      <select class="rounded-md border border-slate-300/80 bg-white px-1.5 py-1 text-xs" :value="tamanho" @change="emit('update:tamanho', Number($event.target.value))">
        <option v-for="t in TAMANHOS_PAGINA" :key="t" :value="t">{{ t }}</option>
      </select>
    </label>
    <div v-if="paginas > 1" class="ml-auto flex items-center gap-1">
      <button type="button" class="pag" :disabled="pagina <= 1" title="Primeira página" @click="ir(1)"><i class="fas fa-angles-left"></i></button>
      <button type="button" class="pag" :disabled="pagina <= 1" title="Página anterior" @click="ir(pagina - 1)"><i class="fas fa-chevron-left"></i></button>
      <span class="hidden items-center gap-1 sm:flex">
        <template v-for="(p, i) in numeros" :key="`${p}-${i}`">
          <span v-if="p === '…'" class="px-1 text-slate-400">…</span>
          <button v-else type="button" class="pag" :class="p === pagina ? '!border-blue-600 !bg-blue-600 !text-white' : ''" :aria-current="p === pagina ? 'page' : undefined" @click="ir(p)">{{ p }}</button>
        </template>
      </span>
      <span class="px-1 tabular-nums sm:hidden">{{ pagina }} / {{ paginas }}</span>
      <button type="button" class="pag" :disabled="pagina >= paginas" title="Próxima página" @click="ir(pagina + 1)"><i class="fas fa-chevron-right"></i></button>
      <button type="button" class="pag" :disabled="pagina >= paginas" title="Última página" @click="ir(paginas)"><i class="fas fa-angles-right"></i></button>
    </div>
  </nav>
</template>

<style scoped>
.pag {
  display: inline-flex;
  min-width: 1.85rem;
  height: 1.85rem;
  align-items: center;
  justify-content: center;
  border-radius: 0.375rem;
  border: 1px solid var(--color-slate-200);
  background: var(--color-white);
  padding: 0 0.4rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--color-slate-600);
}
.pag:hover:not(:disabled) { background: var(--color-slate-50); }
.pag:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
