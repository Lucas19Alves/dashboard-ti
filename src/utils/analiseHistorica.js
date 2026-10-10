import { META_PENDENTE_PERCENTUAL, dentroDaMeta, metricasAuditoria, paraISOLocal } from './metricasAuditoria'

const dataISO = auditoria => String(auditoria?.data || '').slice(0, 10)
const ehDataISO = valor => /^\d{4}-\d{2}-\d{2}$/.test(valor)
const media = valores => (valores.length ? valores.reduce((s, v) => s + v, 0) / valores.length : 0)

const NOMES_MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
export const rotuloMes = chave => {
  const [ano, mes] = String(chave).split('-')
  return `${NOMES_MESES[Number(mes) - 1] || mes}/${String(ano).slice(2)}`
}

// ---------- Período ----------
const PERIODOS_MESES = { '1m': 1, '3m': 3, '6m': 6, '12m': 12 }

// Retorna { inicio, fim } em ISO (inclusive). `null` = sem limite.
export const intervaloDoPeriodo = ({ tipo = 'rapido', periodo = '12m', inicio = '', fim = '' } = {}, referencia = new Date()) => {
  if (tipo === 'personalizado') {
    return { inicio: ehDataISO(inicio) ? inicio : null, fim: ehDataISO(fim) ? fim : null }
  }
  const meses = PERIODOS_MESES[periodo]
  if (!meses) return { inicio: null, fim: null }
  const d = new Date(referencia)
  d.setMonth(d.getMonth() - meses)
  return { inicio: paraISOLocal(d), fim: paraISOLocal(referencia) }
}

// Período imediatamente anterior com a mesma duração, para comparação.
export const intervaloAnterior = ({ inicio, fim }) => {
  if (!inicio || !fim) return null
  const [ai, mi, di] = inicio.split('-').map(Number)
  const [af, mf, df] = fim.split('-').map(Number)
  const ini = new Date(ai, mi - 1, di)
  const dias = Math.round((new Date(af, mf - 1, df) - ini) / 86_400_000)
  const fimAnterior = new Date(ini)
  fimAnterior.setDate(fimAnterior.getDate() - 1)
  const iniAnterior = new Date(fimAnterior)
  iniAnterior.setDate(iniAnterior.getDate() - dias)
  return { inicio: paraISOLocal(iniAnterior), fim: paraISOLocal(fimAnterior) }
}

export const dentroDoIntervalo = (auditoria, intervalo) => {
  const data = dataISO(auditoria)
  if (!ehDataISO(data)) return false
  if (intervalo?.inicio && data < intervalo.inicio) return false
  if (intervalo?.fim && data > intervalo.fim) return false
  return true
}

// ---------- Resumo ----------
export const resumirAuditorias = (lista) => {
  const auditorias = lista || []
  const fechadas = auditorias.filter(a => a.status === 'fechada')
  const dentro = fechadas.filter(dentroDaMeta).length
  const metricas = auditorias.map(metricasAuditoria).filter(m => m.total > 0)
  return {
    total: auditorias.length,
    abertas: auditorias.length - fechadas.length,
    fechadas: fechadas.length,
    dentroMeta: dentro,
    foraMeta: fechadas.length - dentro,
    taxaMeta: fechadas.length ? (dentro / fechadas.length) * 100 : null,
    mediaPendente: metricas.length ? media(metricas.map(m => m.percentualPendente)) : null,
    mediaConclusao: metricas.length ? media(metricas.map(m => m.percentualConclusao)) : null,
    itensAuditados: metricas.reduce((s, m) => s + m.total, 0),
    itensPendentes: metricas.reduce((s, m) => s + m.pendentes, 0)
  }
}

export const variacao = (atual, anterior) => (atual === null || anterior === null || atual === undefined || anterior === undefined ? null : atual - anterior)

// ---------- Agrupamentos ----------
const agrupar = (lista, chave) => {
  const mapa = new Map()
  for (const auditoria of lista || []) {
    const k = chave(auditoria)
    if (!k) continue
    if (!mapa.has(k)) mapa.set(k, [])
    mapa.get(k).push(auditoria)
  }
  return mapa
}

export const agruparPorMes = lista => [...agrupar(lista, a => (ehDataISO(dataISO(a)) ? dataISO(a).slice(0, 7) : null))]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([mes, itens]) => ({ mes, rotulo: rotuloMes(mes), ...resumirAuditorias(itens) }))

export const agruparPorTipo = lista => [...agrupar(lista, a => a.tipo || 'Desconhecido')]
  .map(([tipo, itens]) => ({ tipo, ...resumirAuditorias(itens) }))
  .sort((a, b) => a.tipo.localeCompare(b.tipo))

