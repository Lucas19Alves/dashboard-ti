import { META_PENDENTE_PERCENTUAL } from './metricasAuditoria'
import { tendencia } from './analiseHistorica'
import { codigoDoItem, codigoLocal, custoRupturaDoItem, fornecedorDoItem, itemPendente, localDoItem, produtoDoItem, setorDoItem, usuarioDoItem } from './itemAuditoria'
import { isItemLido } from './itemLido'
import { momentoLeitura } from './sinaisAuditoria'
import { PAUSA_MINUTOS } from './trajetoUsuario'

// Análises entre várias auditorias: reincidência, evolução de usuários e ruptura em valor.

const dataDe = a => String(a?.data || '').slice(0, 10)
const emOrdem = lista => [...(lista || [])].filter(Boolean).sort((a, b) => dataDe(a).localeCompare(dataDe(b)) || (a.id || 0) - (b.id || 0))
const percentual = (parte, total) => (total ? (parte / total) * 100 : 0)
const pendenteDoLocal = d => {
  const total = (d?.lidos || 0) + (d?.pendentes || 0) + (d?.comProblema || 0)
  return { total, pendentes: d?.pendentes || 0, perc: percentual(d?.pendentes || 0, total) }
}

// ---------- Reincidência por local ----------
// Para cada local: em quantas auditorias apareceu e em quantas ficou acima da meta.
export const reincidenciaLocais = (auditorias, meta = META_PENDENTE_PERCENTUAL) => {
  const mapa = new Map()
  for (const auditoria of emOrdem(auditorias)) {
    for (const [local, d] of Object.entries(auditoria?.analise?.porLocal || {})) {
      const { total, pendentes, perc } = pendenteDoLocal(d)
      if (!total) continue
      const r = mapa.get(local) || { chave: local, local: codigoLocal(local), auditorias: 0, foraMeta: 0, pendentes: 0, itens: 0, sequencia: 0, ultimaData: '', historico: [] }
      const fora = perc > meta
      r.auditorias++
      r.foraMeta += fora ? 1 : 0
      r.pendentes += pendentes
      r.itens += total
      r.sequencia = fora ? r.sequencia + 1 : 0 // auditorias seguidas (as mais recentes) fora da meta
      r.ultimaData = dataDe(auditoria)
      r.historico.push({ data: dataDe(auditoria), perc, fora })
      mapa.set(local, r)
    }
  }
  return [...mapa.values()]
    .map(r => ({ ...r, taxaFora: percentual(r.foraMeta, r.auditorias), percMedio: percentual(r.pendentes, r.itens), historico: r.historico.slice(-12) }))
    .sort((a, b) => b.foraMeta - a.foraMeta || b.taxaFora - a.taxaFora || b.pendentes - a.pendentes)
}

// Produtos que ficaram pendentes em mais de uma auditoria.
export const reincidenciaProdutos = (auditorias, minimo = 2) => {
  const mapa = new Map()
  for (const auditoria of emOrdem(auditorias)) {
    const vistos = new Set()
    for (const item of Array.isArray(auditoria?.dados) ? auditoria.dados : []) {
      if (!itemPendente(item)) continue
      const codigo = codigoDoItem(item)
      if (!codigo || vistos.has(codigo)) continue
      vistos.add(codigo)
      const r = mapa.get(codigo) || { codigo, produto: produtoDoItem(item), setor: setorDoItem(item), local: '', vezes: 0, ultimaData: '', custo: 0 }
      r.vezes++
      r.local = codigoLocal(localDoItem(item))
      r.ultimaData = dataDe(auditoria)
      r.custo += custoRupturaDoItem(item)
      mapa.set(codigo, r)
    }
  }
  return [...mapa.values()].filter(r => r.vezes >= minimo).sort((a, b) => b.vezes - a.vezes || b.custo - a.custo)
}

// Mapa de reincidência: cada local conta uma "ocorrência" por auditoria; fora da meta entra como
// pendente. O mapa da loja mostra então o % de ocorrências fora da meta por área.
export const mapaReincidencia = (auditorias, meta = META_PENDENTE_PERCENTUAL) => {
  const porLocal = {}
  for (const auditoria of auditorias || []) {
    for (const [local, d] of Object.entries(auditoria?.analise?.porLocal || {})) {
      const { total, perc } = pendenteDoLocal(d)
      if (!total) continue
      const destino = (porLocal[local] ??= { lidos: 0, pendentes: 0, comProblema: 0 })
      if (perc > meta) destino.pendentes++
      else destino.lidos++
    }
  }
  // Uma linha por local (com o histórico) para o painel e a lista de locais de cada área.
  const dados = reincidenciaLocais(auditorias, meta).map(r => ({ ...r, Local: r.chave }))
  return { analise: { porLocal }, dados }
}

