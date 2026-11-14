import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { db } from '../db/appDb'
import { registrarAlteracao } from '../utils/lembreteBackup'
import { lerPlanilha } from '../utils/planilha'
import { faltandoColunas, tratarEstoqueTotal } from '../utils/estoqueTotal'
import { dataDaPlanilha, fotoDoEstoque } from '../utils/historicoEstoque'

export const CHAVE_INFO_ESTOQUE = 'estoqueTotal'

// Planilha de estoque total da loja. A mais recente é a base das análises; cada importação também
// guarda uma foto no histórico (utils/historicoEstoque.js), na data da última venda da planilha.
// Uma planilha mais antiga que a atual entra só no histórico.
export const useEstoqueTotalStore = defineStore('estoqueTotal', () => {
  // ~11 mil itens que só são lidos: shallowRef evita tornar cada um reativo.
  const itens = shallowRef([])
  const info = ref(null) // { importadoEm, arquivo, total, data }
  const fotos = shallowRef([]) // resumo das fotos do histórico: [{ id, data, importadoEm, arquivo, total }]

  const guardarFoto = async (lista, meta) => {
    const f = fotoDoEstoque(lista, meta)
    await db.transaction('rw', db.estoqueFotos, db.estoqueFotoItens, async () => {
      await db.estoqueFotos.put(f.meta)
      await db.estoqueFotoItens.put(f.itens)
    })
    return f.meta
  }

  const carregarFotos = async () => {
    fotos.value = (await db.estoqueFotos.toArray()).sort((a, b) => a.data.localeCompare(b.data))
  }

  const carregar = async () => {
    const [lista, registro] = await Promise.all([db.estoqueTotal.toArray(), db.config.get(CHAVE_INFO_ESTOQUE)])
    itens.value = lista
    info.value = registro ? { importadoEm: registro.importadoEm, arquivo: registro.arquivo, total: registro.total, data: registro.data || dataDaPlanilha(lista, registro.importadoEm) } : null
    await carregarFotos()
    // Planilha importada antes do histórico existir: vira a primeira foto.
    if (lista.length && registro && !fotos.value.some(f => f.id === info.value.data)) {
      await guardarFoto(lista, registro)
      await carregarFotos()
    }
  }

  // Itens completos das fotos (só quando a aba Histórico abre: pode ser bastante coisa).
  const itensDasFotos = async () => {
    const registros = await db.estoqueFotoItens.toArray()
    const porId = new Map(registros.map(r => [r.id, r.itens]))
    return fotos.value.map(f => ({ ...f, itens: porId.get(f.id) || [] }))
  }

  const importar = async (file) => {
    const { linhas, colunas } = await lerPlanilha(file)
    const faltam = faltandoColunas(colunas)
    if (faltam.length) throw new Error(`A planilha não tem a(s) coluna(s) ${faltam.join(', ')}. Use o relatório de produtos com estoque do sistema.`)
    const novos = tratarEstoqueTotal(linhas)
    if (!novos.length) throw new Error('Nenhum item com código na planilha.')
    const importadoEm = new Date().toISOString()
    const data = dataDaPlanilha(novos, importadoEm)
    const meta = { importadoEm, arquivo: file.name, total: novos.length, data }
    await guardarFoto(novos, meta)
    const somenteHistorico = Boolean(info.value?.data && data < info.value.data)
    if (!somenteHistorico) {
      await db.transaction('rw', db.estoqueTotal, db.config, async () => {
        await db.estoqueTotal.clear()
        await db.estoqueTotal.bulkAdd(novos)
        await db.config.put({ chave: CHAVE_INFO_ESTOQUE, ...meta })
      })
      itens.value = novos
      info.value = meta
    }
    await carregarFotos()
    registrarAlteracao(somenteHistorico ? 'foto antiga do estoque importada' : 'estoque total importado')
    return { total: novos.length, comEstoque: novos.filter(i => i.estoque > 0).length, data, somenteHistorico }
  }

  const apagarFoto = async (id) => {
    await db.transaction('rw', db.estoqueFotos, db.estoqueFotoItens, async () => {
      await db.estoqueFotos.delete(id)
      await db.estoqueFotoItens.delete(id)
    })
    await carregarFotos()
    registrarAlteracao('foto do estoque apagada')
  }

  // Apaga a planilha atual; o histórico fica (tem botão próprio).
  const limpar = async () => {
    await db.transaction('rw', db.estoqueTotal, db.config, async () => {
      await db.estoqueTotal.clear()
      await db.config.delete(CHAVE_INFO_ESTOQUE)
    })
    itens.value = []
    info.value = null
    registrarAlteracao('estoque total apagado')
  }

  return { itens, info, fotos, carregar, carregarFotos, itensDasFotos, importar, apagarFoto, limpar }
})
