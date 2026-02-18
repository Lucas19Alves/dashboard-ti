<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuditoriasStore } from '../stores/auditoriasStore'
import { useVencimentosStore } from '../stores/vencimentosStore'

const auditoriasStore = useAuditoriasStore()
const vencStore = useVencimentosStore()

const totalAuditorias = computed(() => Array.isArray(auditoriasStore.auditorias) ? auditoriasStore.auditorias.length : 0)
const auditoriasAbertas = computed(() => (Array.isArray(auditoriasStore.auditorias) ? auditoriasStore.auditorias.filter(a => a && a.status !== 'fechada').length : 0))
const auditoriasFechadas = computed(() => (Array.isArray(auditoriasStore.auditorias) ? auditoriasStore.auditorias.filter(a => a && a.status === 'fechada').length : 0))

const resumoVenc = computed(() => vencStore.analise || { total: 0, vencidos: 0, hoje: 0, ate3: 0 })
const setoresCriticos = computed(() => {
  const mapa = vencStore.analise?.porSetor || {}
  const lista = Object.entries(mapa).map(([nome, v]) => ({
    nome,
    vencidos: v?.vencidos || 0,
    hoje: v?.hoje || 0,
    ate3: v?.ate3 || 0,
    total: v?.total || 0
  }))
  return lista.sort((a, b) => (b.vencidos - a.vencidos) || (b.hoje - a.hoje) || (b.ate3 - a.ate3)).slice(0, 6)
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
    .slice(0, 8)
})

const ultimasAuditorias = computed(() => {
  const arr = Array.isArray(auditoriasStore.auditorias) ? auditoriasStore.auditorias : []
  return arr.slice(-6).reverse()
})
</script>

