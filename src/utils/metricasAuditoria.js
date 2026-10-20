// Meta de % pendente; ajustável em Configurações (vale para as telas abertas depois da mudança).
export let META_PENDENTE_PERCENTUAL = 3
export const definirMetaPendente = (valor) => { META_PENDENTE_PERCENTUAL = valor }

// Métricas derivadas sempre do SKU atual: backups antigos podem trazer
// percentuais desatualizados dentro de `analise`.
export const metricasAuditoria = (auditoria) => {
  const analise = auditoria?.analise || {}
  const total = Number(auditoria?.sku || analise.totalItens || auditoria?.total || 0)
  const pendentes = Math.max(0, Number(analise.itensPendentes || 0))
  const lidos = Math.max(0, total - pendentes)
  const percentualConclusao = total > 0 ? Math.min(100, (lidos / total) * 100) : 0
  const percentualPendente = total > 0 ? Math.min(100, (pendentes / total) * 100) : 0
  return { total, pendentes, lidos, percentualConclusao, percentualPendente }
}

export const dentroDaMeta = auditoria => metricasAuditoria(auditoria).percentualPendente <= META_PENDENTE_PERCENTUAL

export const paraISOLocal = (data) => {
  const d = data instanceof Date ? data : new Date(data)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Segunda-feira da semana operacional (sex/sáb/dom já apontam para a próxima semana,
// como no calendário de auditorias).
export const inicioSemanaOperacional = (referencia = new Date()) => {
  const data = new Date(referencia)
  const dia = data.getDay()
  const diff = dia === 0 ? 1 : dia >= 5 ? 8 - dia : 1 - dia
  data.setDate(data.getDate() + diff)
  data.setHours(0, 0, 0, 0)
  return data
}

// Agenda da semana: para cada dia com auditoria planejada, o estado de cada tipo.
export const montarAgendaSemana = (auditorias, tiposPorDia, referencia = new Date()) => {
  const hoje = paraISOLocal(referencia)
  const inicio = inicioSemanaOperacional(referencia)
  const indice = new Map()
  for (const auditoria of auditorias || []) {
    const chave = `${String(auditoria?.data || '').slice(0, 10)}|${auditoria?.tipo}`
    const atual = indice.get(chave)
    if (!atual || auditoria.id > atual.id) indice.set(chave, auditoria)
  }

  const dias = []
  for (let i = 0; i < 7; i++) {
    const dia = new Date(inicio)
    dia.setDate(inicio.getDate() + i)
    const tipos = tiposPorDia?.[dia.getDay()] || []
    if (!tipos.length) continue
    const iso = paraISOLocal(dia)
    dias.push({
      data: iso,
      dia,
      ehHoje: iso === hoje,
      itens: tipos.map(tipo => {
        const auditoria = indice.get(`${iso}|${tipo}`) || null
        let estado
        if (auditoria) estado = auditoria.status === 'fechada' ? (dentroDaMeta(auditoria) ? 'meta' : 'foraMeta') : 'andamento'
        else estado = iso < hoje ? 'atrasada' : iso === hoje ? 'hoje' : 'futura'
        return { tipo, auditoria, estado }
      })
    })
  }
  return dias
}

// Últimas N auditorias de um tipo, em ordem cronológica, para a série de evolução.
export const serieEvolucao = (auditorias, tipo, limite = 10) => (auditorias || [])
  .filter(a => a?.tipo === tipo && metricasAuditoria(a).total > 0)
  .sort((a, b) => String(a.data).localeCompare(String(b.data)) || a.id - b.id)
  .slice(-limite)
  .map(a => ({ id: a.id, data: String(a.data).slice(0, 10), valor: metricasAuditoria(a).percentualPendente }))
