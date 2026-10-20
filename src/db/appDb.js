import Dexie from 'dexie'

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
