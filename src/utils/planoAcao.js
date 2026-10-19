import { META_PENDENTE_PERCENTUAL } from './metricasAuditoria'
import { interpretarLocal, nomeArea } from './mapaLoja'
import { codigoLocal, itemPendente, localDoItem, setorDoItem, usuarioDoItem } from './itemAuditoria'
import { isItemLido } from './itemLido'
import { momentoLeitura } from './sinaisAuditoria'
import { tempoAtivoMs } from './historicoAuditorias'

// Plano de ação a partir dos pendentes de uma auditoria e escala sugerida para a próxima.

const maisFrequente = mapa => [...mapa].sort((a, b) => b[1] - a[1])[0]?.[0] || ''
const contar = (mapa, chave) => mapa.set(chave, (mapa.get(chave) || 0) + 1)

// Uma ação por local com pendentes: prioridade pelo % pendente e responsável sugerido
// (quem mais leu naquela área nesta auditoria).
export const gerarAcoes = (auditoria, meta = META_PENDENTE_PERCENTUAL) => {
  const setores = new Map()
  const leitoresPorArea = new Map()
  for (const item of Array.isArray(auditoria?.dados) ? auditoria.dados : []) {
    const local = localDoItem(item)
    if (itemPendente(item)) {
      const s = setores.get(local) || new Map()
      contar(s, setorDoItem(item))
      setores.set(local, s)
    }
    const usuario = usuarioDoItem(item)
    if (usuario && isItemLido(item)) {
      const bloco = interpretarLocal(local).bloco
      const u = leitoresPorArea.get(bloco) || new Map()
      contar(u, usuario)
      leitoresPorArea.set(bloco, u)
    }
  }
  return Object.entries(auditoria?.analise?.porLocal || {})
    .map(([local, d]) => {
      const total = (d?.lidos || 0) + (d?.pendentes || 0) + (d?.comProblema || 0)
      const pendentes = d?.pendentes || 0
      const perc = total ? (pendentes / total) * 100 : 0
      const info = interpretarLocal(local)
      return {
        local: codigoLocal(local),
        area: nomeArea({ ...info }),
        setor: maisFrequente(setores.get(local) || new Map()),
        pendentes,
        total,
        perc,
        semLeitura: total > 0 && !(d?.lidos || 0) && !(d?.comProblema || 0),
        prioridade: perc > meta * 2 || (total && !(d?.lidos || 0)) ? 'alta' : perc > meta ? 'media' : 'baixa',
        responsavelSugerido: maisFrequente(leitoresPorArea.get(info.bloco) || new Map())
      }
    })
    .filter(a => a.pendentes > 0)
    .sort((a, b) => ({ alta: 0, media: 1, baixa: 2 }[a.prioridade] - { alta: 0, media: 1, baixa: 2 }[b.prioridade]) || b.pendentes - a.pendentes)
}

// Ritmo por pessoa (leituras/h de tempo ativo) de cada usuário nesta auditoria.
export const ritmosDaAuditoria = (auditoria) => {
  const instantes = new Map()
  for (const item of Array.isArray(auditoria?.dados) ? auditoria.dados : []) {
    const usuario = usuarioDoItem(item)
    if (!usuario || !isItemLido(item)) continue
    const m = momentoLeitura(item)
    if (!m) continue
    const lista = instantes.get(usuario) || []
    lista.push(m.instante)
    instantes.set(usuario, lista)
  }
  return [...instantes].map(([usuario, lista]) => {
    const ativo = tempoAtivoMs(lista)
    return { usuario, leituras: lista.length, ritmo: ativo >= 10 * 60000 ? lista.length / (ativo / 3600000) : null }
  }).filter(r => r.ritmo !== null).sort((a, b) => b.ritmo - a.ritmo)
}

export const mediana = (valores) => {
  const v = [...valores].filter(Number.isFinite).sort((a, b) => a - b)
  if (!v.length) return null
  const meio = Math.floor(v.length / 2)
  return v.length % 2 ? v[meio] : (v[meio - 1] + v[meio]) / 2
}

const ORDEM_TIPOS = ['liquida', 'gondola', 'emporio', 'paredaoFrios', 'freezer', 'acougue', 'flv', 'outro']
// Ordem de caminhada: líquida e corredores em sequência, depois o bloco de frios/perecíveis.
export const ordenarAreas = areas => [...areas].sort((a, b) =>
  ORDEM_TIPOS.indexOf(a.tipo) - ORDEM_TIPOS.indexOf(b.tipo) || (a.numero || 0) - (b.numero || 0) || String(a.bloco).localeCompare(String(b.bloco)))

