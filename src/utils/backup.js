import { db } from '../db/appDb'
import { limparAlteracoes, marcarBackupFeito } from './lembreteBackup'
import { carregarLayoutSalvo, layoutValido, salvarLayout } from './mapaLoja'

const STATUS_STORAGE_KEY = 'dashboard_ti_auditorias_status'
const BACKUP_VERSION = 2
const GZIP_MAGIC = [0x1f, 0x8b]

const limparStatusLocalLegado = () => {
  try {
    localStorage.removeItem(STATUS_STORAGE_KEY)
  } catch {
    // A importação continua válida quando o navegador bloqueia o localStorage.
  }
}

const baixarBlob = (blob, nome) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nome
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

const criarNomeBackup = (compactado) => {
  const agora = new Date()
  const data = agora.toISOString().slice(0, 10)
  const hora = agora.toTimeString().slice(0, 8).replaceAll(':', '-')
  return `dashboard-ti-backup-${data}-${hora}.json${compactado ? '.gz' : ''}`
}

const compactarGzip = async (blob) => {
  if (typeof CompressionStream === 'undefined') return null

  const stream = blob.stream().pipeThrough(new CompressionStream('gzip'))
  return new Response(stream, {
    headers: { 'Content-Type': 'application/gzip' }
  }).blob()
}

const arquivoEhGzip = async (file) => {
  const bytes = new Uint8Array(await file.slice(0, 2).arrayBuffer())
  return bytes[0] === GZIP_MAGIC[0] && bytes[1] === GZIP_MAGIC[1]
}

const lerTextoBackup = async (file) => {
  if (!(await arquivoEhGzip(file))) return file.text()

  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Este navegador não oferece suporte à leitura de backups compactados.')
  }

  try {
    const stream = file.stream().pipeThrough(new DecompressionStream('gzip'))
    return await new Response(stream).text()
  } catch {
    throw new Error('O arquivo compactado está corrompido ou incompleto.')
  }
}

export const validarBackup = (dados) => {
  if (!dados || typeof dados !== 'object' || Array.isArray(dados)) {
    throw new Error('O arquivo não contém um backup válido.')
  }

  if (!Number.isInteger(dados.versao) || dados.versao < 1 || dados.versao > BACKUP_VERSION) {
    throw new Error('A versão deste backup não é compatível com o sistema.')
  }

  if (!Array.isArray(dados.auditorias) || !Array.isArray(dados.vencimentos)) {
    throw new Error('Backup inválido: auditorias ou vencimentos estão ausentes.')
  }

  const registroInvalido = [...dados.auditorias, ...dados.vencimentos]
    .some(item => !item || typeof item !== 'object' || Array.isArray(item))

  if (registroInvalido) {
    throw new Error('Backup inválido: um ou mais registros estão corrompidos.')
  }

  // Configurações são opcionais (backups antigos não têm); se vierem, precisam ser válidas.
  const mapa = dados.configuracoes?.mapaLoja
  if (mapa != null && !layoutValido(mapa)) {
    throw new Error('Backup inválido: o layout do mapa da loja está corrompido.')
  }

  return dados
}

const numero = valor => Number.isFinite(Number(valor)) ? Number(valor) : 0

const converterSessaoRegional = (sessao, regiao, indice) => {
  const lojas = Array.isArray(sessao.stores) ? sessao.stores : []
  const resumo = sessao.summary && typeof sessao.summary === 'object' ? sessao.summary : {}
  const data = sessao.isoDate || sessao.weekStart || ''
  const hoje = new Date().toISOString().slice(0, 10)
  const status = data && data < hoje ? 'fechada' : 'em_andamento'
  const totalItens = numero(resumo.totalSku)
  const itensPendentes = numero(resumo.pendingItems)
  const totalLidos = numero(resumo.updatedItems) || Math.max(0, totalItens - itensPendentes)
  const porLoja = Object.fromEntries(lojas.map((loja, lojaIndice) => {
    const nome = loja.name || loja.code || `Loja ${lojaIndice + 1}`
    return [nome, {
      lidos: numero(loja.updatedItems),
      pendentes: numero(loja.pendingItems),
      comProblema: numero(loja.outdatedItems),
      desatualizados: numero(loja.outdatedItems),
      total: numero(loja.totalSku),
      cancelada: Boolean(loja.cancelled || loja.isCancelled)
    }]
  }))
  const dados = lojas.map(loja => ({
    Código: loja.code || '',
    Produto: loja.name || '',
    Setor: loja.name || regiao || 'Regional',
    Local: loja.name || '',
    Situação: loja.cancelled || loja.isCancelled ? 'Auditoria cancelada' : loja.status || 'Ativa',
    'Estoque atual': numero(loja.totalSku),
    _regional: true,
    _totalSku: numero(loja.totalSku),
    _pendentes: numero(loja.pendingItems),
    _atualizados: numero(loja.updatedItems),
    _desatualizados: numero(loja.outdatedItems),
    _percentualLido: numero(loja.readPct),
    _percentualPendente: numero(loja.pendingPct),
    _precisao: numero(loja.accuracyPct),
    _cancelada: Boolean(loja.cancelled || loja.isCancelled)
  }))
  const analise = {
    totalItens,
    totalLidos,
    itensLidos: totalLidos,
    itensLidosCorretamente: totalLidos,
    itensPendentes,
    itensAtualizados: numero(resumo.updatedItems),
    itensDesatualizados: numero(resumo.outdatedItems),
    itensLidosComProblema: numero(resumo.outdatedItems),
    itensComEstoqueZero: 0,
    itensLidoNaoPertence: 0,
    itensComEstoqueZeroDetalhes: [],
    itensLidoNaoPertenceDetalhes: [],
    parcialPercentual: numero(resumo.pendingPct),
    percentualConclusao: numero(resumo.readPct),
    usuarios: [],
    porUsuario: {},
    porSetor: porLoja,
    porLocal: porLoja,
    setoresParados: lojas.filter(loja => numero(loja.updatedItems) === 0).map(loja => loja.name || loja.code),
    locaisSemLeitura: lojas.filter(loja => numero(loja.updatedItems) === 0).map(loja => loja.name || loja.code),
    regional: {
      regiao,
      sessaoId: sessao.id || `sessao-${indice + 1}`,
      dia: sessao.dayLabel || '',
      arquivoOrigem: sessao.sourceFile || '',
      enviadoEm: sessao.uploadedAt || '',
      resumo,
      previsao: sessao.forecast || null
    }
  }

  return {
    data,
    tipo: sessao.auditType || 'Presença',
    sku: totalItens,
    status,
    dados,
    analise,
    parcial: analise.parcialPercentual,
    total: totalItens,
    metaAlcancada: analise.parcialPercentual <= 3,
    origem: 'backup-regional'
  }
}

