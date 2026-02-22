<script setup>
import { computed, ref, reactive } from 'vue'
import { useAuditoriasStore } from '../stores/auditoriasStore'
import { printHtmlInNewWindow } from '../utils/print'

const store = useAuditoriasStore()

const filtroTipo = ref('todos')
const filtroStatus = ref('todos')
const filtroMeta = ref('todos')
const filtroPeriodoTipo = ref('rapido')
const filtroPeriodo = ref('12m')
const filtroDataInicio = ref('')
const filtroDataFim = ref('')

const auditoriasBase = computed(() => {
  return Array.isArray(store.auditorias) ? store.auditorias.filter(a => a) : []
})

const auditoriasFiltradas = computed(() => {
  const agora = new Date()
  const base = auditoriasBase.value
  let limiteRapido = null
  if (filtroPeriodoTipo.value === 'rapido') {
    if (filtroPeriodo.value === '3m') {
      const d = new Date(agora)
      d.setMonth(d.getMonth() - 3)
      limiteRapido = d
    } else if (filtroPeriodo.value === '6m') {
      const d = new Date(agora)
      d.setMonth(d.getMonth() - 6)
      limiteRapido = d
    } else if (filtroPeriodo.value === '12m') {
      const d = new Date(agora)
      d.setFullYear(d.getFullYear() - 1)
      limiteRapido = d
    }
  }

  return base.filter(a => {
    if (!a.data) return false
    const dataAud = new Date(a.data)
    if (Number.isNaN(dataAud.getTime())) return false
    if (filtroPeriodoTipo.value === 'rapido') {
      if (limiteRapido && dataAud < limiteRapido) return false
    } else {
      if (filtroDataInicio.value) {
        const ini = new Date(filtroDataInicio.value)
        if (!Number.isNaN(ini.getTime()) && dataAud < ini) return false
      }
      if (filtroDataFim.value) {
        const fim = new Date(filtroDataFim.value)
        if (!Number.isNaN(fim.getTime())) {
          const fimDia = new Date(fim)
          fimDia.setHours(23, 59, 59, 999)
          if (dataAud > fimDia) return false
        }
      }
    }
    if (filtroTipo.value !== 'todos' && a.tipo !== filtroTipo.value) return false
    if (filtroStatus.value === 'abertas' && a.status === 'fechada') return false
    if (filtroStatus.value === 'fechadas' && a.status !== 'fechada') return false
    if (filtroMeta.value === 'dentro' && !a.metaAlcancada) return false
    if (filtroMeta.value === 'fora' && a.metaAlcancada) return false
    return true
  })
})

const resumoGeral = computed(() => {
  const lista = auditoriasFiltradas.value
  const total = lista.length
  if (!total) {
    return {
      total,
      abertas: 0,
      fechadas: 0,
      dentroMeta: 0,
      foraMeta: 0,
      percDentroMeta: 0,
      percParcialMedia: 0,
      percConclusaoMedia: 0
    }
  }
  let abertas = 0
  let fechadas = 0
  let dentroMeta = 0
  let somaParcial = 0
  let somaConclusao = 0

  lista.forEach(a => {
    if (a.status === 'fechada') {
      fechadas++
    } else {
      abertas++
    }
    if (a.status === 'fechada' && a.metaAlcancada) dentroMeta++
    const analise = a.analise || {}
    const parcial = typeof analise.parcialPercentual === 'number'
      ? analise.parcialPercentual
      : (typeof a.parcial === 'number' ? a.parcial : 0)
    const conclusao = typeof analise.percentualConclusao === 'number' ? analise.percentualConclusao : 0
    somaParcial += Number.isFinite(parcial) ? parcial : 0
    somaConclusao += Number.isFinite(conclusao) ? conclusao : 0
  })

  const percDentroMeta = fechadas > 0 ? (dentroMeta / fechadas) * 100 : 0
  const percParcialMedia = somaParcial / total
  const percConclusaoMedia = somaConclusao / total

  return {
    total,
    abertas,
    fechadas,
    dentroMeta,
    foraMeta: fechadas - dentroMeta,
    percDentroMeta,
    percParcialMedia,
    percConclusaoMedia
  }
})

const agrupadoPorMesBase = computed(() => {
  const mapa = {}
  auditoriasFiltradas.value.forEach(a => {
    if (!a.data) return
    const d = new Date(a.data)
    if (Number.isNaN(d.getTime())) return
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!mapa[chave]) {
      mapa[chave] = {
        mes: chave,
        total: 0,
        fechadas: 0,
        dentroMeta: 0,
        somaParcial: 0,
        somaConclusao: 0
      }
    }
    const grupo = mapa[chave]
    grupo.total++
    if (a.status === 'fechada') {
      grupo.fechadas++
      if (a.metaAlcancada) grupo.dentroMeta++
    }
    const analise = a.analise || {}
    const parcial = typeof analise.parcialPercentual === 'number'
      ? analise.parcialPercentual
      : (typeof a.parcial === 'number' ? a.parcial : 0)
    const conclusao = typeof analise.percentualConclusao === 'number' ? analise.percentualConclusao : 0
    grupo.somaParcial += Number.isFinite(parcial) ? parcial : 0
    grupo.somaConclusao += Number.isFinite(conclusao) ? conclusao : 0
  })

  return Object.values(mapa).map(g => {
    const mediaParcial = g.total > 0 ? g.somaParcial / g.total : 0
    const mediaConclusao = g.total > 0 ? g.somaConclusao / g.total : 0
    const taxaMeta = g.fechadas > 0 ? (g.dentroMeta / g.fechadas) * 100 : 0
    return {
      mes: g.mes,
      total: g.total,
      fechadas: g.fechadas,
      dentroMeta: g.dentroMeta,
      foraMeta: g.fechadas - g.dentroMeta,
      mediaParcial,
      mediaConclusao,
      taxaMeta
    }
  })
})

