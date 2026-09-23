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