export const normalizarFormatoBackup = dados => {
  if (dados && Array.isArray(dados.sessions)) {
    const regiao = dados.regionId || 'regional'
    return {
      versao: BACKUP_VERSION,
      geradoEm: dados.exportedAt || new Date().toISOString(),
      auditorias: dados.sessions.map((sessao, indice) => converterSessaoRegional(sessao || {}, regiao, indice)),
      vencimentos: [],
      origem: 'backup-regional',
      regiao
    }
  }

  if (dados && Array.isArray(dados.auditorias) && Array.isArray(dados.vencimentos) && dados.versao == null) {
    return { ...dados, versao: 1, origem: 'backup-json-legado' }
  }

  return dados
}

// Monta o arquivo de backup (JSON compactado em gzip quando o navegador permite).
export const gerarBackupArquivo = async () => {
  const auditorias = await db.auditorias.toArray()
  const vencimentos = await db.vencimentos.toArray()
  const planosAcao = await db.planosAcao.toArray()
  const auditoriasComStatus = auditorias.map(a => ({ ...a, status: a.status || 'em_andamento' }))
  const payload = {
    versao: BACKUP_VERSION,
    geradoEm: new Date().toISOString(),
    auditorias: auditoriasComStatus,
    vencimentos,
    planosAcao,
    configuracoes: { mapaLoja: carregarLayoutSalvo() }
  }

  const jsonBlob = new Blob([JSON.stringify(payload)], {
    type: 'application/json;charset=utf-8'
  })
  const gzipBlob = await compactarGzip(jsonBlob)
  const blob = gzipBlob || jsonBlob
  return {
    blob,
    nome: criarNomeBackup(Boolean(gzipBlob)),
    compactado: Boolean(gzipBlob),
    tamanhoOriginal: jsonBlob.size,
    tamanhoFinal: blob.size
  }
}

export const exportarBackupJson = async () => {
  const { blob, nome, ...info } = await gerarBackupArquivo()
  baixarBlob(blob, nome)
  marcarBackupFeito()
  return info
}

export const importarBackupJson = async (file) => {
  if (!file || typeof file.slice !== 'function') {
    throw new Error('Selecione um arquivo de backup válido.')
  }

  const texto = await lerTextoBackup(file)
  let dados
  try {
    dados = validarBackup(normalizarFormatoBackup(JSON.parse(texto)))
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('O arquivo não contém um JSON válido.')
    }
    throw error
  }

  const auditorias = dados.auditorias
  const vencimentos = dados.vencimentos

  // A validação acontece antes desta transação para nunca apagar a base atual
  // por causa de um arquivo incompleto ou de formato incorreto.
  // Planos de ação só são substituídos quando o backup os traz (backups antigos não têm).
  const planosAcao = Array.isArray(dados.planosAcao) ? dados.planosAcao.filter(p => p && typeof p === 'object') : null
  await db.transaction('rw', db.auditorias, db.vencimentos, db.planosAcao, async () => {
    await db.auditorias.clear()
    await db.vencimentos.clear()
    if (auditorias.length) await db.auditorias.bulkAdd(auditorias)
    if (vencimentos.length) await db.vencimentos.bulkAdd(vencimentos)
    if (planosAcao) {
      await db.planosAcao.clear()
      if (planosAcao.length) await db.planosAcao.bulkAdd(planosAcao)
    }
  })

  limparStatusLocalLegado()
  limparAlteracoes()
  // Restaura o layout do mapa só quando o backup tem um; senão mantém o atual.
  if (dados.configuracoes?.mapaLoja) salvarLayout(dados.configuracoes.mapaLoja)

  return { auditorias, vencimentos, versao: dados.versao, origem: dados.origem || 'dashboard-ti' }
}
