import { reactive } from 'vue'
import { obterUltimoBackup, registrarBackupRealizado } from './saudeDados'

// Alterações importantes feitas desde o último backup (auditoria nova, dados enviados,
// exclusões, vencimentos importados). Ficam neste navegador e zeram a cada backup.
const CHAVE = 'dashboard_ti_alteracoes_sem_backup'
const MAXIMO = 50

const lerAlteracoes = () => {
  try {
    const lista = JSON.parse(localStorage.getItem(CHAVE) || '[]')
    return Array.isArray(lista) ? lista : []
  } catch {
    return []
  }
}
const salvar = () => {
  try { localStorage.setItem(CHAVE, JSON.stringify(estadoBackup.alteracoes)) } catch {}
}

export const estadoBackup = reactive({
  ultimo: obterUltimoBackup(),
  alteracoes: lerAlteracoes()
})

export const registrarAlteracao = (descricao) => {
  estadoBackup.alteracoes = [...estadoBackup.alteracoes, { descricao, em: new Date().toISOString() }].slice(-MAXIMO)
  salvar()
}

export const marcarBackupFeito = (quando = new Date()) => {
  registrarBackupRealizado(quando)
  estadoBackup.ultimo = quando
  estadoBackup.alteracoes = []
  salvar()
}

// Depois de restaurar um backup, os dados locais são iguais ao arquivo: nada pendente.
export const limparAlteracoes = () => {
  estadoBackup.alteracoes = []
  salvar()
}

// "2 auditorias novas · 1 exclusão" a partir das descrições registradas.
export const resumirAlteracoes = (alteracoes) => {
  const contagem = new Map()
  for (const a of alteracoes || []) contagem.set(a.descricao, (contagem.get(a.descricao) || 0) + 1)
  return [...contagem].map(([descricao, n]) => (n > 1 ? `${n}× ${descricao}` : descricao)).join(' · ')
}