const desempenhoTiposBase = computed(() => {
  const mapa = {}
  auditoriasFiltradas.value.forEach(a => {
    const tipo = a.tipo || 'Desconhecido'
    if (!mapa[tipo]) {
      mapa[tipo] = {
        tipo,
        total: 0,
        fechadas: 0,
        dentroMeta: 0,
        somaParcial: 0,
        somaConclusao: 0
      }
    }
    const grupo = mapa[tipo]
    grupo.total++
    if (a.status === 'fechada') {
      grupo.fechadas++
      if (a.metaAlcancada) grupo.dentroMeta++
    }
    const analise = a.analise || {}
    const parcial = typeof analise.parcialPercentual === 'number'
      ? analise.parcialPercentual
      : (typeof a.parcial === 'number' ? a.parcial : 0)
    const conclusao = typeof analise.percentualConclusao === 'number' ? analise.percentualConclusao : 0
    grupo.somaParcial += Number.isFinite(parcial) ? parcial : 0
    grupo.somaConclusao += Number.isFinite(conclusao) ? conclusao : 0
  })

  return Object.values(mapa).map(g => {
    const mediaParcial = g.total > 0 ? g.somaParcial / g.total : 0
    const mediaConclusao = g.total > 0 ? g.somaConclusao / g.total : 0
    const taxaMeta = g.fechadas > 0 ? (g.dentroMeta / g.fechadas) * 100 : 0
    return {
      tipo: g.tipo,
      total: g.total,
      fechadas: g.fechadas,
      dentroMeta: g.dentroMeta,
      foraMeta: g.fechadas - g.dentroMeta,
      mediaParcial,
      mediaConclusao,
      taxaMeta
    }
  })
})

const desempenhoUsuariosBase = computed(() => {
  const mapa = {}
  auditoriasFiltradas.value.forEach(a => {
    const analise = a.analise
    if (!analise || !analise.porUsuario) return
    Object.entries(analise.porUsuario).forEach(([nome, dados]) => {
      if (!mapa[nome]) {
        mapa[nome] = {
          usuario: nome,
          lidos: 0,
          pendentes: 0,
          comProblema: 0,
          auditorias: 0
        }
      }
      const destino = mapa[nome]
      destino.lidos += dados.lidos || 0
      destino.pendentes += dados.pendentes || 0
      destino.comProblema += dados.comProblema || 0
      destino.auditorias++
    })
  })

  return Object.values(mapa).map(u => {
    const total = u.lidos + u.pendentes + u.comProblema
    const percPendente = total > 0 ? (u.pendentes / total) * 100 : 0
    const percProblema = total > 0 ? (u.comProblema / total) * 100 : 0
    return {
      ...u,
      total,
      percPendente,
      percProblema
    }
  })
})

const desempenhoSetoresBase = computed(() => {
  const mapa = {}
  auditoriasFiltradas.value.forEach(a => {
    const analise = a.analise
    if (!analise || !analise.porSetor) return
    Object.entries(analise.porSetor).forEach(([setor, dados]) => {
      if (!mapa[setor]) {
        mapa[setor] = {
          setor,
          lidos: 0,
          pendentes: 0,
          comProblema: 0,
          auditorias: 0
        }
      }
      const destino = mapa[setor]
      destino.lidos += dados.lidos || 0
      destino.pendentes += dados.pendentes || 0
      destino.comProblema += dados.comProblema || 0
      destino.auditorias++
    })
  })

  return Object.values(mapa).map(s => {
    const total = s.lidos + s.pendentes + s.comProblema
    const percPendente = total > 0 ? (s.pendentes / total) * 100 : 0
    const percProblema = total > 0 ? (s.comProblema / total) * 100 : 0
    return {
      ...s,
      total,
      percPendente,
      percProblema
    }
  })
})

const auditoriasParaTabelaBase = computed(() => {
  return auditoriasFiltradas.value.map(a => {
    const analise = a.analise || {}
    const parcial = typeof analise.parcialPercentual === 'number'
      ? analise.parcialPercentual
      : (typeof a.parcial === 'number' ? a.parcial : 0)
    const conclusao = typeof analise.percentualConclusao === 'number' ? analise.percentualConclusao : 0
    const parcialValor = Number.isFinite(parcial) ? parcial : null
    const conclusaoValor = Number.isFinite(conclusao) ? conclusao : null
    return {
      id: a.id,
      data: a.data,
      tipo: a.tipo,
      status: a.status === 'fechada' ? 'Fechada' : 'Em andamento',
      meta: a.status === 'fechada' ? (a.metaAlcancada ? 'Dentro da meta' : 'Fora da meta') : '-',
      parcial: parcialValor,
      conclusao: conclusaoValor,
      totalItens: analise.totalItens ?? a.total ?? '',
      pendentes: analise.itensPendentes ?? '',
      lidos: analise.totalLidos ?? ''
    }
  })
})

const colunasTabelaAuditorias = [
  { chave: 'data', titulo: 'Data', alinhamento: 'left' },
  { chave: 'tipo', titulo: 'Tipo', alinhamento: 'left' },
  { chave: 'status', titulo: 'Status', alinhamento: 'left' },
  { chave: 'meta', titulo: 'Meta', alinhamento: 'left' },
  { chave: 'parcial', titulo: 'Parcial (%)', alinhamento: 'right' },
  { chave: 'conclusao', titulo: 'Conclusão (%)', alinhamento: 'right' },
  { chave: 'totalItens', titulo: 'Itens', alinhamento: 'right' },
  { chave: 'pendentes', titulo: 'Pendentes', alinhamento: 'right' },
  { chave: 'lidos', titulo: 'Lidos', alinhamento: 'right' }
]

const ordenacaoMes = reactive({ coluna: 'mes', direcao: 'asc' })
const ordenacaoTipos = reactive({ coluna: 'tipo', direcao: 'asc' })
const ordenacaoUsuarios = reactive({ coluna: 'total', direcao: 'desc' })
const ordenacaoSetores = reactive({ coluna: 'percPendente', direcao: 'desc' })
const ordenacaoAuditorias = reactive({ coluna: 'data', direcao: 'desc' })