// Inclinação da regressão linear da série cronológica (para % pendente, menor = melhor).
export const tendencia = (valores) => {
  const pontos = (valores || []).filter(v => Number.isFinite(v))
  if (pontos.length < 3) return { direcao: 'indefinida', inclinacao: 0 }
  const n = pontos.length
  const mx = (n - 1) / 2
  const my = media(pontos)
  let num = 0
  let den = 0
  pontos.forEach((y, x) => { num += (x - mx) * (y - my); den += (x - mx) ** 2 })
  const inclinacao = den ? num / den : 0
  const direcao = Math.abs(inclinacao) < 0.1 ? 'estavel' : inclinacao < 0 ? 'melhorando' : 'piorando'
  return { direcao, inclinacao }
}

// ---------- Setores ----------
const percentual = (parte, total) => (total > 0 ? (parte / total) * 100 : 0)

// Consolida setores ao longo das auditorias, com histórico por auditoria para detectar reincidência.
export const consolidarSetores = (lista) => {
  const ordenadas = [...(lista || [])].sort((a, b) => dataISO(a).localeCompare(dataISO(b)) || a.id - b.id)
  const mapa = new Map()
  for (const auditoria of ordenadas) {
    for (const [setor, d] of Object.entries(auditoria?.analise?.porSetor || {})) {
      const lidos = d?.lidos || 0
      const pendentes = d?.pendentes || 0
      const comProblema = d?.comProblema || 0
      const total = lidos + pendentes + comProblema
      if (!total) continue
      if (!mapa.has(setor)) mapa.set(setor, { setor, lidos: 0, pendentes: 0, comProblema: 0, historico: [] })
      const s = mapa.get(setor)
      s.lidos += lidos
      s.pendentes += pendentes
      s.comProblema += comProblema
      s.historico.push({ id: auditoria.id, data: dataISO(auditoria), valor: percentual(pendentes, total) })
    }
  }
  return [...mapa.values()].map(s => {
    const total = s.lidos + s.pendentes + s.comProblema
    const acimaDaMeta = s.historico.filter(h => h.valor > META_PENDENTE_PERCENTUAL).length
    return {
      ...s,
      total,
      auditorias: s.historico.length,
      percPendente: percentual(s.pendentes, total),
      percProblema: percentual(s.comProblema, total),
      acimaDaMeta,
      reincidencia: s.historico.length ? (acimaDaMeta / s.historico.length) * 100 : 0,
      ultimo: s.historico.at(-1)?.valor ?? null,
      // Tendência recente: as últimas 8 auditorias refletem melhor a situação atual.
      tendencia: tendencia(s.historico.slice(-8).map(h => h.valor)).direcao
    }
  })
}

// ---------- Usuários ----------
export const consolidarUsuarios = (lista) => {
  const mapa = new Map()
  for (const auditoria of lista || []) {
    for (const [usuario, d] of Object.entries(auditoria?.analise?.porUsuario || {})) {
      if (!mapa.has(usuario)) mapa.set(usuario, { usuario, lidos: 0, pendentes: 0, comProblema: 0, auditorias: 0, ultimaData: '' })
      const u = mapa.get(usuario)
      u.lidos += d?.lidos || 0
      u.pendentes += d?.pendentes || 0
      u.comProblema += d?.comProblema || 0
      u.auditorias++
      if (dataISO(auditoria) > u.ultimaData) u.ultimaData = dataISO(auditoria)
    }
  }
  return [...mapa.values()].map(u => {
    const leituras = u.lidos + u.comProblema
    return {
      ...u,
      leituras,
      total: u.lidos + u.pendentes + u.comProblema,
      percProblema: percentual(u.comProblema, leituras),
      mediaPorAuditoria: u.auditorias ? leituras / u.auditorias : 0
    }
  })
}

// ---------- Comparação entre auditorias ----------
export const auditoriaAnteriorDoTipo = (auditoria, todas) => (todas || [])
  .filter(a => a && a.id !== auditoria?.id && a.tipo === auditoria?.tipo && metricasAuditoria(a).total > 0)
  .filter(a => dataISO(a) < dataISO(auditoria) || (dataISO(a) === dataISO(auditoria) && a.id < auditoria.id))
  .sort((a, b) => dataISO(b).localeCompare(dataISO(a)) || b.id - a.id)[0] || null

const percentuaisPorSetor = (auditoria) => {
  const mapa = new Map()
  for (const [setor, d] of Object.entries(auditoria?.analise?.porSetor || {})) {
    const total = (d?.lidos || 0) + (d?.pendentes || 0) + (d?.comProblema || 0)
    if (total) mapa.set(setor, { valor: percentual(d?.pendentes || 0, total), pendentes: d?.pendentes || 0, total })
  }
  return mapa
}

