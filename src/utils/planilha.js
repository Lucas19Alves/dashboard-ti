let worker
let proximoId = 0
const pendentes = new Map()
const cache = new WeakMap()

const normalizar = valor => String(valor ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase()

const obterWorker = () => {
  if (worker) return worker
  worker = new Worker(new URL('../workers/planilha.worker.js', import.meta.url), { type: 'module' })
  worker.onmessage = ({ data }) => {
    const requisicao = pendentes.get(data.id)
    if (!requisicao) return
    pendentes.delete(data.id)
    if (data.erro) requisicao.reject(new Error(data.erro))
    else requisicao.resolve(data.matriz)
  }
  worker.onerror = event => {
    const erro = new Error(event.message || 'Falha no processador de planilhas.')
    pendentes.forEach(({ reject }) => reject(erro))
    pendentes.clear()
    worker?.terminate()
    worker = null
  }
  return worker
}

const lerMatrizNoWorker = file => new Promise((resolve, reject) => {
  const id = ++proximoId
  pendentes.set(id, { resolve, reject })
  obterWorker().postMessage({ id, file })
})

const encontrarCabecalho = matriz => {
  const limite = Math.min(matriz.length, 12)
  for (let indice = 0; indice < limite; indice++) {
    const linha = matriz[indice] || []
    if (linha.some(celula => normalizar(celula) === 'codigo')) return indice
  }
  return 0
}

const criarCabecalhosUnicos = linha => {
  const usados = new Map()
  return linha.map((valor, indice) => {
    const base = String(valor ?? '').trim() || `Coluna ${indice + 1}`
    const repeticoes = usados.get(base) || 0
    usados.set(base, repeticoes + 1)
    return repeticoes === 0 ? base : `${base}_${repeticoes}`
  })
}

export const matrizParaObjetos = matriz => {
  if (!Array.isArray(matriz) || matriz.length === 0) return { linhas: [], colunas: [] }
  const indiceCabecalho = encontrarCabecalho(matriz)
  const colunas = criarCabecalhosUnicos(matriz[indiceCabecalho] || [])
  const linhas = matriz.slice(indiceCabecalho + 1)
    .map((linha, deslocamento) => ({ linha, numeroLinha: indiceCabecalho + deslocamento + 2 }))
    .filter(({ linha }) => Array.isArray(linha) && linha.some(valor => valor !== null && valor !== undefined && valor !== ''))
    .map(({ linha, numeroLinha }) => ({
      ...Object.fromEntries(colunas.map((coluna, indice) => [coluna, linha[indice] ?? ''])),
      _linhaPlanilha: numeroLinha
    }))
  return { linhas, colunas }
}

export const lerPlanilha = async file => {
  if (!file) throw new Error('Selecione uma planilha.')
  if (cache.has(file)) return cache.get(file)
  const promessa = lerMatrizNoWorker(file).then(matrizParaObjetos)
  cache.set(file, promessa)
  try {
    return await promessa
  } catch (error) {
    cache.delete(file)
    throw error
  }
}

export const criarPreviaPlanilha = async file => {
  const { linhas, colunas } = await lerPlanilha(file)
  return {
    nome: file.name,
    tamanho: file.size,
    totalLinhas: linhas.length,
    totalColunas: colunas.length,
    colunas,
    amostra: linhas.slice(0, 5)
  }
}
