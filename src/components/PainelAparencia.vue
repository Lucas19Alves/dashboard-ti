<script setup>
import UiModal from './ui/UiModal.vue'
import UiButton from './ui/UiButton.vue'
import { useAparencia } from '../composables/useAparencia'

// Aparência e acessibilidade: tema, tamanho do texto, alto contraste e animações.
const emit = defineEmits(['close'])
const { estado, restaurar } = useAparencia()

const TEMAS = [
  { valor: 'claro', rotulo: 'Claro', icone: 'fas fa-sun' },
  { valor: 'escuro', rotulo: 'Escuro', icone: 'fas fa-moon' },
  { valor: 'sistema', rotulo: 'Do sistema', icone: 'fas fa-desktop' }
]
const TEXTOS = [
  { valor: 'normal', rotulo: 'Normal', exemplo: 'text-sm' },
  { valor: 'grande', rotulo: 'Grande', exemplo: 'text-base' },
  { valor: 'maior', rotulo: 'Maior', exemplo: 'text-lg' }
]
</script>

<template>
  <UiModal title="Aparência e acessibilidade" subtitle="Salvo neste navegador" @close="emit('close')">
    <div class="space-y-6">
      <fieldset>
        <legend class="ui-label">Tema</legend>
        <div class="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tema">
          <button v-for="t in TEMAS" :key="t.valor" type="button" role="radio" :aria-checked="estado.tema === t.valor"
            class="flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-sm font-semibold transition"
            :class="estado.tema === t.valor ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-200' : 'border-slate-200 text-slate-600 hover:border-slate-300'"
            @click="estado.tema = t.valor">
            <i :class="[t.icone, 'text-lg']" aria-hidden="true"></i>{{ t.rotulo }}
          </button>
        </div>
      </fieldset>

      <fieldset>
        <legend class="ui-label">Tamanho do texto</legend>
        <div class="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tamanho do texto">
          <button v-for="t in TEXTOS" :key="t.valor" type="button" role="radio" :aria-checked="estado.texto === t.valor"
            class="rounded-xl border px-3 py-2.5 font-semibold transition" :class="[t.exemplo, estado.texto === t.valor ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-200' : 'border-slate-200 text-slate-600 hover:border-slate-300']"
            @click="estado.texto = t.valor">
            Aa <span class="block text-xs font-medium">{{ t.rotulo }}</span>
          </button>
        </div>
      </fieldset>

      <div class="space-y-2">
        <label class="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 hover:border-slate-300">
          <input v-model="estado.contraste" type="checkbox" class="mt-0.5 size-4 accent-blue-600">
          <span>
            <span class="block text-sm font-semibold text-slate-800">Alto contraste</span>
            <span class="block text-xs text-slate-500">Textos secundários e bordas mais fortes, foco do teclado mais visível e links sublinhados.</span>
          </span>
        </label>
        <label class="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 hover:border-slate-300">
          <input v-model="estado.menosMovimento" type="checkbox" class="mt-0.5 size-4 accent-blue-600">
          <span>
            <span class="block text-sm font-semibold text-slate-800">Reduzir animações</span>
            <span class="block text-xs text-slate-500">Desliga transições e animações (já acontece se o sistema pedir menos movimento).</span>
          </span>
        </label>
      </div>

      <p class="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <i class="fas fa-keyboard mr-1" aria-hidden="true"></i>Navegação por teclado: <kbd class="rounded bg-white px-1 font-semibold ring-1 ring-slate-200">Tab</kbd> percorre os controles,
        <kbd class="rounded bg-white px-1 font-semibold ring-1 ring-slate-200">Esc</kbd> fecha janelas e o primeiro <kbd class="rounded bg-white px-1 font-semibold ring-1 ring-slate-200">Tab</kbd> da página oferece “Pular para o conteúdo”.
      </p>
    </div>

    <template #footer>
      <UiButton variant="secondary" size="sm" @click="restaurar">Restaurar padrão</UiButton>
      <UiButton size="sm" @click="emit('close')">Concluir</UiButton>
    </template>
  </UiModal>
</template>
