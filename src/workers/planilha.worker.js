import readXlsxFile from 'read-excel-file/web-worker'
import Papa from 'papaparse'

const lerMatriz = async (file) => {
  const nome = file.name.toLowerCase()
  if (nome.endsWith('.csv')) {
    const texto = await file.text()
    const resultado = Papa.parse(texto, {
      skipEmptyLines: true,
      delimiter: '',
      transform: valor => typeof valor === 'string' ? valor.trim() : valor
    })
    if (resultado.errors.length) {
      throw new Error(resultado.errors[0].message || 'CSV inválido.')
    }
    return resultado.data
  }

  if (!nome.endsWith('.xlsx')) {
    throw new Error('Formato não suportado. Converta arquivos .xls antigos para .xlsx ou .csv.')
  }

  const abas = await readXlsxFile(file)
  const abaComDados = Array.isArray(abas)
    ? abas.find(aba => Array.isArray(aba?.data) && aba.data.some(linha =>
      Array.isArray(linha) && linha.some(celula => celula !== null && celula !== undefined && celula !== '')
    ))
    : null

  if (!abaComDados) {
    throw new Error('A planilha .xlsx não contém dados para importar.')
  }

  return abaComDados.data
}

self.onmessage = async ({ data }) => {
  try {
    const matriz = await lerMatriz(data.file)
    self.postMessage({ id: data.id, matriz })
  } catch (error) {
    self.postMessage({
      id: data.id,
      erro: error?.message || 'Não foi possível ler a planilha.'
    })
  }
}
