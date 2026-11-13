import { lerPlanilha } from './planilha'
import { deduplicarPorCodigo } from './deduplicar'
import { VERSAO_RUPTURA_PRESENCA, presencaBaseDaRuptura, setoresPelaPresenca } from './rupturaPresenca'

// Leitura e análise das planilhas de auditoria (Presença, Ruptura e Etiqueta).
// Funções puras: recebem as linhas da planilha (ou o arquivo) e devolvem os itens normalizados
// e a análise. O store (stores/auditoriasStore.js) só guarda o resultado e mostra os avisos.

// Função auxiliar para verificar se um valor é placeholder/dados faltantes
export const isPlaceholder = (valor) => {
  if (!valor) return true
  if (typeof valor === 'string') {
    const limpo = valor.trim()
    // Verifica prefixo ### ou valores vazios/inválidos
    return limpo.startsWith('###') || 
           limpo === '' || 
           limpo.toLowerCase() === 'undefined' || 
           limpo.toLowerCase() === 'null' ||
           limpo.toLowerCase() === 'não' ||
           limpo.toLowerCase() === 'nao'
  }
  return false
}

// Corrige planilhas com cabeçalhos agrupados (ex: "Auditado em" repetido).
// Retorna os dados com colunas padrão (Código, Situação, etc.) mapeadas.
export const corrigirCabecalhoAgrupado = (dadosCompletos) => {
  if (!dadosCompletos || dadosCompletos.length === 0) return dadosCompletos

  const todasChaves = new Set()
  dadosCompletos.slice(0, 20).forEach(r => Object.keys(r).forEach(k => todasChaves.add(k)))
  const temColunasEsperadas =
    todasChaves.has('Código') || todasChaves.has('Codigo') ||
    todasChaves.has('Situação') || todasChaves.has('Situação atual da auditoria')

  if (temColunasEsperadas) return dadosCompletos

  // Auto-detectar colunas pelos padrões dos dados quando o ERP muda os títulos.
  const amostra = dadosCompletos.slice(0, Math.min(100, dadosCompletos.length))
  const chaves = [...new Set(amostra.flatMap(r => Object.keys(r)))]

  const mapeamento = {}

  for (const key of chaves) {
    const vals = amostra.map(r => r[key]).filter(v => v != null)
    if (vals.length === 0) continue

    // Situação: valores contêm "Presença" + "Com"/"Sem"
    if (!mapeamento['Situação']) {
      const match = vals.filter(v => {
        const s = String(v).toLowerCase()
        return (s.includes('prese') || s.includes('presença')) && (s.includes('com') || s.includes('sem'))
      }).length
      if (match > vals.length * 0.3) {
        mapeamento['Situação'] = key
        continue
      }
    }

    // Código: maioria numérica com 3+ dígitos
    if (!mapeamento['Código']) {
      const match = vals.filter(v =>
        typeof v === 'number' || /^\d{3,}$/.test(String(v).trim())
      ).length
      if (match > vals.length * 0.8) {
        mapeamento['Código'] = key
        continue
      }
    }
  }

  // Identificar outras colunas pela posição relativa ao Código
  const auditadoKeys = chaves
    .filter(k => /^auditado\s*em/i.test(k))
    .sort((a, b) => {
      const numA = parseInt(a.match(/_(\d+)$/)?.[1] || '0')
      const numB = parseInt(b.match(/_(\d+)$/)?.[1] || '0')
      return numA - numB
    })

  if (mapeamento['Código']) {
    const codIdx = auditadoKeys.indexOf(mapeamento['Código'])
    if (codIdx >= 0) {
      const after = auditadoKeys.slice(codIdx + 1).filter(k => k !== mapeamento['Situação'])
      if (after.length >= 1) mapeamento['Produto'] = after[0]
      if (after.length >= 2) mapeamento['Classe de Produto Raiz'] = after[1]
      if (after.length >= 3) mapeamento['Local'] = after[2]
    }
  }

  // Usuário: valores com padrão "número (NOME)"
  for (const key of chaves) {
    if (Object.values(mapeamento).includes(key)) continue
    const vals = amostra.map(r => r[key]).filter(v => v != null)
    if (vals.some(v => /\d+\s*\(/.test(String(v)))) {
      mapeamento['Usuário'] = key
      break
    }
  }

  if (Object.keys(mapeamento).length > 0) {
    return dadosCompletos.map(item => {
      const mapped = { ...item }
      for (const [standard, original] of Object.entries(mapeamento)) {
        if (item[original] !== undefined) mapped[standard] = item[original]
      }
      return mapped
    })
  }

  return dadosCompletos
}

// Função auxiliar para extrair número do estoque
// Pode estar em: "Estoque atual", "oque atual", ou embutido em outras colunas
// Pode ser número, string formatada como "25,502 KG", ou estar em timestamp com KG
export const extrairEstoque = (item) => {
  // Tenta diferentes nomes de coluna
  const colunasEstoque = [
    'Estoque atual',
    'oque atual', 
    'Estoque Leitura',
    'ue Leitura em venda o'
  ]
  
  for (const coluna of colunasEstoque) {
    if (item[coluna] !== undefined && item[coluna] !== null) {
      const valor = item[coluna]
      
      // Se é número, retorna direto
      if (typeof valor === 'number') {
        return valor > 0 ? valor : 0
      }
      
      // Se é string, tenta extrair número
      if (typeof valor === 'string') {
        // Remove prefixo ### se existir
        let limpo = valor.replace(/^###\s*/, '').trim()
        
        // Remove "KG" e espaços
        limpo = limpo.replace(/KG/gi, '').replace(/\s+/g, ' ')
        
        // Extrai número (pode ter vírgula ou ponto como separador decimal)
        const match = limpo.match(/(\d+)[,.]?(\d*)/)
        if (match) {
          const parteInteira = match[1] || '0'
          const parteDecimal = match[2] || '0'
          const numero = parseFloat(parteInteira + '.' + parteDecimal)
          if (!isNaN(numero) && numero > 0) {
            return numero
          }
        }
      }
    }
  }
  
  // Tenta extrair de colunas que podem ter timestamp + quantidade (ex: "### 09:51:41 25,502 KG")
  const colunasComQuantidade = ['Auditado', 'Presença', 'Presença confirmada']
  for (const coluna of colunasComQuantidade) {
    if (item[coluna] && typeof item[coluna] === 'string') {
      const match = item[coluna].match(/(\d+)[,.](\d+)\s*KG/i)
      if (match) {
        const parteInteira = match[1] || '0'
        const parteDecimal = match[2] || '0'
        const numero = parseFloat(parteInteira + '.' + parteDecimal)
        if (!isNaN(numero) && numero > 0) {
          return numero
        }
      }
    }
  }
  
  return 0
}

// Verifica se a coluna Situação indica "Com Estoque" ou "Sem Estoque"
// A Situação é a fonte de verdade para classificar pendentes vs problemas
export const temEstoquePelaSituacao = (item) => {
  const situacao = item['Situação'] || item['Situação atual da auditoria'] || ''
  if (!situacao) return null // sem informação na Situação
  const sitLower = situacao.toString().toLowerCase()
  if (sitLower.includes('com estoque') || sitLower.includes('com esto')) return true
  if (sitLower.includes('sem estoque') || sitLower.includes('sem esto')) return false
  return null // Situação não menciona estoque
}

// Função auxiliar para verificar se tem presença confirmada
// Baseado na coluna "Situação" que contém "Com Prese Encerrada" ou "Sem Prese Encerrada"
// Também verifica colunas "Presença confirmada" e "Presença"
export const temPresencaConfirmada = (item) => {
  // Prioridade 1: Coluna "Situação" (mais confiável)
  const situacao = item['Situação'] || item['Situação atual da auditoria'] || ''
  if (situacao) {
    const sitLower = situacao.toString().toLowerCase()
    // "Com Prese" ou "Com Presença" = tem presença
    if (sitLower.includes('com prese') || sitLower.includes('com presença')) {
      return true
    }
    // "Sem Prese" ou "Sem Presença" = sem presença
    if (sitLower.includes('sem prese') || sitLower.includes('sem presença')) {
      return false
    }
  }
  
  // Prioridade 2: Coluna "Presença confirmada" ou "Presença"
  const presenca = item['Presença confirmada'] || item['Presença'] || ''
  if (presenca) {
    // Se tem prefixo ###, é placeholder (sem presença)
    if (isPlaceholder(presenca)) {
      return false
    }
    // Se é número (serial do Excel), significa que tem presença
    if (typeof presenca === 'number') {
      return true
    }
    // Se é string não vazia e não é placeholder, tem presença
    if (typeof presenca === 'string' && presenca.trim() !== '') {
      return !isPlaceholder(presenca)
    }
  }
  
  return false
}

export const normalizarTexto = (valor) => {
  if (valor === undefined || valor === null) return ''
  return String(valor).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

export const paraDataISO = (valor) => {
  if (valor === undefined || valor === null || valor === '') return ''

  // Serial de data do Excel
  if (typeof valor === 'number' && isFinite(valor)) {
    const serial = Math.floor(valor)
    if (serial > 0) {
      const ms = (serial - 25569) * 86400 * 1000
      const d = new Date(ms)
      if (!isNaN(d.getTime())) {
        const yyyy = d.getUTCFullYear()
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
        const dd = String(d.getUTCDate()).padStart(2, '0')
        return `${yyyy}-${mm}-${dd}`
      }
    }
  }

  if (valor instanceof Date && !isNaN(valor.getTime())) {
    // Datas sem horário vindas do Excel são representadas como meia-noite UTC.
    // Usar getters locais pode recuar um dia em fusos a oeste de UTC.
    const yyyy = valor.getUTCFullYear()
    const mm = String(valor.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(valor.getUTCDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  const texto = String(valor).trim()
  if (!texto) return ''

  // dd/mm/yyyy ou dd-mm-yyyy
  let m = texto.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/)
  if (m) {
    const dd = String(parseInt(m[1], 10)).padStart(2, '0')
    const mm = String(parseInt(m[2], 10)).padStart(2, '0')
    let yyyy = String(parseInt(m[3], 10))
    if (yyyy.length === 2) yyyy = `20${yyyy}`
    return `${yyyy}-${mm}-${dd}`
  }

  // yyyy-mm-dd ou yyyy/mm/dd
  m = texto.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/)
  if (m) {
    const yyyy = m[1]
    const mm = String(parseInt(m[2], 10)).padStart(2, '0')
    const dd = String(parseInt(m[3], 10)).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  const data = new Date(texto)
  if (!isNaN(data.getTime())) {
    const yyyy = data.getFullYear()
    const mm = String(data.getMonth() + 1).padStart(2, '0')
    const dd = String(data.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  return ''
}

// Verifica se uma data ISO está em um intervalo razoável (2020-2040)
export const isDataRazoavel = (isoDate) => {
  if (!isoDate) return false
  const year = parseInt(isoDate.substring(0, 4))
  return year >= 2020 && year <= 2040
}

export const dataItemAuditadoEmISO = (item) => {
  if (!item || typeof item !== 'object') return ''
  // Tentar coluna exata primeiro
  const direto = paraDataISO(item['Auditado em'] || item['Auditado Em'] || item['auditado em'] || item['Data'])
  if (direto && isDataRazoavel(direto)) return direto
  // XLSX renomeia colunas duplicadas com sufixo _1, _2, etc.
  // Buscar todas as variações e retornar a primeira com data válida e razoável
  const chaves = Object.keys(item).filter(k => {
    const n = k.toLowerCase()
    return n.startsWith('auditado em') || n.startsWith('auditado_em')
  })
  for (const chave of chaves) {
    const val = paraDataISO(item[chave])
    if (val && isDataRazoavel(val)) return val
  }
  return ''
}

export const temMarcadorNaoLidoComEstoque = (valor) => {
  const s = normalizarTexto(valor)
  if (!s) return false
  if ((s.includes('nao lido') || s.includes('nao lidos')) && s.includes('estoq')) return true
  return false
}

export const getLidoNaoPertence = (item) => {
  if (!item) return false
  let valor = undefined
  if (Object.prototype.hasOwnProperty.call(item, 'Lido não pertence')) {
    valor = item['Lido não pertence']
  } else if (Object.prototype.hasOwnProperty.call(item, 'Lido nao pertence')) {
    valor = item['Lido nao pertence']
  } else {
    const key = Object.keys(item).find(k => {
      const n = normalizarTexto(k)
      return n.includes('lido') && n.includes('pertence')
    })
    if (key) valor = item[key]
  }
  // Se não existe coluna específica, tentar inferir pela Situação
  if (valor === undefined || valor === null) {
    const camposSituacao = ['Situação', 'Situação atual da auditoria']
    for (const campo of camposSituacao) {
      if (Object.prototype.hasOwnProperty.call(item, campo)) {
        const texto = normalizarTexto(item[campo])
        if (texto && texto.includes('lido') && texto.includes('pertence')) {
          valor = texto
          break
        }
      }
    }
  }
  if (valor === undefined || valor === null) return false
  if (valor === true) return true
  if (typeof valor === 'number') return valor > 0
  if (typeof valor === 'string') {
    const texto = normalizarTexto(valor)
    if (!texto) return false
    if (texto.includes('lido') && texto.includes('pertence')) return true
    if (texto.includes('sim')) return true
    return false
  }
  return false
}

export const statusEtiqueta = (item) => {
  const raw = (item['Situação'] || item['Situação atual da auditoria'] || '').toString()
  const s = normalizarTexto(raw)
  const temDesatual = s.includes('desatualizad') // cobre desatualizado/desatualizada/desatualizados
  const temAtual = s.includes('atualizad') && !temDesatual // evita colisão com "desatualizado"
  const atualizado = temAtual
  const desatualizado = temDesatual
  const naoLidoEstoque = temMarcadorNaoLidoComEstoque(s)
  const lidoSemEstoque = s.includes('lido sem estoque')
  const semEstoque = !lidoSemEstoque && s.includes('sem estoque')
  const lidoNaoPertence = getLidoNaoPertence(item)
  return { atualizado, desatualizado, naoLidoEstoque, lidoSemEstoque, semEstoque, lidoNaoPertence }
}

// Obter tipo de auditoria baseado na data selecionada
export const detectarTipoArquivo = async (file) => {
  const resultado = await lerPlanilha(file)
  const linhas = corrigirCabecalhoAgrupado(resultado.linhas)

  let etiquetaScore = 0
  let presencaScore = 0
  let rupturaSinal = 0
  let rupturaCusto = 0
  const max = Math.min(linhas.length, 100)
  for (let i = 0; i < max; i++) {
    const row = linhas[i] || {}
    const sRaw = row['Situação'] || row['Situação atual da auditoria'] || ''
    const s = normalizarTexto(sRaw)
    // Etiqueta: status / leituras específicas
    if (s.includes('atualizad') || s.includes('desatualizad') || s.includes('lido sem estoque') || temMarcadorNaoLidoComEstoque(s) || getLidoNaoPertence(row)) {
      etiquetaScore++
    }
    // Presença: menções explícitas
    if (s.includes('com prese') || s.includes('sem prese') || s.includes('com presen') || s.includes('sem presen') || s.includes('com presenca') || s.includes('sem presenca') || s.includes('com presença') || s.includes('sem presença')) {
      presencaScore++
    }
    // Ruptura: foco em "Sem Presença e Com Estoque"
    const semPresenca = s.includes('sem prese') || s.includes('sem presen') || s.includes('sem presenca') || s.includes('sem presença')
    const comEstoque = s.includes('com estoq')
    if (semPresenca && comEstoque) {
      rupturaSinal++
    }
    const custo = parseFloat(row['Custo Ruptura'] || row['Custo de Ruptura'] || row['Custo ruptura'] || row['Custo de ruptura'] || 0) || 0
    if (custo > 0) rupturaCusto++
  }
  // Score de ruptura pondera fortemente sinais "sem presença + com estoque" e considera custo como apoio
  const rupturaScore = (rupturaSinal * 2) + Math.min(rupturaCusto, rupturaSinal)
  // Decisão
  if (etiquetaScore > Math.max(presencaScore, rupturaScore)) return 'Etiqueta'
  if (rupturaScore >= presencaScore && rupturaSinal >= 2) return 'Ruptura'
  return 'Presença'
}

export const detectarTipoDados = (dados) => {
  if (!Array.isArray(dados) || dados.length === 0) return 'Presença'
  let etiquetaScore = 0
  let presencaScore = 0
  let rupturaSinal = 0
  let rupturaCusto = 0
  const n = Math.min(50, dados.length)
  for (let i = 0; i < n; i++) {
    const item = dados[i] || {}
    const s = normalizarTexto((item['Situação'] || item['Situação atual da auditoria'] || item._situacao || '').toString())
    if (s.includes('atualizad') || s.includes('desatualizad') || s.includes('lido sem estoque') || temMarcadorNaoLidoComEstoque(s) || item._lidoNaoPertence) {
      etiquetaScore++
    }
    if (s.includes('com prese') || s.includes('sem prese') || s.includes('com presen') || s.includes('sem presen') || s.includes('com presenca') || s.includes('sem presenca') || s.includes('com presença') || s.includes('sem presença')) {
      presencaScore++
    }
    const semPresenca = s.includes('sem prese') || s.includes('sem presen') || s.includes('sem presenca') || s.includes('sem presença')
    const comEstoque = s.includes('com estoq')
    if (semPresenca && comEstoque) rupturaSinal++
    const custoVal = parseFloat(item['Custo Ruptura'] || item['Custo de Ruptura'] || item['Custo ruptura'] || item['Custo de ruptura'] || 0) || 0
    if (custoVal > 0) rupturaCusto++
  }
  if (etiquetaScore > Math.max(presencaScore, rupturaSinal)) return 'Etiqueta'
  const rupturaScore = (rupturaSinal * 2) + Math.min(rupturaCusto, rupturaSinal)
  if (rupturaScore >= presencaScore && rupturaSinal >= 2) return 'Ruptura'
  return 'Presença'
}

export const analisarDadosPresenca = (dados, sku = 0) => {
  const analise = {
    // Totais da auditoria
    totalItens: 0, // Será definido como SKU após o loop
    itensIgnorados: 0,
    
    // Categorias principais de auditáveis
    itensLidosCorretamente: 0, // Será derivado do SKU: SKU - itensPendentes
    itensPendentes: 0,          // Não lidos com estoque (lido da planilha)
    itensLidosComProblema: 0,   // Lidos sem estoque + Lido não pertence (apenas exibição)
    itensComEstoqueZero: 0,     // Lidos sem estoque (apenas exibição)
    itensLidoNaoPertence: 0,    // Lido não pertence (apenas exibição)
    
    // Para análise
    parcialPercentual: 0, // % pendentes em relação ao SKU
    porUsuario: {},
    porSetor: {},
    porLocal: {},
    setoresParados: [],
    locaisSemLeitura: [],
    usuarios: [],
    
    // Detalhes para alertas
    itensComEstoqueZeroDetalhes: [],
    itensLidoNaoPertenceDetalhes: []
  }

  dados.forEach((item) => {
    // Usar valores normalizados do processamento
    const temPresenca = item._temPresenca || false
    // Usar estoque pela Situação (fonte de verdade), fallback para coluna de estoque
    const estoqueSituacao = item._temEstoqueSituacao
    const temEstoque = estoqueSituacao !== null && estoqueSituacao !== undefined
      ? estoqueSituacao
      : (item._estoque || 0) > 0

    // Verificar "Lido não pertence" - pode não existir na planilha
    // Pode estar em diferentes formatos ou inferido da situação
    const lidoNaoPertence = item._lidoNaoPertence !== undefined
      ? item._lidoNaoPertence
      : getLidoNaoPertence(item)

    // Se "Lido não pertence" é verdadeiro, assumimos que o item TEM presença,
    // mesmo que as outras colunas digam que não.
    const efetivamenteTemPresenca = temPresenca || lidoNaoPertence

    // ❌ EXCLUI DO SKU (não contam no total auditável)
    // Itens "Com Presença e sem Estoque" ou "Lido não pertence" são apenas para exibição em "Itens com problema"
    if ((temPresenca && !temEstoque) || lidoNaoPertence) {
      if (temPresenca && !temEstoque) {
        analise.itensComEstoqueZero++
        analise.itensComEstoqueZeroDetalhes.push({
          codigo: item['Código'],
          produto: item['Produto'],
          setor: (item['Classe de Produto Raiz'] || item['Setor'] || 'Não especificado').trim(),
          usuario: item['Usuário'],
          local: item['Local'],
          fornecedor: item['Fornecedor']
        })
      }

      if (lidoNaoPertence) {
        analise.itensLidoNaoPertence++
        analise.itensLidoNaoPertenceDetalhes.push({
          codigo: item['Código'],
          produto: item['Produto'],
          setor: (item['Classe de Produto Raiz'] || item['Setor'] || 'Não especificado').trim(),
          usuario: item['Usuário'],
          local: item['Local']
        })
      }

      // Agrupar itens com problema por USUÁRIO
      const usuarioProblema = (item['Usuário'] || '').trim()
      if (usuarioProblema && usuarioProblema !== '' && usuarioProblema !== 'undefined') {
        if (!analise.porUsuario[usuarioProblema]) {
          analise.porUsuario[usuarioProblema] = { lidos: 0, pendentes: 0, comProblema: 0 }
          analise.usuarios.push(usuarioProblema)
        }
        if (!analise.porUsuario[usuarioProblema].comProblema) analise.porUsuario[usuarioProblema].comProblema = 0
        analise.porUsuario[usuarioProblema].comProblema++
      }

      // Agrupar itens com problema por SETOR
      const setorProblema = (item['Classe de Produto Raiz'] || item['Setor'] || 'Não especificado').trim()
      if (!analise.porSetor[setorProblema]) {
        analise.porSetor[setorProblema] = { lidos: 0, pendentes: 0, comProblema: 0 }
      }
      if (!analise.porSetor[setorProblema].comProblema) analise.porSetor[setorProblema].comProblema = 0
      analise.porSetor[setorProblema].comProblema++

      // Agrupar itens com problema por LOCAL
      const localProblema = (item['Local'] || 'Não especificado').trim()
      if (!analise.porLocal[localProblema]) {
        analise.porLocal[localProblema] = { lidos: 0, pendentes: 0, comProblema: 0 }
      }
      if (!analise.porLocal[localProblema].comProblema) analise.porLocal[localProblema].comProblema = 0
      analise.porLocal[localProblema].comProblema++

      return // Pular para o próximo item
    }

    // Categorizar o item
    if (!efetivamenteTemPresenca && temEstoque) {
      // ⏳ Sem Presença e Com Estoque (pela Situação): conta como pendente
      analise.itensPendentes++
    }

    // Agrupar por USUÁRIO (ignora em branco)
    const usuario = (item['Usuário'] || '').trim()
    if (usuario && usuario !== '' && usuario !== 'undefined') {
      if (!analise.porUsuario[usuario]) {
        analise.porUsuario[usuario] = {
          lidos: 0,      // Com presença e sem problemas
          pendentes: 0,  // Sem presença
          comProblema: 0
        }
        analise.usuarios.push(usuario)
      }

      if (efetivamenteTemPresenca) {
        analise.porUsuario[usuario].lidos++
      } else {
        analise.porUsuario[usuario].pendentes++
      }
    }

    // Agrupar por SETOR
    const setor = (item['Classe de Produto Raiz'] || 'Não especificado').trim()
    if (!analise.porSetor[setor]) {
      analise.porSetor[setor] = {
        lidos: 0,
        pendentes: 0,
        comProblema: 0
      }
    }
    if (efetivamenteTemPresenca) {
      analise.porSetor[setor].lidos++
    } else {
      analise.porSetor[setor].pendentes++
    }

    // Agrupar por LOCAL
    const local = (item['Local'] || 'Não especificado').trim()
    if (!analise.porLocal[local]) {
      analise.porLocal[local] = {
        lidos: 0,
        pendentes: 0
      }
    }
    if (efetivamenteTemPresenca) {
      analise.porLocal[local].lidos++
    } else {
      analise.porLocal[local].pendentes++
    }
  })

  // Calcular percentuais usando SKU
  // - Total auditável (totalItens) = SKU informado pelo usuário
  // - Total lidos = SKU - Não lidos com estoque (itensPendentes)
  // - Itens com problema (lidos sem estoque + lido não pertence) são apenas para exibição
  // Fallback quando SKU não foi informado: conta os itens lidos corretamente na planilha
  let totalAuditaveis
  if (sku > 0) {
    totalAuditaveis = sku
  } else {
    // Fallback sem SKU: mantém coerência da regra principal usando base planilha mínima
    // (pendentes + itens com presença e estoque pela Situação) apenas para não zerar total.
    const lidosBase = dados.filter(i => {
      const temP = i._temPresenca || false
      const lnp = i._lidoNaoPertence !== undefined ? i._lidoNaoPertence : getLidoNaoPertence(i)
      const estSit = i._temEstoqueSituacao
      const temEst = estSit !== null && estSit !== undefined ? estSit : (i._estoque || 0) > 0
      return temP && !lnp && temEst
    }).length
    totalAuditaveis = analise.itensPendentes + lidosBase
  }
  const totalLidos = Math.max(0, totalAuditaveis - analise.itensPendentes)
  
  analise.totalItens = totalAuditaveis
  analise.totalLidos = totalLidos
  analise.itensLidosCorretamente = totalLidos
  // Itens com problema = lidos sem estoque + lido não pertence (apenas exibição, não entra no cálculo)
  analise.itensLidosComProblema = (analise.itensComEstoqueZero || 0) + (analise.itensLidoNaoPertence || 0)
  analise.comProblema = analise.itensLidosComProblema
  
  // Percentual pendente = pendentes / SKU
  analise.parcialPercentual = totalAuditaveis > 0 
    ? parseFloat(((analise.itensPendentes / totalAuditaveis) * 100).toFixed(2))
    : 0
  
  // Percentual concluído = totalLidos / SKU
  analise.percentualConclusao = totalAuditaveis > 0
    ? parseFloat(((totalLidos / totalAuditaveis) * 100).toFixed(2))
    : 0

  // Identificar setores parados (sem nenhuma leitura)
  Object.entries(analise.porSetor).forEach(([setor, dados]) => {
    if (dados.lidos === 0) {
      analise.setoresParados.push(setor)
    }
  })

  // Identificar locais sem leitura
  Object.entries(analise.porLocal).forEach(([local, dados]) => {
    if (dados.lidos === 0) {
      analise.locaisSemLeitura.push(local)
    }
  })

  return analise
}

export const analisarDadosEtiqueta = (dados, sku = 0) => {
  const analise = {
    totalItens: 0,
    itensIgnorados: 0,
    itensLidosCorretamente: 0,
    itensPendentes: 0,
    itensLidosComProblema: 0,
    itensComEstoqueZero: 0,
    itensLidoNaoPertence: 0,
    itensAtualizados: 0,
    itensDesatualizados: 0,
    parcialPercentual: 0,
    percentualConclusao: 0,
    totalLidos: 0,
    porUsuario: {},
    porSetor: {},
    porLocal: {},
    setoresParados: [],
    locaisSemLeitura: [],
    usuarios: [],
    itensComEstoqueZeroDetalhes: [],
    itensLidoNaoPertenceDetalhes: []
  }
  let lidosRawEtiqueta = 0
  dados.forEach(item => {
    const st = statusEtiqueta(item)
    const estoque = item._estoque || 0
    const efetivamenteTem = !!item._temPresenca || st.lidoNaoPertence

    // ❌ EXCLUI DO SKU (não contam no total auditável)
    // Itens com estoque <= 0 ou lidos em local errado não entram na auditoria
    if (estoque <= 0 || st.lidoNaoPertence) {
      if (estoque <= 0 && st.lidoSemEstoque) {
        analise.itensComEstoqueZero++
        analise.itensComEstoqueZeroDetalhes.push({
          codigo: item['Código'],
          produto: item['Produto'],
          setor: (item['Classe de Produto Raiz'] || item['Setor'] || 'Não especificado').trim(),
          usuario: item['Usuário'],
          local: item['Local'],
          fornecedor: item['Fornecedor']
        })
      }

      if (st.lidoNaoPertence) {
        analise.itensLidoNaoPertence++
        analise.itensLidoNaoPertenceDetalhes.push({
          codigo: item['Código'],
          produto: item['Produto'],
          setor: (item['Classe de Produto Raiz'] || item['Setor'] || 'Não especificado').trim(),
          usuario: item['Usuário'],
          local: item['Local']
        })
      }

      // Agrupar itens com problema por USUÁRIO
      const usuarioProblema = (item['Usuário'] || '').trim()
      if (usuarioProblema && usuarioProblema !== '' && usuarioProblema !== 'undefined') {
        if (!analise.porUsuario[usuarioProblema]) {
          analise.porUsuario[usuarioProblema] = { lidos: 0, pendentes: 0, comProblema: 0 }
          analise.usuarios.push(usuarioProblema)
        }
        if (!analise.porUsuario[usuarioProblema].comProblema) analise.porUsuario[usuarioProblema].comProblema = 0
        analise.porUsuario[usuarioProblema].comProblema++
      }

      // Agrupar itens com problema por SETOR
      const setorProblema = (item['Classe de Produto Raiz'] || item['Setor'] || 'Não especificado').trim()
      if (!analise.porSetor[setorProblema]) {
        analise.porSetor[setorProblema] = { lidos: 0, pendentes: 0, comProblema: 0, desatualizados: 0 }
      }
      if (!analise.porSetor[setorProblema].comProblema) analise.porSetor[setorProblema].comProblema = 0
      analise.porSetor[setorProblema].comProblema++

      // Agrupar itens com problema por LOCAL
      const localProblema = (item['Local'] || 'Não especificado').trim()
      if (!analise.porLocal[localProblema]) {
        analise.porLocal[localProblema] = { lidos: 0, pendentes: 0, comProblema: 0 }
      }
      if (!analise.porLocal[localProblema].comProblema) analise.porLocal[localProblema].comProblema = 0
      analise.porLocal[localProblema].comProblema++

      return // Pular para o próximo item
    }

    // Categorizar o item: contar Não lidos com estoque (pendentes) e Desatualizados da planilha
    if (st.naoLidoEstoque) {
      analise.itensPendentes++
    } else if (st.desatualizado) {
      // Desatualizados lidos da planilha (usados para derivar Atualizados)
      analise.itensDesatualizados++
      lidosRawEtiqueta++
    } else if (st.atualizado && !st.lidoNaoPertence) {
      // Atualizado: conta como lidos brutos para fallback quando SKU não informado
      lidosRawEtiqueta++
    }
    const usuario = (item['Usuário'] || '').trim()
    if (usuario && usuario !== '' && usuario !== 'undefined') {
      if (!analise.porUsuario[usuario]) {
        analise.porUsuario[usuario] = { lidos: 0, pendentes: 0, comProblema: 0 }
        analise.usuarios.push(usuario)
      }
      if (efetivamenteTem) {
        analise.porUsuario[usuario].lidos++
      } else {
        analise.porUsuario[usuario].pendentes++
      }
    }
    const setor = (item['Classe de Produto Raiz'] || 'Não especificado').trim()
    if (!analise.porSetor[setor]) analise.porSetor[setor] = { lidos: 0, pendentes: 0, comProblema: 0, desatualizados: 0 }
    if (efetivamenteTem) {
      analise.porSetor[setor].lidos++
      if (st.desatualizado) analise.porSetor[setor].desatualizados++
    } else {
      analise.porSetor[setor].pendentes++
    }
    const local = (item['Local'] || 'Não especificado').trim()
    if (!analise.porLocal[local]) analise.porLocal[local] = { lidos: 0, pendentes: 0 }
    if (efetivamenteTem) {
      analise.porLocal[local].lidos++
    } else {
      analise.porLocal[local].pendentes++
    }
  })
  // Calcular percentuais usando SKU
  // - Total auditável (totalItens) = SKU informado pelo usuário
  // - Total lidos = SKU - Não lidos com estoque (itensPendentes)
  // - Atualizados = Total lidos - Desatualizados
  // - Itens com problema (lidos sem estoque + lido não pertence) são apenas para exibição
  const totalAuditaveis = sku > 0 ? sku : (lidosRawEtiqueta + analise.itensPendentes)
  const totalLidos = Math.max(0, totalAuditaveis - analise.itensPendentes)
  const itensAtualizados = Math.max(0, totalLidos - analise.itensDesatualizados)
  analise.totalLidos = totalLidos
  analise.totalItens = totalAuditaveis
  analise.itensAtualizados = itensAtualizados
  analise.itensLidosCorretamente = itensAtualizados
  // Itens com problema = lidos sem estoque + lido não pertence (apenas exibição, não entra no cálculo)
  analise.itensLidosComProblema = (analise.itensComEstoqueZero || 0) + (analise.itensLidoNaoPertence || 0)
  analise.parcialPercentual = totalAuditaveis > 0 ? parseFloat(((analise.itensPendentes / totalAuditaveis) * 100).toFixed(2)) : 0
  analise.percentualConclusao = totalAuditaveis > 0 ? parseFloat(((totalLidos / totalAuditaveis) * 100).toFixed(2)) : 0
  Object.entries(analise.porSetor).forEach(([setor, dados]) => {
    if (dados.lidos === 0) analise.setoresParados.push(setor)
  })
  Object.entries(analise.porLocal).forEach(([local, dados]) => {
    if (dados.lidos === 0) analise.locaisSemLeitura.push(local)
  })
  return analise
}

// % por setor da ruptura parte da presença anterior (ver utils/rupturaPresenca.js); o restante não muda.
export const aplicarBasePresenca = (analise, dadosRuptura, dataAuditoria, auditorias = []) => {
  const base = presencaBaseDaRuptura(dataAuditoria, auditorias)
  if (!base) return analise
  analise.porSetor = setoresPelaPresenca(dadosRuptura, base.dados)
  analise.setoresParados = Object.entries(analise.porSetor).filter(([, d]) => d.lidos === 0).map(([setor]) => setor)
  analise.basePresenca = { id: base.id, data: base.data, versao: VERSAO_RUPTURA_PRESENCA }
  return analise
}

// `auditorias`: as já salvas, para achar a presença anterior (setores da ruptura partem dela).
export const analisarDadosRuptura = (dados, sku = 0, opts = {}, auditorias = []) => {
  // `dataReferencia`: só localiza a presença anterior, sem aplicar a regra de data do item.
  const auditoriaDiaISO = paraDataISO(opts?.dataAuditoria)
  if (!auditoriaDiaISO) {
    return aplicarBasePresenca(analisarDadosPresenca(dados, sku), dados, paraDataISO(opts?.dataReferencia), auditorias)
  }

  // Em Ruptura, só conta pendência quando for "Sem Presença e Com Estoque"
  // E o "Auditado em" (coluna J) for do mesmo dia da auditoria.
  const dadosAjustados = (dados || []).map((item) => {
    const temPresenca = item?._temPresenca || false
    const estoque = item?._estoque || 0
    if (temPresenca || estoque <= 0) return item

    const dataItemISO = dataItemAuditadoEmISO(item)
    if (dataItemISO === auditoriaDiaISO) {
      return item
    }

    // Fora da data da auditoria: não entra como pendente.
    // Ajusta apenas para reutilizar a regra-base sem duplicação.
    return {
      ...item,
      _temPresenca: true
    }
  })

  return aplicarBasePresenca(analisarDadosPresenca(dadosAjustados, sku), dadosAjustados, auditoriaDiaISO, auditorias)
}

// ---------- Linhas da planilha → itens da auditoria ----------
const situacaoDaPrimeira = linhas => (linhas[0]['Situação'] || linhas[0]['Situação atual da auditoria'] || '').toString().toLowerCase()
const pareceEtiqueta = s => s.includes('atualizado') || s.includes('desatualizado') || s.includes('lido sem estoque') || temMarcadorNaoLidoComEstoque(s)
const parecePresenca = s => s.includes('com prese') || s.includes('sem prese') || s.includes('com presen') || s.includes('sem presen')

// Presença e Ruptura: normaliza, tira itens sem leitura e sem estoque e junta códigos repetidos.
// Devolve { redirecionar: 'Etiqueta' } quando a planilha é, na verdade, de etiqueta.
export const tratarLinhasPresenca = (linhas, opts = {}) => {
  const dadosCompletos = corrigirCabecalhoAgrupado(linhas)
  if (dadosCompletos.length > 0) {
    const s = situacaoDaPrimeira(dadosCompletos)
    if (pareceEtiqueta(s) && !parecePresenca(s)) return { redirecionar: 'Etiqueta' }
  }

  const filtrados = dadosCompletos
    .map(item => ({
      ...item,
      _temPresenca: temPresencaConfirmada(item),
      _estoque: extrairEstoque(item),
      _temEstoqueSituacao: temEstoquePelaSituacao(item),
      _situacao: item['Situação'] || item['Situação atual da auditoria'] || '',
      _lidoNaoPertence: getLidoNaoPertence(item)
    }))
    // Estoque pela Situação quando disponível, senão pela coluna de estoque.
    .filter(item => {
      const temEstoque = item._temEstoqueSituacao !== null ? item._temEstoqueSituacao : (item._estoque > 0)
      return item._temPresenca || item._lidoNaoPertence || temEstoque
    })

  const auditoriaDiaISO = paraDataISO(opts?.dataAuditoria)
  const ehRuptura = normalizarTexto(opts?.tipoAuditoria || '') === 'ruptura'
  const dados = deduplicarPorCodigo(filtrados, (existente, item) => {
    const locAtual = ((item['Local'] || '').toString().trim())
    const locExistente = ((existente['Local'] || '').toString().trim())
    const lidoNaoPertenceAtual = item._lidoNaoPertence
    const lidoNaoPertenceExistente = existente._lidoNaoPertence

    // Ruptura: para código repetido, prioriza o item auditado no dia da auditoria.
    if (ehRuptura && auditoriaDiaISO) {
      const atualNoDia = dataItemAuditadoEmISO(item) === auditoriaDiaISO
      const existenteNoDia = dataItemAuditadoEmISO(existente) === auditoriaDiaISO
      if (atualNoDia && !existenteNoDia) return true
      if (existenteNoDia && !atualNoDia) return false
    }

    // 1: preferir o item sem "Lido não pertence"; 2: empatados nisso, preferir o sem Local.
    if (lidoNaoPertenceExistente && !lidoNaoPertenceAtual) return true
    return lidoNaoPertenceExistente === lidoNaoPertenceAtual && !locAtual && Boolean(locExistente)
  })
  return { dados, duplicados: filtrados.length - dados.length }
}

// Etiqueta. Devolve { redirecionar: 'Presença' } quando a planilha é, na verdade, de presença.
export const tratarLinhasEtiqueta = (linhas) => {
  const dadosCompletos = corrigirCabecalhoAgrupado(linhas)
  if (dadosCompletos.length > 0) {
    const s = situacaoDaPrimeira(dadosCompletos)
    if (parecePresenca(s) && !pareceEtiqueta(s)) return { redirecionar: 'Presença' }
  }

  const filtrados = dadosCompletos
    .map(item => {
      const st = statusEtiqueta(item)
      return {
        ...item,
        _temPresenca: !!(st.atualizado || st.desatualizado || st.lidoSemEstoque || st.lidoNaoPertence),
        _estoque: extrairEstoque(item),
        _situacao: item['Situação'] || item['Situação atual da auditoria'] || '',
        _lidoNaoPertence: st.lidoNaoPertence
      }
    })
    .filter(item => {
      const st = statusEtiqueta(item)
      return !(st.semEstoque && !st.lidoSemEstoque)
    })

  const dados = deduplicarPorCodigo(filtrados, (existente, item) => {
    const locAtual = ((item['Local'] || '').toString().trim())
    const locExistente = ((existente['Local'] || '').toString().trim())
    const statusAtual = statusEtiqueta(item)
    const statusExistente = statusEtiqueta(existente)

    // 1: preservar o registro que NÃO é "Lido não pertence"
    if (statusExistente.lidoNaoPertence && !statusAtual.lidoNaoPertence) return true
    if (statusExistente.lidoNaoPertence !== statusAtual.lidoNaoPertence) return false
    // 2: entre equivalentes, preservar "Não lido(s) com estoque"
    if (!statusExistente.naoLidoEstoque && statusAtual.naoLidoEstoque) return true
    // 3: preferir o item sem Local
    return statusExistente.naoLidoEstoque === statusAtual.naoLidoEstoque && !locAtual && Boolean(locExistente)
  })
  return { dados, duplicados: filtrados.length - dados.length }
}
