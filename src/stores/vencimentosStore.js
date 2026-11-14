import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db } from '../db/appDb'
import { registrarAlteracao } from '../utils/lembreteBackup'
import { lerPlanilha } from '../utils/planilha'

export const useVencimentosStore = defineStore('vencimentos', () => {
  const itens = ref([])
  const analise = ref(null)

  const parseDateBR = (valor) => {
    if (!valor) return null
    if (valor instanceof Date) return valor
    if (typeof valor === 'number') {
      const excelEpoch = new Date(Math.round((valor - 25569) * 86400 * 1000))
      return excelEpoch
    }
    const str = String(valor).trim()
    const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
    if (m) {
      const d = parseInt(m[1], 10)
      const mo = parseInt(m[2], 10) - 1
      const y = parseInt(m[3], 10)
      return new Date(y, mo, d)
    }
    return null
  }

  const toISODate = (d) => {
    if (!(d instanceof Date) || isNaN(d)) return ''
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const diffDias = (date, base = new Date()) => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return null
    // Zerar horas para comparação apenas de datas
    const d1 = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const d2 = new Date(base.getFullYear(), base.getMonth(), base.getDate())
    const ms = d1.getTime() - d2.getTime()
    return Math.round(ms / (1000 * 60 * 60 * 24))
  }

  const extrairNumeroEstoque = (valor) => {
    if (valor == null) return 0
    if (typeof valor === 'number') return valor
    let s = String(valor).trim()
    s = s.replace(/^###\s*/, '')
    s = s.replace(/KG/gi, '')
    s = s.replace(',', '.')
    const m = s.match(/-?\d+(\.\d+)?/)
    if (!m) return 0
    const n = parseFloat(m[0])
    return isNaN(n) ? 0 : n
  }

  const classificarPrazo = (dias) => {
    if (dias === null || dias === undefined || isNaN(dias)) return 'desconhecido'
    const d = Number(dias)
    if (d < 0) return 'vencidos'
    if (d === 0) return 'hoje'
    if (d <= 3) return 'ate3'
    return 'futuro'
  }

  const carregarVencimentosPersistidos = async () => {
    try {
      const registros = await db.vencimentos.toArray()
      itens.value = registros.map(r => ({
        ...r,
        _validadeDate: r._validadeDate ? new Date(r._validadeDate) : null,
        _revalidacaoDate: r._revalidacaoDate ? new Date(r._revalidacaoDate) : null,
        _ultimaCompraDate: r._ultimaCompraDate ? new Date(r._ultimaCompraDate) : null
      }))
      analise.value = analisar(itens.value)
    } catch (e) {
      console.error('Erro ao carregar vencimentos do IndexedDB', e)
    }
  }

  const processarExcelVencimentos = async (file) => {
    const { linhas } = await lerPlanilha(file)

    const resultado = linhas.map((row) => {
      const situacao = row['Situação'] || ''
      const validade = parseDateBR(row['Data de validade'])
      const revalidacao = parseDateBR(row['Data de revalidação'])
      const ultimaCompra1 = parseDateBR(row['Última compra'])
      const ultimaCompra2 = parseDateBR(row['Ultima compra']) || ultimaCompra1
      const dias = diffDias(validade)
      const estoque = extrairNumeroEstoque(row['Estoque atual'])
      const setor = row['Classe de Produto Raiz'] || row['Setor'] || 'Não especificado'
      const fornecedor = row['Fornecedor'] || ''
      const local = row['Locais'] || row['Local'] || ''
      const codigo = row['Código'] || row['Codigo'] || ''
      const produto = row['Produto'] || ''
      const usuario = row['Usuário'] || row['Usuario'] || ''
      const statusPrazo = classificarPrazo(dias)

      return {
        ...row,
        _situacao: String(situacao),
        _validadeDate: validade,
        _validadeISO: toISODate(validade),
        _diasParaVencer: dias,
        _prazo: statusPrazo,
        _revalidacaoDate: revalidacao,
        _ultimaCompraDate: ultimaCompra2,
        _estoque: estoque,
        _setor: String(setor).trim(),
        _fornecedor: String(fornecedor).trim(),
        _local: String(local).trim(),
        _codigo: codigo,
        _produto: produto,
        _usuario: usuario
      }
    })

    itens.value = resultado
    analise.value = analisar(resultado)
    try {
      await db.vencimentos.clear()
      const ids = await db.vencimentos.bulkAdd(resultado, { allKeys: true })
      ids.forEach((id, indice) => { resultado[indice].id = id })
      registrarAlteracao('vencimentos importados')
    } catch (e) {
      console.error('Erro ao salvar vencimentos no IndexedDB', e)
    }
    return resultado
  }

  const analisar = (lista) => {
    const dados = Array.isArray(lista) ? lista : itens.value
    const total = dados.length
    let vencidos = 0
    let hoje = 0
    let ate3 = 0
    const porSetor = {}
    const porFornecedor = {}

    for (const item of dados) {
      const prazo = item._prazo
      if (prazo === 'vencidos') vencidos++
      else if (prazo === 'hoje') hoje++
      else if (prazo === 'ate3') ate3++

      const setor = item._setor || 'Não especificado'
      if (!porSetor[setor]) {
        porSetor[setor] = { total: 0, vencidos: 0, hoje: 0, ate3: 0, futuro: 0, itens: [] }
      }
      porSetor[setor].total++
      porSetor[setor][prazo] = (porSetor[setor][prazo] || 0) + 1
      porSetor[setor].itens.push(item)

      const forn = item._fornecedor || '—'
      if (!porFornecedor[forn]) porFornecedor[forn] = 0
      porFornecedor[forn]++
    }

    return {
      total,
      vencidos,
      hoje,
      ate3,
      porSetor,
      porFornecedor
    }
  }

  const setores = computed(() => {
    const s = new Set()
    itens.value.forEach(i => s.add(i._setor || 'Não especificado'))
    return Array.from(s).sort()
  })

  const limparVencimentos = async () => {
    itens.value = []
    analise.value = null
    try {
      await db.vencimentos.clear()
      registrarAlteracao('vencimentos apagados')
    } catch (e) {
      console.error('Erro ao limpar vencimentos do IndexedDB', e)
    }
  }

  return {
    itens,
    analise,
    setores,
    processarExcelVencimentos,
    carregarVencimentosPersistidos,
    limparVencimentos
  }
})
