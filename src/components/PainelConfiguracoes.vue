<script setup>
import { onMounted, ref } from 'vue'
import UiModal from './ui/UiModal.vue'
import UiButton from './ui/UiButton.vue'
import UiTabs from './ui/UiTabs.vue'
import BackupPastaConfig from './BackupPastaConfig.vue'
import { useAparencia } from '../composables/useAparencia'
import { CONFIG_PADRAO, useConfiguracoes } from '../composables/useConfiguracoes'
import { useAuditoriasStore } from '../stores/auditoriasStore'
import { exportarBackupJson } from '../utils/backup'
import { formatarBytes } from '../utils/saudeDados'

// Configurações do sistema: aparência, auditorias, relatórios e backup. Tudo salvo neste navegador.
const props = defineProps({ abaInicial: { type: String, default: 'aparencia' } })
const emit = defineEmits(['close'])
const { estado, restaurar } = useAparencia()
const { configuracoes, restaurarGrupo } = useConfiguracoes()
const store = useAuditoriasStore()

const ABAS = [
  { value: 'aparencia', label: 'Aparência', icon: 'fas fa-palette' },
  { value: 'auditorias', label: 'Auditorias', icon: 'fas fa-clipboard-check' },
  { value: 'relatorios', label: 'Relatórios', icon: 'fas fa-file-pdf' },
  { value: 'dados', label: 'Backup e dados', icon: 'fas fa-database' }
]
const aba = ref(props.abaInicial)
const restaurarAba = () => {
  if (aba.value === 'aparencia') restaurar()
  else restaurarGrupo({ auditorias: 'auditoria', relatorios: 'relatorio', dados: 'backup' }[aba.value])
}

const ORIENTACOES = [['paisagem', 'Paisagem', 'fas fa-image'], ['retrato', 'Retrato', 'fas fa-file'], ['auto', 'Automática', 'fas fa-list-check']]

// Escolhas lembradas de cada relatório (seções, colunas, assinatura).
const PREFIXO = 'dashboard_ti_relatorio_'
const contarLembradas = () => { try { return Object.keys(localStorage).filter(k => k.startsWith(PREFIXO)).length } catch { return 0 } }
const lembradas = ref(contarLembradas())
const limparLembradas = () => {
  try { Object.keys(localStorage).filter(k => k.startsWith(PREFIXO)).forEach(k => localStorage.removeItem(k)) } catch {}
  lembradas.value = contarLembradas()
  store.addToast('Escolhas dos relatórios apagadas.', 'success')
}

