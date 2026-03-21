<script setup>
import { computed, ref, reactive } from 'vue'
import { useAuditoriasStore } from '../stores/auditoriasStore'
import { useRouter } from 'vue-router'
import { printHtmlInNewWindow } from '../utils/print'

const store = useAuditoriasStore()
const router = useRouter()

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
    const parcial = getParcialExibido(a)
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

const nomesMeses = {
  '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
  '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
  '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro'
}

const formatarMes = (chave) => {
  const [ano, mes] = chave.split('-')
  return `${nomesMeses[mes] || mes} ${ano}`
}

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
        mesFormatado: formatarMes(chave),
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
    const parcial = getParcialExibido(a)
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
      mesFormatado: g.mesFormatado,
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
    const parcial = getParcialExibido(a)
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

const getPendentesExibidos = (auditoria) => {
  const analise = auditoria?.analise || {}
  return analise.itensPendentes || 0
}

const getParcialExibido = (auditoria) => {
  const analise = auditoria?.analise || {}
  if (typeof analise.parcialPercentual === 'number') return analise.parcialPercentual
  const total = analise.totalItens ?? auditoria?.sku ?? auditoria?.total ?? 0
  if (!total || total <= 0) return 0
  return ((analise.itensPendentes || 0) / total) * 100
}

const formatarDataISO = (dataStr) => {
  if (!dataStr) return ''
  const partes = String(dataStr).split('T')[0].split('-')
  if (partes.length !== 3) return dataStr
  return `${partes[2]}/${partes[1]}/${partes[0]}`
}