const ordenarLista = (lista, ordenacao) => {
  const arr = [...lista]
  const coluna = ordenacao.coluna
  const direcao = ordenacao.direcao
  arr.sort((a, b) => {
    const va = a[coluna]
    const vb = b[coluna]
    if (typeof va === 'number' && typeof vb === 'number') {
      return direcao === 'asc' ? va - vb : vb - va
    }
    const sa = String(va ?? '')
    const sb = String(vb ?? '')
    return direcao === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa)
  })
  return arr
}

const agrupadoPorMes = computed(() => ordenarLista(agrupadoPorMesBase.value, ordenacaoMes))
const desempenhoTipos = computed(() => ordenarLista(desempenhoTiposBase.value, ordenacaoTipos))
const desempenhoUsuarios = computed(() => ordenarLista(desempenhoUsuariosBase.value, ordenacaoUsuarios))
const desempenhoSetores = computed(() => ordenarLista(desempenhoSetoresBase.value, ordenacaoSetores))
const auditoriasParaTabela = computed(() => ordenarLista(auditoriasParaTabelaBase.value, ordenacaoAuditorias))

const atualizarOrdenacao = (estado, coluna) => {
  if (estado.coluna === coluna) {
    estado.direcao = estado.direcao === 'asc' ? 'desc' : 'asc'
  } else {
    estado.coluna = coluna
    estado.direcao = 'asc'
  }
}

const gerarRelatorioPDF = () => {
  if (!auditoriasParaTabela.value.length) return
  const escapeHtml = (v) => {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }
  const formatPercent = (v, casas = 2) => {
    const n = typeof v === 'number' && Number.isFinite(v) ? v : 0
    return `${n.toFixed(casas)}%`
  }
  const formatPeriodo = () => {
    if (filtroPeriodoTipo.value === 'rapido') {
      if (filtroPeriodo.value === '3m') return 'Últimos 3 meses'
      if (filtroPeriodo.value === '6m') return 'Últimos 6 meses'
      if (filtroPeriodo.value === '12m') return 'Últimos 12 meses'
      return 'Todo o histórico'
    }
    const ini = filtroDataInicio.value ? filtroDataInicio.value.split('-').reverse().join('/') : ''
    const fim = filtroDataFim.value ? filtroDataFim.value.split('-').reverse().join('/') : ''
    if (ini && fim) return `De ${ini} até ${fim}`
    if (ini) return `A partir de ${ini}`
    if (fim) return `Até ${fim}`
    return 'Período personalizado'
  }
  const resumo = resumoGeral.value
  const cardsHtml = `
    <div class="cards">
      <div class="card">
        <div class="card-label">Total no período</div>
        <div class="card-value">${escapeHtml(resumo.total)}</div>
        <div class="card-sub">Auditorias encontradas com os filtros atuais.</div>
      </div>
      <div class="card">
        <div class="card-label">Taxa de meta</div>
        <div class="card-value">${formatPercent(resumo.percDentroMeta, 1)}</div>
        <div class="card-sub">Das auditorias fechadas ficaram dentro da meta.</div>
      </div>
      <div class="card">
        <div class="card-label">Parcial média</div>
        <div class="card-value">${formatPercent(resumo.percParcialMedia, 2)}</div>
        <div class="card-sub">Percentual médio pendente das auditorias no período.</div>
      </div>
      <div class="card">
        <div class="card-label">Conclusão média</div>
        <div class="card-value">${formatPercent(resumo.percConclusaoMedia, 2)}</div>
        <div class="card-sub">Percentual médio concluído das auditorias no período.</div>
      </div>
    </div>
  `
  const tabelaEvolucao = (() => {
    if (!agrupadoPorMes.value.length) return ''
    const linhas = agrupadoPorMes.value.map(m => {
      return `
        <tr>
          <td>${escapeHtml(m.mes)}</td>
          <td style="text-align:right;">${escapeHtml(m.total)}</td>
          <td style="text-align:right;">${formatPercent(m.mediaParcial)}</td>
          <td style="text-align:right;">${formatPercent(m.mediaConclusao)}</td>
          <td style="text-align:right;">${formatPercent(m.taxaMeta, 1)}</td>
        </tr>
      `
    }).join('')
    return `
      <div class="section">
        <h2>Evolução mensal</h2>
        <table>
          <thead>
            <tr>
              <th>Mês</th>
              <th>Qtd</th>
              <th>% Parcial</th>
              <th>% Conclusão</th>
              <th>% Meta</th>
            </tr>
          </thead>
          <tbody>
            ${linhas}
          </tbody>
        </table>
      </div>
    `
  })()
  const tabelaTipos = (() => {
    if (!desempenhoTipos.value.length) return ''
    const linhas = desempenhoTipos.value.map(t => {
      return `
        <tr>
          <td>${escapeHtml(t.tipo)}</td>
          <td style="text-align:right;">${escapeHtml(t.total)}</td>
          <td style="text-align:right;">${formatPercent(t.mediaParcial)}</td>
          <td style="text-align:right;">${formatPercent(t.mediaConclusao)}</td>
          <td style="text-align:right;">${formatPercent(t.taxaMeta, 1)}</td>
        </tr>
      `
    }).join('')
    return `
      <div class="section">
        <h2>Desempenho por tipo de auditoria</h2>
        <table>
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Qtd</th>
              <th>% Parcial</th>
              <th>% Conclusão</th>
              <th>% Meta</th>
            </tr>
          </thead>
          <tbody>
            ${linhas}
          </tbody>
        </table>
      </div>
    `
  })()
  const tabelaUsuarios = (() => {
    if (!desempenhoUsuarios.value.length) return ''
    const linhas = desempenhoUsuarios.value.map(u => {
      return `
        <tr>
          <td>${escapeHtml(u.usuario)}</td>
          <td style="text-align:right;">${escapeHtml(u.lidos)}</td>
          <td style="text-align:right;">${escapeHtml(u.comProblema)}</td>
          <td style="text-align:right;">${formatPercent(u.percPendente)}</td>
          <td style="text-align:right;">${formatPercent(u.percProblema)}</td>
        </tr>
      `
    }).join('')
    return `
      <div class="section">
        <h2>Desempenho por usuário</h2>
        <table>
          <thead>
            <tr>
              <th>Usuário</th>
              <th>Itens lidos</th>
              <th>Leituras com erro</th>
              <th>% Pendentes</th>
              <th>% Problemas</th>
            </tr>
          </thead>
          <tbody>
            ${linhas}
          </tbody>
        </table>
      </div>
    `
  })()
  const tabelaSetores = (() => {
    if (!desempenhoSetores.value.length) return ''
    const linhas = desempenhoSetores.value.map(s => {
      return `
        <tr>
          <td>${escapeHtml(s.setor)}</td>
          <td style="text-align:right;">${escapeHtml(s.lidos)}</td>
          <td style="text-align:right;">${escapeHtml(s.comProblema)}</td>
          <td style="text-align:right;">${formatPercent(s.percPendente)}</td>
          <td style="text-align:right;">${formatPercent(s.percProblema)}</td>
        </tr>
      `
    }).join('')
    return `
      <div class="section">
        <h2>Desempenho por setor</h2>
        <table>
          <thead>
            <tr>
              <th>Setor</th>
              <th>Itens lidos</th>
              <th>Leituras com erro</th>
              <th>% Pendentes</th>
              <th>% Problemas</th>
            </tr>
          </thead>
          <tbody>
            ${linhas}
          </tbody>
        </table>
      </div>
    `
  })()
  const tabelaAuditorias = (() => {
    const linhas = auditoriasParaTabela.value.map(a => {
      const parcial = a.parcial != null ? formatPercent(a.parcial) : ''
      const conclusao = a.conclusao != null ? formatPercent(a.conclusao) : ''
      return `
        <tr>
          <td>${escapeHtml(a.data)}</td>
          <td>${escapeHtml(a.tipo)}</td>
          <td>${escapeHtml(a.status)}</td>
          <td>${escapeHtml(a.meta)}</td>
          <td style="text-align:right;">${parcial}</td>
          <td style="text-align:right;">${conclusao}</td>
          <td style="text-align:right;">${escapeHtml(a.totalItens)}</td>
          <td style="text-align:right;">${escapeHtml(a.pendentes)}</td>
          <td style="text-align:right;">${escapeHtml(a.lidos)}</td>
        </tr>
      `
    }).join('')
    return `
      <div class="section">
        <h2>Lista detalhada das auditorias filtradas</h2>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Tipo</th>
              <th>Status</th>
              <th>Meta</th>
              <th>% Parcial</th>
              <th>% Conclusão</th>
              <th>Itens</th>
              <th>Pendentes</th>
              <th>Lidos</th>
            </tr>
          </thead>
          <tbody>
            ${linhas}
          </tbody>
        </table>
      </div>
    `
  })()
  const bodyHtml = `
    <h1>Análise Histórica de Auditorias</h1>
    <p><strong>Período:</strong> ${escapeHtml(formatPeriodo())}</p>
    <p><strong>Total de auditorias no período:</strong> ${escapeHtml(resumo.total)}</p>
    ${cardsHtml}
    ${tabelaEvolucao}
    ${tabelaTipos}
    ${tabelaUsuarios}
    ${tabelaSetores}
    ${tabelaAuditorias}
  `
  printHtmlInNewWindow('Analise_Historica_Auditorias', bodyHtml)
}
</script>

