import { compactar, expandir } from './backupCompacto'

// Montar e ler o arquivo de backup, sem acesso ao banco nem à tela: roda no Web Worker
// (backup.worker.js) e, se ele não estiver disponível, na própria página.
//
// Versão 3: dados em formato colunar compacto (backupCompacto.js) + gzip.
// Versões 1 e 2 (JSON comum, com ou sem gzip) e o backup regional continuam sendo lidos.

const GZIP_MAGIC = [0x1f, 0x8b]

const gzip = texto => new Response(new Blob([texto]).stream().pipeThrough(new CompressionStream('gzip'))).blob()

// conteudo: { auditorias, vencimentos, planosAcao, naoVinculados, estoqueTotal, estoqueTotalInfo }; extras: { versao, geradoEm, configuracoes }
export const montarArquivoBackup = async (conteudo, extras) => {
  const texto = JSON.stringify({ ...extras, ...compactar(conteudo) })
  const compactado = typeof CompressionStream !== 'undefined' ? await gzip(texto) : null
  return {
    blob: compactado || new Blob([texto], { type: 'application/json;charset=utf-8' }),
    compactado: Boolean(compactado),
    tamanhoJson: texto.length
  }
}

const lerTexto = async (file) => {
  const inicio = new Uint8Array(await file.slice(0, 2).arrayBuffer())
  if (inicio[0] !== GZIP_MAGIC[0] || inicio[1] !== GZIP_MAGIC[1]) return file.text()
  if (typeof DecompressionStream === 'undefined') throw new Error('Este navegador não oferece suporte à leitura de backups compactados.')
  try {
    return await new Response(file.stream().pipeThrough(new DecompressionStream('gzip'))).text()
  } catch {
    throw new Error('O arquivo compactado está corrompido ou incompleto.')
  }
}

// Devolve o backup no formato de sempre ({ versao, auditorias, vencimentos, ... }).
export const lerArquivoBackup = async (file) => {
  const texto = await lerTexto(file)
  let dados
  try {
    dados = JSON.parse(texto)
  } catch {
    throw new Error('O arquivo não contém um JSON válido.')
  }
  if (dados && typeof dados === 'object' && typeof dados.formato === 'string' && 'corpo' in dados) {
    const { formato, dic, corpo, ...resto } = dados
    const expandido = expandir({ formato, dic, corpo })
    return { ...resto, ...expandido }
  }
  return dados
}
