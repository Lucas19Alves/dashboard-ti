import { computed, effectScope, ref, watch } from 'vue'
import { useAuditoriasStore } from '../stores/auditoriasStore'
import { useVencimentosStore } from '../stores/vencimentosStore'
import { useNaoVinculadosStore } from '../stores/naoVinculadosStore'
import { LIMIAR_PARADO_DIAS, LIMIAR_REINCIDENCIA_DIAS, estoqueParado, indexarEstoque, reincidencias, semEstoqueNoSistema } from '../utils/estoque'
import { vinculosSuspeitos } from '../utils/naoVinculados'

// Limiares escolhidos na tela, lembrados neste navegador.
const ler = (chave, padrao) => {
  try { return Number(localStorage.getItem(chave)) || padrao } catch { return padrao }
}
export const limiarReincidencia = ref(ler('dashboard_ti_estoque_limiar_reincidencia', LIMIAR_REINCIDENCIA_DIAS))
export const limiarParado = ref(ler('dashboard_ti_estoque_limiar_parado', LIMIAR_PARADO_DIAS))
watch(limiarReincidencia, v => { try { localStorage.setItem('dashboard_ti_estoque_limiar_reincidencia', String(v)) } catch {} })
watch(limiarParado, v => { try { localStorage.setItem('dashboard_ti_estoque_limiar_parado', String(v)) } catch {} })

// Uma instância só para o app inteiro: Início, Estoque e Não vinculados usam os mesmos cálculos,
// que só refazem quando auditorias, validades ou não vinculados mudam (não a cada troca de página).
let compartilhado = null
export const useAnaliseEstoque = () => {
  if (!compartilhado) compartilhado = effectScope(true).run(criarAnalise)
  return compartilhado
}

const criarAnalise = () => {
  const auditorias = useAuditoriasStore()
  const vencimentos = useVencimentosStore()
  const naoVinculadosStore = useNaoVinculadosStore()

  const indice = computed(() => indexarEstoque(auditorias.auditorias))
  const reincidentes = computed(() => reincidencias(indice.value, { limiar: limiarReincidencia.value }))
  const semEstoque = computed(() => semEstoqueNoSistema(indice.value))
  const parados = computed(() => estoqueParado(indice.value, vencimentos.itens, { limiar: limiarParado.value }))
  const naoVinculados = computed(() => naoVinculadosStore.itens.filter(i => i.status !== 'resolvido'))
  const suspeitos = computed(() => vinculosSuspeitos(auditorias.auditorias))

  // Fila única por gravidade: os itens mais graves de todos os tipos.
  const prioridades = computed(() => [...reincidentes.value, ...semEstoque.value, ...parados.value]
    .sort((a, b) => b.gravidade - a.gravidade || (b.dias || 0) - (a.dias || 0)))

  const resumo = computed(() => ({
    reincidentes: reincidentes.value.length,
    semEstoque: semEstoque.value.length,
    parados: parados.value.length,
    naoVinculados: naoVinculados.value.length,
    suspeitos: suspeitos.value.length,
    custoReincidentes: reincidentes.value.reduce((s, l) => s + (l.custoAcumulado || 0), 0)
  }))

  // Enquanto os itens chegam em segundo plano, as listas ainda não estão completas.
  const carregando = computed(() => !auditorias.itensCarregados)

  return { carregando, indice, reincidentes, semEstoque, parados, naoVinculados, suspeitos, prioridades, resumo, limiarReincidencia, limiarParado }
}