// ---------- Escala por afinidade ----------
// Histórico de leitura de cada colaborador em todas as auditorias: por área do mapa e por setor.
export const historicoLeitores = (auditorias) => {
  const mapa = new Map()
  for (const auditoria of auditorias || []) {
    for (const item of Array.isArray(auditoria?.dados) ? auditoria.dados : []) {
      const usuario = usuarioDoItem(item)
      if (!usuario || !isItemLido(item)) continue
      const h = mapa.get(usuario) || { usuario, total: 0, porArea: new Map(), porSetor: new Map() }
      h.total++
      contar(h.porArea, interpretarLocal(localDoItem(item)).bloco)
      contar(h.porSetor, setorDoItem(item))
      mapa.set(usuario, h)
    }
  }
  return mapa
}

// Setor predominante de cada área (pelos itens da auditoria).
export const setorPorArea = (auditoria) => {
  const porArea = new Map()
  for (const item of Array.isArray(auditoria?.dados) ? auditoria.dados : []) {
    const bloco = interpretarLocal(localDoItem(item)).bloco
    const m = porArea.get(bloco) || new Map()
    contar(m, setorDoItem(item))
    porArea.set(bloco, m)
  }
  return new Map([...porArea].map(([bloco, m]) => [bloco, maisFrequente(m)]))
}

// Afinidade 0–1: parcela das leituras da pessoa naquela área (60%) e no setor da área (40%).
export const afinidade = (historico, area, setor) => {
  if (!historico?.total) return 0
  const naArea = (historico.porArea.get(area) || 0) / historico.total
  const noSetor = setor ? (historico.porSetor.get(setor) || 0) / historico.total : 0
  return 0.6 * naArea + 0.4 * noSetor
}

// Distribui as áreas entre as pessoas escolhidas priorizando onde cada uma costuma ler,
// respeitando a capacidade de cada uma (ritmo próprio × horas disponíveis).
export const escalaPorAfinidade = ({ areas = [], pessoas = [], historico = new Map(), setores = new Map(), horas = 8, ritmoPadrao = 120 }) => {
  const lista = areas.filter(a => a.itens > 0)
  const totalItens = lista.reduce((s, a) => s + a.itens, 0)
  const pessoasNecessarias = Math.max(1, Math.ceil(totalItens / Math.max(1, ritmoPadrao * horas)))
  if (!pessoas.length) return { totalItens, pessoasNecessarias, grupos: [], horasNecessarias: 0, cabeNoHorario: false, aderencia: 0 }

  const ritmos = pessoas.map(p => p.ritmo > 0 ? p.ritmo : ritmoPadrao)
  const somaRitmos = ritmos.reduce((s, r) => s + r, 0)
  const grupos = pessoas.map((p, i) => ({ pessoa: i + 1, usuario: p.usuario, ritmo: ritmos[i], alvo: (totalItens * ritmos[i]) / somaRitmos, areas: [], itens: 0, itensHabituais: 0 }))
  const pontuar = area => grupos.map(g => ({ g, af: afinidade(historico.get(g.usuario), area.bloco, setores.get(area.bloco)) }))

  // Áreas com "dono" mais claro primeiro; entre elas, as maiores.
  const ordenadas = lista.map(area => {
    const notas = pontuar(area).sort((a, b) => b.af - a.af)
    return { area, notas, clareza: (notas[0]?.af || 0) - (notas[1]?.af || 0) }
  }).sort((a, b) => b.clareza - a.clareza || b.area.itens - a.area.itens)

  for (const { area, notas } of ordenadas) {
    const ocupacao = g => (g.itens + area.itens) / Math.max(1, g.alvo)
    let escolhido = notas.find(n => n.af > 0 && ocupacao(n.g) <= 1.1)?.g
    if (!escolhido) {
      const comHistorico = notas.filter(n => n.af > 0).sort((a, b) => ocupacao(a.g) - ocupacao(b.g))
      escolhido = comHistorico.length && ocupacao(comHistorico[0].g) <= 1.3 ? comHistorico[0].g : [...grupos].sort((a, b) => ocupacao(a) - ocupacao(b))[0]
    }
    const af = notas.find(n => n.g === escolhido)?.af || 0
    escolhido.areas.push({ ...area, setor: setores.get(area.bloco) || '', habitual: af > 0 })
    escolhido.itens += area.itens
    if (af > 0) escolhido.itensHabituais += area.itens
  }

  const resultado = grupos.map(g => {
    const h = historico.get(g.usuario)
    return {
      ...g,
      areas: ordenarAreas(g.areas),
      horas: g.itens / g.ritmo,
      aderencia: g.itens ? (g.itensHabituais / g.itens) * 100 : 0,
      setoresHabituais: h ? [...h.porSetor].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s]) => s) : []
    }
  })
  const horasNecessarias = Math.max(0, ...resultado.map(g => g.horas))
  const itensHabituais = resultado.reduce((s, g) => s + g.itensHabituais, 0)
  return { totalItens, pessoasNecessarias, grupos: resultado, horasNecessarias, cabeNoHorario: horasNecessarias <= horas, aderencia: totalItens ? (itensHabituais / totalItens) * 100 : 0 }
}