<template>
  <div class="p-8 space-y-6">
    <div class="flex items-center gap-3">
      <i class="fas fa-home text-3xl text-blue-600"></i>
      <h1 class="text-4xl font-bold text-gray-800">Início</h1>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <section class="space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-2xl font-bold text-gray-800">Validades</h2>
          <RouterLink to="/vencimentos" class="px-3 py-2 rounded bg-orange-600 text-white hover:bg-orange-700 text-sm transition">
            Abrir Vencimentos
          </RouterLink>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div class="bg-white rounded-lg shadow p-4 border-l-4 border-red-600">
            <p class="text-xs text-gray-500">Vencidos</p>
            <p class="text-2xl font-bold text-red-700">{{ resumoVenc.vencidos }}</p>
          </div>
          <div class="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
            <p class="text-xs text-gray-500">Hoje</p>
            <p class="text-2xl font-bold text-orange-600">{{ resumoVenc.hoje }}</p>
          </div>
          <div class="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
            <p class="text-xs text-gray-500">Até 3 dias</p>
            <p class="text-2xl font-bold text-yellow-600">{{ resumoVenc.ate3 }}</p>
          </div>
          <div class="bg-white rounded-lg shadow p-4 border-l-4 border-green-600">
            <p class="text-xs text-gray-500">Itens monitorados</p>
            <p class="text-2xl font-bold text-green-700">{{ resumoVenc.total }}</p>
          </div>
        </div>

        <div class="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
          <div class="p-4 border-b bg-gray-50 flex items-center justify-between">
            <h3 class="font-bold text-gray-800">Setores críticos</h3>
            <RouterLink to="/vencimentos" class="text-sm text-blue-600 hover:underline">Ver todos</RouterLink>
          </div>
          <div class="p-4">
            <div v-if="setoresCriticos.length === 0" class="text-sm text-gray-500">Sem dados</div>
            <div v-else class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="bg-blue-600 text-white">
                  <tr>
                    <th class="px-3 py-2 text-left">Setor</th>
                    <th class="px-3 py-2 text-right">Vencidos</th>
                    <th class="px-3 py-2 text-right">Hoje</th>
                    <th class="px-3 py-2 text-right">Até 3</th>
                    <th class="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody class="divide-y">
                  <tr v-for="s in setoresCriticos" :key="s.nome" class="hover:bg-gray-50">
                    <td class="px-3 py-2 font-medium text-gray-800">{{ s.nome }}</td>
                    <td class="px-3 py-2 text-right text-red-700 font-semibold">{{ s.vencidos }}</td>
                    <td class="px-3 py-2 text-right text-orange-700 font-semibold">{{ s.hoje }}</td>
                    <td class="px-3 py-2 text-right text-yellow-700 font-semibold">{{ s.ate3 }}</td>
                    <td class="px-3 py-2 text-right text-gray-700">{{ s.total }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
          <div class="p-4 border-b bg-gray-50 flex items-center justify-between">
            <h3 class="font-bold text-gray-800">Itens críticos</h3>
            <RouterLink to="/vencimentos" class="text-sm text-blue-600 hover:underline">Ver todos</RouterLink>
          </div>
          <div class="p-4">
            <div v-if="itensCriticos.length === 0" class="text-sm text-gray-500">Sem itens críticos</div>
            <div v-else class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="bg-orange-600 text-white">
                  <tr>
                    <th class="px-3 py-2 text-left">Código</th>
                    <th class="px-3 py-2 text-left">Produto</th>
                    <th class="px-3 py-2 text-left">Setor</th>
                    <th class="px-3 py-2 text-right">Validade</th>
                    <th class="px-3 py-2 text-right">Dias</th>
                  </tr>
                </thead>
                <tbody class="divide-y">
                  <tr v-for="i in itensCriticos" :key="i._codigo + '-' + i._validadeISO" class="hover:bg-gray-50">
                    <td class="px-3 py-2 font-medium text-gray-800">{{ i._codigo || '-' }}</td>
                    <td class="px-3 py-2 text-gray-700 truncate max-w-[220px]">{{ i._produto || i['Produto'] || '-' }}</td>
                    <td class="px-3 py-2 text-gray-700">{{ i._setor || '-' }}</td>
                    <td class="px-3 py-2 text-right">{{ i._validadeISO || '-' }}</td>
                    <td class="px-3 py-2 text-right">
                      <span :class="{
                        'text-red-700 font-semibold': i._prazo === 'vencidos',
                        'text-orange-700 font-semibold': i._prazo === 'hoje',
                        'text-yellow-700 font-semibold': i._prazo === 'ate3'
                      }">
                        {{ i._diasParaVencer }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section class="space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-2xl font-bold text-gray-800">Auditorias</h2>
          <RouterLink to="/auditorias" class="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm transition">
            Abrir Auditorias
          </RouterLink>
        </div>

        <div class="grid grid-cols-3 gap-3">
          <div class="bg-white rounded-lg shadow p-4 border-l-4 border-blue-600">
            <p class="text-xs text-gray-500">Abertas</p>
            <p class="text-2xl font-bold text-blue-700">{{ auditoriasAbertas }}</p>
          </div>
          <div class="bg-white rounded-lg shadow p-4 border-l-4 border-gray-500">
            <p class="text-xs text-gray-500">Fechadas</p>
            <p class="text-2xl font-bold text-gray-700">{{ auditoriasFechadas }}</p>
          </div>
          <div class="bg-white rounded-lg shadow p-4 border-l-4 border-indigo-600">
            <p class="text-xs text-gray-500">Total</p>
            <p class="text-2xl font-bold text-indigo-700">{{ totalAuditorias }}</p>
          </div>
        </div>

        <div class="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
          <div class="p-4 border-b bg-gray-50 flex items-center justify-between">
            <h3 class="font-bold text-gray-800">Últimas auditorias</h3>
            <RouterLink to="/auditorias" class="text-sm text-blue-600 hover:underline">Ver todas</RouterLink>
          </div>
          <div class="p-4">
            <div v-if="ultimasAuditorias.length === 0" class="text-sm text-gray-500">Sem auditorias</div>
            <div v-else class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="bg-blue-600 text-white">
                  <tr>
                    <th class="px-3 py-2 text-left">ID</th>
                    <th class="px-3 py-2 text-left">Tipo</th>
                    <th class="px-3 py-2 text-left">Status</th>
                    <th class="px-3 py-2 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody class="divide-y">
                  <tr v-for="a in ultimasAuditorias" :key="a.id" class="hover:bg-gray-50">
                    <td class="px-3 py-2 font-medium text-gray-800">{{ a.id }}</td>
                    <td class="px-3 py-2 text-gray-700">{{ a.tipo || '-' }}</td>
                    <td class="px-3 py-2 text-gray-700">{{ a.status || '-' }}</td>
                    <td class="px-3 py-2 text-right">
                      <RouterLink :to="'/auditoria/' + a.id" class="px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 text-xs transition">
                        Abrir
                      </RouterLink>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