const armazenamento = ref(null)
onMounted(async () => {
  try { armazenamento.value = await navigator.storage?.estimate?.() } catch {}
})
const exportando = ref(false)
const exportar = async () => {
  exportando.value = true
  try {
    await exportarBackupJson()
    store.addToast('Backup exportado.', 'success')
  } catch (err) {
    store.addToast(`Não foi possível exportar: ${err?.message || err}`, 'error')
  } finally {
    exportando.value = false
  }
}

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
  <UiModal title="Configurações" subtitle="Salvas neste navegador e incluídas no backup" width="max-w-2xl" @close="emit('close')">
    <UiTabs v-model="aba" :items="ABAS" class="mb-5" />
    <div v-if="aba === 'aparencia'" class="space-y-6">
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

    <div v-else-if="aba === 'auditorias'" class="space-y-5">
      <fieldset>
        <legend class="ui-label">Horário das auditorias</legend>
        <div class="grid grid-cols-2 gap-3">
          <label class="block"><span class="text-xs text-slate-500">Início</span><input v-model="configuracoes.auditoria.inicio" type="time" class="ui-input"></label>
          <label class="block"><span class="text-xs text-slate-500">Fim</span><input v-model="configuracoes.auditoria.fim" type="time" class="ui-input"></label>
        </div>
        <p class="mt-1 text-[11px] text-slate-500">Usado na previsão de fechamento e na escala sugerida.</p>
      </fieldset>
      <fieldset>
        <legend class="ui-label">Meta de % pendente</legend>
        <div class="flex items-center gap-2">
          <input v-model.number="configuracoes.auditoria.meta" type="number" min="0.5" max="50" step="0.5" class="ui-input w-28">
          <span class="text-sm text-slate-600">% de itens pendentes por auditoria</span>
        </div>
        <p class="mt-1 text-[11px] text-slate-500">Padrão {{ CONFIG_PADRAO.auditoria.meta }}%. Define “dentro/fora da meta”, cores, plano de ação e reincidência. Vale para as telas abertas depois da mudança.</p>
      </fieldset>
    </div>

    <div v-else-if="aba === 'relatorios'" class="space-y-5">
      <fieldset>
        <legend class="ui-label">Orientação padrão da folha (A4)</legend>
        <div class="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Orientação padrão">
          <button v-for="[v, r, icone] in ORIENTACOES" :key="v" type="button" role="radio" :aria-checked="configuracoes.relatorio.orientacao === v"
            class="flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-sm font-semibold transition"
            :class="configuracoes.relatorio.orientacao === v ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-200' : 'border-slate-200 text-slate-600 hover:border-slate-300'"
            @click="configuracoes.relatorio.orientacao = v">
            <i :class="[icone, 'text-lg']" aria-hidden="true"></i>{{ r }}
          </button>
        </div>
        <p class="mt-1 text-[11px] text-slate-500">Pode ser trocada em cada relatório antes de gerar.</p>
      </fieldset>
      <fieldset>
        <legend class="ui-label">Identificação no cabeçalho</legend>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label class="block"><span class="text-xs text-slate-500">Empresa</span><input v-model.trim="configuracoes.relatorio.empresa" type="text" maxlength="60" class="ui-input" placeholder="Ex.: Rede Exemplo"></label>
          <label class="block"><span class="text-xs text-slate-500">Loja / unidade</span><input v-model.trim="configuracoes.relatorio.unidade" type="text" maxlength="60" class="ui-input" placeholder="Ex.: Loja 12 · Centro"></label>
          <label class="block sm:col-span-2"><span class="text-xs text-slate-500">Emitido por</span><input v-model.trim="configuracoes.relatorio.emissor" type="text" maxlength="60" class="ui-input" placeholder="Seu nome e função (opcional)"></label>
        </div>
      </fieldset>
      <fieldset>
        <legend class="ui-label">Campos de assinatura</legend>
        <input v-model="configuracoes.relatorio.assinaturas" type="text" maxlength="120" class="ui-input" placeholder="Responsável, Liderança, Data">
        <p class="mt-1 text-[11px] text-slate-500">Separados por vírgula (até 4). Relatórios com assinatura própria (ficha, escala) mantêm os seus.</p>
      </fieldset>
      <div class="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
        <div>
          <p class="text-sm font-semibold text-slate-800">Escolhas lembradas</p>
          <p class="text-xs text-slate-500">{{ lembradas }} relatório(s) com seções e colunas salvas.</p>
        </div>
        <UiButton variant="secondary" size="sm" :disabled="!lembradas" @click="limparLembradas">Apagar</UiButton>
      </div>
    </div>

    <div v-else class="space-y-5">
      <label class="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 hover:border-slate-300">
        <input v-model="configuracoes.backup.lembrete" type="checkbox" class="mt-0.5 size-4 accent-blue-600">
        <span class="flex-1">
          <span class="block text-sm font-semibold text-slate-800">Aviso de backup</span>
          <span class="block text-xs text-slate-500">Lembra de exportar após mudanças grandes ou depois de alguns dias sem backup. Não aparece com o backup automático ativo.</span>
          <span v-if="configuracoes.backup.lembrete" class="mt-2 flex items-center gap-2 text-xs text-slate-600">
            Lembrar a cada
            <select v-model.number="configuracoes.backup.dias" class="ui-input w-auto py-1 text-xs" @click.stop>
              <option v-for="d in [1, 2, 3, 7]" :key="d" :value="d">{{ d }} dia{{ d > 1 ? 's' : '' }}</option>
            </select>
            sem backup
          </span>
        </span>
      </label>
      <BackupPastaConfig />
      <div class="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
        <div>
          <p class="text-sm font-semibold text-slate-800">Backup manual</p>
          <p class="text-xs text-slate-500">Baixa um arquivo com auditorias, vencimentos, planos, mapa da loja e todas estas configurações.</p>
        </div>
        <UiButton variant="secondary" size="sm" :disabled="exportando" @click="exportar"><i class="fas fa-download"></i>Exportar</UiButton>
      </div>
      <p v-if="armazenamento?.usage" class="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <i class="fas fa-hard-drive mr-1" aria-hidden="true"></i>Espaço usado neste navegador: <b>{{ formatarBytes(armazenamento.usage) }}</b> de {{ formatarBytes(armazenamento.quota) }}. Os dados não saem deste computador.
      </p>
    </div>

    <template #footer>
      <UiButton variant="secondary" size="sm" @click="restaurarAba">Restaurar padrão desta aba</UiButton>
      <UiButton size="sm" @click="emit('close')">Concluir</UiButton>
    </template>
  </UiModal>
</template>
