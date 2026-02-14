<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuditoriasStore } from '../stores/auditoriasStore'
import UploadAnaliseAuditoria from '../components/UploadAnaliseAuditoria.vue'

const router = useRouter()
const route = useRoute()
const store = useAuditoriasStore()

const auditoria = computed(() => {
  return store.auditorias.find(a => a.id === parseInt(route.params.id))
})

const abaAtiva = ref('dashboard')
const filtroUsuario = ref('')
const filtroDados = ref('')
const filtroFornecedor = ref('')

const abas = ['Dashboard', 'Usuários', 'Dados', 'Estatísticas']

onMounted(() => {
  if (!auditoria.value) {
    router.push('/auditorias')
  }
})

const handleUploadCompleto = ({ dados, analise }) => {
  if (auditoria.value) {
    store.updateAuditoria(auditoria.value.id, {
      dados: dados,
      analise: analise,
      parcial: analise.parcialPercentual,
      total: analise.totalItens
    })
    store.addToast('Dados importados com sucesso!', 'success')
  }
}

// =========== DASHBOARD ===========
const metricasGerais = computed(() => {
  if (!auditoria.value?.analise) return null
  const a = auditoria.value.analise
  return {
    totalItens: a.totalItens,
    lidos: a.itensLidos,
    pendentes: a.itensPendentes,
    percentualConclusao: 100 - a.parcialPercentual,
    velocidadeLeitura: a.totalItens > 0 ? Math.round((a.itensLidos / a.totalItens) * 100) : 0,
    setoresParados: a.setoresParados?.length || 0,
    locaisCriticos: a.locaisSemLeitura?.length || 0
  }
})

const insights = computed(() => {
  if (!auditoria.value?.dados || !auditoria.value?.analise) return []
  
  const insights = []
  const a = auditoria.value.analise
  const dados = auditoria.value.dados

  // Insight 1: Setores críticos
  if (a.setoresParados?.length > 0) {
    insights.push({
      tipo: 'critico',
      titulo: '🚨 Setores Parados',
      mensagem: `${a.setoresParados.length} setor(es) sem nenhuma leitura`,
      detalhes: a.setoresParados
    })
  }

  // Insight 2: Progresso
  const percentual = 100 - a.parcialPercentual
  if (percentual > 75) {
    insights.push({
      tipo: 'sucesso',
      titulo: '🎯 Excelente Progresso!',
      mensagem: `${percentual}% de conclusão - Continue assim!`,
      detalhes: [`${a.itensLidos} de ${a.totalItens} itens lidos`]
    })
  } else if (percentual > 50) {
    insights.push({
      tipo: 'aviso',
      titulo: '⚡ Mais da metade completada',
      mensagem: `${percentual}% de conclusão`,
      detalhes: [`Ainda restam ${a.itensPendentes} itens`]
    })
  }

  // Insight 3: Usuário mais produtivo
  if (Object.keys(a.porUsuario).length > 0) {
    const usuarioTopProdutivo = Object.entries(a.porUsuario)
      .sort(([,a], [,b]) => b.lidos - a.lidos)[0]
    if (usuarioTopProdutivo) {
      insights.push({
        tipo: 'info',
        titulo: '⭐ Melhor Desempenho',
        mensagem: `${usuarioTopProdutivo[0]} leu ${usuarioTopProdutivo[1].lidos} itens`,
        detalhes: [``]
      })
    }
  }

  // Insight 4: Locais críticos
  if (a.locaisSemLeitura?.length > 0) {
    insights.push({
      tipo: 'aviso',
      titulo: '📍 Locais Sem Leitura',
      mensagem: `${a.locaisSemLeitura.length} local(is) ainda precisam de atenção`,
      detalhes: a.locaisSemLeitura.slice(0, 3)
    })
  }

  return insights
})

