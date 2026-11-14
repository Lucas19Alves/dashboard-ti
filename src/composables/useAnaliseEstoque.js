import { computed, effectScope, ref, watch } from 'vue'
import { useAuditoriasStore } from '../stores/auditoriasStore'
import { useVencimentosStore } from '../stores/vencimentosStore'
import { useNaoVinculadosStore } from '../stores/naoVinculadosStore'
import { useEstoqueTotalStore } from '../stores/estoqueTotalStore'
import { LIMIAR_PARADO_DIAS, LIMIAR_REINCIDENCIA_DIAS, estoqueParado, indexarEstoque, reincidencias, semEstoqueNoSistema, validadePorCodigo } from '../utils/estoque'
import { cruzarEstoqueTotal, insumosNaPlanilha, mapaEstoqueTotal, nuncaLidosNaPlanilha } from '../utils/estoqueTotal'
import { indexarHistorico, vinculosSuspeitos } from '../utils/naoVinculados'

// Limiares escolhidos na tela, lembrados neste navegador.
const ler = (chave, padrao) => {
  try { return Number(localStorage.getItem(chave)) || padrao } catch { return padrao }
}
export const limiarReincidencia = ref(ler('dashboard_ti_estoque_limiar_reincidencia', LIMIAR_REINCIDENCIA_DIAS))
export const limiarParado = ref(ler('dashboard_ti_estoque_limiar_parado', LIMIAR_PARADO_DIAS))
watch(limiarReincidencia, v => { try { localStorage.setItem('dashboard_ti_estoque_limiar_reincidencia', String(v)) } catch {} })
watch(limiarParado, v => { try { localStorage.setItem('dashboard_ti_estoque_limiar_parado', String(v)) } catch {} })

// Uma instância só para o app inteiro: Início, Estoque e Não vinculados usam os mesmos cálculos,
// que só refazem quando auditorias, validades, não vinculados ou o estoque total mudam.
let compartilhado = null
export const useAnaliseEstoque = () => {
  if (!compartilhado) compartilhado = effectScope(true).run(criarAnalise)
  return compartilhado
}

const criarAnalise = () => {
  const auditorias = useAuditoriasStore()
  const vencimentos = useVencimentosStore()
  const naoVinculadosStore = useNaoVinculadosStore()
  const estoqueTotalStore = useEstoqueTotalStore()

  const indice = computed(() => indexarEstoque(auditorias.auditorias))
  const historico = computed(() => indexarHistorico(auditorias.auditorias))
  // Planilha de estoque total: quando existe, é a base das listas (só os itens dela, com o estoque dela).
  const total = computed(() => (estoqueTotalStore.itens.length ? mapaEstoqueTotal(estoqueTotalStore.itens) : null))
  const infoEstoqueTotal = computed(() => estoqueTotalStore.info)

  const reincidentes = computed(() => reincidencias(indice.value, { limiar: limiarReincidencia.value, total: total.value }))
  const semEstoque = computed(() => semEstoqueNoSistema(indice.value, { total: total.value }))
  const parados = computed(() => estoqueParado(indice.value, vencimentos.itens, { limiar: limiarParado.value, total: total.value }))
  const naoVinculados = computed(() => naoVinculadosStore.itens.filter(i => i.status !== 'resolvido'))
  const suspeitos = computed(() => vinculosSuspeitos(null, { historico: historico.value }))
  // Insumos (setor OUTROS): ficam numa aba própria, fora das listas de problemas.
  const insumos = computed(() => insumosNaPlanilha({ total: total.value, indice: indice.value }))
  // Itens com estoque, comprados antes da última Presença, que nunca apareceram nas auditorias e não estão
  // na lista de não vinculados (sem os insumos e sem os que chegaram depois da última auditoria).
  const nuncaLidos = computed(() => nuncaLidosNaPlanilha({ total: total.value, indice: indice.value, naoVinculados: naoVinculados.value }))
  // Zerados que a planilha mostra com estoque de novo (entrada lançada depois da auditoria).
  const zeradosResolvidos = computed(() => {
    if (!total.value) return 0
    return semEstoqueNoSistema(indice.value).length - semEstoque.value.length
  })

  // Fila única por gravidade: os itens mais graves de todos os tipos.
  const prioridades = computed(() => [...reincidentes.value, ...semEstoque.value, ...parados.value, ...nuncaLidos.value]
    .sort((a, b) => b.gravidade - a.gravidade || (b.dias || 0) - (a.dias || 0)))

  // Lista completa da planilha, cruzada com auditorias e validades.
  const itensEstoque = computed(() => (total.value ? cruzarEstoqueTotal({ total: total.value, indice: indice.value, validades: validadePorCodigo(vencimentos.itens), naoVinculados: naoVinculados.value }) : []))
  const problemasPorCodigo = computed(() => {
    const m = new Map()
    for (const l of [...reincidentes.value, ...semEstoque.value, ...parados.value, ...nuncaLidos.value]) m.set(l.codigo, [...(m.get(l.codigo) || []), l])
    return m
  })

  const resumo = computed(() => ({
    reincidentes: reincidentes.value.length,
    semEstoque: semEstoque.value.length,
    parados: parados.value.length,
    nuncaLidos: nuncaLidos.value.length,
    insumos: insumos.value.length,
    saiuDaAuditoria: reincidentes.value.filter(l => l.saiuDaAuditoria).length,
    naoVinculados: naoVinculados.value.length,
    suspeitos: suspeitos.value.length,
    custoReincidentes: reincidentes.value.reduce((s, l) => s + (l.custoAcumulado || 0), 0)
  }))

  // Enquanto os itens chegam em segundo plano, as listas ainda não estão completas.
  const carregando = computed(() => !auditorias.itensCarregados)

  return {
    carregando, indice, total, infoEstoqueTotal, reincidentes, semEstoque, parados, nuncaLidos, insumos, zeradosResolvidos,
    naoVinculados, suspeitos, prioridades, itensEstoque, problemasPorCodigo, resumo, limiarReincidencia, limiarParado
  }
}
