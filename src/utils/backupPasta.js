import { reactive, watch } from 'vue'
import { db } from '../db/appDb'
import { gerarBackupArquivo } from './backup'
import { estadoBackup, marcarBackupFeito } from './lembreteBackup'
import { diasDesde } from './saudeDados'

// Backup automático numa pasta escolhida pelo usuário (Chrome/Edge, File System Access API).
// Grava sempre o mesmo arquivo (dashboard-ti-backup.json.gz), substituindo o anterior.
// O arquivo fica no computador (ex.: pasta do OneDrive/rede da empresa); nada passa por servidor.
const CHAVE = 'pastaBackup'
// Sempre o mesmo arquivo, substituído a cada backup (não acumula cópias na pasta).
const NOME_ARQUIVO = 'dashboard-ti-backup'
const ESPERA_MS = 20000 // junta mudanças seguidas num só backup

export const suportaPasta = typeof window !== 'undefined' && 'showDirectoryPicker' in window

// Automático funcionando: pasta escolhida e acesso liberado neste navegador.
export const backupAutomaticoAtivo = () => estadoPasta.configurada && estadoPasta.permissao === 'granted'

export const estadoPasta = reactive({
  suportado: suportaPasta,
  configurada: false,
  nome: '',
  permissao: 'prompt', // granted | prompt | denied
  salvando: false,
  ultimoAutomatico: null,
  erro: ''
})

let handle = null

// Cópias datadas da versão anterior do backup automático: apagadas para liberar espaço.
const PADRAO_ANTIGO = /^dashboard-ti-backup-\d{4}-\d{2}-\d{2}-[\d-]+\.json(\.gz)?$/

const verificarPermissao = async () => {
  if (!handle) return 'prompt'
  try {
    estadoPasta.permissao = await handle.queryPermission({ mode: 'readwrite' })
  } catch {
    estadoPasta.permissao = 'prompt'
  }
  return estadoPasta.permissao
}

export const carregarPasta = async () => {
  if (!suportaPasta) return
  try {
    const registro = await db.config.get(CHAVE)
    handle = registro?.handle || null
    estadoPasta.configurada = Boolean(handle)
    estadoPasta.nome = handle?.name || ''
    estadoPasta.ultimoAutomatico = registro?.ultimo ? new Date(registro.ultimo) : null
    if (handle) await verificarPermissao()
  } catch (e) {
    estadoPasta.erro = e?.message || String(e)
  }
}

// Precisa de um clique do usuário (o navegador pede confirmação).
export const escolherPasta = async () => {
  if (!suportaPasta) return false
  try {
    handle = await window.showDirectoryPicker({ id: 'dashboard-ti-backup', mode: 'readwrite' })
  } catch {
    return false // cancelado
  }
  await db.config.put({ chave: CHAVE, handle, ultimo: estadoPasta.ultimoAutomatico?.toISOString() || null })
  estadoPasta.configurada = true
  estadoPasta.nome = handle.name
  estadoPasta.permissao = 'granted'
  estadoPasta.erro = ''
  await salvarNaPasta()
  return true
}

// Após reabrir o navegador, a permissão volta a "perguntar": também precisa de um clique.
export const permitirPasta = async () => {
  if (!handle) return false
  try {
    estadoPasta.permissao = await handle.requestPermission({ mode: 'readwrite' })
  } catch {
    estadoPasta.permissao = 'denied'
  }
  if (estadoPasta.permissao === 'granted') await salvarNaPasta()
  return estadoPasta.permissao === 'granted'
}

export const desativarPasta = async () => {
  handle = null
  await db.config.delete(CHAVE)
  Object.assign(estadoPasta, { configurada: false, nome: '', permissao: 'prompt', erro: '' })
}

const apagarAntigos = async (atual) => {
  const nomes = []
  for await (const [nome, entrada] of handle.entries()) {
    const outraExtensao = nome.startsWith(`${NOME_ARQUIVO}.json`) && nome !== atual
    if (entrada.kind === 'file' && (PADRAO_ANTIGO.test(nome) || outraExtensao)) nomes.push(nome)
  }
  for (const nome of nomes) await handle.removeEntry(nome).catch(() => {})
}

export const salvarNaPasta = async () => {
  if (!handle || estadoPasta.salvando) return false
  if ((await verificarPermissao()) !== 'granted') return false
  estadoPasta.salvando = true
  try {
    const { blob, compactado } = await gerarBackupArquivo()
    const nome = `${NOME_ARQUIVO}.json${compactado ? '.gz' : ''}`
    const arquivo = await handle.getFileHandle(nome, { create: true })
    // createWritable grava num arquivo temporário e só substitui o anterior ao fechar:
    // se algo falhar no meio, o último backup bom continua lá.
    const escrita = await arquivo.createWritable()
    await escrita.write(blob)
    await escrita.close()
    await apagarAntigos(nome)
    const agora = new Date()
    marcarBackupFeito(agora)
    estadoPasta.ultimoAutomatico = agora
    estadoPasta.erro = ''
    await db.config.put({ chave: CHAVE, handle, ultimo: agora.toISOString() })
    return true
  } catch (e) {
    estadoPasta.erro = e?.message || String(e)
    return false
  } finally {
    estadoPasta.salvando = false
  }
}

// Liga o automático: salva ao abrir (se passou um dia ou há mudanças) e após cada mudança grande.
let timer = null
export const iniciarBackupAutomatico = async () => {
  watch(() => estadoBackup.alteracoes.length, (n, antes) => {
    if (!(n > antes) || !estadoPasta.configurada) return
    clearTimeout(timer)
    timer = setTimeout(salvarNaPasta, ESPERA_MS)
  })
  await carregarPasta()
  if (!estadoPasta.configurada || estadoPasta.permissao !== 'granted') return
  const dias = diasDesde(estadoBackup.ultimo)
  if (dias === null || dias >= 1 || estadoBackup.alteracoes.length) await salvarNaPasta()
}
