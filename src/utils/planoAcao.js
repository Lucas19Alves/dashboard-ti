import { META_PENDENTE_PERCENTUAL } from './metricasAuditoria'
import { interpretarLocal, nomeArea } from './mapaLoja'
import { codigoLocal, custoRupturaDoItem, itemPendente, localDoItem, setorDoItem, usuarioDoItem } from './itemAuditoria'
import { isItemLido } from './itemLido'
import { momentoLeitura } from './sinaisAuditoria'
import { tempoAtivoMs } from './historicoAuditorias'
import { afinidadePerfil, doPerfil, ritmoNaArea } from './perfilColaborador'

// Plano de ação a partir dos pendentes de uma auditoria e escala sugerida para a próxima.

const maisFrequente = mapa => [...mapa].sort((a, b) => b[1] - a[1])[0]?.[0] || ''
const contar = (mapa, chave) => mapa.set(chave, (mapa.get(chave) || 0) + 1)

const percDoLocal = d => {
  const total = (d?.lidos || 0) + (d?.pendentes || 0) + (d?.comProblema || 0)
  return total ? ((d?.pendentes || 0) / total) * 100 : 0
}
const ORDEM_PRIORIDADE = { alta: 0, media: 1, baixa: 2 }
const PRAZO_DIAS = { alta: 1, media: 2, baixa: 3 }
const moeda = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// O que fazer em cada local, pelo tipo da auditoria.
const descreverAcao = ({ tipo, pendentes, semLeitura, reincidente }) => {
  const n = `${pendentes} item(ns)`
  const base = semLeitura
    ? `Local sem leitura: auditar o local inteiro (${n})`
    : tipo === 'Etiqueta' ? `Conferir e atualizar a etiqueta de ${n}`
      : tipo === 'Presença' || tipo === 'Ruptura' ? `Conferir a presença de ${n} e repor a gôndola`
        : `Conferir ${n} pendente(s)`
  return reincidente ? `${base}. Reincidente: rever exposição/endereçamento do local` : base
}