<template>
  <div class="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-6 md:px-8 md:py-8 max-w-7xl mx-auto space-y-6">
    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div class="flex items-center gap-3">
        <div class="h-12 w-12 rounded-xl bg-indigo-600/10 flex items-center justify-center">
          <i class="fas fa-chart-line text-2xl text-indigo-600"></i>
        </div>
        <div>
          <h1 class="text-3xl md:text-4xl font-bold text-gray-900">Análise Histórica de Auditorias</h1>
          <p class="text-sm text-gray-500 mt-1">
            Explore o desempenho das auditorias ao longo do tempo com filtros avançados.
          </p>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button
          @click="gerarRelatorioPDF"
          class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium shadow-sm hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="!auditoriasParaTabela.length"
        >
          <i class="fas fa-file-pdf text-base"></i>
          Gerar Relatório PDF
        </button>
      </div>
    </div>

    <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 p-4 md:p-5 space-y-4">
      <div class="flex flex-wrap gap-3 items-end">
        <div class="flex flex-col gap-1">
          <label class="text-[11px] font-semibold text-slate-500">Período</label>
          <div class="flex flex-wrap gap-2 items-center">
            <select
              v-model="filtroPeriodoTipo"
              class="px-3 py-1.5 rounded-lg border border-slate-200 text-xs md:text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="rapido">Rápido</option>
              <option value="personalizado">Personalizado</option>
            </select>
            <template v-if="filtroPeriodoTipo === 'rapido'">
              <select
                v-model="filtroPeriodo"
                class="px-3 py-1.5 rounded-lg border border-slate-200 text-xs md:text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="3m">Últimos 3 meses</option>
                <option value="6m">Últimos 6 meses</option>
                <option value="12m">Últimos 12 meses</option>
                <option value="todos">Todo o histórico</option>
              </select>
            </template>
            <template v-else>
              <input
                v-model="filtroDataInicio"
                type="date"
                class="px-3 py-1.5 rounded-lg border border-slate-200 text-xs md:text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
              <span class="text-[11px] text-slate-400">até</span>
              <input
                v-model="filtroDataFim"
                type="date"
                class="px-3 py-1.5 rounded-lg border border-slate-200 text-xs md:text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
            </template>
          </div>
        </div>
        <div class="flex flex-col">
          <label class="text-[11px] font-semibold text-slate-500 mb-1">Tipo</label>
          <select
            v-model="filtroTipo"
            class="px-3 py-1.5 rounded-lg border border-slate-200 text-xs md:text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="todos">Todos</option>
            <option value="Etiqueta">Etiqueta</option>
            <option value="Presença">Presença</option>
            <option value="Ruptura">Ruptura</option>
          </select>
        </div>
        <div class="flex flex-col">
          <label class="text-[11px] font-semibold text-slate-500 mb-1">Status</label>
          <select
            v-model="filtroStatus"
            class="px-3 py-1.5 rounded-lg border border-slate-200 text-xs md:text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="todos">Abertas e fechadas</option>
            <option value="abertas">Somente abertas</option>
            <option value="fechadas">Somente fechadas</option>
          </select>
        </div>
        <div class="flex flex-col">
          <label class="text-[11px] font-semibold text-slate-500 mb-1">Meta</label>
          <select
            v-model="filtroMeta"
            class="px-3 py-1.5 rounded-lg border border-slate-200 text-xs md:text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="todos">Todas</option>
            <option value="dentro">Dentro da meta</option>
            <option value="fora">Fora da meta</option>
          </select>
        </div>
        <div class="ml-auto text-xs text-slate-500">
          {{ auditoriasFiltradas.length }} auditoria(s) no período selecionado
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-4 gap-4">
      <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col justify-between">
        <div class="flex items-center justify-between gap-2">
          <p class="text-[11px] font-medium text-slate-600 uppercase tracking-wide">Total no período</p>
          <span class="inline-flex items-center justify-center h-7 w-7 rounded-full bg-slate-50 text-slate-700">
            <i class="fas fa-history text-xs"></i>
          </span>
        </div>
        <p class="mt-2 text-2xl md:text-3xl font-bold text-slate-800">
          {{ resumoGeral.total }}
        </p>
        <p class="mt-1 text-[11px] text-slate-500">
          Auditorias encontradas com os filtros atuais.
        </p>
      </div>
      <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col justify-between">
        <div class="flex items-center justify-between gap-2">
          <p class="text-[11px] font-medium text-slate-600 uppercase tracking-wide">Taxa de meta</p>
          <span class="inline-flex items-center justify-center h-7 w-7 rounded-full bg-emerald-50 text-emerald-600">
            <i class="fas fa-bullseye text-xs"></i>
          </span>
        </div>
        <p class="mt-2 text-2xl md:text-3xl font-bold" :class="resumoGeral.percDentroMeta >= 70 ? 'text-emerald-700' : 'text-amber-700'">
          {{ resumoGeral.percDentroMeta.toFixed(1) }}%
        </p>
        <p class="mt-1 text-[11px] text-slate-500">
          Das auditorias fechadas ficaram dentro da meta.
        </p>
      </div>
      <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col justify-between">
        <div class="flex items-center justify-between gap-2">
          <p class="text-[11px] font-medium text-slate-600 uppercase tracking-wide">Parcial média</p>
          <span class="inline-flex items-center justify-center h-7 w-7 rounded-full bg-amber-50 text-amber-600">
            <i class="fas fa-hourglass-half text-xs"></i>
          </span>
        </div>
        <p class="mt-2 text-2xl md:text-3xl font-bold" :class="resumoGeral.percParcialMedia > 3 ? 'text-amber-700' : 'text-emerald-700'">
          {{ resumoGeral.percParcialMedia.toFixed(2) }}%
        </p>
        <p class="mt-1 text-[11px] text-slate-500">
          Percentual médio pendente das auditorias no período.
        </p>
      </div>
      <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col justify-between">
        <div class="flex items-center justify-between gap-2">
          <p class="text-[11px] font-medium text-slate-600 uppercase tracking-wide">Conclusão média</p>
          <span class="inline-flex items-center justify-center h-7 w-7 rounded-full bg-blue-50 text-blue-600">
            <i class="fas fa-check-circle text-xs"></i>
          </span>
        </div>
        <p class="mt-2 text-2xl md:text-3xl font-bold text-blue-700">
          {{ resumoGeral.percConclusaoMedia.toFixed(2) }}%
        </p>
        <p class="mt-1 text-[11px] text-slate-500">
          Percentual médio concluído das auditorias no período.
        </p>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 p-4 space-y-3">
        <div class="flex items-center justify-between gap-2">
          <h2 class="text-sm font-bold text-slate-800 flex items-center gap-2">
            <i class="fas fa-calendar-week text-indigo-600"></i>
            Evolução mensal
          </h2>
        </div>
        <div v-if="agrupadoPorMes.length === 0" class="text-xs text-slate-500">
          Nenhuma auditoria encontrada para o período selecionado.
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead class="bg-slate-50 border-b">
              <tr>
                <th
                  class="px-2 py-2 text-left font-semibold text-slate-600 cursor-pointer select-none"
                  @click="atualizarOrdenacao(ordenacaoMes, 'mes')"
                >
                  <span class="inline-flex items-center gap-1">
                    Mês
                    <i
                      class="fas"
                      :class="ordenacaoMes.coluna === 'mes' ? (ordenacaoMes.direcao === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'"
                    />
                  </span>
                </th>
                <th
                  class="px-2 py-2 text-right font-semibold text-slate-600 cursor-pointer select-none"
                  @click="atualizarOrdenacao(ordenacaoMes, 'total')"
                >
                  <span class="inline-flex items-center gap-1">
                    Qtd
                    <i
                      class="fas"
                      :class="ordenacaoMes.coluna === 'total' ? (ordenacaoMes.direcao === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'"
                    />
                  </span>
                </th>
                <th
                  class="px-2 py-2 text-right font-semibold text-slate-600 cursor-pointer select-none"
                  @click="atualizarOrdenacao(ordenacaoMes, 'mediaParcial')"
                >
                  <span class="inline-flex items-center gap-1">
                    % Parcial
                    <i
                      class="fas"
                      :class="ordenacaoMes.coluna === 'mediaParcial' ? (ordenacaoMes.direcao === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'"
                    />
                  </span>
                </th>
                <th
                  class="px-2 py-2 text-right font-semibold text-slate-600 cursor-pointer select-none"
                  @click="atualizarOrdenacao(ordenacaoMes, 'mediaConclusao')"
                >
                  <span class="inline-flex items-center gap-1">
                    % Conclusão
                    <i
                      class="fas"
                      :class="ordenacaoMes.coluna === 'mediaConclusao' ? (ordenacaoMes.direcao === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'"
                    />
                  </span>
                </th>
                <th
                  class="px-2 py-2 text-right font-semibold text-slate-600 cursor-pointer select-none"
                  @click="atualizarOrdenacao(ordenacaoMes, 'taxaMeta')"
                >
                  <span class="inline-flex items-center gap-1">
                    % Meta
                    <i
                      class="fas"
                      :class="ordenacaoMes.coluna === 'taxaMeta' ? (ordenacaoMes.direcao === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'"
                    />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr v-for="m in agrupadoPorMes" :key="m.mes" class="hover:bg-slate-50">
                <td class="px-2 py-2 text-slate-700 font-medium">
                  {{ m.mes }}
                </td>
                <td class="px-2 py-2 text-right text-slate-700">
                  {{ m.total }}
                </td>
                <td class="px-2 py-2 text-right" :class="m.mediaParcial > 3 ? 'text-amber-700 font-semibold' : 'text-emerald-700 font-semibold'">
                  {{ m.mediaParcial.toFixed(2) }}%
                </td>
                <td class="px-2 py-2 text-right text-blue-700 font-semibold">
                  {{ m.mediaConclusao.toFixed(2) }}%
                </td>
                <td class="px-2 py-2 text-right text-emerald-700 font-semibold">
                  {{ m.taxaMeta.toFixed(1) }}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 p-4 space-y-3">
        <div class="flex items-center justify-between gap-2">
          <h2 class="text-sm font-bold text-slate-800 flex items-center gap-2">
            <i class="fas fa-layer-group text-indigo-600"></i>
            Desempenho por tipo de auditoria
          </h2>
        </div>
        <div v-if="desempenhoTipos.length === 0" class="text-xs text-slate-500">
          Nenhuma auditoria encontrada para o período selecionado.
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead class="bg-slate-50 border-b">
              <tr>
                <th
                  class="px-2 py-2 text-left font-semibold text-slate-600 cursor-pointer select-none"
                  @click="atualizarOrdenacao(ordenacaoTipos, 'tipo')"
                >
                  <span class="inline-flex items-center gap-1">
                    Tipo
                    <i
                      class="fas"
                      :class="ordenacaoTipos.coluna === 'tipo' ? (ordenacaoTipos.direcao === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'"
                    />
                  </span>
                </th>
                <th
                  class="px-2 py-2 text-right font-semibold text-slate-600 cursor-pointer select-none"
                  @click="atualizarOrdenacao(ordenacaoTipos, 'total')"
                >
                  <span class="inline-flex items-center gap-1">
                    Qtd
                    <i
                      class="fas"
                      :class="ordenacaoTipos.coluna === 'total' ? (ordenacaoTipos.direcao === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'"
                    />
                  </span>
                </th>
                <th
                  class="px-2 py-2 text-right font-semibold text-slate-600 cursor-pointer select-none"
                  @click="atualizarOrdenacao(ordenacaoTipos, 'mediaParcial')"
                >
                  <span class="inline-flex items-center gap-1">
                    % Parcial
                    <i
                      class="fas"
                      :class="ordenacaoTipos.coluna === 'mediaParcial' ? (ordenacaoTipos.direcao === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'"
                    />
                  </span>
                </th>
                <th
                  class="px-2 py-2 text-right font-semibold text-slate-600 cursor-pointer select-none"
                  @click="atualizarOrdenacao(ordenacaoTipos, 'mediaConclusao')"
                >
                  <span class="inline-flex items-center gap-1">
                    % Conclusão
                    <i
                      class="fas"
                      :class="ordenacaoTipos.coluna === 'mediaConclusao' ? (ordenacaoTipos.direcao === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'"
                    />
                  </span>
                </th>
                <th
                  class="px-2 py-2 text-right font-semibold text-slate-600 cursor-pointer select-none"
                  @click="atualizarOrdenacao(ordenacaoTipos, 'taxaMeta')"
                >
                  <span class="inline-flex items-center gap-1">
                    % Meta
                    <i
                      class="fas"
                      :class="ordenacaoTipos.coluna === 'taxaMeta' ? (ordenacaoTipos.direcao === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'"
                    />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr v-for="t in desempenhoTipos" :key="t.tipo" class="hover:bg-slate-50">
                <td class="px-2 py-2 text-slate-700 font-medium">
                  {{ t.tipo }}
                </td>
                <td class="px-2 py-2 text-right text-slate-700">
                  {{ t.total }}
                </td>
                <td class="px-2 py-2 text-right" :class="t.mediaParcial > 3 ? 'text-amber-700 font-semibold' : 'text-emerald-700 font-semibold'">
                  {{ t.mediaParcial.toFixed(2) }}%
                </td>
                <td class="px-2 py-2 text-right text-blue-700 font-semibold">
                  {{ t.mediaConclusao.toFixed(2) }}%
                </td>
                <td class="px-2 py-2 text-right text-emerald-700 font-semibold">
                  {{ t.taxaMeta.toFixed(1) }}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 p-4 space-y-3">
        <div class="flex items-center justify-between gap-2">
          <h2 class="text-sm font-bold text-slate-800 flex items-center gap-2">
            <i class="fas fa-users text-indigo-600"></i>
            Desempenho por usuário
          </h2>
        </div>
        <div v-if="desempenhoUsuarios.length === 0" class="text-xs text-slate-500">
          Nenhuma informação de usuários encontrada no período.
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead class="bg-slate-50 border-b">
              <tr>
                <th
                  class="px-2 py-2 text-left font-semibold text-slate-600 cursor-pointer select-none"
                  @click="atualizarOrdenacao(ordenacaoUsuarios, 'usuario')"
                >
                  <span class="inline-flex items-center gap-1">
                    Usuário
                    <i
                      class="fas"
                      :class="ordenacaoUsuarios.coluna === 'usuario' ? (ordenacaoUsuarios.direcao === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'"
                    />
                  </span>
                </th>
                <th
                  class="px-2 py-2 text-right font-semibold text-slate-600 cursor-pointer select-none"
                  @click="atualizarOrdenacao(ordenacaoUsuarios, 'lidos')"
                >
                  <span class="inline-flex items-center gap-1">
                    Itens Lidos
                    <i
                      class="fas"
                      :class="ordenacaoUsuarios.coluna === 'lidos' ? (ordenacaoUsuarios.direcao === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'"
                    />
                  </span>
                </th>
                <th
                  class="px-2 py-2 text-right font-semibold text-slate-600 cursor-pointer select-none"
                  @click="atualizarOrdenacao(ordenacaoUsuarios, 'comProblema')"
                >
                  <span class="inline-flex items-center gap-1">
                    Leituras com erro
                    <i
                      class="fas"
                      :class="ordenacaoUsuarios.coluna === 'comProblema' ? (ordenacaoUsuarios.direcao === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'"
                    />
                  </span>
                </th>
                <th
                  class="px-2 py-2 text-right font-semibold text-slate-600 cursor-pointer select-none"
                  @click="atualizarOrdenacao(ordenacaoUsuarios, 'percPendente')"
                >
                  <span class="inline-flex items-center gap-1">
                    % Pendentes
                    <i
                      class="fas"
                      :class="ordenacaoUsuarios.coluna === 'percPendente' ? (ordenacaoUsuarios.direcao === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'"
                    />
                  </span>
                </th>
                <th
                  class="px-2 py-2 text-right font-semibold text-slate-600 cursor-pointer select-none"
                  @click="atualizarOrdenacao(ordenacaoUsuarios, 'percProblema')"
                >
                  <span class="inline-flex items-center gap-1">
                    % Problemas
                    <i
                      class="fas"
                      :class="ordenacaoUsuarios.coluna === 'percProblema' ? (ordenacaoUsuarios.direcao === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'"
                    />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr v-for="u in desempenhoUsuarios" :key="u.usuario" class="hover:bg-slate-50">
                <td class="px-2 py-2 text-slate-700 font-medium">
                  {{ u.usuario }}
                </td>
                <td class="px-2 py-2 text-right text-emerald-700 font-semibold">
                  {{ u.lidos }}
                </td>
                <td class="px-2 py-2 text-right text-amber-700 font-semibold">
                  {{ u.comProblema }}
                </td>
                <td class="px-2 py-2 text-right" :class="u.percPendente > 3 ? 'text-amber-700 font-semibold' : 'text-emerald-700 font-semibold'">
                  {{ u.percPendente.toFixed(2) }}%
                </td>
                <td class="px-2 py-2 text-right text-red-600 font-semibold">
                  {{ u.percProblema.toFixed(2) }}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 p-4 space-y-3">
        <div class="flex items-center justify-between gap-2">
          <h2 class="text-sm font-bold text-slate-800 flex items-center gap-2">
            <i class="fas fa-store-alt text-indigo-600"></i>
            Desempenho por setor
          </h2>
        </div>
        <div v-if="desempenhoSetores.length === 0" class="text-xs text-slate-500">
          Nenhuma informação de setores encontrada no período.
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead class="bg-slate-50 border-b">
              <tr>
                <th
                  class="px-2 py-2 text-left font-semibold text-slate-600 cursor-pointer select-none"
                  @click="atualizarOrdenacao(ordenacaoSetores, 'setor')"
                >
                  <span class="inline-flex items-center gap-1">
                    Setor
                    <i
                      class="fas"
                      :class="ordenacaoSetores.coluna === 'setor' ? (ordenacaoSetores.direcao === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'"
                    />
                  </span>
                </th>
                <th
                  class="px-2 py-2 text-right font-semibold text-slate-600 cursor-pointer select-none"
                  @click="atualizarOrdenacao(ordenacaoSetores, 'lidos')"
                >
                  <span class="inline-flex items-center gap-1">
                    Itens Lidos
                    <i
                      class="fas"
                      :class="ordenacaoSetores.coluna === 'lidos' ? (ordenacaoSetores.direcao === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'"
                    />
                  </span>
                </th>
                <th
                  class="px-2 py-2 text-right font-semibold text-slate-600 cursor-pointer select-none"
                  @click="atualizarOrdenacao(ordenacaoSetores, 'comProblema')"
                >
                  <span class="inline-flex items-center gap-1">
                    Leituras com erro
                    <i
                      class="fas"
                      :class="ordenacaoSetores.coluna === 'comProblema' ? (ordenacaoSetores.direcao === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'"
                    />
                  </span>
                </th>
                <th
                  class="px-2 py-2 text-right font-semibold text-slate-600 cursor-pointer select-none"
                  @click="atualizarOrdenacao(ordenacaoSetores, 'percPendente')"
                >
                  <span class="inline-flex items-center gap-1">
                    % Pendentes
                    <i
                      class="fas"
                      :class="ordenacaoSetores.coluna === 'percPendente' ? (ordenacaoSetores.direcao === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'"
                    />
                  </span>
                </th>
                <th
                  class="px-2 py-2 text-right font-semibold text-slate-600 cursor-pointer select-none"
                  @click="atualizarOrdenacao(ordenacaoSetores, 'percProblema')"
                >
                  <span class="inline-flex items-center gap-1">
                    % Problemas
                    <i
                      class="fas"
                      :class="ordenacaoSetores.coluna === 'percProblema' ? (ordenacaoSetores.direcao === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'"
                    />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr v-for="s in desempenhoSetores" :key="s.setor" class="hover:bg-slate-50">
                <td class="px-2 py-2 text-slate-700 font-medium">
                  {{ s.setor }}
                </td>
                <td class="px-2 py-2 text-right text-emerald-700 font-semibold">
                  {{ s.lidos }}
                </td>
                <td class="px-2 py-2 text-right text-amber-700 font-semibold">
                  {{ s.comProblema }}
                </td>
                <td class="px-2 py-2 text-right" :class="s.percPendente > 3 ? 'text-amber-700 font-semibold' : 'text-emerald-700 font-semibold'">
                  {{ s.percPendente.toFixed(2) }}%
                </td>
                <td class="px-2 py-2 text-right text-red-600 font-semibold">
                  {{ s.percProblema.toFixed(2) }}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 p-4 space-y-3">
      <div class="flex items-center justify-between gap-2">
        <h2 class="text-sm font-bold text-slate-800 flex items-center gap-2">
          <i class="fas fa-table text-indigo-600"></i>
          Lista detalhada das auditorias filtradas
        </h2>
      </div>
      <div v-if="auditoriasParaTabela.length === 0" class="text-xs text-slate-500">
        Nenhuma auditoria encontrada com os filtros selecionados.
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead class="bg-slate-50 border-b">
            <tr>
              <th
                class="px-2 py-2 text-left font-semibold text-slate-600 cursor-pointer select-none"
                @click="atualizarOrdenacao(ordenacaoAuditorias, 'data')"
              >
                <span class="inline-flex items-center gap-1">
                  Data
                  <i
                    class="fas"
                    :class="ordenacaoAuditorias.coluna === 'data' ? (ordenacaoAuditorias.direcao === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'"
                  />
                </span>
              </th>
              <th
                class="px-2 py-2 text-left font-semibold text-slate-600 cursor-pointer select-none"
                @click="atualizarOrdenacao(ordenacaoAuditorias, 'tipo')"
              >
                <span class="inline-flex items-center gap-1">
                  Tipo
                  <i
                    class="fas"
                    :class="ordenacaoAuditorias.coluna === 'tipo' ? (ordenacaoAuditorias.direcao === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'"
                  />
                </span>
              </th>
              <th
                class="px-2 py-2 text-left font-semibold text-slate-600 cursor-pointer select-none"
                @click="atualizarOrdenacao(ordenacaoAuditorias, 'status')"
              >
                <span class="inline-flex items-center gap-1">
                  Status
                  <i
                    class="fas"
                    :class="ordenacaoAuditorias.coluna === 'status' ? (ordenacaoAuditorias.direcao === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'"
                  />
                </span>
              </th>
              <th
                class="px-2 py-2 text-left font-semibold text-slate-600 cursor-pointer select-none"
                @click="atualizarOrdenacao(ordenacaoAuditorias, 'meta')"
              >
                <span class="inline-flex items-center gap-1">
                  Meta
                  <i
                    class="fas"
                    :class="ordenacaoAuditorias.coluna === 'meta' ? (ordenacaoAuditorias.direcao === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'"
                  />
                </span>
              </th>
              <th
                class="px-2 py-2 text-right font-semibold text-slate-600 cursor-pointer select-none"
                @click="atualizarOrdenacao(ordenacaoAuditorias, 'parcial')"
              >
                <span class="inline-flex items-center gap-1">
                  % Parcial
                  <i
                    class="fas"
                    :class="ordenacaoAuditorias.coluna === 'parcial' ? (ordenacaoAuditorias.direcao === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'"
                  />
                </span>
              </th>
              <th
                class="px-2 py-2 text-right font-semibold text-slate-600 cursor-pointer select-none"
                @click="atualizarOrdenacao(ordenacaoAuditorias, 'conclusao')"
              >
                <span class="inline-flex items-center gap-1">
                  % Conclusão
                  <i
                    class="fas"
                    :class="ordenacaoAuditorias.coluna === 'conclusao' ? (ordenacaoAuditorias.direcao === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'"
                  />
                </span>
              </th>
              <th
                class="px-2 py-2 text-right font-semibold text-slate-600 cursor-pointer select-none"
                @click="atualizarOrdenacao(ordenacaoAuditorias, 'totalItens')"
              >
                <span class="inline-flex items-center gap-1">
                  Itens
                  <i
                    class="fas"
                    :class="ordenacaoAuditorias.coluna === 'totalItens' ? (ordenacaoAuditorias.direcao === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'"
                  />
                </span>
              </th>
              <th
                class="px-2 py-2 text-right font-semibold text-slate-600 cursor-pointer select-none"
                @click="atualizarOrdenacao(ordenacaoAuditorias, 'pendentes')"
              >
                <span class="inline-flex items-center gap-1">
                  Pendentes
                  <i
                    class="fas"
                    :class="ordenacaoAuditorias.coluna === 'pendentes' ? (ordenacaoAuditorias.direcao === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'"
                  />
                </span>
              </th>
              <th
                class="px-2 py-2 text-right font-semibold text-slate-600 cursor-pointer select-none"
                @click="atualizarOrdenacao(ordenacaoAuditorias, 'lidos')"
              >
                <span class="inline-flex items-center gap-1">
                  Lidos
                  <i
                    class="fas"
                    :class="ordenacaoAuditorias.coluna === 'lidos' ? (ordenacaoAuditorias.direcao === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'"
                  />
                </span>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y">
            <tr v-for="a in auditoriasParaTabela" :key="a.id" class="hover:bg-slate-50">
              <td class="px-2 py-2 text-slate-700">
                {{ a.data }}
              </td>
              <td class="px-2 py-2 text-slate-700">
                {{ a.tipo }}
              </td>
              <td class="px-2 py-2 text-slate-700">
                {{ a.status }}
              </td>
              <td class="px-2 py-2 text-slate-700">
                {{ a.meta }}
              </td>
              <td class="px-2 py-2 text-right text-amber-700 font-semibold">
                {{ a.parcial != null ? `${a.parcial.toFixed(2)}%` : '' }}
              </td>
              <td class="px-2 py-2 text-right text-blue-700 font-semibold">
                {{ a.conclusao != null ? `${a.conclusao.toFixed(2)}%` : '' }}
              </td>
              <td class="px-2 py-2 text-right text-slate-700">
                {{ a.totalItens }}
              </td>
              <td class="px-2 py-2 text-right text-amber-700 font-semibold">
                {{ a.pendentes }}
              </td>
              <td class="px-2 py-2 text-right text-emerald-700 font-semibold">
                {{ a.lidos }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
