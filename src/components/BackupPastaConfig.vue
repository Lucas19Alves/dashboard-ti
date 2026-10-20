<script setup>
import { desativarPasta, escolherPasta, estadoPasta, permitirPasta, salvarNaPasta } from '../utils/backupPasta'

// Configuração do backup automático em pasta (card "Dados e backup" do Início).
const quando = d => (d ? d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'ainda não')
</script>

<template>
  <div class="space-y-2 rounded-xl border border-slate-200 p-3">
    <div class="flex items-center gap-2">
      <i class="fas fa-folder-open text-blue-600" aria-hidden="true"></i>
      <p class="text-xs font-bold text-slate-800">Backup automático em pasta</p>
      <span v-if="estadoPasta.configurada" class="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold" :class="estadoPasta.permissao === 'granted' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'">
        {{ estadoPasta.permissao === 'granted' ? 'Ativo' : 'Aguardando permissão' }}
      </span>
    </div>

    <p v-if="!estadoPasta.suportado" class="text-[11px] text-slate-500">
      Disponível no Chrome ou Edge no computador. Neste navegador, use o botão Exportar.
    </p>

    <template v-else-if="!estadoPasta.configurada">
      <p class="text-[11px] text-slate-500">Escolha uma pasta (ex.: OneDrive ou rede da empresa). O sistema grava o backup sozinho a cada mudança grande e uma vez por dia, sempre no mesmo arquivo (dashboard-ti-backup.json.gz), substituindo o anterior.</p>
      <button type="button" class="ui-btn-secondary w-full py-2 text-xs" @click="escolherPasta"><i class="fas fa-folder-plus"></i>Escolher pasta</button>
    </template>

    <template v-else>
      <p class="text-[11px] text-slate-600">Pasta: <b>{{ estadoPasta.nome }}</b> · último automático: {{ quando(estadoPasta.ultimoAutomatico) }}</p>
      <p v-if="estadoPasta.permissao !== 'granted'" class="text-[11px] text-amber-700">O navegador pede para confirmar o acesso à pasta a cada vez que é aberto.</p>
      <p v-if="estadoPasta.erro" class="text-[11px] text-red-700">{{ estadoPasta.erro }}</p>
      <div class="flex flex-wrap gap-2">
        <button v-if="estadoPasta.permissao !== 'granted'" type="button" class="ui-btn-primary py-1.5 text-xs" @click="permitirPasta"><i class="fas fa-unlock"></i>Permitir acesso</button>
        <button v-else type="button" class="ui-btn-secondary py-1.5 text-xs" :disabled="estadoPasta.salvando" @click="salvarNaPasta">
          <i :class="estadoPasta.salvando ? 'fas fa-spinner fa-spin' : 'fas fa-floppy-disk'"></i>Salvar agora
        </button>
        <button type="button" class="ui-btn-secondary py-1.5 text-xs" @click="escolherPasta"><i class="fas fa-folder-tree"></i>Trocar</button>
        <button type="button" class="rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100" @click="desativarPasta">Desativar</button>
      </div>
    </template>
  </div>
</template>