// Uma ação por local com pendentes.
// Prioridade: % pendente acima da meta, local sem leitura, reincidência nas auditorias anteriores
// do mesmo tipo, volume de pendentes e custo de ruptura.
// Responsável: quem tem o local no perfil (área, setor ou família), com bom acerto, entre as pessoas
// que leram nesta auditoria, sem acumular ações demais na mesma pessoa.
// opcoes: { anteriores: auditorias do mesmo tipo antes desta, perfis: perfisColaboradores(...) }
export const gerarAcoes = (auditoria, meta = META_PENDENTE_PERCENTUAL, { anteriores = [], perfis = null } = {}) => {
  const setores = new Map()
  const custos = new Map()
  const leitoresPorArea = new Map()
  for (const item of Array.isArray(auditoria?.dados) ? auditoria.dados : []) {
    const local = localDoItem(item)
    if (itemPendente(item)) {
      const s = setores.get(local) || new Map()
      contar(s, setorDoItem(item))
      setores.set(local, s)
      const custo = custoRupturaDoItem(item)
      if (custo > 0) custos.set(local, (custos.get(local) || 0) + custo)
    }
    const usuario = usuarioDoItem(item)
    if (usuario && isItemLido(item)) {
      const bloco = interpretarLocal(local).bloco
      const u = leitoresPorArea.get(bloco) || new Map()
      contar(u, usuario)
      leitoresPorArea.set(bloco, u)
    }
  }
  // Reincidência: em quantas auditorias anteriores (mesmo tipo) o local ficou fora da meta.
  const historicoLocal = new Map()
  for (const anterior of anteriores) {
    for (const [local, d] of Object.entries(anterior?.analise?.porLocal || {})) {
      const r = historicoLocal.get(local) || { auditorias: 0, fora: 0 }
      r.auditorias++
      if (percDoLocal(d) > meta) r.fora++
      historicoLocal.set(local, r)
    }
  }

  const acoes = Object.entries(auditoria?.analise?.porLocal || {})
    .map(([local, d]) => {
      const total = (d?.lidos || 0) + (d?.pendentes || 0) + (d?.comProblema || 0)
      const pendentes = d?.pendentes || 0
      const perc = total ? (pendentes / total) * 100 : 0
      const info = interpretarLocal(local)
      const semLeitura = total > 0 && !(d?.lidos || 0) && !(d?.comProblema || 0)
      const hist = historicoLocal.get(local) || { auditorias: 0, fora: 0 }
      const reincidente = perc > meta && hist.fora >= 2
      const custo = custos.get(local) || 0
      const pontos = Math.min(4, perc / Math.max(0.1, meta)) + (semLeitura ? 3 : 0) + (perc > meta ? hist.fora * 0.8 : 0) + Math.log10(1 + pendentes) + (custo > 0 ? Math.log10(1 + custo) / 2 : 0)
      const prioridade = perc <= meta ? 'baixa' : semLeitura || reincidente || pontos >= 5 ? 'alta' : 'media'
      const motivos = [
        semLeitura ? 'Sem leitura' : `${perc.toFixed(1).replace('.', ',')}% pendente`,
        hist.fora ? `Fora da meta em ${hist.fora} de ${hist.auditorias} anteriores` : '',
        custo > 0 ? `${moeda(custo)} em ruptura` : ''
      ].filter(Boolean)
      return {
        local: codigoLocal(local),
        localOriginal: local,
        bloco: info.bloco,
        tipoArea: info.tipo,
        numero: info.numero,
        area: nomeArea({ ...info }),
        setor: maisFrequente(setores.get(local) || new Map()),
        pendentes,
        total,
        perc,
        semLeitura,
        reincidente,
        reincidencias: hist.fora,
        custo,
        pontos,
        motivos,
        prioridade,
        prazoDias: PRAZO_DIAS[prioridade],
        descricao: descreverAcao({ tipo: auditoria?.tipo, pendentes, semLeitura, reincidente }),
        responsavelSugerido: maisFrequente(leitoresPorArea.get(info.bloco) || new Map())
      }
    })
    .filter(a => a.pendentes > 0)
    .sort((a, b) => ORDEM_PRIORIDADE[a.prioridade] - ORDEM_PRIORIDADE[b.prioridade] || b.pontos - a.pontos || b.pendentes - a.pendentes)

  // Responsável pelo perfil, distribuindo a carga (minutos estimados) entre as pessoas do dia.
  const pessoas = Object.keys(auditoria?.analise?.porUsuario || {}).filter(u => perfis?.get(u))
  if (perfis && pessoas.length) {
    const cargaMin = new Map(pessoas.map(u => [u, 0]))
    const mediaCarga = () => [...cargaMin.values()].reduce((s, v) => s + v, 0) / pessoas.length || 1
    const qtd = new Map(pessoas.map(u => [u, 0]))
    const mediaQtd = () => [...qtd.values()].reduce((s, v) => s + v, 0) / pessoas.length || 1
    for (const acao of acoes) {
      const area = { bloco: acao.bloco, tipo: acao.tipoArea, numero: acao.numero }
      const opcoes = pessoas.map(u => {
        const perfil = perfis.get(u)
        const ok = doPerfil(perfil, area, acao.setor)
        const nota = (ok ? 1 : 0.15) * (0.2 + afinidadePerfil(perfil, area, acao.setor)) * (0.85 + 0.15 * perfil.acerto)
        return { u, ok, nota: nota / (1 + cargaMin.get(u) / Math.max(30, mediaCarga()) + 0.5 * (qtd.get(u) / Math.max(2, mediaQtd()))) }
      }).sort((a, b) => b.nota - a.nota)
      const escolhido = opcoes[0]
      if (!escolhido || (!escolhido.ok && acao.responsavelSugerido)) continue
      acao.responsavelSugerido = escolhido.u
      acao.estimativaMin = Math.max(2, Math.round((acao.pendentes / ritmoNaArea(perfis.get(escolhido.u), area, 120)) * 60))
      cargaMin.set(escolhido.u, cargaMin.get(escolhido.u) + acao.estimativaMin)
      qtd.set(escolhido.u, qtd.get(escolhido.u) + 1)
    }
  }
  return acoes
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
