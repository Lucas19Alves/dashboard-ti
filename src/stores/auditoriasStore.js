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

  const processarExcelPresenca = async (file) => {
    console.log('� Lendo arquivo:', file.name)
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
      const dados = XLSX.utils.sheet_to_json(worksheet)
      
      console.log('✅ Leitura completa:', dados.length, 'linhas')
      if (dados.length > 0) {
        console.log('Colunas:', Object.keys(dados[0]))
      }
      
      return dados
    } catch (erro) {
      console.error('❌ Erro na leitura:', erro.message)
      addToast('Erro: ' + erro.message, 'error')
      throw erro
    }
  }

  const analisarDadosPresenca = (dados) => {
    const analise = {
      totalItens: 0,
      itensAuditaveis: 0,
      itensIgnorados: 0,
      itensLidos: 0,
      itensPendentes: 0,
      parcialPercentual: 0,
      porUsuario: {},
      porSetor: {},
      porLocal: {},
      setoresParados: [],
      locaisSemLeitura: [],
      usuarios: [],
      ranking: []
    }

    // Processar apenas itens auditáveis
    const itensAuditaveis = dados.filter(item => {
      // Item não auditável: sem presença confirmada E sem estoque
      const temPresenca = item['Presença confirmada'] && item['Presença confirmada'] !== '' && item['Presença confirmada'] !== 'undefined'
      const estoque = parseInt(item['Estoque atual']) || 0
      
      if (!temPresenca && estoque === 0) {
        analise.itensIgnorados++
        return false
      }
      return true
    })

    analise.totalItens = dados.length
    analise.itensAuditaveis = itensAuditaveis.length

    itensAuditaveis.forEach((item) => {
      const temPresencaConfirmada = item['Presença confirmada'] && item['Presença confirmada'] !== '' && item['Presença confirmada'] !== 'undefined'
      
      if (temPresencaConfirmada) {
        analise.itensLidos++
      } else {
        analise.itensPendentes++
      }

      // Agrupar por USUÁRIO (ignora em branco)
      const usuario = (item['Usuário'] || '').trim()
      if (usuario && usuario !== '' && usuario !== 'undefined') {
        if (!analise.porUsuario[usuario]) {
          analise.porUsuario[usuario] = { lidos: 0, pendentes: 0}
          analise.usuarios.push(usuario)
        }
        if (temPresencaConfirmada) {
          analise.porUsuario[usuario].lidos++
        } else {
          analise.porUsuario[usuario].pendentes++
        }
      }

      // Agrupar por SETOR/CLASSE
      const setor = item['Classe de Produto Raiz'] || 'Não especificado'
      if (!analise.porSetor[setor]) {
        analise.porSetor[setor] = { lidos: 0, pendentes: 0 }
      }
      if (temPresencaConfirmada) {
        analise.porSetor[setor].lidos++
      } else {
        analise.porSetor[setor].pendentes++
      }

      // Agrupar por LOCAL
      const local = item['Local'] || 'Não especificado'
      if (!analise.porLocal[local]) {
        analise.porLocal[local] = { lidos: 0, pendentes: 0 }
      }
      if (temPresencaConfirmada) {
        analise.porLocal[local].lidos++
      } else {
        analise.porLocal[local].pendentes++
      }
    })

    // Calcular PARCIAL: porcentagem de itens NÃO lidos (apenas auditáveis)
    analise.parcialPercentual = analise.itensAuditaveis > 0 
      ? Math.round((analise.itensPendentes / analise.itensAuditaveis) * 100)
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

