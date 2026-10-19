import { db } from './appDb'

// Ações do plano de uma auditoria, guardadas só neste navegador (IndexedDB).
export const STATUS_ACAO = [
  { valor: 'aberta', rotulo: 'A fazer' },
  { valor: 'andamento', rotulo: 'Em andamento' },
  { valor: 'feita', rotulo: 'Resolvida' }
]

export const listarAcoes = auditoriaId => db.planosAcao.where('auditoriaId').equals(auditoriaId).toArray()

export const salvarAcao = async (acao) => {
  const registro = { ...acao, atualizadoEm: new Date().toISOString() }
  const id = await db.planosAcao.put(registro)
  return { ...registro, id }
}

export const adicionarAcoes = async (acoes) => {
  const agora = new Date().toISOString()
  const registros = acoes.map(a => ({ ...a, criadoEm: agora, atualizadoEm: agora }))
  const ids = await db.planosAcao.bulkAdd(registros, { allKeys: true })
  return registros.map((r, i) => ({ ...r, id: ids[i] }))
}

export const removerAcao = id => db.planosAcao.delete(id)
