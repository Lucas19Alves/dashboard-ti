<script setup>
import { computed, ref } from 'vue'

// Colunas de uma única série (ex.: % pendente médio por mês) com linha de meta.
const props = defineProps({
  pontos: { type: Array, default: () => [] }, // [{ chave, rotulo, valor, detalhe }]
  meta: { type: Number, default: 3 },
  sufixo: { type: String, default: '%' },
  rotuloSerie: { type: String, default: '% pendente médio' }
})
const emit = defineEmits(['selecionar'])

const ativo = ref(null)
const validos = computed(() => props.pontos.filter(p => Number.isFinite(p.valor)))
const maximo = computed(() => {
  const maior = Math.max(props.meta * 1.5, ...validos.value.map(p => p.valor))
  const passo = maior <= 10 ? 2 : maior <= 25 ? 5 : 10
  return Math.ceil(maior / passo) * passo
})
const altura = valor => `${Math.max(0, Math.min(100, (valor / maximo.value) * 100))}%`
const grade = computed(() => [maximo.value, maximo.value / 2, 0])
const ultimoIndice = computed(() => props.pontos.length - 1)
const formatar = v => `${v.toFixed(1)}${props.sufixo}`
</script>

<template>
  <div>
    <div class="relative flex h-52 gap-2 pl-9">
      <!-- Grade e eixo Y: cada linha tem altura 0 para ficar exatamente na altura do valor. -->
      <div class="pointer-events-none absolute inset-y-0 left-0 right-0">
        <div v-for="g in grade" :key="g" class="absolute left-0 right-0 flex h-0 items-center" :style="{ bottom: altura(g) }">
          <span class="w-8 pr-1 text-right text-[10px] leading-none text-slate-400">{{ g }}{{ sufixo }}</span>
          <span class="h-px flex-1 bg-slate-100"></span>
        </div>
        <div class="absolute left-9 right-0 flex h-0 items-center" :style="{ bottom: altura(meta) }">
          <span class="h-0 flex-1 border-t border-dashed border-slate-400"></span>
          <span class="ml-1 rounded bg-white px-1 text-[10px] font-semibold leading-none text-slate-500">meta {{ meta }}{{ sufixo }}</span>
        </div>
      </div>

      <p v-if="!pontos.length" class="m-auto text-xs text-slate-400">Sem dados no período.</p>

      <button
        v-for="(p, i) in pontos"
        :key="p.chave"
        type="button"
        class="group relative flex h-full min-w-0 flex-1 cursor-pointer flex-col justify-end rounded-t-md outline-none"
        :aria-label="`${p.rotulo}: ${Number.isFinite(p.valor) ? formatar(p.valor) : 'sem dados'}`"
        @mouseenter="ativo = i"
        @mouseleave="ativo = null"
        @focus="ativo = i"
        @blur="ativo = null"
        @click="emit('selecionar', p)"
      >
        <span class="absolute inset-0 rounded-md transition" :class="ativo === i ? 'bg-slate-100/70' : ''"></span>
        <span
          v-if="Number.isFinite(p.valor)"
          class="relative mx-auto w-full max-w-10 rounded-t transition-[height] duration-500"
          :class="ativo === null || ativo === i ? 'bg-blue-600' : 'bg-blue-300'"
          :style="{ height: altura(p.valor), minHeight: p.valor > 0 ? '3px' : '0' }"
        ></span>
        <span
          v-if="i === ultimoIndice && ativo === null && Number.isFinite(p.valor)"
          class="absolute left-1/2 -translate-x-1/2 -translate-y-5 whitespace-nowrap text-[11px] font-bold text-slate-700"
          :style="{ bottom: altura(p.valor) }"
        >{{ formatar(p.valor) }}</span>
        <span
          v-if="ativo === i"
          class="absolute left-1/2 z-10 -translate-x-1/2 -translate-y-2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-left text-[11px] text-white shadow-lg"
          :style="{ bottom: Number.isFinite(p.valor) ? altura(p.valor) : '0%' }"
        >
          <span class="block font-semibold">{{ p.rotulo }}</span>
          <span class="block">{{ rotuloSerie }}: <b>{{ Number.isFinite(p.valor) ? formatar(p.valor) : '—' }}</b></span>
          <span v-if="p.detalhe" class="block text-slate-300">{{ p.detalhe }}</span>
        </span>
      </button>
    </div>
    <div class="mt-1.5 flex gap-2 pl-9">
      <span v-for="p in pontos" :key="p.chave" class="min-w-0 flex-1 truncate text-center text-[10px] text-slate-500">{{ p.rotulo }}</span>
    </div>
  </div>
</template>
