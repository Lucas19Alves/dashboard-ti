import { META_PENDENTE_PERCENTUAL, metricasAuditoria } from './metricasAuditoria'
import { isItemLido } from './itemLido'
import { temEstoque, usuarioDoItem } from './itemAuditoria'
import { momentoLeitura } from './sinaisAuditoria'

// Previsão de fechamento da auditoria a partir do ritmo de leitura recente.
// Os horários vêm da própria planilha ("Auditado em"); o "agora" é a última leitura registrada.

const HORA = 3600000
const segundosDoHorario = (hhmm) => {
  const [h, m] = String(hhmm || '20:00').split(':').map(Number)
  return ((h || 0) * 60 + (m || 0)) * 60
}

export const previsaoAuditoria = (auditoria, { fim = '20:00', meta = META_PENDENTE_PERCENTUAL, janelaMinutos = 60, passoMinutos = 15 } = {}) => {
  const dados = Array.isArray(auditoria?.dados) ? auditoria.dados : []
  // Só leituras que reduzem o pendente (itens com estoque).
  const leituras = []
  for (const item of dados) {
    if (!isItemLido(item) || !temEstoque(item)) continue
    const momento = momentoLeitura(item)
    if (momento) leituras.push({ instante: momento.instante, data: momento.data, usuario: usuarioDoItem(item) })
  }
  if (!leituras.length) return null

  // Dia da auditoria: o informado ou o dia com mais leituras.
  const contagem = new Map()
  leituras.forEach(l => contagem.set(l.data, (contagem.get(l.data) || 0) + 1))
  const dataAuditoria = String(auditoria?.data || '').slice(0, 10)
  const dia = contagem.has(dataAuditoria) ? dataAuditoria : [...contagem].sort((a, b) => b[1] - a[1])[0][0]
  const doDia = leituras.filter(l => l.data === dia).sort((a, b) => a.instante - b.instante)
  if (!doDia.length) return null

  const { total, pendentes, percentualPendente } = metricasAuditoria(auditoria)
  const inicioDia = Date.parse(`${dia}T00:00:00Z`)
  const fimInstante = inicioDia + segundosDoHorario(fim) * 1000
  const ultima = doDia.at(-1).instante
  const primeira = doDia[0].instante

  const janela = janelaMinutos * 60000
  const recentes = doDia.filter(l => l.instante > ultima - janela)
  const ritmo = recentes.length * (HORA / janela) // leituras por hora
  const pessoasAtivas = new Set(recentes.map(l => l.usuario).filter(Boolean)).size
  const ritmoPorPessoa = pessoasAtivas ? ritmo / pessoasAtivas : 0
  const ritmoMedio = ultima > primeira ? doDia.length / ((ultima - primeira) / HORA) : 0

  const permitido = Math.floor((total * meta) / 100)
  const faltam = Math.max(0, pendentes - permitido)
  const horasRestantes = Math.max(0, (fimInstante - ultima) / HORA)
  const pendentesPrevistos = Math.max(0, Math.round(pendentes - ritmo * horasRestantes))
  const percentualPrevisto = total ? (pendentesPrevistos / total) * 100 : 0
  const instanteMeta = faltam === 0 ? ultima : ritmo > 0 ? ultima + (faltam / ritmo) * HORA : null
  const ritmoNecessario = faltam === 0 ? 0 : horasRestantes > 0 ? faltam / horasRestantes : Infinity
  const pessoasNecessarias = faltam === 0 ? 0 : ritmoPorPessoa > 0 && Number.isFinite(ritmoNecessario) ? Math.ceil(ritmoNecessario / ritmoPorPessoa) : null

  // Curva do pendente: pendente em t = pendente atual + leituras feitas depois de t.
  const passo = passoMinutos * 60000
  const serie = []
  let indice = 0
  const inicioSerie = Math.floor(primeira / passo) * passo
  for (let t = inicioSerie; t <= ultima + passo - 1; t += passo) {
    const corte = Math.min(t, ultima)
    while (indice < doDia.length && doDia[indice].instante <= corte) indice++
    serie.push({ instante: corte, pendentes: pendentes + (doDia.length - indice), real: true })
  }
  const projecao = []
  if (fimInstante > ultima) {
    for (let t = ultima; t <= fimInstante; t += passo) {
      projecao.push({ instante: t, pendentes: Math.max(0, pendentes - ritmo * ((t - ultima) / HORA)) })
    }
    if (projecao.at(-1)?.instante !== fimInstante) projecao.push({ instante: fimInstante, pendentes: pendentesPrevistos })
  }

  let situacao
  if (faltam === 0) situacao = 'naMeta'
  else if (instanteMeta !== null && instanteMeta <= fimInstante) situacao = 'noPrazo'
  else if (ritmo > 0) situacao = 'atrasada'
  else situacao = 'parada'

  return {
    dia, total, pendentes, percentualPendente, permitido, faltam, meta,
    primeira, ultima, fimInstante, horasRestantes,
    ritmo, ritmoMedio, pessoasAtivas, ritmoPorPessoa, ritmoNecessario, pessoasNecessarias,
    pendentesPrevistos, percentualPrevisto, instanteMeta, situacao,
    serie, projecao
  }
}
