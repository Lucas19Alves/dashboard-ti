import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as XLSX from 'xlsx'

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
          
          return {
            ...item,
            _temPresenca: temPresenca,
            _estoque: estoque,
            _situacao: item['Situação'] || item['Situação atual da auditoria'] || ''
          }
        })
        .filter(item => {
          // Filtrar itens não auditáveis: sem presença E sem estoque
          // Itens auditáveis são: (sem presença + com estoque) OU (com presença + qualquer coisa)
          if (!item._temPresenca && item._estoque === 0) {
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
      let lidoNaoPertence = false
      
      // Verifica coluna explícita se existir
      if (item['Lido não pertence'] !== undefined) {
        const valor = item['Lido não pertence']
        lidoNaoPertence = valor === 'Sim' || 
                         valor === true ||
                         valor === 'SIM' ||
                         (typeof valor === 'string' && 
                          valor.toLowerCase().includes('sim'))
      }
      
      // Se não encontrou na coluna, pode inferir de outras colunas ou situação
      // (por enquanto mantém false, pode ser expandido depois)
      
      // Categorizar o item (cada item cai em apenas UMA categoria)
      let itemProblema = false
      
      if (temPresenca && estoque > 0 && !lidoNaoPertence) {
        // ✅ Lido Corretamente: tem presença + tem estoque + não está no local errado
        analise.itensLidosCorretamente++
      } else if (!temPresenca && estoque > 0) {
        // ⏳ Pendente (não lido): sem presença mas tem estoque
        analise.itensPendentes++
      } else if (temPresenca && (estoque === 0 || lidoNaoPertence)) {
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
        
        if (temPresenca) {
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
      if (temPresenca) {
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
      if (temPresenca) {
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

  const addAuditoria = (auditoria) => {
    const novaAuditoria = {
      id: Date.now(),
      data: auditoria.data,
      tipo: auditoria.tipo,
      sku: auditoria.sku,
      status: auditoria.status || 'em_andamento', // 'em_andamento' ou 'fechada'
      dados: auditoria.dados || [],
      analise: auditoria.analise || null,
      parcial: auditoria.parcial || 0,
      total: auditoria.total || 0,
      status: 'em_andamento'
    }
    auditorias.value.push(novaAuditoria)
    addToast(`Auditoria ${auditoria.tipo} criada com sucesso!`, 'success')
    return novaAuditoria
  }

  const updateAuditoria = (id, dados) => {
    const auditoria = auditorias.value.find(a => a.id === id)
    if (auditoria) {
      Object.assign(auditoria, dados)
    }
  }

  const deleteAuditoria = (id) => {
    const index = auditorias.value.findIndex(a => a.id === id)
    if (index !== -1) {
      auditorias.value.splice(index, 1)
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
    addToast,
    removeToast,
    processarExcelPresenca,
    analisarDadosPresenca,
    addAuditoria,
    updateAuditoria,
    deleteAuditoria,
    auditoriasAtivas,
    auditoriasAgrupadas
  }
})

