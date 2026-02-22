import Dexie from 'dexie'

export const db = new Dexie('dashboard_ti_db')

db.version(1).stores({
  auditorias: '++id',
  vencimentos: '++id'
})

