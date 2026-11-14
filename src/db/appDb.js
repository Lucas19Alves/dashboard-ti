import Dexie from 'dexie'
import { corrigirEstoqueDosItens } from '../utils/itemAuditoria'

export const db = new Dexie('dashboard_ti_db')

db.version(1).stores({
  auditorias: '++id',
  vencimentos: '++id'
})

// Índices para filtros e evoluções futuras sem varrer toda a base.
db.version(2).stores({
  auditorias: '++id, data, tipo, status, [data+tipo]',
  vencimentos: '++id, _validadeISO, _prazo, _setor, _fornecedor, _codigo'
})


// Plano de ação por auditoria (ações geradas dos pendentes, editadas localmente).
db.version(3).stores({
  auditorias: '++id, data, tipo, status, [data+tipo]',
  vencimentos: '++id, _validadeISO, _prazo, _setor, _fornecedor, _codigo',
  planosAcao: '++id, auditoriaId, status'
})

// Configurações que precisam ficar no IndexedDB (ex.: pasta do backup automático).
db.version(4).stores({
  auditorias: '++id, data, tipo, status, [data+tipo]',
  vencimentos: '++id, _validadeISO, _prazo, _setor, _fornecedor, _codigo',
  planosAcao: '++id, auditoriaId, status',
  config: 'chave'
})

// Itens não vinculados a local (um registro por código, com status do tratamento).
db.version(5).stores({
  auditorias: '++id, data, tipo, status, [data+tipo]',
  vencimentos: '++id, _validadeISO, _prazo, _setor, _fornecedor, _codigo',
  planosAcao: '++id, auditoriaId, status',
  config: 'chave',
  naoVinculados: 'codigo, status'
})

// (Versão 7, não 6: a 6 chegou a existir em navegadores de desenvolvimento com outro esquema.)
// Itens das auditorias numa tabela própria: ao abrir, o sistema lê só o resumo das auditorias
// (rápido) e mostra a tela; os itens chegam em segundo plano. Migra os itens que estavam dentro
// de cada auditoria.
db.version(7).stores({
  auditorias: '++id, data, tipo, status, [data+tipo]',
  vencimentos: '++id, _validadeISO, _prazo, _setor, _fornecedor, _codigo',
  planosAcao: '++id, auditoriaId, status',
  config: 'chave',
  naoVinculados: 'codigo, status',
  itensAuditoria: 'auditoriaId'
}).upgrade(async (tx) => {
  const auditorias = await tx.table('auditorias').toArray()
  await tx.table('itensAuditoria').bulkPut(auditorias.map(a => ({ auditoriaId: a.id, dados: Array.isArray(a.dados) ? a.dados : [] })))
  await tx.table('auditorias').toCollection().modify((a) => { delete a.dados })
})

// Planilha de estoque total da loja (um registro por código; a importação substitui a anterior).
// Data e nome do arquivo ficam em config ('estoqueTotal').
db.version(8).stores({
  auditorias: '++id, data, tipo, status, [data+tipo]',
  vencimentos: '++id, _validadeISO, _prazo, _setor, _fornecedor, _codigo',
  planosAcao: '++id, auditoriaId, status',
  config: 'chave',
  naoVinculados: 'codigo, status',
  itensAuditoria: 'auditoriaId',
  estoqueTotal: 'codigo'
})

// Histórico do estoque: uma foto por data da planilha (utils/historicoEstoque.js).
// estoqueFotos guarda o resumo (data, arquivo, total); estoqueFotoItens, os itens da foto.
db.version(9).stores({
  auditorias: '++id, data, tipo, status, [data+tipo]',
  vencimentos: '++id, _validadeISO, _prazo, _setor, _fornecedor, _codigo',
  planosAcao: '++id, auditoriaId, status',
  config: 'chave',
  naoVinculados: 'codigo, status',
  itensAuditoria: 'auditoriaId',
  estoqueTotal: 'codigo',
  estoqueFotos: 'id',
  estoqueFotoItens: 'id'
}).upgrade(async (tx) => {
  // Estoque das auditorias: "9.051,374 KG" era lido como 9,051 (ponto de milhar como decimal).
  await tx.table('itensAuditoria').toCollection().modify((r) => { corrigirEstoqueDosItens(r.dados) })
})
