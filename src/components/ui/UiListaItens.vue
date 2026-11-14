<script setup>
import { computed } from 'vue'
import UiTabela from './UiTabela.vue'

// Lista de itens dos modais (métricas, setor, fornecedor, usuário...). Usa a tabela padrão
// (UiTabela): as facetas viram filtros rápidos; as que não são colunas entram como colunas ocultas.
const props = defineProps({
  itens: { type: Array, default: () => [] },
  // [{ chave, titulo, alinhamento?, valor?: item => any, formato?: valor => texto, largura?, badge?: valor => classes }]
  colunas: { type: Array, required: true },
  // [{ chave, titulo, valor?: item => string }]
  facetas: { type: Array, default: () => [] },
  titulo: { type: String, default: 'Itens' },
  ordemInicial: { type: Object, default: () => ({ chave: null, direcao: 'desc' }) },
  passo: { type: Number, default: 50 }
})

const colunasTabela = computed(() => {
  const chaves = new Set(props.colunas.map(c => c.chave))
  const facetas = new Map(props.facetas.map(f => [f.chave, f]))
  return [
    ...props.colunas.map(c => (facetas.has(c.chave) ? { ...c, rapido: true } : c)),
    ...props.facetas.filter(f => !chaves.has(f.chave)).map(f => ({ ...f, tipo: 'categoria', rapido: true, oculta: true }))
  ]
})
const id = computed(() => `lista-${props.titulo.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').slice(0, 50)}`)
const ordem = computed(() => (props.ordemInicial?.chave ? props.ordemInicial : null))
</script>

<template>
  <UiTabela :id="id" :itens="itens" :colunas="colunasTabela" :titulo="titulo" :ordem-inicial="ordem" :tamanho-pagina="passo >= 50 ? 50 : 25" altura="max-h-[55vh]" />
</template>
