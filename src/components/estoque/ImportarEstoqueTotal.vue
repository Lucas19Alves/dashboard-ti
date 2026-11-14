<script setup>
import { ref } from 'vue'
import { useAuditoriasStore } from '../../stores/auditoriasStore'
import { useEstoqueTotalStore } from '../../stores/estoqueTotalStore'
import UiButton from '../ui/UiButton.vue'
import UiModal from '../ui/UiModal.vue'

// Importação da planilha de estoque total (relatório de produtos com estoque do sistema).
const emit = defineEmits(['close', 'importado'])
const store = useEstoqueTotalStore()
const auditorias = useAuditoriasStore()

const arquivo = ref(null)
const carregando = ref(false)
const hoverDrop = ref(false)
const inputRef = ref(null)
const soltar = (e) => { e.preventDefault(); hoverDrop.value = false; arquivo.value = e.dataTransfer?.files?.[0] || arquivo.value }

const importar = async () => {
  carregando.value = true
  try {
    const { total, comEstoque, data, somenteHistorico } = await store.importar(arquivo.value)
    const dia = `${data.slice(8, 10)}/${data.slice(5, 7)}/${data.slice(0, 4)}`
    auditorias.addToast(somenteHistorico
      ? `Planilha de ${dia} é mais antiga que a atual: entrou só no histórico do estoque (${total.toLocaleString('pt-BR')} itens).`
      : `Estoque total de ${dia} importado: ${total.toLocaleString('pt-BR')} itens (${comEstoque.toLocaleString('pt-BR')} com estoque). Foto guardada no histórico.`, 'success')
    emit('importado')
    emit('close')
  } catch (e) {
    auditorias.addToast(`Erro ao importar: ${e?.message || 'desconhecido'}`, 'error')
  } finally {
    carregando.value = false
  }
}
</script>

<template>
  <UiModal title="Importar estoque total" subtitle="Relatório de produtos com estoque exportado do sistema (.xlsx ou .csv)" @close="emit('close')">
    <div class="space-y-4">
      <button
        type="button"
        class="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 p-8 text-center transition"
        :class="hoverDrop ? 'bg-blue-50' : 'hover:bg-slate-50'"
        @dragover.prevent="hoverDrop = true" @dragleave="hoverDrop = false" @drop="soltar" @click="inputRef?.click()"
      >
        <i class="fas fa-file-excel mb-3 text-4xl text-green-600"></i>
        <span class="font-medium text-slate-700">{{ arquivo ? `${arquivo.name} (${Math.ceil(arquivo.size / 1024)} KB)` : 'Solte o arquivo aqui ou clique para selecionar' }}</span>
      </button>
      <input ref="inputRef" type="file" accept=".xlsx,.csv" class="hidden" @change="arquivo = $event.target.files?.[0] || null" />
      <div class="space-y-1.5 text-xs leading-relaxed text-slate-500">
        <p>Precisa das colunas <b>Código</b>, <b>Nome</b> e <b>Estoque</b>. Dias sem venda, última venda e compra, classe, fornecedor e gerenciado são usados quando vierem.</p>
        <p>A planilha passa a ser a base da aba Estoque: só entram os itens dela, com o estoque e os dias sem venda dela. Local, leituras e validades vêm das auditorias e das validades já importadas. Uma nova importação substitui a anterior.</p>
        <p>Cada planilha também vira uma foto no <b>histórico do estoque</b>, na data da última venda registrada nela. Planilhas de dias anteriores podem ser importadas para montar o histórico: entram só nele, sem trocar a atual.</p>
      </div>
      <UiButton :disabled="!arquivo || carregando" @click="importar">
        <i :class="carregando ? 'fas fa-spinner fa-spin' : 'fas fa-file-import'"></i>{{ carregando ? 'Processando...' : 'Importar' }}
      </UiButton>
    </div>
  </UiModal>
</template>