// =========== USUÁRIOS ===========
const usuariosOrdenados = computed(() => {
  if (!auditoria.value?.analise) return []
  const analise = auditoria.value.analise
  return analise.usuarios
    .filter(u => u.toLowerCase().includes(filtroUsuario.value.toLowerCase()))
    .map(u => ({
      nome: u,
      lidos: analise.porUsuario[u]?.lidos || 0,
      pendentes: analise.porUsuario[u]?.pendentes || 0,
      total: (analise.porUsuario[u]?.lidos || 0) + (analise.porUsuario[u]?.pendentes || 0),
      percentual: analise.porUsuario[u]?.lidos ? 
        Math.round((analise.porUsuario[u].lidos / ((analise.porUsuario[u].lidos || 0) + (analise.porUsuario[u].pendentes || 0))) * 100) 
        : 0,
      velocidade: 'Rápido'
    }))
    .sort((a, b) => b.lidos - a.lidos)
})

const analiseUsuarios = computed(() => {
  if (!auditoria.value?.analise) return null
  const usuarios = auditoria.value.analise.usuarios
  if (usuarios.length === 0) return null

  const totalLidos = usuarios.reduce((sum, u) => sum + (auditoria.value.analise.porUsuario[u]?.lidos || 0), 0)
  const mediaLidosPorUsuario = Math.round(totalLidos / usuarios.length)
  const usuarioMaisProdutivo = usuarios.sort((a, b) => 
    (auditoria.value.analise.porUsuario[b]?.lidos || 0) - (auditoria.value.analise.porUsuario[a]?.lidos || 0)
  )[0]

  return {
    totalUsuarios: usuarios.length,
    mediaLidasPorUsuario: mediaLidosPorUsuario,
    usuarioDestaque: usuarioMaisProdutivo,
    lidasDestaque: auditoria.value.analise.porUsuario[usuarioMaisProdutivo]?.lidos || 0
  }
})

// =========== DADOS ===========
const mapaSeteores = computed(() => {
  if (!auditoria.value?.dados || !auditoria.value?.analise) return {}
  
  const analise = auditoria.value.analise
  const setores = {}

  Object.entries(analise.porSetor).forEach(([setor, dados]) => {
    setores[setor] = {
      nome: setor,
      lidos: dados.lidos,
      pendentes: dados.pendentes,
      total: dados.lidos + dados.pendentes,
      percentualConclusao: dados.lidos + dados.pendentes > 0 ? 
        Math.round((dados.lidos / (dados.lidos + dados.pendentes)) * 100) : 0
    }
  })

  return setores
})

const itensVendidosOjeSemLeitura = computed(() => {
  if (!auditoria.value?.dados) return []
  const hoje = new Date().toISOString().split('T')[0]
  return auditoria.value.dados.filter(item => {
    const temPresenca = item['Presença confirmada'] && item['Presença confirmada'] !== ''
    const vendidoHoje = item['Dias sem venda'] === '0' || item['Dias sem venda'] === 0
    return vendidoHoje && !temPresenca
  }).length
})

const itensLidosEstoqueZero = computed(() => {
  if (!auditoria.value?.dados) return []
  return auditoria.value.dados.filter(item => {
    const temPresenca = item['Presença confirmada'] && item['Presença confirmada'] !== ''
    const estoqueZero = !item['Estoque atual'] || item['Estoque atual'] === '0' || item['Estoque atual'] === 0 || parseInt(item['Estoque atual']) <= 0
    return temPresenca && estoqueZero
  }).slice(0, 5)
})

const itensGrandeEstoqueNaoLidos = computed(() => {
  if (!auditoria.value?.dados) return []
  return auditoria.value.dados.filter(item => {
    const temPresenca = item['Presença confirmada'] && item['Presença confirmada'] !== ''
    const estoque = parseInt(item['Estoque atual']) || 0
    return !temPresenca && estoque > 100
  })
    .sort((a, b) => parseInt(b['Estoque atual']) - parseInt(a['Estoque atual']))
    .slice(0, 5)
})

