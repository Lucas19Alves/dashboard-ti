<script setup>
import { computed, ref } from 'vue'
import { useAuditoriasStore } from '../stores/auditoriasStore'
import { useVencimentosStore } from '../stores/vencimentosStore'
import { estadoBackup, resumirAlteracoes } from '../utils/lembreteBackup'
import { descreverUltimoBackup, precisaLembrarBackup } from '../utils/saudeDados'
import { exportarBackupJson } from '../utils/backup'

// Aviso em todas as páginas: sem backup há um dia ou mais, ou com mudanças grandes desde o último.
const auditorias = useAuditoriasStore()
const vencimentos = useVencimentosStore()
const temDados = computed(() => (auditorias.auditorias?.length || 0) > 0 || (vencimentos.itens?.length || 0) > 0)
const mudancas = computed(() => estadoBackup.alteracoes.length)

// "Depois": esconde por 2 horas, mas volta na próxima mudança grande.
const CHAVE_ADIADO = 'dashboard_ti_backup_adiado'
const lerAdiado = () => {
  try { return JSON.parse(sessionStorage.getItem(CHAVE_ADIADO) || 'null') } catch { return null }
}
const adiado = ref(lerAdiado())
const adiar = () => {
  adiado.value = { ate: Date.now() + 2 * 3600000, mudancas: mudancas.value }
  try { sessionStorage.setItem(CHAVE_ADIADO, JSON.stringify(adiado.value)) } catch {}
}
const estaAdiado = computed(() => Boolean(adiado.value && adiado.value.ate > Date.now() && mudancas.value <= adiado.value.mudancas))

const visivel = computed(() => !estaAdiado.value && precisaLembrarBackup(estadoBackup.ultimo, temDados.value, new Date(), mudancas.value))
const titulo = computed(() => (mudancas.value
  ? `${mudancas.value} alteração(ões) sem backup: ${resumirAlteracoes(estadoBackup.alteracoes)}`
  : descreverUltimoBackup(estadoBackup.ultimo)))

const exportando = ref(false)
const fazerBackup = async () => {
  exportando.value = true
  try {
    await exportarBackupJson()
    auditorias.addToast('Backup exportado.', 'success')
  } catch (err) {
    auditorias.addToast('Erro ao exportar backup: ' + (err?.message || 'desconhecido'), 'error')
  } finally {
    exportando.value = false
  }
}
</script>

<template>
  <div v-if="visivel" class="ui-container pt-4 print:hidden">
    <div class="ui-fade-in flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 sm:flex-row sm:items-center" role="status" aria-live="polite">
      <span class="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700" aria-hidden="true">
        <i class="fas fa-shield-halved"></i>
      </span>
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-bold text-amber-900" :title="titulo">{{ titulo }}</p>
        <p class="text-xs text-amber-800">
          {{ mudancas ? descreverUltimoBackup(estadoBackup.ultimo) + '. ' : '' }}Os dados ficam apenas neste navegador: exporte um backup para não perder o histórico.
        </p>
      </div>
      <div class="flex shrink-0 gap-2">
        <button type="button" class="rounded-xl px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100" @click="adiar">Depois</button>
        <button type="button" class="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-3.5 py-2 text-sm font-bold text-white shadow-sm hover:bg-amber-600 disabled:opacity-60" :disabled="exportando" @click="fazerBackup">
          <i :class="exportando ? 'fas fa-spinner fa-spin' : 'fas fa-download'" aria-hidden="true"></i>Fazer backup agora
        </button>
      </div>
    </div>
  </div>
</template>
