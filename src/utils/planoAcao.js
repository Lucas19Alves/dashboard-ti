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

// Divide as áreas (em ordem de caminhada) em grupos contíguos com carga parecida.
export const dividirAreas = (areas, pessoas) => {
  const lista = ordenarAreas(areas).filter(a => a.itens > 0)
  const n = Math.max(1, Math.min(pessoas, lista.length || 1))
  const grupos = Array.from({ length: n }, () => ({ areas: [], itens: 0 }))
  let restante = lista.reduce((s, a) => s + a.itens, 0)
  let g = 0
  lista.forEach((area, i) => {
    const gruposRestantes = n - g
    const alvo = restante / gruposRestantes
    const grupo = grupos[g]
    const areasRestantes = lista.length - i
    // Fecha o grupo se a área estoura o alvo (e o grupo já tem carga), ou se faltam áreas para os demais.
    const estoura = grupo.itens > 0 && grupo.itens + area.itens - alvo > alvo - grupo.itens
    if (g < n - 1 && grupo.areas.length && (estoura || areasRestantes < gruposRestantes)) {
      restante -= grupo.itens
      g++
    }
    grupos[g].areas.push(area)
    grupos[g].itens += area.itens
  })
  return grupos.filter(x => x.areas.length)
}

// Escala: pessoas necessárias para terminar no horário e divisão das áreas entre elas.
export const escalaSugerida = ({ areas = [], pessoas = 1, horas = 8, ritmoPorPessoa = 120 }) => {
  const totalItens = areas.reduce((s, a) => s + (a.itens || 0), 0)
  const capacidade = Math.max(1, ritmoPorPessoa * horas)
  const pessoasNecessarias = Math.max(1, Math.ceil(totalItens / capacidade))
  const grupos = dividirAreas(areas, pessoas).map((grupo, i) => ({
    ...grupo,
    pessoa: i + 1,
    horas: ritmoPorPessoa > 0 ? grupo.itens / ritmoPorPessoa : null
  }))
  const horasNecessarias = Math.max(0, ...grupos.map(gr => gr.horas || 0))
  return { totalItens, pessoasNecessarias, grupos, horasNecessarias, cabeNoHorario: horasNecessarias <= horas }
}