const itensMuitoTempoNaoLidos = computed(() => {
  if (!auditoria.value?.dados) return []
  return auditoria.value.dados.filter(item => {
    const temPresenca = item['Presença confirmada'] && item['Presença confirmada'] !== ''
    const diasSemVenda = parseInt(item['Dias sem venda']) || 0
    return !temPresenca && diasSemVenda > 30
  })
    .sort((a, b) => parseInt(b['Dias sem venda']) - parseInt(a['Dias sem venda']))
    .slice(0, 5)
})

const itensRupturaMenorCusto = computed(() => {
  if (!auditoria.value?.dados) return []
  return auditoria.value.dados.filter(item => {
    const custo = parseFloat(item['Custo Ruptura']) || 0
    return custo > 0 && custo < 50
  })
    .sort((a, b) => parseFloat(a['Custo Ruptura']) - parseFloat(b['Custo Ruptura']))
    .slice(0, 5)
})

const fornecedoresUnicos = computed(() => {
  if (!auditoria.value?.dados) return []
  const fornecedores = new Set()
  auditoria.value.dados.forEach(item => {
    if (item['Fornecedor']) fornecedores.add(item['Fornecedor'])
  })
  return Array.from(fornecedores).sort()
})

const itensPorFornecedor = computed(() => {
  if (!auditoria.value?.dados || !filtroFornecedor.value) return []
  return auditoria.value.dados.filter(item => 
    item['Fornecedor'] === filtroFornecedor.value
  )
})

// =========== ESTATÍSTICAS ===========
const setoresComAnalise = computed(() => {
  if (!auditoria.value?.analise) return []
  const analise = auditoria.value.analise
  
  return Object.entries(analise.porSetor)
    .map(([setor, dados]) => ({
      nome: setor,
      lidos: dados.lidos,
      pendentes: dados.pendentes,
      total: dados.lidos + dados.pendentes,
      percentualPendente: dados.lidos + dados.pendentes > 0 ? 
        Math.round((dados.pendentes / (dados.lidos + dados.pendentes)) * 100) : 0,
      percentualLido: dados.lidos + dados.pendentes > 0 ? 
        Math.round((dados.lidos / (dados.lidos + dados.pendentes)) * 100) : 0
    }))
    .sort((a, b) => b.pendentes - a.pendentes)
})

const locaisComAnalise = computed(() => {
  if (!auditoria.value?.analise) return []
  const analise = auditoria.value.analise
  
  return Object.entries(analise.porLocal)
    .map(([local, dados]) => ({
      nome: local,
      lidos: dados.lidos,
      pendentes: dados.pendentes,
      total: dados.lidos + dados.pendentes,
      percentualPendente: dados.lidos + dados.pendentes > 0 ? 
        Math.round((dados.pendentes / (dados.lidos + dados.pendentes)) * 100) : 0
    }))
    .sort((a, b) => b.pendentes - a.pendentes)
})

const voltar = () => {
  router.push('/auditorias')
}

const iconeAba = (tab) => {
  const icones = {
    'Dashboard': 'fas fa-chart-line',
    'Usuários': 'fas fa-users-cog',
    'Dados': 'fas fa-database',
    'Estatísticas': 'fas fa-chart-bar'
  }
  return icones[tab]
}
</script>