const auditoriasParaTabelaBase = computed(() => {
  return auditoriasFiltradas.value.map(a => {
    const analise = a.analise || {}
    const parcial = getParcialExibido(a)
    const conclusao = typeof analise.percentualConclusao === 'number' ? analise.percentualConclusao : 0
    const parcialValor = Number.isFinite(parcial) ? parcial : null
    const conclusaoValor = Number.isFinite(conclusao) ? conclusao : null
    return {
      id: a.id,
      data: a.data,
      dataFormatada: formatarDataISO(a.data),
      tipo: a.tipo,
      status: a.status === 'fechada' ? 'Fechada' : 'Em andamento',
      statusRaw: a.status,
      meta: a.status === 'fechada' ? (a.metaAlcancada ? 'Dentro da meta' : 'Fora da meta') : '-',
      metaAlcancada: a.metaAlcancada,
      parcial: parcialValor,
      conclusao: conclusaoValor,
      totalItens: analise.totalItens ?? a.total ?? '',
      pendentes: a.analise ? getPendentesExibidos(a) : '',
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

const paginaUsuarios = ref(1)
const itensPorPaginaUsuarios = 10

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
const totalPaginasUsuarios = computed(() => Math.ceil(desempenhoUsuarios.value.length / itensPorPaginaUsuarios))
const desempenhoUsuariosPaginado = computed(() => {
  const inicio = (paginaUsuarios.value - 1) * itensPorPaginaUsuarios
  return desempenhoUsuarios.value.slice(inicio, inicio + itensPorPaginaUsuarios)
})
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

const abrirAuditoria = (id) => {
  if (id) router.push(`/auditorias/${id}`)
}

const tipoConfig = {
  'Etiqueta': { cor: 'bg-violet-100 text-violet-700', icone: 'fa-tag' },
  'Presença': { cor: 'bg-sky-100 text-sky-700', icone: 'fa-clipboard-check' },
  'Ruptura': { cor: 'bg-orange-100 text-orange-700', icone: 'fa-exclamation-triangle' },
  'Desconhecido': { cor: 'bg-slate-100 text-slate-600', icone: 'fa-question' }
}
const getTipoConfig = (tipo) => tipoConfig[tipo] || tipoConfig['Desconhecido']

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
          <td>${escapeHtml(m.mesFormatado)}</td>
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
          <td>${escapeHtml(a.dataFormatada)}</td>
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
  <div class="min-h-[calc(100vh-4rem)] bg-linear-to-b from-slate-50 to-slate-100 px-4 py-6 md:px-8 md:py-8 max-w-7xl mx-auto space-y-6">
    <!-- Header -->
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

    <!-- Filtros -->
    <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 p-4 md:p-5 space-y-4">
      <div class="flex flex-wrap gap-3 items-end">
        <div class="flex flex-col gap-1">
          <label class="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Período</label>
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
          <label class="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Tipo</label>
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
          <label class="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Status</label>
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
          <label class="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Meta</label>
          <select
            v-model="filtroMeta"
            class="px-3 py-1.5 rounded-lg border border-slate-200 text-xs md:text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="todos">Todas</option>
            <option value="dentro">Dentro da meta</option>
            <option value="fora">Fora da meta</option>
          </select>
        </div>
        <div class="ml-auto flex items-center gap-2">
          <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold">
            <i class="fas fa-filter text-[10px]"></i>
            {{ auditoriasFiltradas.length }} auditoria(s)
          </span>
        </div>
      </div>
    </div>

    <!-- Cards de Resumo -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- Total no período -->
      <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <p class="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Total no período</p>
          <span class="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600">
            <i class="fas fa-history text-sm"></i>
          </span>
        </div>
        <p class="text-3xl font-bold text-slate-800">{{ resumoGeral.total }}</p>
        <div class="flex items-center gap-3 text-[11px]">
          <span class="inline-flex items-center gap-1 text-emerald-600 font-medium">
            <span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
            {{ resumoGeral.fechadas }} fechadas
          </span>
          <span class="inline-flex items-center gap-1 text-amber-600 font-medium">
            <span class="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
            {{ resumoGeral.abertas }} abertas
          </span>
        </div>
      </div>

      <!-- Taxa de meta -->
      <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <p class="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Taxa de meta</p>
          <span class="inline-flex items-center justify-center h-8 w-8 rounded-lg" :class="resumoGeral.percDentroMeta >= 70 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'">
            <i class="fas fa-bullseye text-sm"></i>
          </span>
        </div>
        <p class="text-3xl font-bold" :class="resumoGeral.percDentroMeta >= 70 ? 'text-emerald-700' : 'text-amber-700'">
          {{ resumoGeral.percDentroMeta.toFixed(1) }}%
        </p>
        <div class="w-full bg-slate-100 rounded-full h-2">
          <div
            class="h-2 rounded-full transition-all duration-500"
            :class="resumoGeral.percDentroMeta >= 70 ? 'bg-emerald-500' : 'bg-amber-500'"
            :style="{ width: Math.min(resumoGeral.percDentroMeta, 100) + '%' }"
          ></div>
        </div>
        <div class="flex items-center gap-3 text-[11px]">
          <span class="text-emerald-600 font-medium">{{ resumoGeral.dentroMeta }} dentro</span>
          <span class="text-red-500 font-medium">{{ resumoGeral.foraMeta }} fora</span>
        </div>
      </div>

      <!-- Parcial média -->
      <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <p class="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Parcial média</p>
          <span class="inline-flex items-center justify-center h-8 w-8 rounded-lg" :class="resumoGeral.percParcialMedia > 3 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'">
            <i class="fas fa-hourglass-half text-sm"></i>
          </span>
        </div>
        <p class="text-3xl font-bold" :class="resumoGeral.percParcialMedia > 3 ? 'text-amber-700' : 'text-emerald-700'">
          {{ resumoGeral.percParcialMedia.toFixed(2) }}%
        </p>
        <div class="w-full bg-slate-100 rounded-full h-2">
          <div
            class="h-2 rounded-full transition-all duration-500"
            :class="resumoGeral.percParcialMedia > 3 ? 'bg-amber-500' : 'bg-emerald-500'"
            :style="{ width: Math.min(resumoGeral.percParcialMedia, 100) + '%' }"
          ></div>
        </div>
        <p class="text-[11px] text-slate-500">Percentual médio pendente</p>
      </div>

      <!-- Conclusão média -->
      <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <p class="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Conclusão média</p>
          <span class="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-blue-50 text-blue-600">
            <i class="fas fa-check-circle text-sm"></i>
          </span>
        </div>
        <p class="text-3xl font-bold text-blue-700">
          {{ resumoGeral.percConclusaoMedia.toFixed(2) }}%
        </p>
        <div class="w-full bg-slate-100 rounded-full h-2">
          <div
            class="h-2 rounded-full bg-blue-500 transition-all duration-500"
            :style="{ width: Math.min(resumoGeral.percConclusaoMedia, 100) + '%' }"
          ></div>
        </div>
        <p class="text-[11px] text-slate-500">Percentual médio concluído</p>
      </div>
    </div>

    <!-- Evolução mensal + Desempenho por tipo -->
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <!-- Evolução mensal -->
      <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 p-5 space-y-3">
        <div class="flex items-center gap-2">
          <div class="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center">
            <i class="fas fa-calendar-week text-indigo-600 text-sm"></i>
          </div>
          <h2 class="text-sm font-bold text-slate-800">Evolução mensal</h2>
        </div>
        <div v-if="agrupadoPorMes.length === 0" class="flex flex-col items-center justify-center py-8 text-slate-400">
          <i class="fas fa-calendar-times text-3xl mb-2"></i>
          <p class="text-xs">Nenhuma auditoria encontrada para o período selecionado.</p>
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="border-b-2 border-slate-100">
                <th
                  class="px-3 py-2.5 text-left font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors"
                  @click="atualizarOrdenacao(ordenacaoMes, 'mes')"
                >
                  <span class="inline-flex items-center gap-1">
                    Mês
                    <i class="fas text-[10px]" :class="ordenacaoMes.coluna === 'mes' ? (ordenacaoMes.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" />
                  </span>
                </th>
                <th
                  class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors"
                  @click="atualizarOrdenacao(ordenacaoMes, 'total')"
                >
                  <span class="inline-flex items-center gap-1">
                    Qtd
                    <i class="fas text-[10px]" :class="ordenacaoMes.coluna === 'total' ? (ordenacaoMes.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" />
                  </span>
                </th>
                <th
                  class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors"
                  @click="atualizarOrdenacao(ordenacaoMes, 'mediaParcial')"
                >
                  <span class="inline-flex items-center gap-1">
                    % Parcial
                    <i class="fas text-[10px]" :class="ordenacaoMes.coluna === 'mediaParcial' ? (ordenacaoMes.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" />
                  </span>
                </th>
                <th
                  class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors"
                  @click="atualizarOrdenacao(ordenacaoMes, 'mediaConclusao')"
                >
                  <span class="inline-flex items-center gap-1">
                    % Conclusão
                    <i class="fas text-[10px]" :class="ordenacaoMes.coluna === 'mediaConclusao' ? (ordenacaoMes.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" />
                  </span>
                </th>
                <th
                  class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors"
                  @click="atualizarOrdenacao(ordenacaoMes, 'taxaMeta')"
                >
                  <span class="inline-flex items-center gap-1">
                    % Meta
                    <i class="fas text-[10px]" :class="ordenacaoMes.coluna === 'taxaMeta' ? (ordenacaoMes.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="(m, idx) in agrupadoPorMes" :key="m.mes" class="transition-colors" :class="idx % 2 === 0 ? 'bg-white hover:bg-indigo-50/40' : 'bg-slate-50/60 hover:bg-indigo-50/40'">
                <td class="px-3 py-2.5 text-slate-700 font-medium">{{ m.mesFormatado }}</td>
                <td class="px-3 py-2.5 text-right">
                  <span class="inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold text-[11px]">{{ m.total }}</span>
                </td>
                <td class="px-3 py-2.5 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <div class="w-12 bg-slate-100 rounded-full h-1.5 hidden sm:block">
                      <div class="h-1.5 rounded-full transition-all" :class="m.mediaParcial > 3 ? 'bg-amber-400' : 'bg-emerald-400'" :style="{ width: Math.min(m.mediaParcial, 100) + '%' }"></div>
                    </div>
                    <span class="font-semibold" :class="m.mediaParcial > 3 ? 'text-amber-700' : 'text-emerald-700'">{{ m.mediaParcial.toFixed(2) }}%</span>
                  </div>
                </td>
                <td class="px-3 py-2.5 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <div class="w-12 bg-slate-100 rounded-full h-1.5 hidden sm:block">
                      <div class="h-1.5 rounded-full bg-blue-400 transition-all" :style="{ width: Math.min(m.mediaConclusao, 100) + '%' }"></div>
                    </div>
                    <span class="text-blue-700 font-semibold">{{ m.mediaConclusao.toFixed(2) }}%</span>
                  </div>
                </td>
                <td class="px-3 py-2.5 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <div class="w-12 bg-slate-100 rounded-full h-1.5 hidden sm:block">
                      <div class="h-1.5 rounded-full bg-emerald-400 transition-all" :style="{ width: Math.min(m.taxaMeta, 100) + '%' }"></div>
                    </div>
                    <span class="text-emerald-700 font-semibold">{{ m.taxaMeta.toFixed(1) }}%</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Desempenho por tipo -->
      <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 p-5 space-y-3">
        <div class="flex items-center gap-2">
          <div class="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center">
            <i class="fas fa-layer-group text-indigo-600 text-sm"></i>
          </div>
          <h2 class="text-sm font-bold text-slate-800">Desempenho por tipo de auditoria</h2>
        </div>
        <div v-if="desempenhoTipos.length === 0" class="flex flex-col items-center justify-center py-8 text-slate-400">
          <i class="fas fa-layer-group text-3xl mb-2"></i>
          <p class="text-xs">Nenhuma auditoria encontrada para o período selecionado.</p>
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="border-b-2 border-slate-100">
                <th
                  class="px-3 py-2.5 text-left font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors"
                  @click="atualizarOrdenacao(ordenacaoTipos, 'tipo')"
                >
                  <span class="inline-flex items-center gap-1">
                    Tipo
                    <i class="fas text-[10px]" :class="ordenacaoTipos.coluna === 'tipo' ? (ordenacaoTipos.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" />
                  </span>
                </th>
                <th
                  class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors"
                  @click="atualizarOrdenacao(ordenacaoTipos, 'total')"
                >
                  <span class="inline-flex items-center gap-1">
                    Qtd
                    <i class="fas text-[10px]" :class="ordenacaoTipos.coluna === 'total' ? (ordenacaoTipos.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" />
                  </span>
                </th>
                <th
                  class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors"
                  @click="atualizarOrdenacao(ordenacaoTipos, 'mediaParcial')"
                >
                  <span class="inline-flex items-center gap-1">
                    % Parcial
                    <i class="fas text-[10px]" :class="ordenacaoTipos.coluna === 'mediaParcial' ? (ordenacaoTipos.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" />
                  </span>
                </th>
                <th
                  class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors"
                  @click="atualizarOrdenacao(ordenacaoTipos, 'mediaConclusao')"
                >
                  <span class="inline-flex items-center gap-1">
                    % Conclusão
                    <i class="fas text-[10px]" :class="ordenacaoTipos.coluna === 'mediaConclusao' ? (ordenacaoTipos.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" />
                  </span>
                </th>
                <th
                  class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors"
                  @click="atualizarOrdenacao(ordenacaoTipos, 'taxaMeta')"
                >
                  <span class="inline-flex items-center gap-1">
                    % Meta
                    <i class="fas text-[10px]" :class="ordenacaoTipos.coluna === 'taxaMeta' ? (ordenacaoTipos.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="(t, idx) in desempenhoTipos" :key="t.tipo" class="transition-colors" :class="idx % 2 === 0 ? 'bg-white hover:bg-indigo-50/40' : 'bg-slate-50/60 hover:bg-indigo-50/40'">
                <td class="px-3 py-2.5">
                  <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold" :class="getTipoConfig(t.tipo).cor">
                    <i class="fas text-[9px]" :class="getTipoConfig(t.tipo).icone"></i>
                    {{ t.tipo }}
                  </span>
                </td>
                <td class="px-3 py-2.5 text-right">
                  <span class="inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold text-[11px]">{{ t.total }}</span>
                </td>
                <td class="px-3 py-2.5 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <div class="w-12 bg-slate-100 rounded-full h-1.5 hidden sm:block">
                      <div class="h-1.5 rounded-full transition-all" :class="t.mediaParcial > 3 ? 'bg-amber-400' : 'bg-emerald-400'" :style="{ width: Math.min(t.mediaParcial, 100) + '%' }"></div>
                    </div>
                    <span class="font-semibold" :class="t.mediaParcial > 3 ? 'text-amber-700' : 'text-emerald-700'">{{ t.mediaParcial.toFixed(2) }}%</span>
                  </div>
                </td>
                <td class="px-3 py-2.5 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <div class="w-12 bg-slate-100 rounded-full h-1.5 hidden sm:block">
                      <div class="h-1.5 rounded-full bg-blue-400 transition-all" :style="{ width: Math.min(t.mediaConclusao, 100) + '%' }"></div>
                    </div>
                    <span class="text-blue-700 font-semibold">{{ t.mediaConclusao.toFixed(2) }}%</span>
                  </div>
                </td>
                <td class="px-3 py-2.5 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <div class="w-12 bg-slate-100 rounded-full h-1.5 hidden sm:block">
                      <div class="h-1.5 rounded-full bg-emerald-400 transition-all" :style="{ width: Math.min(t.taxaMeta, 100) + '%' }"></div>
                    </div>
                    <span class="text-emerald-700 font-semibold">{{ t.taxaMeta.toFixed(1) }}%</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Desempenho por usuário + Desempenho por setor -->
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <!-- Desempenho por usuário -->
      <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 p-5 space-y-3">
        <div class="flex items-center gap-2">
          <div class="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center">
            <i class="fas fa-users text-indigo-600 text-sm"></i>
          </div>
          <h2 class="text-sm font-bold text-slate-800">Desempenho por usuário</h2>
          <span v-if="desempenhoUsuarios.length" class="ml-auto text-[10px] text-slate-400 font-medium">{{ desempenhoUsuarios.length }} usuário(s)</span>
        </div>
        <div v-if="desempenhoUsuarios.length === 0" class="flex flex-col items-center justify-center py-8 text-slate-400">
          <i class="fas fa-users text-3xl mb-2"></i>
          <p class="text-xs">Nenhuma informação de usuários encontrada no período.</p>
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="border-b-2 border-slate-100">
                <th
                  class="px-3 py-2.5 text-left font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors"
                  @click="atualizarOrdenacao(ordenacaoUsuarios, 'usuario'); paginaUsuarios = 1"
                >
                  <span class="inline-flex items-center gap-1">
                    Usuário
                    <i class="fas text-[10px]" :class="ordenacaoUsuarios.coluna === 'usuario' ? (ordenacaoUsuarios.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" />
                  </span>
                </th>
                <th
                  class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors"
                  @click="atualizarOrdenacao(ordenacaoUsuarios, 'lidos'); paginaUsuarios = 1"
                >
                  <span class="inline-flex items-center gap-1">
                    Itens Lidos
                    <i class="fas text-[10px]" :class="ordenacaoUsuarios.coluna === 'lidos' ? (ordenacaoUsuarios.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" />
                  </span>
                </th>
                <th
                  class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors"
                  @click="atualizarOrdenacao(ordenacaoUsuarios, 'comProblema'); paginaUsuarios = 1"
                >
                  <span class="inline-flex items-center gap-1">
                    Com erro
                    <i class="fas text-[10px]" :class="ordenacaoUsuarios.coluna === 'comProblema' ? (ordenacaoUsuarios.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" />
                  </span>
                </th>
                <th
                  class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors"
                  @click="atualizarOrdenacao(ordenacaoUsuarios, 'percProblema'); paginaUsuarios = 1"
                >
                  <span class="inline-flex items-center gap-1">
                    % Problemas
                    <i class="fas text-[10px]" :class="ordenacaoUsuarios.coluna === 'percProblema' ? (ordenacaoUsuarios.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="(u, idx) in desempenhoUsuariosPaginado" :key="u.usuario" class="transition-colors" :class="idx % 2 === 0 ? 'bg-white hover:bg-indigo-50/40' : 'bg-slate-50/60 hover:bg-indigo-50/40'">
                <td class="px-3 py-2.5 text-slate-700 font-medium">{{ u.usuario }}</td>
                <td class="px-3 py-2.5 text-right text-emerald-700 font-semibold">{{ u.lidos.toLocaleString('pt-BR') }}</td>
                <td class="px-3 py-2.5 text-right text-amber-700 font-semibold">{{ u.comProblema.toLocaleString('pt-BR') }}</td>
                <td class="px-3 py-2.5 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <div class="w-10 bg-slate-100 rounded-full h-1.5 hidden sm:block">
                      <div class="h-1.5 rounded-full bg-red-400 transition-all" :style="{ width: Math.min(u.percProblema * 5, 100) + '%' }"></div>
                    </div>
                    <span class="text-red-600 font-semibold">{{ u.percProblema.toFixed(2) }}%</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <!-- Paginação -->
        <div v-if="totalPaginasUsuarios > 1" class="flex items-center justify-between pt-2 border-t border-slate-100">
          <p class="text-[11px] text-slate-500">
            Página {{ paginaUsuarios }} de {{ totalPaginasUsuarios }}
          </p>
          <div class="flex items-center gap-1">
            <button
              @click="paginaUsuarios = 1"
              :disabled="paginaUsuarios === 1"
              class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"
            >
              <i class="fas fa-angle-double-left"></i>
            </button>
            <button
              @click="paginaUsuarios--"
              :disabled="paginaUsuarios === 1"
              class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"
            >
              <i class="fas fa-angle-left"></i>
            </button>
            <template v-for="p in totalPaginasUsuarios" :key="p">
              <button
                v-if="p === 1 || p === totalPaginasUsuarios || (p >= paginaUsuarios - 1 && p <= paginaUsuarios + 1)"
                @click="paginaUsuarios = p"
                class="min-w-[28px] px-2 py-1 rounded text-[11px] font-semibold transition"
                :class="p === paginaUsuarios ? 'bg-indigo-600 text-white shadow-sm' : 'hover:bg-slate-100 text-slate-600'"
              >
                {{ p }}
              </button>
              <span
                v-else-if="p === paginaUsuarios - 2 || p === paginaUsuarios + 2"
                class="text-slate-400 text-[11px] px-1"
              >...</span>
            </template>
            <button
              @click="paginaUsuarios++"
              :disabled="paginaUsuarios === totalPaginasUsuarios"
              class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"
            >
              <i class="fas fa-angle-right"></i>
            </button>
            <button
              @click="paginaUsuarios = totalPaginasUsuarios"
              :disabled="paginaUsuarios === totalPaginasUsuarios"
              class="px-2 py-1 rounded text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"
            >
              <i class="fas fa-angle-double-right"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- Desempenho por setor -->
      <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 p-5 space-y-3">
        <div class="flex items-center gap-2">
          <div class="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center">
            <i class="fas fa-store-alt text-indigo-600 text-sm"></i>
          </div>
          <h2 class="text-sm font-bold text-slate-800">Desempenho por setor</h2>
          <span v-if="desempenhoSetores.length" class="ml-auto text-[10px] text-slate-400 font-medium">{{ desempenhoSetores.length }} setor(es)</span>
        </div>
        <div v-if="desempenhoSetores.length === 0" class="flex flex-col items-center justify-center py-8 text-slate-400">
          <i class="fas fa-store-alt text-3xl mb-2"></i>
          <p class="text-xs">Nenhuma informação de setores encontrada no período.</p>
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="border-b-2 border-slate-100">
                <th
                  class="px-3 py-2.5 text-left font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors"
                  @click="atualizarOrdenacao(ordenacaoSetores, 'setor')"
                >
                  <span class="inline-flex items-center gap-1">
                    Setor
                    <i class="fas text-[10px]" :class="ordenacaoSetores.coluna === 'setor' ? (ordenacaoSetores.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" />
                  </span>
                </th>
                <th
                  class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors"
                  @click="atualizarOrdenacao(ordenacaoSetores, 'lidos')"
                >
                  <span class="inline-flex items-center gap-1">
                    Itens Lidos
                    <i class="fas text-[10px]" :class="ordenacaoSetores.coluna === 'lidos' ? (ordenacaoSetores.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" />
                  </span>
                </th>
                <th
                  class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors"
                  @click="atualizarOrdenacao(ordenacaoSetores, 'comProblema')"
                >
                  <span class="inline-flex items-center gap-1">
                    Com erro
                    <i class="fas text-[10px]" :class="ordenacaoSetores.coluna === 'comProblema' ? (ordenacaoSetores.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" />
                  </span>
                </th>
                <th
                  class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors"
                  @click="atualizarOrdenacao(ordenacaoSetores, 'percPendente')"
                >
                  <span class="inline-flex items-center gap-1">
                    % Pendentes
                    <i class="fas text-[10px]" :class="ordenacaoSetores.coluna === 'percPendente' ? (ordenacaoSetores.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" />
                  </span>
                </th>
                <th
                  class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors"
                  @click="atualizarOrdenacao(ordenacaoSetores, 'percProblema')"
                >
                  <span class="inline-flex items-center gap-1">
                    % Problemas
                    <i class="fas text-[10px]" :class="ordenacaoSetores.coluna === 'percProblema' ? (ordenacaoSetores.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="(s, idx) in desempenhoSetores" :key="s.setor" class="transition-colors" :class="idx % 2 === 0 ? 'bg-white hover:bg-indigo-50/40' : 'bg-slate-50/60 hover:bg-indigo-50/40'">
                <td class="px-3 py-2.5 text-slate-700 font-medium">{{ s.setor }}</td>
                <td class="px-3 py-2.5 text-right text-emerald-700 font-semibold">{{ s.lidos.toLocaleString('pt-BR') }}</td>
                <td class="px-3 py-2.5 text-right text-amber-700 font-semibold">{{ s.comProblema.toLocaleString('pt-BR') }}</td>
                <td class="px-3 py-2.5 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <div class="w-10 bg-slate-100 rounded-full h-1.5 hidden sm:block">
                      <div class="h-1.5 rounded-full transition-all" :class="s.percPendente > 3 ? 'bg-amber-400' : 'bg-emerald-400'" :style="{ width: Math.min(s.percPendente, 100) + '%' }"></div>
                    </div>
                    <span class="font-semibold" :class="s.percPendente > 3 ? 'text-amber-700' : 'text-emerald-700'">{{ s.percPendente.toFixed(2) }}%</span>
                  </div>
                </td>
                <td class="px-3 py-2.5 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <div class="w-10 bg-slate-100 rounded-full h-1.5 hidden sm:block">
                      <div class="h-1.5 rounded-full bg-red-400 transition-all" :style="{ width: Math.min(s.percProblema * 5, 100) + '%' }"></div>
                    </div>
                    <span class="text-red-600 font-semibold">{{ s.percProblema.toFixed(2) }}%</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Tabela detalhada de auditorias -->
    <div class="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-slate-100 p-5 space-y-3">
      <div class="flex items-center gap-2">
        <div class="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center">
          <i class="fas fa-table text-indigo-600 text-sm"></i>
        </div>
        <h2 class="text-sm font-bold text-slate-800">Lista detalhada das auditorias filtradas</h2>
        <span v-if="auditoriasParaTabela.length" class="ml-auto text-[10px] text-slate-400 font-medium">{{ auditoriasParaTabela.length }} registro(s)</span>
      </div>
      <div v-if="auditoriasParaTabela.length === 0" class="flex flex-col items-center justify-center py-10 text-slate-400">
        <i class="fas fa-search text-4xl mb-3"></i>
        <p class="text-sm font-medium">Nenhuma auditoria encontrada</p>
        <p class="text-xs mt-1">Tente ajustar os filtros selecionados.</p>
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead>
            <tr class="border-b-2 border-slate-100">
              <th
                class="px-3 py-2.5 text-left font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors"
                @click="atualizarOrdenacao(ordenacaoAuditorias, 'data')"
              >
                <span class="inline-flex items-center gap-1">
                  Data
                  <i class="fas text-[10px]" :class="ordenacaoAuditorias.coluna === 'data' ? (ordenacaoAuditorias.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" />
                </span>
              </th>
              <th
                class="px-3 py-2.5 text-left font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors"
                @click="atualizarOrdenacao(ordenacaoAuditorias, 'tipo')"
              >
                <span class="inline-flex items-center gap-1">
                  Tipo
                  <i class="fas text-[10px]" :class="ordenacaoAuditorias.coluna === 'tipo' ? (ordenacaoAuditorias.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" />
                </span>
              </th>
              <th
                class="px-3 py-2.5 text-left font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors"
                @click="atualizarOrdenacao(ordenacaoAuditorias, 'status')"
              >
                <span class="inline-flex items-center gap-1">
                  Status
                  <i class="fas text-[10px]" :class="ordenacaoAuditorias.coluna === 'status' ? (ordenacaoAuditorias.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" />
                </span>
              </th>
              <th
                class="px-3 py-2.5 text-left font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors"
                @click="atualizarOrdenacao(ordenacaoAuditorias, 'meta')"
              >
                <span class="inline-flex items-center gap-1">
                  Meta
                  <i class="fas text-[10px]" :class="ordenacaoAuditorias.coluna === 'meta' ? (ordenacaoAuditorias.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" />
                </span>
              </th>
              <th
                class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors"
                @click="atualizarOrdenacao(ordenacaoAuditorias, 'parcial')"
              >
                <span class="inline-flex items-center gap-1">
                  % Parcial
                  <i class="fas text-[10px]" :class="ordenacaoAuditorias.coluna === 'parcial' ? (ordenacaoAuditorias.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" />
                </span>
              </th>
              <th
                class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors"
                @click="atualizarOrdenacao(ordenacaoAuditorias, 'conclusao')"
              >
                <span class="inline-flex items-center gap-1">
                  % Conclusão
                  <i class="fas text-[10px]" :class="ordenacaoAuditorias.coluna === 'conclusao' ? (ordenacaoAuditorias.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" />
                </span>
              </th>
              <th
                class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors"
                @click="atualizarOrdenacao(ordenacaoAuditorias, 'totalItens')"
              >
                <span class="inline-flex items-center gap-1">
                  Itens
                  <i class="fas text-[10px]" :class="ordenacaoAuditorias.coluna === 'totalItens' ? (ordenacaoAuditorias.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" />
                </span>
              </th>
              <th
                class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors"
                @click="atualizarOrdenacao(ordenacaoAuditorias, 'pendentes')"
              >
                <span class="inline-flex items-center gap-1">
                  Pendentes
                  <i class="fas text-[10px]" :class="ordenacaoAuditorias.coluna === 'pendentes' ? (ordenacaoAuditorias.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" />
                </span>
              </th>
              <th
                class="px-3 py-2.5 text-right font-semibold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition-colors"
                @click="atualizarOrdenacao(ordenacaoAuditorias, 'lidos')"
              >
                <span class="inline-flex items-center gap-1">
                  Lidos
                  <i class="fas text-[10px]" :class="ordenacaoAuditorias.coluna === 'lidos' ? (ordenacaoAuditorias.direcao === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600') : 'fa-sort text-slate-300'" />
                </span>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-50">
            <tr
              v-for="(a, idx) in auditoriasParaTabela"
              :key="a.id"
              class="transition-colors cursor-pointer group"
              :class="idx % 2 === 0 ? 'bg-white hover:bg-indigo-50/40' : 'bg-slate-50/60 hover:bg-indigo-50/40'"
              @click="abrirAuditoria(a.id)"
            >
              <td class="px-3 py-2.5 text-slate-700 font-medium">
                <span class="group-hover:text-indigo-600 transition-colors">{{ a.dataFormatada }}</span>
              </td>
              <td class="px-3 py-2.5">
                <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold" :class="getTipoConfig(a.tipo).cor">
                  <i class="fas text-[9px]" :class="getTipoConfig(a.tipo).icone"></i>
                  {{ a.tipo }}
                </span>
              </td>
              <td class="px-3 py-2.5">
                <span
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                  :class="a.statusRaw === 'fechada' ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700'"
                >
                  <span class="h-1.5 w-1.5 rounded-full" :class="a.statusRaw === 'fechada' ? 'bg-emerald-500' : 'bg-sky-500'"></span>
                  {{ a.status }}
                </span>
              </td>
              <td class="px-3 py-2.5">
                <span
                  v-if="a.meta !== '-'"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                  :class="a.metaAlcancada ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'"
                >
                  <i class="fas text-[9px]" :class="a.metaAlcancada ? 'fa-check' : 'fa-times'"></i>
                  {{ a.metaAlcancada ? 'Dentro' : 'Fora' }}
                </span>
                <span v-else class="text-slate-400">-</span>
              </td>
              <td class="px-3 py-2.5 text-right">
                <span v-if="a.parcial != null" class="font-semibold" :class="a.parcial > 3 ? 'text-amber-700' : 'text-emerald-700'">{{ a.parcial.toFixed(2) }}%</span>
              </td>
              <td class="px-3 py-2.5 text-right">
                <span v-if="a.conclusao != null" class="text-blue-700 font-semibold">{{ a.conclusao.toFixed(2) }}%</span>
              </td>
              <td class="px-3 py-2.5 text-right text-slate-700">{{ typeof a.totalItens === 'number' ? a.totalItens.toLocaleString('pt-BR') : a.totalItens }}</td>
              <td class="px-3 py-2.5 text-right text-amber-700 font-semibold">{{ typeof a.pendentes === 'number' ? a.pendentes.toLocaleString('pt-BR') : a.pendentes }}</td>
              <td class="px-3 py-2.5 text-right text-emerald-700 font-semibold">{{ typeof a.lidos === 'number' ? a.lidos.toLocaleString('pt-BR') : a.lidos }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
