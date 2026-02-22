<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuditoriasStore } from '../stores/auditoriasStore'
import { useVencimentosStore } from '../stores/vencimentosStore'
import { exportarBackupJson, importarBackupJson } from '../utils/backup'

const auditoriasStore = useAuditoriasStore()
const vencStore = useVencimentosStore()

onMounted(() => {
  auditoriasStore.carregarAuditoriasPersistidas()
  vencStore.carregarVencimentosPersistidos()
})

const totalAuditorias = computed(() => Array.isArray(auditoriasStore.auditorias) ? auditoriasStore.auditorias.length : 0)
const auditoriasAbertas = computed(() => (Array.isArray(auditoriasStore.auditorias) ? auditoriasStore.auditorias.filter(a => a && a.status !== 'fechada').length : 0))
const auditoriasFechadas = computed(() => (Array.isArray(auditoriasStore.auditorias) ? auditoriasStore.auditorias.filter(a => a && a.status === 'fechada').length : 0))

const resumoVenc = computed(() => vencStore.analise || { total: 0, vencidos: 0, hoje: 0, ate3: 0 })

const totalCriticosPrazo = computed(() => resumoVenc.value.vencidos + resumoVenc.value.hoje + resumoVenc.value.ate3)

const statusValidades = computed(() => {
  const r = resumoVenc.value
  if (!r.total) {
    return {
      titulo: 'Sem dados de validades',
      descricao: 'Abra a tela de Vencimentos para carregar os dados mais recentes.',
      classe: 'bg-gray-100 text-gray-700'
    }
  }
  if (r.vencidos > 0) {
    return {
      titulo: 'Risco alto em validades',
      descricao: `${r.vencidos} itens já vencidos e ${r.hoje + r.ate3} muito próximos.`,
      classe: 'bg-red-50 text-red-800'
    }
  }
  if (r.hoje + r.ate3 > 0) {
    return {
      titulo: 'Atenção aos próximos dias',
      descricao: `${r.hoje + r.ate3} itens vencendo hoje ou em até 3 dias.`,
      classe: 'bg-yellow-50 text-yellow-800'
    }
  }
  return {
    titulo: 'Validades sob controle',
    descricao: 'Nenhum item crítico nos próximos dias.',
    classe: 'bg-green-50 text-green-800'
  }
})

const setoresCriticos = computed(() => {
  const mapa = vencStore.analise?.porSetor || {}
  const lista = Object.entries(mapa).map(([nome, v]) => ({
    nome,
    vencidos: v?.vencidos || 0,
    hoje: v?.hoje || 0,
    ate3: v?.ate3 || 0,
    total: v?.total || 0
  }))
  return lista
    .filter(s => s.vencidos || s.hoje || s.ate3)
    .sort((a, b) => (b.vencidos - a.vencidos) || (b.hoje - a.hoje) || (b.ate3 - a.ate3))
    .slice(0, 5)
})

const itensCriticos = computed(() => {
  const lista = Array.isArray(vencStore.itens) ? vencStore.itens : []
  const rank = { vencidos: 0, hoje: 1, ate3: 2, futuro: 3 }
  return lista
    .filter(i => ['vencidos', 'hoje', 'ate3'].includes(i?._prazo))
    .sort((a, b) => {
      const ra = rank[a?._prazo] ?? 9
      const rb = rank[b?._prazo] ?? 9
      if (ra !== rb) return ra - rb
      const da = a?._diasParaVencer ?? 9999
      const db = b?._diasParaVencer ?? 9999
      return da - db
    })
    .slice(0, 6)
})

const importarInput = ref(null)

const dispararImportarBackup = () => {
  importarInput.value?.click()
}

const handleArquivoBackup = async (e) => {
  const arquivo = e.target.files?.[0]
  if (!arquivo) return
  try {
    await importarBackupJson(arquivo)
    await auditoriasStore.carregarAuditoriasPersistidas()
    await vencStore.carregarVencimentosPersistidos()
    auditoriasStore.addToast('Backup importado com sucesso!', 'success')
  } catch (err) {
    auditoriasStore.addToast('Erro ao importar backup: ' + (err?.message || 'desconhecido'), 'error')
  } finally {
    e.target.value = ''
  }
}

const ultimasAuditorias = computed(() => {
  const arr = Array.isArray(auditoriasStore.auditorias) ? auditoriasStore.auditorias : []
  return arr.slice(-5).reverse()
})

