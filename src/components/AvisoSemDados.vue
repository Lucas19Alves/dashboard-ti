<script setup>
import { computed, ref } from 'vue'
import { useAuditoriasStore } from '../stores/auditoriasStore'
import { useVencimentosStore } from '../stores/vencimentosStore'
import { useNaoVinculadosStore } from '../stores/naoVinculadosStore'
import { useEstoqueTotalStore } from '../stores/estoqueTotalStore'
import { importarBackupJson } from '../utils/backup'

// Primeira abertura (nada salvo neste navegador): oferece importar um backup. Dispensável.
const auditorias = useAuditoriasStore()
const vencimentos = useVencimentosStore()
const CHAVE = 'dashboard_ti_aviso_sem_dados_dispensado'
const lerDispensado = () => { try { return localStorage.getItem(CHAVE) === '1' } catch { return false } }
const dispensado = ref(lerDispensado())
const semDados = computed(() => !(auditorias.auditorias?.length) && !(vencimentos.itens?.length))
const visivel = computed(() => semDados.value && !dispensado.value)

const dispensar = () => {
  dispensado.value = true
  try { localStorage.setItem(CHAVE, '1') } catch {}
}

const entrada = ref(null)
const importando = ref(false)
const importar = async (e) => {
  const arquivo = e.target.files?.[0]
  if (!arquivo) return
  importando.value = true
  try {
    const resultado = await importarBackupJson(arquivo)
    await auditorias.carregarAuditoriasPersistidas()
    await vencimentos.carregarVencimentosPersistidos()
    await Promise.all([useNaoVinculadosStore().carregar(), useEstoqueTotalStore().carregar()])
    auditorias.addToast(resultado.origem === 'backup-regional'
      ? `Backup regional convertido: ${resultado.auditorias.length} auditorias importadas.`
      : 'Backup importado com sucesso!', 'success')
  } catch (err) {
    auditorias.addToast('Erro ao importar backup: ' + (err?.message || 'desconhecido'), 'error')
  } finally {
    importando.value = false
    e.target.value = ''
  }
}
</script>

<template>
  <transition name="aviso-dados">
    <div v-if="visivel" class="fixed bottom-4 right-4 z-50 w-[calc(100%-2rem)] max-w-sm rounded-xl bg-white p-4 shadow-xl ring-1 ring-slate-200 print:hidden" role="dialog" aria-labelledby="aviso-sem-dados-titulo">
      <div class="flex items-start gap-3">
        <i class="fas fa-box-archive shrink-0 text-slate-400" aria-hidden="true"></i>
        <div class="min-w-0 flex-1">
          <p id="aviso-sem-dados-titulo" class="text-sm font-bold text-slate-900">Nenhum dado neste navegador</p>
          <p class="mt-0.5 text-xs text-slate-600">Tem um backup do Dashboard Loja? Importe para recuperar auditorias, vencimentos e planos. Os dados ficam só neste computador.</p>
        </div>
        <button type="button" class="-mr-1 -mt-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Dispensar" @click="dispensar"><i class="fas fa-xmark"></i></button>
      </div>
      <div class="mt-3 flex justify-end gap-2">
        <button type="button" class="rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100" @click="dispensar">Começar do zero</button>
        <button type="button" class="ui-btn-primary py-2 text-xs" :disabled="importando" @click="entrada?.click()">
          <i :class="importando ? 'fas fa-spinner fa-spin' : 'fas fa-file-import'"></i>Importar backup
        </button>
      </div>
      <input ref="entrada" type="file" accept=".json,.gz,.json.gz,application/json,application/gzip" class="hidden" @change="importar">
    </div>
  </transition>
</template>

<style scoped>
.aviso-dados-enter-active, .aviso-dados-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.aviso-dados-enter-from, .aviso-dados-leave-to { opacity: 0; transform: translateY(8px); }
</style>
