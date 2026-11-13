import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db } from '../db/appDb'
import { registrarAlteracao } from '../utils/lembreteBackup'
import { lerPlanilha } from '../utils/planilha'
import { mesclarImportacao, tratarPlanilha } from '../utils/naoVinculados'

const hojeISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const simples = v => JSON.parse(JSON.stringify(v))

export const useNaoVinculadosStore = defineStore('naoVinculados', () => {
  const itens = ref([])

  const carregar = async () => {
    itens.value = await db.naoVinculados.toArray()
  }

  const importar = async (file, auditorias) => {
    const { linhas, colunas } = await lerPlanilha(file)
    if (!colunas.some(c => /^c[oó]digo$/i.test(c))) throw new Error('A planilha não tem a coluna Código.')
    const novos = tratarPlanilha(linhas, auditorias)
    if (!novos.length) throw new Error('Nenhum item com código na planilha.')
    const resultado = mesclarImportacao(await db.naoVinculados.toArray(), novos, hojeISO())
    await db.transaction('rw', db.naoVinculados, async () => {
      await db.naoVinculados.clear()
      await db.naoVinculados.bulkAdd(simples(resultado))
    })
    itens.value = resultado
    registrarAlteracao('não vinculados importados')
    return { total: novos.length, resolvidos: resultado.filter(i => i.resolvidoEm === hojeISO()).length }
  }

  // Recalcula as sugestões com as auditorias atuais (sem mexer no status do tratamento).
  const atualizarSugestoes = async (auditorias) => {
    const ativos = itens.value.filter(i => i.status !== 'resolvido')
    if (!ativos.length) return
    const novas = new Map(tratarPlanilha(ativos.map(i => ({ 'Código': i.codigo, 'Classe de Produto': i.classe })), auditorias).map(i => [i.codigo, i.sugestao]))
    itens.value = itens.value.map(i => (novas.has(i.codigo) ? { ...i, sugestao: novas.get(i.codigo) } : i))
    await db.naoVinculados.bulkPut(simples(itens.value))
  }

  const limpar = async () => {
    await db.naoVinculados.clear()
    itens.value = []
    registrarAlteracao('não vinculados apagados')
  }

  return { itens, carregar, importar, atualizarSugestoes, limpar }
})
