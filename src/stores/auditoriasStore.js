import { defineStore } from 'pinia'
import { configuracoes } from '../composables/useConfiguracoes'
import { ref, computed, toRaw, markRaw } from 'vue'
import { db } from '../db/appDb'
import { registrarAlteracao } from '../utils/lembreteBackup'
import { lerPlanilha } from '../utils/planilha'
import { VERSAO_RUPTURA_PRESENCA, completarLocaisPelaPresenca, presencaBaseDaRuptura } from '../utils/rupturaPresenca'
import {
  analisarDadosEtiqueta,
  analisarDadosPresenca,
  analisarDadosRuptura as analisarRuptura,
  detectarTipoArquivo,
  detectarTipoDados,
  tratarLinhasEtiqueta,
  tratarLinhasPresenca
} from '../utils/processamentoAuditoria'

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

// `dados` e `analise` podem ter dezenas de milhares de linhas e sempre são
// substituídos por inteiro. Marcá-los como raw evita proxies reativos profundos.
const semReatividade = valor => (valor && typeof valor === 'object' ? markRaw(valor) : valor)

const limparStatusLocal = () => {
  try {
    localStorage.removeItem(STATUS_STORAGE_KEY)
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

  // Horário das auditorias: editável em Configurações.
  const horariosAuditoria = configuracoes.auditoria

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

  // Obter tipo de auditoria baseado na data selecionada
  const obterTipoAuditoriaParaData = (dataStr) => {
    const data = new Date(dataStr)
    const diaSemana = data.getDay()
    const tipos = tiposAuditoriaPorDia[diaSemana] || []
    return tipos.length > 0 ? tipos[0] : 'Presença' // fallback para Presença
  }

  // ---------- Planilhas (o processamento fica em utils/processamentoAuditoria.js) ----------
  const lerComAvisos = async (file, tratar) => {
    try {
      const { linhas } = await lerPlanilha(file)
      return tratar(linhas)
    } catch (erro) {
      console.error('Erro na leitura da planilha:', erro)
      addToast('Erro: ' + erro.message, 'error')
      throw erro
    }
  }
  const itensPresenca = (linhas, opts = {}) => {
    const r = tratarLinhasPresenca(linhas, opts)
    if (r.redirecionar) {
      addToast('Arquivo detectado como Etiqueta. Ajustando interpretação.', 'info')
      return itensEtiqueta(linhas)
    }
    if (r.duplicados > 0) addToast(`Itens com leitura em local errado agrupados: ${r.duplicados}`, 'info')
    return r.dados
  }
  const itensEtiqueta = (linhas) => {
    const r = tratarLinhasEtiqueta(linhas)
    if (r.redirecionar) {
      addToast('Arquivo detectado como Presença. Ajustando interpretação.', 'info')
      return itensPresenca(linhas)
    }
    if (r.duplicados > 0) addToast(`Itens com Local descartados em favor de registros sem Local: ${r.duplicados}`, 'info')
    return r.dados
  }
  const processarExcelPresenca = (file, opts = {}) => lerComAvisos(file, linhas => itensPresenca(linhas, opts))
  const processarExcelEtiqueta = file => lerComAvisos(file, itensEtiqueta)

  // A planilha de ruptura vem sem local: usa o local do item na presença anterior.
  const processarExcelRuptura = async (file, opts = {}) => {
    const dados = await processarExcelPresenca(file, {
      ...opts,
      tipoAuditoria: 'Ruptura'
    })
    // A presença anterior precisa estar com os itens na memória (carregados em segundo plano).
    await itensProntos
    const base = presencaBaseDaRuptura(opts?.dataAuditoria, auditorias.value)
    return base ? completarLocaisPelaPresenca(dados, base.dados) : dados
  }

  // Ruptura: os setores partem da presença anterior já salva.
  const analisarDadosRuptura = (dados, sku = 0, opts = {}) => analisarRuptura(dados, sku, opts, auditorias.value)

  // ---------- Persistência ----------
  // O resumo de cada auditoria (data, tipo, status, análise) fica em `auditorias`; os itens, que são
  // a maior parte dos dados, em `itensAuditoria`. Ao abrir, o resumo é lido e a tela aparece; os
  // itens chegam em segundo plano, em lotes (`itensCarregados` avisa quando terminou).
  const itensCarregados = ref(true)
  let itensProntos = Promise.resolve()
  const comItens = new Set() // auditorias cujos itens já estão na memória
  const aguardarItens = () => itensProntos
  const LOTE_ITENS = 6

  const plano = (valor) => {
    try {
      return JSON.parse(JSON.stringify(toRaw(valor)))
    } catch {
      try {
        return JSON.parse(JSON.stringify(valor))
      } catch {
        return null
      }
    }
  }
  const resumoParaBanco = a => ({
    id: a.id,
    data: a.data,
    tipo: a.tipo,
    sku: a.sku,
    status: a.status,
    analise: plano(a.analise),
    parcial: a.parcial || 0,
    total: a.total || 0,
    metaAlcancada: a.metaAlcancada || false
  })

  // Recalcula setores e locais das rupturas a partir da presença anterior, sem mexer no % geral.
  // Roda ao carregar (rupturas antigas) e quando uma presença é criada ou atualizada.
  const recalcularRupturasAgora = async ({ presencaId = null } = {}) => {
    const alteradas = []
    for (const auditoria of auditorias.value) {
      if (auditoria.tipo !== 'Ruptura' || !auditoria.analise || !Array.isArray(auditoria.dados)) continue
      const base = presencaBaseDaRuptura(auditoria.data, auditorias.value)
      if (!base) continue
      const atual = auditoria.analise.basePresenca
      const pendente = presencaId ? base.id === presencaId : (atual?.versao !== VERSAO_RUPTURA_PRESENCA || atual?.id !== base.id)
      if (!pendente) continue
      const dados = completarLocaisPelaPresenca(auditoria.dados, base.dados)
      // Usa a mesma regra com que o % geral foi calculado (com ou sem a data do item), para os setores somarem igual.
      const comData = analisarDadosRuptura(dados, auditoria.sku || 0, { dataAuditoria: auditoria.data })
      const nova = comData.itensPendentes === auditoria.analise.itensPendentes
        ? comData
        : analisarDadosRuptura(dados, auditoria.sku || 0, { dataReferencia: auditoria.data })
      auditoria.dados = semReatividade(dados)
      auditoria.analise = semReatividade({
        ...auditoria.analise,
        porSetor: nova.porSetor,
        setoresParados: nova.setoresParados,
        porLocal: nova.porLocal,
        locaisSemLeitura: nova.locaisSemLeitura,
        basePresenca: nova.basePresenca
      })
      alteradas.push(auditoria)
    }
    if (!alteradas.length) return
    try {
      await db.transaction('rw', db.auditorias, db.itensAuditoria, async () => {
        await db.auditorias.bulkPut(alteradas.map(resumoParaBanco))
        await db.itensAuditoria.bulkPut(alteradas.map(a => ({ auditoriaId: a.id, dados: plano(a.dados) || [] })))
      })
    } catch (e) {
      console.error('Erro ao salvar rupturas recalculadas', e)
    }
  }
  // Precisa dos itens de todas as auditorias: espera o carregamento em segundo plano.
  const recalcularRupturas = async (opts) => {
    await itensProntos
    return recalcularRupturasAgora(opts)
  }

  // Itens em lotes, das auditorias mais recentes para as mais antigas, cedendo a vez à tela entre
  // um lote e outro. Não sobrescreve itens que já chegaram por outro caminho (planilha nova).
  const carregarItens = async () => {
    const ids = [...auditorias.value].sort((a, b) => String(b.data).localeCompare(String(a.data)) || b.id - a.id).map(a => a.id)
    for (let i = 0; i < ids.length; i += LOTE_ITENS) {
      const lote = ids.slice(i, i + LOTE_ITENS)
      const registros = await db.itensAuditoria.bulkGet(lote)
      const porId = new Map(auditorias.value.map(a => [a.id, a]))
      lote.forEach((id, k) => {
        const auditoria = porId.get(id)
        if (!auditoria || comItens.has(id)) return
        auditoria.dados = semReatividade(Array.isArray(registros[k]?.dados) ? registros[k].dados : [])
        comItens.add(id)
      })
      await new Promise(resolve => setTimeout(resolve, 0))
    }
    await recalcularRupturasAgora()
  }

  // Itens de uma auditoria já, sem esperar a fila (ex.: abrir o detalhe direto pelo link).
  const garantirItens = async (id) => {
    if (comItens.has(id)) return
    const registro = await db.itensAuditoria.get(id)
    const auditoria = auditorias.value.find(a => a.id === id)
    if (!auditoria || comItens.has(id)) return
    auditoria.dados = semReatividade(Array.isArray(registro?.dados) ? registro.dados : [])
    comItens.add(id)
  }

  const carregarAuditoriasPersistidas = async () => {
    try {
      const registros = await db.auditorias.toArray()
      const statusMap = carregarStatusLocal()
      let migrouStatus = false
      comItens.clear()
      auditorias.value = registros.map(r => {
        const id = r.id
        const statusPersistido = statusMap && statusMap[id]
        const status = statusPersistido === 'fechada'
          ? 'fechada'
          : (r.status === 'fechada' ? 'fechada' : 'em_andamento')
        if (statusPersistido && status !== r.status) {
          r.status = status
          migrouStatus = true
        }
        return {
          id,
          data: r.data,
          tipo: r.tipo,
          sku: r.sku,
          status,
          dados: semReatividade([]),
          analise: semReatividade(r.analise || null),
          parcial: r.parcial || 0,
          total: r.total || 0,
          metaAlcancada: r.metaAlcancada || false
        }
      })
      if (migrouStatus) await db.auditorias.bulkPut(registros)
      if (Object.keys(statusMap).length) limparStatusLocal()
      itensCarregados.value = false
      itensProntos = carregarItens()
        .catch(e => console.error('Erro ao carregar os itens das auditorias', e))
        .finally(() => { itensCarregados.value = true })
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
      const { dados, ...resumo } = novaAuditoria
      await db.transaction('rw', db.auditorias, db.itensAuditoria, async () => {
        id = await db.auditorias.add(resumo)
        await db.itensAuditoria.put({ auditoriaId: id, dados })
      })
      registrarAlteracao('auditoria nova')
    } catch (e) {
      console.error('Erro ao salvar auditoria no IndexedDB', e)
      id = Date.now()
    }
    const completa = {
      ...novaAuditoria,
      id,
      dados: semReatividade(novaAuditoria.dados),
      analise: semReatividade(novaAuditoria.analise)
    }
    comItens.add(id)
    auditorias.value.push(completa)
    if (completa.tipo === 'Presença') await recalcularRupturas({ presencaId: completa.id })
    return completa
  }

  const updateAuditoria = async (id, dados) => {
    const auditoria = auditorias.value.find(a => a.id === id)
    if (!auditoria) return
    const atualizacao = { ...dados }
    if ('dados' in atualizacao) atualizacao.dados = semReatividade(atualizacao.dados)
    if ('analise' in atualizacao) atualizacao.analise = semReatividade(atualizacao.analise)
    Object.assign(auditoria, atualizacao)
    if (dados.analise) {
      auditoria.metaAlcancada = (dados.analise.parcialPercentual || 0) <= 3.0
    }
    // Os itens só são gravados quando mudam (status ou análise não regravam a planilha inteira).
    const novosItens = 'dados' in dados
    if (novosItens) comItens.add(auditoria.id)
    try {
      await db.transaction('rw', db.auditorias, db.itensAuditoria, async () => {
        await db.auditorias.put(resumoParaBanco(auditoria))
        if (novosItens) await db.itensAuditoria.put({ auditoriaId: auditoria.id, dados: plano(auditoria.dados) || [] })
      })
    } catch (e) {
      console.error('Erro ao atualizar auditoria no IndexedDB', e)
    }
    if (novosItens) registrarAlteracao('planilha enviada')
    if (auditoria.tipo === 'Presença' && novosItens) await recalcularRupturas({ presencaId: auditoria.id })
  }

  const deleteAuditoria = async (id) => {
    const index = auditorias.value.findIndex(a => a.id === id)
    if (index !== -1) {
      const [removida] = auditorias.value.splice(index, 1)
      comItens.delete(removida.id)
      try {
        await db.transaction('rw', db.auditorias, db.itensAuditoria, db.planosAcao, async () => {
          await db.auditorias.delete(removida.id)
          await db.itensAuditoria.delete(removida.id)
          await db.planosAcao.where('auditoriaId').equals(removida.id).delete()
        })
        registrarAlteracao('auditoria excluída')
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
    processarExcelRuptura,
    processarExcelEtiqueta,
    analisarDadosPresenca,
    analisarDadosRuptura,
    analisarDadosEtiqueta,
    detectarTipoDados,
    obterTipoAuditoriaParaData,
    carregarAuditoriasPersistidas,
    itensCarregados,
    aguardarItens,
    garantirItens,
    addAuditoria,
    updateAuditoria,
    deleteAuditoria,
    auditoriasAtivas,
    auditoriasAgrupadas
  }
})