// ---------- Evolução dos usuários ----------
// Tempo ativo: soma dos intervalos entre leituras seguidas, ignorando pausas.
export const tempoAtivoMs = (instantes) => {
  const ordenados = [...instantes].sort((a, b) => a - b)
  let total = 0
  for (let i = 1; i < ordenados.length; i++) {
    const gap = ordenados[i] - ordenados[i - 1]
    if (gap <= PAUSA_MINUTOS * 60000) total += gap
  }
  return total
}

// subindo | caindo | estavel | indefinida (sem juízo de valor: ritmo subir é bom, problema subir é ruim).
const sentido = (valores) => {
  const { direcao } = tendencia(valores)
  return direcao === 'melhorando' ? 'caindo' : direcao === 'piorando' ? 'subindo' : direcao
}

export const evolucaoUsuarios = (auditorias) => {
  const mapa = new Map()
  for (const auditoria of emOrdem(auditorias)) {
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
    for (const [usuario, d] of Object.entries(auditoria?.analise?.porUsuario || {})) {
      const leituras = (d?.lidos || 0) + (d?.comProblema || 0)
      if (!leituras) continue
      const ativo = tempoAtivoMs(instantes.get(usuario) || [])
      const u = mapa.get(usuario) || { usuario, serie: [] }
      u.serie.push({
        auditoriaId: auditoria.id,
        data: dataDe(auditoria),
        tipo: auditoria.tipo,
        leituras,
        percProblema: percentual(d?.comProblema || 0, leituras),
        ritmo: ativo >= 10 * 60000 ? leituras / (ativo / 3600000) : null // menos de 10 min não é base confiável
      })
      mapa.set(usuario, u)
    }
  }
  return [...mapa.values()].map(u => {
    const ritmos = u.serie.map(s => s.ritmo).filter(v => v !== null)
    const media = lista => (lista.length ? lista.reduce((s, v) => s + v, 0) / lista.length : null)
    return {
      ...u,
      auditorias: u.serie.length,
      leituras: u.serie.reduce((s, x) => s + x.leituras, 0),
      ritmoMedio: media(ritmos),
      ritmoRecente: media(ritmos.slice(-3)),
      percProblemaMedio: media(u.serie.map(s => s.percProblema)),
      tendenciaRitmo: sentido(ritmos.slice(-8)),
      tendenciaProblema: sentido(u.serie.slice(-8).map(s => s.percProblema))
    }
  }).sort((a, b) => b.leituras - a.leituras)
}

// ---------- Ruptura em valor ----------
// Soma o "Custo Ruptura" dos itens que ficaram sem presença (pendentes) em cada auditoria.
export const rupturaEmValor = (auditorias) => {
  const porFornecedor = new Map()
  const porSetor = new Map()
  const porMes = new Map()
  const porProduto = new Map()
  let total = 0
  let itens = 0
  const somar = (mapa, chave, valor, extra = {}) => {
    const r = mapa.get(chave) || { chave, valor: 0, itens: 0, ...extra }
    r.valor += valor
    r.itens++
    mapa.set(chave, r)
  }
  for (const auditoria of emOrdem(auditorias)) {
    const mes = dataDe(auditoria).slice(0, 7)
    let totalAuditoria = 0
    for (const item of Array.isArray(auditoria?.dados) ? auditoria.dados : []) {
      if (!itemPendente(item)) continue
      const custo = custoRupturaDoItem(item)
      if (custo <= 0) continue
      total += custo
      itens++
      totalAuditoria += custo
      somar(porFornecedor, fornecedorDoItem(item), custo)
      somar(porSetor, setorDoItem(item), custo)
      somar(porProduto, codigoDoItem(item) || produtoDoItem(item), custo, { produto: produtoDoItem(item), fornecedor: fornecedorDoItem(item) })
    }
    if (mes) {
      const m = porMes.get(mes) || { chave: mes, valor: 0, auditorias: 0 }
      m.valor += totalAuditoria
      m.auditorias++
      porMes.set(mes, m)
    }
  }
  const ordenar = mapa => [...mapa.values()].sort((a, b) => b.valor - a.valor).map(r => ({ ...r, participacao: percentual(r.valor, total) }))
  const meses = [...porMes.values()].sort((a, b) => a.chave.localeCompare(b.chave)).map(m => ({ ...m, mediaPorAuditoria: m.auditorias ? m.valor / m.auditorias : 0 }))
  return {
    total,
    itens,
    porFornecedor: ordenar(porFornecedor),
    porSetor: ordenar(porSetor),
    porProduto: ordenar(porProduto).slice(0, 50),
    meses,
    tendencia: sentido(meses.map(m => m.mediaPorAuditoria))
  }
}