const statusAuditorias = computed(() => {
  if (!totalAuditorias.value) {
    return {
      titulo: 'Nenhuma auditoria registrada',
      descricao: 'Inicie uma nova auditoria para começar a acompanhar o progresso.',
      classe: 'bg-gray-100 text-gray-700'
    }
  }
  if (auditoriasAbertas.value > 0) {
    return {
      titulo: 'Auditorias em andamento',
      descricao: `${auditoriasAbertas.value} auditoria(s) ainda abertas para acompanhamento.`,
      classe: 'bg-blue-50 text-blue-800'
    }
  }
  return {
    titulo: 'Todas as auditorias fechadas',
    descricao: 'Nenhuma auditoria aberta no momento.',
    classe: 'bg-green-50 text-green-800'
  }
})
</script>

<template>
  <div class="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-6 md:px-8 md:py-8">
    <div class="max-w-7xl mx-auto space-y-6">
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="h-12 w-12 rounded-xl bg-blue-600/10 flex items-center justify-center">
            <i class="fas fa-home text-2xl text-blue-600"></i>
          </div>
          <div>
            <h1 class="text-3xl md:text-4xl font-bold text-gray-900">Painel Operacional</h1>
            <p class="text-sm text-gray-500 mt-1">
              Visão rápida das validades e auditorias da loja.
            </p>
          </div>
        </div>
        <div class="flex flex-wrap gap-2 justify-start md:justify-end">
          <RouterLink
            to="/vencimentos"
            class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 shadow-sm"
          >
            <i class="fas fa-clock"></i>
            Ver detalhes de Validades
          </RouterLink>
          <RouterLink
            to="/auditorias"
            class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 shadow-sm"
          >
            <i class="fas fa-clipboard-check"></i>
            Ver Auditorias
          </RouterLink>
          <button
            type="button"
            class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 shadow-sm"
            @click="exportarBackupJson"
          >
            <i class="fas fa-download"></i>
            Exportar backup
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 text-white text-sm font-medium hover:bg-slate-800 shadow-sm"
            @click="dispararImportarBackup"
          >
            <i class="fas fa-upload"></i>
            Importar backup
          </button>
          <input
            ref="importarInput"
            type="file"
            accept="application/json"
            class="hidden"
            @change="handleArquivoBackup"
          >
        </div>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col justify-between">
          <div class="flex items-center justify-between gap-2">
            <p class="text-[11px] font-medium text-slate-600 uppercase tracking-wide">Itens críticos</p>
            <span class="inline-flex items-center justify-center h-7 w-7 rounded-full bg-red-50 text-red-600">
              <i class="fas fa-bolt text-xs"></i>
            </span>
          </div>
          <p class="mt-2 text-2xl md:text-3xl font-bold" :class="totalCriticosPrazo > 0 ? 'text-red-700' : 'text-slate-700'">
            {{ totalCriticosPrazo }}
          </p>
          <p class="mt-1 text-[11px] text-slate-500">
            Vencidos, hoje ou até 3 dias.
          </p>
        </div>
        <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col justify-between">
          <div class="flex items-center justify-between gap-2">
            <p class="text-[11px] font-medium text-slate-600 uppercase tracking-wide">Itens monitorados</p>
            <span class="inline-flex items-center justify-center h-7 w-7 rounded-full bg-green-50 text-green-600">
              <i class="fas fa-box-open text-xs"></i>
            </span>
          </div>
          <p class="mt-2 text-2xl md:text-3xl font-bold text-green-700">
            {{ resumoVenc.total }}
          </p>
          <p class="mt-1 text-[11px] text-slate-500">
            Itens com validade acompanhada.
          </p>
        </div>
        <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col justify-between">
          <div class="flex items-center justify-between gap-2">
            <p class="text-[11px] font-medium text-slate-600 uppercase tracking-wide">Auditorias abertas</p>
            <span class="inline-flex items-center justify-center h-7 w-7 rounded-full bg-blue-50 text-blue-600">
              <i class="fas fa-clipboard-list text-xs"></i>
            </span>
          </div>
          <p class="mt-2 text-2xl md:text-3xl font-bold text-blue-700">
            {{ auditoriasAbertas }}
          </p>
          <p class="mt-1 text-[11px] text-slate-500">
            Pendentes de conclusão.
          </p>
        </div>
        <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col justify-between">
          <div class="flex items-center justify-between gap-2">
            <p class="text-[11px] font-medium text-slate-600 uppercase tracking-wide">Auditorias totais</p>
            <span class="inline-flex items-center justify-center h-7 w-7 rounded-full bg-indigo-50 text-indigo-600">
              <i class="fas fa-history text-xs"></i>
            </span>
          </div>
          <p class="mt-2 text-2xl md:text-3xl font-bold text-indigo-700">
            {{ totalAuditorias }}
          </p>
          <p class="mt-1 text-[11px] text-slate-500">
            Histórico registrado no sistema.
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section class="xl:col-span-2 space-y-6">
          <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 p-5 md:p-6 space-y-4">
            <div class="flex items-center justify-between gap-2">
              <div>
                <h2 class="text-lg md:text-xl font-bold text-gray-900">Saúde das validades</h2>
                <p class="text-xs md:text-sm text-gray-500">Resumo dos itens monitorados por prazo de vencimento.</p>
              </div>
              <div
                class="hidden md:flex items-center px-3 py-1 rounded-full text-xs font-medium"
                :class="statusValidades.classe"
              >
                <span class="truncate">{{ statusValidades.titulo }}</span>
              </div>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div class="bg-red-50 border border-red-100 rounded-xl p-4 flex flex-col justify-between">
                <div class="flex items-center justify-between">
                  <p class="text-xs font-medium text-red-800">Vencidos</p>
                  <span class="inline-flex items-center justify-center h-7 w-7 rounded-full bg-red-100 text-red-700">
                    <i class="fas fa-exclamation-triangle text-xs"></i>
                  </span>
                </div>
                <p class="mt-2 text-2xl md:text-3xl font-bold text-red-700">{{ resumoVenc.vencidos }}</p>
                <p class="mt-1 text-[11px] text-red-600">Requer ação imediata na gôndola.</p>
              </div>
              <div class="bg-orange-50 border border-orange-100 rounded-xl p-4 flex flex-col justify-between">
                <div class="flex items-center justify-between">
                  <p class="text-xs font-medium text-orange-800">Vencem hoje</p>
                  <span class="inline-flex items-center justify-center h-7 w-7 rounded-full bg-orange-100 text-orange-700">
                    <i class="fas fa-sun text-xs"></i>
                  </span>
                </div>
                <p class="mt-2 text-2xl md:text-3xl font-bold text-orange-600">{{ resumoVenc.hoje }}</p>
                <p class="mt-1 text-[11px] text-orange-600">Organizar quebras e ações promocionais.</p>
              </div>
              <div class="bg-yellow-50 border border-yellow-100 rounded-xl p-4 flex flex-col justify-between">
                <div class="flex items-center justify-between">
                  <p class="text-xs font-medium text-yellow-800">Até 3 dias</p>
                  <span class="inline-flex items-center justify-center h-7 w-7 rounded-full bg-yellow-100 text-yellow-700">
                    <i class="fas fa-hourglass-half text-xs"></i>
                  </span>
                </div>
                <p class="mt-2 text-2xl md:text-3xl font-bold text-yellow-700">{{ resumoVenc.ate3 }}</p>
                <p class="mt-1 text-[11px] text-yellow-700">Planejar giro e remarcações.</p>
              </div>
              <div class="bg-green-50 border border-green-100 rounded-xl p-4 flex flex-col justify-between">
                <div class="flex items-center justify-between">
                  <p class="text-xs font-medium text-green-800">Itens monitorados</p>
                  <span class="inline-flex items-center justify-center h-7 w-7 rounded-full bg-green-100 text-green-700">
                    <i class="fas fa-boxes text-xs"></i>
                  </span>
                </div>
                <p class="mt-2 text-2xl md:text-3xl font-bold text-green-700">{{ resumoVenc.total }}</p>
                <p class="mt-1 text-[11px] text-green-700">
                  {{ totalCriticosPrazo }} em situação crítica ou de atenção.
                </p>
              </div>
            </div>

            <div
              class="md:hidden mt-2 px-3 py-2 rounded-lg text-xs font-medium"
              :class="statusValidades.classe"
            >
              <div class="font-semibold">{{ statusValidades.titulo }}</div>
              <div class="mt-0.5 text-[11px] text-inherit/90">{{ statusValidades.descricao }}</div>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 flex flex-col">
              <div class="p-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 class="font-semibold text-gray-900 text-sm md:text-base">Setores mais críticos</h3>
                  <p class="text-[11px] text-gray-500">Top setores com maior concentração de itens vencidos.</p>
                </div>
                <RouterLink to="/vencimentos" class="text-xs text-blue-600 hover:underline font-medium">
                  Ver todos
                </RouterLink>
              </div>
              <div class="p-4 flex-1">
                <div v-if="setoresCriticos.length === 0" class="text-sm text-gray-500">
                  Sem dados de setores críticos.
                </div>
                <div v-else class="space-y-3">
                  <div
                    v-for="s in setoresCriticos"
                    :key="s.nome"
                    class="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2.5 hover:bg-slate-50 transition"
                  >
                    <div class="min-w-0">
                      <p class="text-sm font-medium text-gray-900 truncate">{{ s.nome }}</p>
                      <p class="text-[11px] text-gray-500">
                        {{ s.total }} itens monitorados
                      </p>
                    </div>
                    <div class="flex items-center gap-3">
                      <div class="text-right text-xs">
                        <div class="text-red-700 font-semibold">Vencidos: {{ s.vencidos }}</div>
                        <div class="text-orange-700">Hoje: {{ s.hoje }}</div>
                        <div class="text-yellow-700">Até 3: {{ s.ate3 }}</div>
                      </div>
                      <div class="w-20 h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          class="h-full bg-gradient-to-r from-red-500 via-orange-500 to-yellow-400"
                          :style="{ width: Math.min(100, ((s.vencidos + s.hoje + s.ate3) / (s.total || 1)) * 100) + '%' }"
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 flex flex-col">
              <div class="p-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 class="font-semibold text-gray-900 text-sm md:text-base">Itens mais críticos</h3>
                  <p class="text-[11px] text-gray-500">Itens com menor prazo de validade.</p>
                </div>
                <RouterLink to="/vencimentos" class="text-xs text-blue-600 hover:underline font-medium">
                  Ver todos
                </RouterLink>
              </div>
              <div class="p-4 flex-1">
                <div v-if="itensCriticos.length === 0" class="text-sm text-gray-500">
                  Sem itens críticos no momento.
                </div>
                <div v-else class="space-y-2">
                  <div
                    v-for="i in itensCriticos"
                    :key="i._codigo + '-' + i._validadeISO"
                    class="flex items-start justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2 hover:bg-slate-50 transition"
                  >
                    <div class="min-w-0">
                      <div class="flex items-center gap-2">
                        <p class="text-xs font-semibold text-gray-900">{{ i._codigo || '-' }}</p>
                        <span
                          class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border"
                          :class="{
                            'border-red-200 bg-red-50 text-red-700': i._prazo === 'vencidos',
                            'border-orange-200 bg-orange-50 text-orange-700': i._prazo === 'hoje',
                            'border-yellow-200 bg-yellow-50 text-yellow-700': i._prazo === 'ate3'
                          }"
                        >
                          {{ i._prazo === 'vencidos' ? 'Vencido' : i._prazo === 'hoje' ? 'Hoje' : 'Até 3 dias' }}
                        </span>
                      </div>
                      <p class="text-xs text-gray-700 truncate max-w-xs mt-0.5">
                        {{ i._produto || i['Produto'] || '-' }}
                      </p>
                      <p class="text-[11px] text-gray-500 mt-0.5">
                        {{ i._setor || '-' }}
                      </p>
                    </div>
                    <div class="text-right text-xs whitespace-nowrap">
                      <div class="text-gray-500">Validade</div>
                      <div class="font-semibold text-gray-800">{{ i._validadeISO || '-' }}</div>
                      <div
                        class="mt-1 font-semibold"
                        :class="{
                          'text-red-700': i._prazo === 'vencidos',
                          'text-orange-700': i._prazo === 'hoje',
                          'text-yellow-700': i._prazo === 'ate3'
                        }"
                      >
                        {{ i._diasParaVencer }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="space-y-6">
          <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 p-5 md:p-6 space-y-4">
            <div class="flex items-center justify-between gap-2">
              <div>
                <h2 class="text-lg md:text-xl font-bold text-gray-900">Status das auditorias</h2>
                <p class="text-xs md:text-sm text-gray-500">Acompanhamento rápido das auditorias abertas e fechadas.</p>
              </div>
            </div>

            <div
              class="px-3 py-2 rounded-lg text-xs md:text-sm font-medium"
              :class="statusAuditorias.classe"
            >
              <div>{{ statusAuditorias.titulo }}</div>
              <div class="text-[11px] md:text-xs mt-0.5 text-inherit/90">
                {{ statusAuditorias.descricao }}
              </div>
            </div>

            <div class="grid grid-cols-3 gap-3">
              <div class="bg-blue-50 border border-blue-100 rounded-xl p-3">
                <p class="text-[11px] text-blue-800">Abertas</p>
                <p class="mt-1 text-2xl font-bold text-blue-700">{{ auditoriasAbertas }}</p>
              </div>
              <div class="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <p class="text-[11px] text-slate-800">Fechadas</p>
                <p class="mt-1 text-2xl font-bold text-slate-800">{{ auditoriasFechadas }}</p>
              </div>
              <div class="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                <p class="text-[11px] text-indigo-800">Total</p>
                <p class="mt-1 text-2xl font-bold text-indigo-700">{{ totalAuditorias }}</p>
              </div>
            </div>

            <div class="flex flex-col gap-2 text-xs text-gray-500">
              <div class="flex items-center gap-2">
                <span class="h-2 w-2 rounded-full bg-blue-500"></span>
                <span>Foque nas auditorias abertas para manter o indicador dentro da meta.</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="h-2 w-2 rounded-full bg-slate-400"></span>
                <span>Use as auditorias fechadas como histórico para acompanhar evolução.</span>
              </div>
            </div>
          </div>

          <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 flex flex-col">
            <div class="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 class="font-semibold text-gray-900 text-sm md:text-base">Últimas auditorias</h3>
                <p class="text-[11px] text-gray-500">Histórico recente para entrar rápido nos detalhes.</p>
              </div>
              <RouterLink to="/auditorias" class="text-xs text-blue-600 hover:underline font-medium">
                Ver todas
              </RouterLink>
            </div>
            <div class="p-4">
              <div v-if="ultimasAuditorias.length === 0" class="text-sm text-gray-500">
                Sem auditorias registradas.
              </div>
              <div v-else class="space-y-2">
                <div
                  v-for="a in ultimasAuditorias"
                  :key="a.id"
                  class="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2 hover:bg-slate-50 transition"
                >
                  <div class="min-w-0">
                    <p class="text-xs font-semibold text-gray-900 truncate">
                      {{ a.id }}
                    </p>
                    <p class="text-[11px] text-gray-500 mt-0.5">
                      {{ a.tipo || '-' }}
                    </p>
                  </div>
                  <div class="flex items-center gap-3">
                    <span
                      class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border"
                      :class="{
                        'border-green-200 bg-green-50 text-green-700': a.status === 'fechada',
                        'border-blue-200 bg-blue-50 text-blue-700': a.status !== 'fechada'
                      }"
                    >
                      {{ a.status || '-' }}
                    </span>
                    <RouterLink
                      :to="'/auditoria/' + a.id"
                      class="inline-flex items-center px-2.5 py-1 text-[11px] rounded-md bg-blue-600 text-white hover:bg-blue-700 font-medium"
                    >
                      Abrir
                    </RouterLink>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 p-5 md:p-6 space-y-3">
            <h3 class="font-semibold text-gray-900 text-sm md:text-base">Atalhos rápidos</h3>
            <div class="grid grid-cols-2 gap-3 text-xs">
              <RouterLink
                to="/vencimentos"
                class="flex flex-col items-start gap-1 rounded-xl border border-orange-100 bg-orange-50 px-3 py-2.5 hover:bg-orange-100 transition"
              >
                <span class="inline-flex items-center justify-center h-6 w-6 rounded-full bg-orange-200 text-orange-700">
                  <i class="fas fa-list-ul text-[11px]"></i>
                </span>
                <span class="font-semibold text-orange-900">Painel de validades</span>
                <span class="text-[11px] text-orange-700">Ver todos os itens e aplicar filtros.</span>
              </RouterLink>
              <RouterLink
                to="/auditorias"
                class="flex flex-col items-start gap-1 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 hover:bg-blue-100 transition"
              >
                <span class="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-200 text-blue-700">
                  <i class="fas fa-search text-[11px]"></i>
                </span>
                <span class="font-semibold text-blue-900">Lista de auditorias</span>
                <span class="text-[11px] text-blue-700">Gerir auditorias em andamento e encerradas.</span>
              </RouterLink>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
