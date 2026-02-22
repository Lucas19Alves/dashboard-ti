import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as XLSX from 'xlsx'
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

export const useAuditoriasStore = defineStore('auditorias', () => {
  // Estado
  const auditorias = ref([])
  const toasts = ref([])
  const toastId = ref(0)

  // Tipos de auditoria por dia da semana
  const tiposAuditoriaPorDia = {
    0: [], // Domingo
    1: ['Etiqueta'], // Segunda
    2: ['Presença'], // Terça
    3: ['Ruptura'], // Quarta
    4: ['Etiqueta'], // Quinta
    5: [], // Sábado
    6: [] // Domingo
  }

  const horariosAuditoria = {
    inicio: '08:00',
    fim: '18:00'
  }

  // Colunas esperadas do Excel para auditoria de Presença
  const colunasPresenca = [
    'Código', 'Produto', 'Classe de Produto Raiz', 'Classe de Produto', 'Setor',
    'Local', 'Usuário', 'Situação', 'Situação atual da auditoria', 'Auditado em',
    'Estoque atual', 'Presença confirmada', 'Estoque Leitura', 'Dias sem venda',
    'Custo Ruptura', 'Resíduo', 'Fornecedor', 'Última compra'
  ]
  const colunasEtiqueta = [
    'Código', 'Produto', 'Classe de Produto Raiz', 'Classe de Produto', 'Setor',
    'Local', 'Usuário', 'Situação', 'Situação atual da auditoria', 'Auditado em',
    'Estoque atual', 'Presença confirmada', 'Estoque Leitura', 'Resíduo', 'Última compra'
  ]

  // Ações
  const addToast = (mensagem, tipo = 'info') => {
    const id = toastId.value++
    toasts.value.push({
      id,
      mensagem,
      tipo // 'success', 'error', 'warning', 'info'
    })

    // Remove automaticamente após 5 segundos
    setTimeout(() => {
      removeToast(id)
    }, 5000)

    return id
  }

  const removeToast = (id) => {
    const index = toasts.value.findIndex(t => t.id === id)
    if (index !== -1) {
      toasts.value.splice(index, 1)
    }
  }

  // Função auxiliar para verificar se um valor é placeholder/dados faltantes
  const isPlaceholder = (valor) => {
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

  // Função auxiliar para extrair número do estoque
  // Pode estar em: "Estoque atual", "oque atual", ou embutido em outras colunas
  // Pode ser número, string formatada como "25,502 KG", ou estar em timestamp com KG
  const extrairEstoque = (item) => {
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

  // Função auxiliar para verificar se tem presença confirmada
  // Baseado na coluna "Situação" que contém "Com Prese Encerrada" ou "Sem Prese Encerrada"
  // Também verifica colunas "Presença confirmada" e "Presença"
  const temPresencaConfirmada = (item) => {
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

  const normalizarTexto = (valor) => {
    if (valor === undefined || valor === null) return ''
    return String(valor).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  }

  const getLidoNaoPertence = (item) => {
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

  const statusEtiqueta = (item) => {
    const raw = (item['Situação'] || item['Situação atual da auditoria'] || '').toString()
    const s = normalizarTexto(raw)
    const temDesatual = s.includes('desatualizad') // cobre desatualizado/desatualizada/desatualizados
    const temAtual = s.includes('atualizad') && !temDesatual // evita colisão com "desatualizado"
    const atualizado = temAtual
    const desatualizado = temDesatual
    const naoLidoEstoque = s.includes('nao lidos com estoque') || s.includes('não lidos com estoque')
    const lidoSemEstoque = s.includes('lido sem estoque')
    const semEstoque = !lidoSemEstoque && s.includes('sem estoque')
    const lidoNaoPertence = getLidoNaoPertence(item)
    return { atualizado, desatualizado, naoLidoEstoque, lidoSemEstoque, semEstoque, lidoNaoPertence }
  }

  const detectarTipoArquivo = async (file) => {
    const buffer = await file.arrayBuffer()
    const data = new Uint8Array(buffer)
    const workbook = XLSX.read(data, { type: 'array' })
    const primeiraAba = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[primeiraAba]
    const linhas = XLSX.utils.sheet_to_json(worksheet)
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
      if (s.includes('atualizad') || s.includes('desatualizad') || s.includes('lido sem estoque') || s.includes('nao lidos com estoque') || s.includes('não lidos com estoque') || getLidoNaoPertence(row)) {
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

  const detectarTipoDados = (dados) => {
    if (!Array.isArray(dados) || dados.length === 0) return 'Presença'
    let etiquetaScore = 0
    let presencaScore = 0
    let rupturaSinal = 0
    let rupturaCusto = 0
    const n = Math.min(50, dados.length)
    for (let i = 0; i < n; i++) {
      const item = dados[i] || {}
      const s = normalizarTexto((item['Situação'] || item['Situação atual da auditoria'] || item._situacao || '').toString())
      if (s.includes('atualizad') || s.includes('desatualizad') || s.includes('lido sem estoque') || s.includes('nao lidos com estoque') || s.includes('não lidos com estoque') || item._lidoNaoPertence) {
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

  const processarExcelPresenca = async (file) => {
    console.log('🔍 Lendo arquivo:', file.name)
    try {
      // Ler arquivo como array buffer
      const buffer = await file.arrayBuffer()
      console.log('✅ Buffer carregado:', buffer.byteLength, 'bytes')
      
      // Processar com XLSX
      console.log('🔍 Processando com XLSX...')
      const data = new Uint8Array(buffer)
      const workbook = XLSX.read(data, { type: 'array' })
      
      // Pegar primeira aba
      const primeiraAba = workbook.SheetNames[0]
      console.log('📄 Aba: ' + primeiraAba)
      
      // Converter para JSON
      const worksheet = workbook.Sheets[primeiraAba]
      const dadosCompletos = XLSX.utils.sheet_to_json(worksheet)
      if (dadosCompletos.length > 0) {
        const s = (dadosCompletos[0]['Situação'] || dadosCompletos[0]['Situação atual da auditoria'] || '').toString().toLowerCase()
        const indicEtiqueta = s.includes('atualizado') || s.includes('desatualizado') || s.includes('lido sem estoque') || s.includes('não lidos com estoque') || s.includes('nao lidos com estoque')
        const indicPresenca = s.includes('com prese') || s.includes('sem prese') || s.includes('com presen') || s.includes('sem presen')
        if (indicEtiqueta && !indicPresenca) {
          addToast('Arquivo detectado como Etiqueta. Ajustando interpretação.', 'info')
          return await processarExcelEtiqueta(file)
        }
      }
      
      console.log('✅ Leitura completa:', dadosCompletos.length, 'linhas')
      
      if (dadosCompletos.length > 0) {
        console.log('Colunas encontradas:', Object.keys(dadosCompletos[0]))
      }
      
      // Normalizar e filtrar dados
      const dados = dadosCompletos
        .map(item => {
          // Normalizar dados usando as novas funções
          const temPresenca = temPresencaConfirmada(item)
          const estoque = extrairEstoque(item)
          const lidoNaoPertence = getLidoNaoPertence(item)
          
          return {
            ...item,
            _temPresenca: temPresenca,
            _estoque: estoque,
            _situacao: item['Situação'] || item['Situação atual da auditoria'] || '',
            _lidoNaoPertence: lidoNaoPertence
          }
        })
        .filter(item => {
          // Filtrar itens não auditáveis: sem presença E sem estoque
          // Itens auditáveis são: (sem presença + com estoque) OU (com presença + qualquer coisa)
          if (!item._temPresenca && !item._lidoNaoPertence && item._estoque === 0) {
            return false
          }
          return true
        })
      
      const ignorados = dadosCompletos.length - dados.length
      console.log(`✅ Itens auditáveis: ${dados.length} linhas`)
      console.log(`↩️ Itens ignorados (sem leitura e sem estoque): ${ignorados}`)
      
      // Estatísticas de debug
      const comPresenca = dados.filter(d => d._temPresenca).length
      const semPresenca = dados.filter(d => !d._temPresenca).length
      const comEstoque = dados.filter(d => d._estoque > 0).length
      const semEstoque = dados.filter(d => d._estoque === 0).length
      console.log(`📊 Estatísticas:`)
      console.log(`   - Com presença: ${comPresenca}`)
      console.log(`   - Sem presença: ${semPresenca}`)
      console.log(`   - Com estoque: ${comEstoque}`)
      console.log(`   - Sem estoque: ${semEstoque}`)
      console.log(`   - Total auditável: ${dados.length}`)
      
      return dados
    } catch (erro) {
      console.error('❌ Erro na leitura:', erro.message)
      addToast('Erro: ' + erro.message, 'error')
      throw erro
    }
  }

  const processarExcelEtiqueta = async (file) => {
    console.log('🔍 Lendo arquivo:', file.name)
    try {
      const buffer = await file.arrayBuffer()
      const data = new Uint8Array(buffer)
      const workbook = XLSX.read(data, { type: 'array' })
      const primeiraAba = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[primeiraAba]
      const dadosCompletos = XLSX.utils.sheet_to_json(worksheet)
      if (dadosCompletos.length > 0) {
        console.log('Colunas encontradas:', Object.keys(dadosCompletos[0]))
      }
      if (dadosCompletos.length > 0) {
        const s = (dadosCompletos[0]['Situação'] || dadosCompletos[0]['Situação atual da auditoria'] || '').toString().toLowerCase()
        const indicEtiqueta = s.includes('atualizado') || s.includes('desatualizado') || s.includes('lido sem estoque') || s.includes('não lidos com estoque') || s.includes('nao lidos com estoque')
        const indicPresenca = s.includes('com prese') || s.includes('sem prese') || s.includes('com presen') || s.includes('sem presen')
        if (indicPresenca && !indicEtiqueta) {
          addToast('Arquivo detectado como Presença. Ajustando interpretação.', 'info')
          return await processarExcelPresenca(file)
        }
      }
      const dados = dadosCompletos
        .map(item => {
          const est = extrairEstoque(item)
          const st = statusEtiqueta(item)
          const tem = st.atualizado || st.desatualizado || st.lidoSemEstoque || st.lidoNaoPertence
          return {
            ...item,
            _temPresenca: !!tem,
            _estoque: est,
            _situacao: item['Situação'] || item['Situação atual da auditoria'] || '',
            _lidoNaoPertence: st.lidoNaoPertence
          }
        })
        .filter(item => {
          const st = statusEtiqueta(item)
          if (st.semEstoque && !st.lidoSemEstoque) return false
          return true
        })
      const ignorados = dadosCompletos.length - dados.length
      console.log(`✅ Itens auditáveis: ${dados.length} linhas`)
      console.log(`↩️ Itens ignorados: ${ignorados}`)
      return dados
    } catch (erro) {
      console.error('❌ Erro na leitura:', erro.message)
      addToast('Erro: ' + erro.message, 'error')
      throw erro
    }
  }

  const analisarDadosPresenca = (dados) => {
    const analise = {
      // Totais da auditoria
      totalItens: dados.length, // Total de itens auditáveis (já filtrado: exclui sem presença E sem estoque)
      itensIgnorados: 0, // Será calculado depois
      
      // Categorias principais de auditáveis
      itensLidosCorretamente: 0, // Com presença + Com estoque
      itensPendentes: 0,          // Sem presença + Com estoque
      itensLidosComProblema: 0,   // Com presença + Sem estoque OU Lido não pertence
      itensComEstoqueZero: 0,     // Com presença + Sem estoque
      itensLidoNaoPertence: 0,    // Lido não pertence
      
      // Pour análise
      parcialPercentual: 0, // % de itens não lidos em relação aos auditáveis
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
      const estoque = item._estoque || 0
      
      // Verificar "Lido não pertence" - pode não existir na planilha
      // Pode estar em diferentes formatos ou inferido da situação
      const lidoNaoPertence = item._lidoNaoPertence !== undefined
        ? item._lidoNaoPertence
        : getLidoNaoPertence(item)
      
      // Se "Lido não pertence" é verdadeiro, assumimos que o item TEM presença,
      // mesmo que as outras colunas digam que não.
      const efetivamenteTemPresenca = temPresenca || lidoNaoPertence

      // Categorizar o item (cada item cai em apenas UMA categoria)
      let itemProblema = false
      
      if (efetivamenteTemPresenca && estoque > 0 && !lidoNaoPertence) {
        // ✅ Lido Corretamente: tem presença + tem estoque + não está no local errado
        analise.itensLidosCorretamente++
      } else if (!efetivamenteTemPresenca && estoque > 0) {
        // ⏳ Pendente (não lido): sem presença mas tem estoque
        analise.itensPendentes++
      } else if (efetivamenteTemPresenca && (estoque === 0 || lidoNaoPertence)) {
        // ⚠️ Lido com Problema: tem presença mas (sem estoque OU no local errado)
        analise.itensLidosComProblema++
        itemProblema = true
        
        if (estoque === 0) {
          analise.itensComEstoqueZero++
          analise.itensComEstoqueZeroDetalhes.push({
            codigo: item['Código'],
            produto: item['Produto'],
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
            usuario: item['Usuário'],
            local: item['Local']
          })
        }
      }

      // Agrupar por USUÁRIO (ignora em branco)
      const usuario = (item['Usuário'] || '').trim()
      if (usuario && usuario !== '' && usuario !== 'undefined') {
        if (!analise.porUsuario[usuario]) {
          analise.porUsuario[usuario] = { 
            lidos: 0,      // Com presença e sem problemas
            pendentes: 0,  // Sem presença
            comProblema: 0 // Com presença mas com problemas
          }
          analise.usuarios.push(usuario)
        }
        
      if (efetivamenteTemPresenca) {
          analise.porUsuario[usuario].lidos++
          if (itemProblema) {
            analise.porUsuario[usuario].comProblema++
          }
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
        if (itemProblema) {
          analise.porSetor[setor].comProblema++
        }
      } else {
        analise.porSetor[setor].pendentes++
      }

      // Agrupar por LOCAL
      const local = (item['Local'] || 'Não especificado').trim()
      if (!analise.porLocal[local]) {
        analise.porLocal[local] = { 
          lidos: 0, 
          pendentes: 0,
          comProblema: 0
        }
      }
      if (efetivamenteTemPresenca) {
        analise.porLocal[local].lidos++
        if (itemProblema) {
          analise.porLocal[local].comProblema++
        }
      } else {
        analise.porLocal[local].pendentes++
      }
    })

    // Calcular percentuais
    // Itens lidos = lidos corretamente + lidos com problema (ambos contam como lidos)
    const totalLidos = analise.itensLidosCorretamente + analise.itensLidosComProblema
    const totalAuditaveis = analise.itensLidosCorretamente + analise.itensPendentes + analise.itensLidosComProblema
    
    // Percentual pendente (foco na meta de 3%)
    analise.parcialPercentual = totalAuditaveis > 0 
      ? parseFloat(((analise.itensPendentes / totalAuditaveis) * 100).toFixed(2))
      : 0
    
    // Percentual concluído (lidos corretamente + com problema)
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

  const analisarDadosEtiqueta = (dados) => {
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
    dados.forEach(item => {
      const st = statusEtiqueta(item)
      const efetivamenteTem = !!item._temPresenca || st.lidoNaoPertence
      let itemProblema = false
      if (st.naoLidoEstoque) {
        analise.itensPendentes++
      } else if (st.atualizado && !st.lidoNaoPertence) {
        analise.itensLidosCorretamente++
        analise.itensAtualizados++
      } else if (st.desatualizado) {
        analise.itensDesatualizados++
      } else if (st.lidoSemEstoque || st.lidoNaoPertence) {
        analise.itensLidosComProblema++
        itemProblema = true
        if (st.lidoSemEstoque) {
          analise.itensComEstoqueZero++
          analise.itensComEstoqueZeroDetalhes.push({
            codigo: item['Código'],
            produto: item['Produto'],
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
            usuario: item['Usuário'],
            local: item['Local']
          })
        }
      }
      const usuario = (item['Usuário'] || '').trim()
      if (usuario && usuario !== '' && usuario !== 'undefined') {
        if (!analise.porUsuario[usuario]) {
          analise.porUsuario[usuario] = { lidos: 0, pendentes: 0, comProblema: 0 }
          analise.usuarios.push(usuario)
        }
        if (efetivamenteTem) {
          analise.porUsuario[usuario].lidos++
          if (itemProblema) analise.porUsuario[usuario].comProblema++
        } else {
          analise.porUsuario[usuario].pendentes++
        }
      }
      const setor = (item['Classe de Produto Raiz'] || 'Não especificado').trim()
      if (!analise.porSetor[setor]) analise.porSetor[setor] = { lidos: 0, pendentes: 0, comProblema: 0, desatualizados: 0 }
      if (efetivamenteTem) {
        analise.porSetor[setor].lidos++
        if (itemProblema) analise.porSetor[setor].comProblema++
        if (st.desatualizado) analise.porSetor[setor].desatualizados++
      } else {
        analise.porSetor[setor].pendentes++
      }
      const local = (item['Local'] || 'Não especificado').trim()
      if (!analise.porLocal[local]) analise.porLocal[local] = { lidos: 0, pendentes: 0, comProblema: 0 }
      if (efetivamenteTem) {
        analise.porLocal[local].lidos++
        if (itemProblema) analise.porLocal[local].comProblema++
      } else {
        analise.porLocal[local].pendentes++
      }
    })
    const totalLidos = analise.itensAtualizados + analise.itensDesatualizados + analise.itensLidoNaoPertence + analise.itensComEstoqueZero
    const totalAuditaveis = totalLidos + analise.itensPendentes
    analise.totalLidos = totalLidos
    analise.totalItens = totalAuditaveis
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

  const carregarAuditoriasPersistidas = async () => {
    try {
      const registros = await db.auditorias.toArray()
      const statusMap = carregarStatusLocal()
      auditorias.value = registros.map(r => {
        const id = r.id
        const statusPersistido = statusMap && statusMap[id]
        const status = statusPersistido === 'fechada'
          ? 'fechada'
          : (r.status === 'fechada' ? 'fechada' : 'em_andamento')
        return {
          id,
          data: r.data,
          tipo: r.tipo,
          sku: r.sku,
          status,
          dados: r.dados || [],
          analise: r.analise || null,
          parcial: r.parcial || 0,
          total: r.total || 0,
          metaAlcancada: r.metaAlcancada || false
        }
      })
    } catch (e) {
      console.error('Erro ao carregar auditorias do IndexedDB', e)
    }
  }

  const addAuditoria = async (auditoria) => {
    const novaAuditoria = {
      data: auditoria.data,
      tipo: auditoria.tipo,
      sku: auditoria.sku,
      status: auditoria.status || 'em_andamento',
      dados: auditoria.dados || [],
      analise: auditoria.analise || null,
      parcial: auditoria.parcial || 0,
      total: auditoria.total || 0,
      metaAlcancada: auditoria.analise
        ? (auditoria.analise.parcialPercentual || 0) <= 3.0
        : false
    }
    let id
    try {
      id = await db.auditorias.add(novaAuditoria)
    } catch (e) {
      console.error('Erro ao salvar auditoria no IndexedDB', e)
      id = Date.now()
    }
    const completa = { ...novaAuditoria, id }
    auditorias.value.push(completa)
    const statusMap = carregarStatusLocal()
    statusMap[completa.id] = completa.status
    salvarStatusLocal(statusMap)
    return completa
  }

  const updateAuditoria = async (id, dados) => {
    const auditoria = auditorias.value.find(a => a.id === id)
    if (!auditoria) return
    Object.assign(auditoria, dados)
    if (dados.analise) {
      auditoria.metaAlcancada = (dados.analise.parcialPercentual || 0) <= 3.0
    }
    const statusMap = carregarStatusLocal()
    statusMap[auditoria.id] = auditoria.status
    salvarStatusLocal(statusMap)
  }

  const deleteAuditoria = async (id) => {
    const index = auditorias.value.findIndex(a => a.id === id)
    if (index !== -1) {
      const [removida] = auditorias.value.splice(index, 1)
      try {
        await db.auditorias.delete(removida.id)
      } catch (e) {
        console.error('Erro ao remover auditoria do IndexedDB', e)
      }
      addToast('Auditoria removida!', 'info')
    }
  }

  // Computed
  const auditoriasAtivas = computed(() => {
    return auditorias.value.filter(a => a.status === 'em_andamento')
  })

  const auditoriasAgrupadas = computed(() => {
    const agrupadas = {}
    auditorias.value.forEach(auditoria => {
      if (!agrupadas[auditoria.tipo]) {
        agrupadas[auditoria.tipo] = []
      }
      agrupadas[auditoria.tipo].push(auditoria)
    })
    return agrupadas
  })

  return {
    auditorias,
    toasts,
    tiposAuditoriaPorDia,
    horariosAuditoria,
    colunasPresenca,
    colunasEtiqueta,
    addToast,
    removeToast,
    detectarTipoArquivo,
    processarExcelPresenca,
    processarExcelEtiqueta,
    analisarDadosPresenca,
    analisarDadosEtiqueta,
    detectarTipoDados,
    carregarAuditoriasPersistidas,
    addAuditoria,
    updateAuditoria,
    deleteAuditoria,
    auditoriasAtivas,
    auditoriasAgrupadas
  }
})
