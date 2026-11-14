import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { db } from '../db/appDb'
import { registrarAlteracao } from '../utils/lembreteBackup'
import { lerPlanilha } from '../utils/planilha'
import { faltandoColunas, tratarEstoqueTotal } from '../utils/estoqueTotal'

export const CHAVE_INFO_ESTOQUE = 'estoqueTotal'

// Planilha de estoque total da loja. Cada importação substitui a anterior (é uma foto do estoque).
export const useEstoqueTotalStore = defineStore('estoqueTotal', () => {
  // ~11 mil itens que só são lidos: shallowRef evita tornar cada um reativo.
  const itens = shallowRef([])
  const info = ref(null) // { importadoEm, arquivo, total }

  const carregar = async () => {
    const [lista, registro] = await Promise.all([db.estoqueTotal.toArray(), db.config.get(CHAVE_INFO_ESTOQUE)])
    itens.value = lista
    info.value = registro ? { importadoEm: registro.importadoEm, arquivo: registro.arquivo, total: registro.total } : null
  }

  const importar = async (file) => {
    const { linhas, colunas } = await lerPlanilha(file)
    const faltam = faltandoColunas(colunas)
    if (faltam.length) throw new Error(`A planilha não tem a(s) coluna(s) ${faltam.join(', ')}. Use o relatório de produtos com estoque do sistema.`)
    const novos = tratarEstoqueTotal(linhas)
    if (!novos.length) throw new Error('Nenhum item com código na planilha.')
    const meta = { importadoEm: new Date().toISOString(), arquivo: file.name, total: novos.length }
    await db.transaction('rw', db.estoqueTotal, db.config, async () => {
      await db.estoqueTotal.clear()
      await db.estoqueTotal.bulkAdd(novos)
      await db.config.put({ chave: CHAVE_INFO_ESTOQUE, ...meta })
    })
    itens.value = novos
    info.value = meta
    registrarAlteracao('estoque total importado')
    return { total: novos.length, comEstoque: novos.filter(i => i.estoque > 0).length }
  }

  const limpar = async () => {
    await db.transaction('rw', db.estoqueTotal, db.config, async () => {
      await db.estoqueTotal.clear()
      await db.config.delete(CHAVE_INFO_ESTOQUE)
    })
    itens.value = []
    info.value = null
    registrarAlteracao('estoque total apagado')
  }

  return { itens, info, carregar, importar, limpar }
})