export const compararAuditorias = (atual, anterior) => {
  if (!atual || !anterior) return null
  const ma = metricasAuditoria(atual)
  const mb = metricasAuditoria(anterior)
  const sa = percentuaisPorSetor(atual)
  const sb = percentuaisPorSetor(anterior)
  const setores = [...new Set([...sa.keys(), ...sb.keys()])].map(setor => {
    const a = sa.get(setor) || null
    const b = sb.get(setor) || null
    return {
      setor,
      atual: a?.valor ?? null,
      anterior: b?.valor ?? null,
      diferenca: a && b ? a.valor - b.valor : null,
      pendentesAtual: a?.pendentes ?? 0,
      pendentesAnterior: b?.pendentes ?? 0
    }
  })
  const comparaveis = setores.filter(s => s.diferenca !== null)
  return {
    atual: ma,
    anterior: mb,
    diferencaPendente: ma.percentualPendente - mb.percentualPendente,
    diferencaPendentes: ma.pendentes - mb.pendentes,
    setores: setores.sort((x, y) => (Math.abs(y.diferenca ?? 0) - Math.abs(x.diferenca ?? 0)) || x.setor.localeCompare(y.setor)),
    pioraram: comparaveis.filter(s => s.diferenca > 0.5).sort((x, y) => y.diferenca - x.diferenca),
    melhoraram: comparaveis.filter(s => s.diferenca < -0.5).sort((x, y) => x.diferenca - y.diferenca),
    novos: setores.filter(s => s.atual !== null && s.anterior === null).map(s => s.setor),
    ausentes: setores.filter(s => s.atual === null && s.anterior !== null).map(s => s.setor)
  }
}

// Quantos itens ainda precisam ser lidos para ficar dentro da meta (ou a folga, se negativo).
export const itensParaMeta = (auditoria, meta = META_PENDENTE_PERCENTUAL) => {
  const { total, pendentes } = metricasAuditoria(auditoria)
  if (!total) return null
  const permitido = Math.floor((total * meta) / 100)
  return pendentes - permitido
}

// ---------- Insights automáticos ----------
export const gerarInsights = ({ resumo, resumoAnterior, meses, tipos, setores }) => {
  const insights = []
  const t = tendencia(meses.map(m => m.mediaPendente).filter(v => v !== null))
  if (t.direcao === 'melhorando') insights.push({ tom: 'bom', icone: 'fas fa-arrow-trend-down', texto: 'O % pendente médio vem caindo mês a mês. A operação está melhorando.' })
  if (t.direcao === 'piorando') insights.push({ tom: 'ruim', icone: 'fas fa-arrow-trend-up', texto: 'O % pendente médio vem subindo mês a mês. Vale revisar a rotina das auditorias.' })

  const dPend = variacao(resumo.mediaPendente, resumoAnterior?.mediaPendente)
  if (dPend !== null && Math.abs(dPend) >= 0.1) {
    insights.push({
      tom: dPend < 0 ? 'bom' : 'ruim',
      icone: dPend < 0 ? 'fas fa-circle-arrow-down' : 'fas fa-circle-arrow-up',
      texto: `% pendente médio ${dPend < 0 ? 'caiu' : 'subiu'} ${Math.abs(dPend).toFixed(1)} p.p. em relação ao período anterior.`
    })
  }

  const comMedia = meses.filter(m => m.mediaPendente !== null)
  if (comMedia.length >= 2) {
    const melhor = comMedia.reduce((a, b) => (b.mediaPendente < a.mediaPendente ? b : a))
    insights.push({ tom: 'neutro', icone: 'fas fa-trophy', texto: `Melhor mês: ${melhor.rotulo}, com ${melhor.mediaPendente.toFixed(1)}% pendente em média.` })
  }

  const piorTipo = tipos.filter(x => x.taxaMeta !== null).sort((a, b) => a.taxaMeta - b.taxaMeta)[0]
  if (piorTipo && piorTipo.taxaMeta < 100) {
    insights.push({ tom: piorTipo.taxaMeta < 50 ? 'ruim' : 'neutro', icone: 'fas fa-layer-group', texto: `${piorTipo.tipo} é o tipo com menor taxa na meta (${piorTipo.taxaMeta.toFixed(0)}% das fechadas).` })
  }

  const reincidente = setores.filter(s => s.auditorias >= 3).sort((a, b) => b.reincidencia - a.reincidencia || b.percPendente - a.percPendente)[0]
  if (reincidente && reincidente.reincidencia >= 50) {
    insights.push({ tom: 'ruim', icone: 'fas fa-repeat', texto: `${reincidente.setor} ficou acima da meta em ${reincidente.acimaDaMeta} de ${reincidente.auditorias} auditorias.` })
  }
  return insights
}
