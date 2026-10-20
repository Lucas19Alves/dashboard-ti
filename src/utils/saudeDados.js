// Acompanha a "saúde" dos dados locais: último backup e uso do armazenamento do navegador.
const CHAVE_ULTIMO_BACKUP = 'dashboard_ti_ultimo_backup'
export const DIAS_LEMBRETE_BACKUP = 1

export const registrarBackupRealizado = (quando = new Date()) => {
  try {
    localStorage.setItem(CHAVE_ULTIMO_BACKUP, quando.toISOString())
  } catch {
  }
}

export const obterUltimoBackup = () => {
  try {
    const valor = localStorage.getItem(CHAVE_ULTIMO_BACKUP)
    const data = valor ? new Date(valor) : null
    return data && !Number.isNaN(data.getTime()) ? data : null
  } catch {
    return null
  }
}

export const diasDesde = (data, agora = new Date()) => {
  if (!data) return null
  return Math.max(0, Math.floor((agora.getTime() - data.getTime()) / 86_400_000))
}

export const descreverUltimoBackup = (data, agora = new Date()) => {
  const dias = diasDesde(data, agora)
  if (dias === null) return 'Nenhum backup registrado neste navegador'
  if (dias === 0) return 'Backup feito hoje'
  if (dias === 1) return 'Último backup ontem'
  return `Último backup há ${dias} dias`
}

// Lembra quando há dados e: nunca houve backup, passou um dia ou houve mudanças grandes depois dele.
export const precisaLembrarBackup = (data, temDados, agora = new Date(), alteracoes = 0, diasLembrete = DIAS_LEMBRETE_BACKUP) => {
  if (!temDados) return false
  if (alteracoes > 0) return true
  const dias = diasDesde(data, agora)
  return dias === null || dias >= diasLembrete
}

export const formatarBytes = (bytes) => {
  const valor = Number(bytes) || 0
  if (valor < 1024) return `${valor} B`
  if (valor < 1024 ** 2) return `${(valor / 1024).toFixed(1)} KB`
  if (valor < 1024 ** 3) return `${(valor / 1024 ** 2).toFixed(1)} MB`
  return `${(valor / 1024 ** 3).toFixed(2)} GB`
}

export const obterUsoArmazenamento = async () => {
  const storage = globalThis.navigator?.storage
  if (!storage?.estimate) return null
  try {
    const [estimativa, persistente] = await Promise.all([
      storage.estimate(),
      storage.persisted ? storage.persisted() : Promise.resolve(false)
    ])
    return { usado: estimativa.usage || 0, cota: estimativa.quota || 0, persistente: Boolean(persistente) }
  } catch {
    return null
  }
}

// Pede ao navegador para não apagar o IndexedDB automaticamente quando faltar espaço.
export const solicitarArmazenamentoPersistente = async () => {
  const storage = globalThis.navigator?.storage
  if (!storage?.persist) return false
  try {
    return await storage.persist()
  } catch {
    return false
  }
}
