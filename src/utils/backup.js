import { db } from '../db/appDb'

const STATUS_STORAGE_KEY = 'dashboard_ti_auditorias_status'

const carregarStatusLocal = () => {
  try {
    const raw = localStorage.getItem(STATUS_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

const salvarStatusLocal = (map) => {
  try {
    localStorage.setItem(STATUS_STORAGE_KEY, JSON.stringify(map || {}))
  } catch {
  }
}

export const exportarBackupJson = async () => {
  const auditorias = await db.auditorias.toArray()
  const vencimentos = await db.vencimentos.toArray()
  const statusMap = carregarStatusLocal()
  const auditoriasComStatus = auditorias.map(a => {
    const statusPersistido = statusMap && statusMap[a.id]
    return {
      ...a,
      status: statusPersistido || a.status || 'em_andamento'
    }
  })
  const payload = {
    versao: 1,
    geradoEm: new Date().toISOString(),
    auditorias: auditoriasComStatus,
    vencimentos
  }
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `dashboard-ti-backup-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export const importarBackupJson = async (file) => {
  const texto = await file.text()
  const dados = JSON.parse(texto)
  const auditorias = Array.isArray(dados.auditorias) ? dados.auditorias : []
  const vencimentos = Array.isArray(dados.vencimentos) ? dados.vencimentos : []
  await db.transaction('rw', db.auditorias, db.vencimentos, async () => {
    await db.auditorias.clear()
    await db.vencimentos.clear()
    if (auditorias.length) {
      await db.auditorias.bulkAdd(
        auditorias.map(a => {
          const copia = { ...a }
          if (!copia.id) delete copia.id
          return copia
        })
      )
    }
    if (vencimentos.length) {
      await db.vencimentos.bulkAdd(vencimentos)
    }
  })
  const statusMap = {}
  auditorias.forEach(a => {
    if (a && a.id != null) {
      statusMap[a.id] = a.status === 'fechada' ? 'fechada' : 'em_andamento'
    }
  })
  salvarStatusLocal(statusMap)
  return { auditorias, vencimentos }
}