<template>
  <div v-if="auditoria" class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
    <!-- Header -->
    <div class="bg-linear-to-r from-blue-600 to-blue-800 text-white p-6 shadow-lg">
      <div class="max-w-7xl mx-auto flex items-center justify-between">
        <div>
          <button @click="voltar" class="mb-3 flex items-center gap-2 hover:opacity-80 transition text-blue-100">
            <i class="fas fa-arrow-left"></i> Voltar
          </button>
          <h1 class="text-4xl font-bold">{{ auditoria.tipo }}</h1>
          <p class="text-blue-100 mt-2">
            <i class="fas fa-calendar mr-2"></i>{{ auditoria.data }} | 
            <i class="fas fa-boxes mr-2"></i>SKU: {{ auditoria.sku }} | 
            <i class="fas fa-tasks mr-2"></i>Total: {{ auditoria.analise?.totalItens || 0 }} itens
          </p>
        </div>
        <div class="text-right">
          <div class="text-5xl font-bold">{{ 100 - (auditoria.analise?.parcialPercentual || 0) }}%</div>
          <p class="text-blue-100">Conclusão</p>
        </div>
      </div>
    </div>

    <!-- Abas -->
    <div class="sticky top-0 z-10 bg-white border-b shadow-sm">
      <div class="max-w-7xl mx-auto flex gap-0">
        <button
          v-for="tab in abas"
          :key="tab"
          @click="abaAtiva = tab.toLowerCase()"
          :class="[
            'px-6 py-4 font-medium transition border-b-2',
            abaAtiva === tab.toLowerCase()
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-800'
          ]"
        >
          <i :class="iconeAba(tab)" class="mr-2"></i>{{ tab }}
        </button>
      </div>
    </div>

    <!-- Conteúdo -->
    <div class="max-w-7xl mx-auto p-6">
      <!-- DASHBOARD -->
      <div v-if="abaAtiva === 'dashboard'" class="space-y-8">
        <!-- Upload se não houver dados -->
        <div v-if="!auditoria.dados || auditoria.dados.length === 0" class="bg-blue-50 border-2 border-blue-300 rounded-lg p-12">
          <div class="text-center">
            <i class="fas fa-cloud-upload-alt text-6xl text-blue-500 mb-6"></i>
            <h3 class="text-2xl font-bold text-gray-800 mb-3">Nenhum dado carregado</h3>
            <p class="text-gray-600 mb-8 text-lg">Faça upload de um arquivo Excel para começar a análise</p>
            <UploadAnaliseAuditoria 
              :auditoria="auditoria"
              @analiseCompleta="handleUploadCompleto"
            />
          </div>
        </div>

        <!-- Métricas Gerais -->
        <template v-else>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="bg-white rounded-lg p-6 shadow border-l-4 border-blue-500">
              <p class="text-gray-600 text-sm font-medium">Total de Itens</p>
              <p class="text-4xl font-bold text-blue-600 mt-2">{{ metricasGerais?.totalItens }}</p>
              <p class="text-xs text-gray-500 mt-1">Auditoria completa</p>
            </div>
            <div class="bg-white rounded-lg p-6 shadow border-l-4 border-green-500">
              <p class="text-gray-600 text-sm font-medium">Itens Lidos</p>
              <p class="text-4xl font-bold text-green-600 mt-2">{{ metricasGerais?.lidos }}</p>
              <p class="text-xs text-gray-500 mt-1">{{ metricasGerais?.velocidadeLeitura }}% de conclusão</p>
            </div>
            <div class="bg-white rounded-lg p-6 shadow border-l-4 border-orange-500">
              <p class="text-gray-600 text-sm font-medium">Pendentes</p>
              <p class="text-4xl font-bold text-orange-600 mt-2">{{ metricasGerais?.pendentes }}</p>
              <p class="text-xs text-gray-500 mt-1">{{ metricasGerais?.pendentes > 0 ? '⚠️ Ação necessária' : '✅ Completo' }}</p>
            </div>
            <div class="bg-white rounded-lg p-6 shadow border-l-4 border-red-500">
              <p class="text-gray-600 text-sm font-medium">Alertas</p>
              <p class="text-4xl font-bold text-red-600 mt-2">{{ metricasGerais?.setoresParados + metricasGerais?.locaisCriticos }}</p>
              <p class="text-xs text-gray-500 mt-1">Setores + Locais parados</p>
            </div>
          </div>

          <!-- Progress Geral -->
          <div class="bg-white rounded-lg p-6 shadow">
            <h3 class="font-bold text-lg text-gray-800 mb-4">Progresso Geral da Auditoria</h3>
            <div class="space-y-3">
              <div class="flex justify-between text-sm">
                <span class="text-gray-700 font-medium">Conclusão</span>
                <span class="font-bold text-blue-600">{{ metricasGerais?.velocidadeLeitura }}%</span>
              </div>
              <div class="w-full h-6 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  :style="{ width: metricasGerais?.velocidadeLeitura + '%' }"
                  class="h-full bg-linear-to-r from-blue-500 to-blue-600 transition-all duration-500"
                />
              </div>
              <p class="text-xs text-gray-600 mt-2">
                {{ metricasGerais?.lidos }} de {{ metricasGerais?.totalItens }} itens lidos
              </p>
            </div>
          </div>

          <!-- Insights -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div 
              v-for="(insight, i) in insights"
              :key="i"
              :class="[
                'rounded-lg p-6 shadow transition hover:shadow-lg',
                insight.tipo === 'critico' ? 'bg-red-50 border-l-4 border-red-500' :
                insight.tipo === 'sucesso' ? 'bg-green-50 border-l-4 border-green-500' :
                insight.tipo === 'aviso' ? 'bg-yellow-50 border-l-4 border-yellow-500' :
                'bg-blue-50 border-l-4 border-blue-500'
              ]"
            >
              <h4 class="font-bold text-lg mb-2 text-gray-800">{{ insight.titulo }}</h4>
              <p class="text-gray-700 mb-3">{{ insight.mensagem }}</p>
              <div v-if="insight.detalhes && insight.detalhes.length > 0" class="space-y-1">
                <div v-for="detalhe in insight.detalhes" :key="detalhe" class="text-sm text-gray-600">
                  • {{ detalhe }}
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- USUÁRIOS -->
      <div v-if="abaAtiva === 'usuarios'" class="space-y-6">
        <!-- Análises Rápidas -->
        <div v-if="analiseUsuarios" class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-white rounded-lg p-6 shadow">
            <p class="text-gray-600 text-sm font-medium">Total de Usuários</p>
            <p class="text-3xl font-bold text-blue-600 mt-2">{{ analiseUsuarios.totalUsuarios }}</p>
          </div>
          <div class="bg-white rounded-lg p-6 shadow">
            <p class="text-gray-600 text-sm font-medium">Média de Lidos/Usuário</p>
            <p class="text-3xl font-bold text-green-600 mt-2">{{ analiseUsuarios.mediaLidasPorUsuario }}</p>
          </div>
          <div class="bg-white rounded-lg p-6 shadow border-l-4 border-purple-500">
            <p class="text-gray-600 text-sm font-medium">🌟 Melhor Desempenho</p>
            <p class="text-2xl font-bold text-purple-600 mt-2">{{ analiseUsuarios.usuarioDestaque }}</p>
            <p class="text-xs text-gray-500 mt-1">{{ analiseUsuarios.lidasDestaque }} lidos</p>
          </div>
        </div>

        <!-- Filtro -->
        <div>
          <input 
            v-model="filtroUsuario"
            type="text"
            placeholder="🔍 Filtrar por nome..."
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
          />
        </div>

        <!-- Tabela de Usuários Ordenada -->
        <div class="bg-white rounded-lg shadow overflow-hidden">
          <table class="w-full">
            <thead class="bg-gray-100 border-b">
              <tr>
                <th class="px-6 py-4 text-left font-semibold text-gray-700">Usuário</th>
                <th class="px-6 py-4 text-right font-semibold text-gray-700">Lidos</th>
                <th class="px-6 py-4 text-right font-semibold text-gray-700">Pendentes</th>
                <th class="px-6 py-4 text-right font-semibold text-gray-700">Total</th>
                <th class="px-6 py-4 text-right font-semibold text-gray-700">Percentual</th>
                <th class="px-6 py-4 text-center font-semibold text-gray-700">Performance</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr v-for="usuario in usuariosOrdenados" :key="usuario.nome" class="hover:bg-blue-50 transition">
                <td class="px-6 py-4 font-medium text-gray-800">{{ usuario.nome }}</td>
                <td class="px-6 py-4 text-right text-green-600 font-semibold">{{ usuario.lidos }}</td>
                <td class="px-6 py-4 text-right text-orange-600 font-semibold">{{ usuario.pendentes }}</td>
                <td class="px-6 py-4 text-right text-gray-600 font-semibold">{{ usuario.total }}</td>
                <td class="px-6 py-4 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <div class="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        :style="{ width: usuario.percentual + '%' }"
                        class="h-full bg-blue-500"
                      />
                    </div>
                    <span class="text-sm font-bold text-blue-600">{{ usuario.percentual }}%</span>
                  </div>
                </td>
                <td class="px-6 py-4 text-center">
                  <span v-if="usuario.percentual >= 80" class="text-lg">⭐⭐⭐</span>
                  <span v-else-if="usuario.percentual >= 60" class="text-lg">⭐⭐</span>
                  <span v-else class="text-lg">⭐</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- DADOS -->
      <div v-if="abaAtiva === 'dados'" class="space-y-8">
        <!-- Mapa de Setores e Corredores -->
        <div>
          <h2 class="text-2xl font-bold text-gray-800 mb-6">
            <i class="fas fa-map text-blue-600 mr-2"></i>Mapa de Setores e Corredores
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div 
              v-for="(setor, nome) in mapaSeteores"
              :key="nome"
              class="bg-white rounded-lg p-6 shadow hover:shadow-lg transition border-l-4"
              :class="setor.percentualConclusao >= 75 ? 'border-green-500' : setor.percentualConclusao >= 50 ? 'border-yellow-500' : 'border-red-500'"
            >
              <div class="flex items-start justify-between mb-4">
                <div>
                  <h3 class="font-bold text-lg text-gray-800">{{ setor.nome }}</h3>
                  <p class="text-sm text-gray-500">{{ setor.total }} itens total</p>
                </div>
                <span 
                  :class="[
                    'px-3 py-1 rounded-full text-xs font-bold',
                    setor.percentualConclusao >= 75 ? 'bg-green-100 text-green-800' :
                    setor.percentualConclusao >= 50 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  ]"
                >
                  {{ setor.percentualConclusao }}%
                </span>
              </div>
              <div class="space-y-2">
                <div class="flex justify-between text-sm">
                  <span class="text-green-600 font-medium">✓ {{ setor.lidos }} lidos</span>
                  <span class="text-orange-600 font-medium">⏳ {{ setor.pendentes }} pendentes</span>
                </div>
                <div class="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    :style="{ width: setor.percentualConclusao + '%' }"
                    class="h-full bg-linear-to-r from-blue-500 to-green-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Filtro de Fornecedor -->
        <div v-if="fornecedoresUnicos.length > 0">
          <h3 class="text-xl font-bold text-gray-800 mb-4">
            <i class="fas fa-truck text-blue-600 mr-2"></i>Filtrar por Fornecedor
          </h3>
          <select 
            v-model="filtroFornecedor"
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
          >
            <option value="">Selecione um fornecedor...</option>
            <option v-for="fornecedor in fornecedoresUnicos" :key="fornecedor" :value="fornecedor">
              {{ fornecedor }}
            </option>
          </select>

          <!-- Itens do Fornecedor Selecionado -->
          <div v-if="filtroFornecedor && itensPorFornecedor.length > 0" class="mt-6 bg-white rounded-lg shadow overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-gray-100 border-b">
                <tr>
                  <th class="px-4 py-3 text-left font-semibold text-gray-700">Produto</th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-700">Setor</th>
                  <th class="px-4 py-3 text-right font-semibold text-gray-700">Estoque</th>
                  <th class="px-4 py-3 text-center font-semibold text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody class="divide-y">
                <tr v-for="(item, i) in itensPorFornecedor" :key="i" class="hover:bg-blue-50">
                  <td class="px-4 py-3 text-gray-800">{{ item['Produto'] || '-' }}</td>
                  <td class="px-4 py-3 text-gray-600">{{ item['Setor'] || item['Classe de Produto Raiz'] || '-' }}</td>
                  <td class="px-4 py-3 text-right font-semibold">{{ item['Estoque atual'] || '0' }}</td>
                  <td class="px-4 py-3 text-center">
                    <span v-if="item['Presença confirmada']" class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">✓ Lido</span>
                    <span v-else class="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">⏳ Pendente</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Análises de Dados Críticos -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Itens Vendidos Hoje sem Leitura -->
          <div class="bg-white rounded-lg p-6 shadow">
            <h4 class="font-bold text-lg text-red-600 mb-4">
              <i class="fas fa-shopping-cart mr-2"></i>Vendidos Hoje - Sem Leitura
            </h4>
            <div v-if="itensVendidosOjeSemLeitura > 0" class="space-y-2">
              <p class="text-3xl font-bold text-red-600">{{ itensVendidosOjeSemLeitura }}</p>
              <p class="text-sm text-gray-600">⚠️ Produtos vendidos mas não foram lidos na auditoria</p>
            </div>
            <div v-else class="text-green-600">
              <p class="text-lg font-bold">✅ Nenhum item</p>
              <p class="text-sm">Todos os itens vendidos foram lidos</p>
            </div>
          </div>

          <!-- Itens Lidos com Estoque Zero -->
          <div class="bg-white rounded-lg p-6 shadow">
            <h4 class="font-bold text-lg text-orange-600 mb-4">
              <i class="fas fa-exclamation-triangle mr-2"></i>Lidos com Estoque Zero
            </h4>
            <p class="text-3xl font-bold text-orange-600 mb-3">{{ itensLidosEstoqueZero.length }}</p>
            <p class="text-sm text-gray-600 mb-4">Itens confirmados mas sem estoque</p>
            <div v-if="itensLidosEstoqueZero.length > 0" class="space-y-2">
              <div v-for="item in itensLidosEstoqueZero" :key="item['Código']" class="text-xs text-gray-700 bg-orange-50 p-2 rounded">
                {{ item['Produto'] }} - {{ item['Fornecedor'] }}
              </div>
            </div>
          </div>

          <!-- Grande Estoque não Lido -->
          <div class="bg-white rounded-lg p-6 shadow">
            <h4 class="font-bold text-lg text-yellow-600 mb-4">
              <i class="fas fa-boxes mr-2"></i>Grande Estoque Não Lido
            </h4>
            <p class="text-3xl font-bold text-yellow-600 mb-3">{{ itensGrandeEstoqueNaoLidos.length }}</p>
            <p class="text-sm text-gray-600 mb-4">Produtos com estoque > 100 itens não confirmados</p>
            <div v-if="itensGrandeEstoqueNaoLidos.length > 0" class="space-y-2">
              <div v-for="item in itensGrandeEstoqueNaoLidos" :key="item['Código']" class="text-xs text-gray-700 bg-yellow-50 p-2 rounded">
                <span class="font-bold">{{ item['Produto'] }}</span> - 
                <span class="text-yellow-700">{{ item['Estoque atual'] }} un</span>
              </div>
            </div>
          </div>

          <!-- Muito Tempo sem Leitura -->
          <div class="bg-white rounded-lg p-6 shadow">
            <h4 class="font-bold text-lg text-red-600 mb-4">
              <i class="fas fa-calendar-times mr-2"></i>Muito Tempo sem Leitura
            </h4>
            <p class="text-3xl font-bold text-red-600 mb-3">{{ itensMuitoTempoNaoLidos.length }}</p>
            <p class="text-sm text-gray-600 mb-4">Itens não confirmados há mais de 30 dias</p>
            <div v-if="itensMuitoTempoNaoLidos.length > 0" class="space-y-2">
              <div v-for="item in itensMuitoTempoNaoLidos" :key="item['Código']" class="text-xs text-gray-700 bg-red-50 p-2 rounded">
                <span class="font-bold">{{ item['Produto'] }}</span> - 
                <span class="text-red-700">{{ item['Dias sem venda'] }} dias</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Itens Ruptura Menor Custo -->
        <div class="bg-white rounded-lg p-6 shadow">
          <h4 class="font-bold text-lg text-blue-600 mb-4">
            <i class="fas fa-coins mr-2"></i>Itens de Ruptura - Menor Custo
          </h4>
          <div v-if="itensRupturaMenorCusto.length > 0" class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-blue-50 border-b">
                <tr>
                  <th class="px-4 py-2 text-left font-semibold text-gray-700">Produto</th>
                  <th class="px-4 py-2 text-right font-semibold text-gray-700">Custo</th>
                  <th class="px-4 py-2 text-left font-semibold text-gray-700">Fornecedor</th>
                </tr>
              </thead>
              <tbody class="divide-y">
                <tr v-for="item in itensRupturaMenorCusto" :key="item['Código']" class="hover:bg-blue-50">
                  <td class="px-4 py-2 text-gray-800">{{ item['Produto'] }}</td>
                  <td class="px-4 py-2 text-right font-semibold text-blue-600">R$ {{ parseFloat(item['Custo Ruptura']).toFixed(2) }}</td>
                  <td class="px-4 py-2 text-gray-600">{{ item['Fornecedor'] }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="text-gray-600">Nenhum item com custo de ruptura encontrado</div>
        </div>
      </div>

      <!-- ESTATÍSTICAS -->
      <div v-if="abaAtiva === 'estatisticas'" class="space-y-8">
        <!-- Setores com Análise -->
        <div>
          <h2 class="text-2xl font-bold text-gray-800 mb-6">
            <i class="fas fa-chart-pie text-blue-600 mr-2"></i>Parcial por Setor
          </h2>
          <div class="space-y-4">
            <div 
              v-for="setor in setoresComAnalise"
              :key="setor.nome"
              class="bg-white rounded-lg p-6 shadow hover:shadow-lg transition"
            >
              <div class="flex items-center justify-between mb-4">
                <div>
                  <h3 class="font-bold text-lg text-gray-800">{{ setor.nome }}</h3>
                  <p class="text-sm text-gray-600">Total: {{ setor.total }} itens</p>
                </div>
                <div class="text-right">
                  <p class="text-3xl font-bold text-orange-600">{{ setor.pendentes }}</p>
                  <p class="text-sm text-gray-600">não lidos</p>
                </div>
              </div>
              <div class="space-y-3">
                <div>
                  <div class="flex justify-between text-sm mb-2">
                    <span class="text-gray-700">Lidos</span>
                    <span class="font-bold text-green-600">{{ setor.percentualLido }}%</span>
                  </div>
                  <div class="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      :style="{ width: setor.percentualLido + '%' }"
                      class="h-full bg-green-500"
                    />
                  </div>
                </div>
                <div>
                  <div class="flex justify-between text-sm mb-2">
                    <span class="text-gray-700">Não Lidos</span>
                    <span class="font-bold text-orange-600">{{ setor.percentualPendente }}%</span>
                  </div>
                  <div class="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      :style="{ width: setor.percentualPendente + '%' }"
                      class="h-full bg-orange-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Locais com Mais Itens para Ler -->
        <div>
          <h2 class="text-2xl font-bold text-gray-800 mb-6">
            <i class="fas fa-map-marker-alt text-red-600 mr-2"></i>Locais com Mais Itens para Ler
          </h2>
          <div class="space-y-3">
            <div 
              v-for="(local, i) in locaisComAnalise"
              :key="local.nome"
              class="bg-white rounded-lg p-6 shadow flex items-center justify-between hover:shadow-lg transition"
            >
              <div class="flex items-center gap-4 flex-1">
                <div class="text-2xl font-bold text-gray-400 w-8 text-center">{{ i + 1 }}</div>
                <div class="flex-1">
                  <h4 class="font-bold text-gray-800">{{ local.nome }}</h4>
                  <p class="text-sm text-gray-600">
                    {{ local.lidos }} lidos · {{ local.pendentes }} pendentes
                  </p>
                </div>
              </div>
              <div class="text-right">
                <p class="text-2xl font-bold text-red-600">{{ local.pendentes }}</p>
                <p class="text-xs text-gray-600">{{ local.percentualPendente }}%</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
