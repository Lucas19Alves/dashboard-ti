import { computed, inject, onBeforeUnmount, provide, reactive, shallowRef, watchEffect } from 'vue'

// Padrão de ações do sistema (botões de página, de aba e de tabela).
//
// Cada ação é um objeto:
//   { id, rotulo, icone?, executar, nivel?, grupo?, perigo?, confirmar?, desativado?, dica?, termos?, oculta? }
//   nivel: 'principal' (um botão em destaque), 'secundaria' (botão comum; no celular vai para o menu)
//          ou 'menu' (padrão: dentro de "Mais").
//   grupo: título da seção no menu. Use os mesmos nomes em todo o sistema: GRUPOS abaixo.
//   perigo: vai para o fim do menu, em vermelho. confirmar: texto de confirmação antes de executar.
//
// Toda ação visível também aparece na busca rápida (Ctrl+K), em "Nesta tela": nada fica escondido.

export const GRUPOS = { acoes: 'Ações', dados: 'Dados', exportar: 'Exportar', ver: 'Ver' }
const ORDEM_GRUPOS = [GRUPOS.acoes, GRUPOS.dados, GRUPOS.exportar, GRUPOS.ver]

export const executarAcao = async (acao) => {
  if (!acao || acao.desativado) return
  if (acao.confirmar && !window.confirm(acao.confirmar)) return
  await acao.executar?.()
}

// Menu em seções: grupos na ordem padrão, ações perigosas por último.
export const seccionarAcoes = (acoes) => {
  const normais = acoes.filter(a => !a.perigo)
  const nomes = [...new Set(normais.map(a => a.grupo || GRUPOS.acoes))]
    .sort((a, b) => (ORDEM_GRUPOS.indexOf(a) + 1 || 99) - (ORDEM_GRUPOS.indexOf(b) + 1 || 99))
  const secoes = nomes.map(nome => ({ nome, acoes: normais.filter(a => (a.grupo || GRUPOS.acoes) === nome) }))
  const perigosas = acoes.filter(a => a.perigo)
  if (perigosas.length) secoes.push({ nome: '', perigo: true, acoes: perigosas })
  return secoes
}

// ---------- Registro para a busca rápida (Ctrl+K) ----------
const fontes = reactive(new Map())
let seq = 0

export const acoesDaTela = computed(() => [...fontes.values()].flatMap(f =>
  (f.acoes() || []).filter(a => a && !a.oculta && !a.desativado && a.executar).map(a => ({ ...a, contexto: f.contexto }))
))

export const registrarAcoes = (contexto, obterAcoes) => {
  const id = ++seq
  fontes.set(id, { contexto, acoes: obterAcoes })
  onBeforeUnmount(() => fontes.delete(id))
}

// ---------- Ações da aba no cabeçalho da página ----------
// A página chama fornecerAcoesDaAba() e passa o resultado ao UiAcoes do cabeçalho.
// A aba chama usarAcoesDaAba(() => [...]): se estiver dentro de uma página que fornece,
// as ações sobem para o cabeçalho (uma linha de botões só) e a função devolve true;
// se não, devolve false e a aba mostra os próprios botões.
const CHAVE_ABA = Symbol('acoesDaAba')

export const fornecerAcoesDaAba = () => {
  const alvo = shallowRef({ dono: 0, acoes: [] })
  provide(CHAVE_ABA, alvo)
  return computed(() => alvo.value.acoes)
}

export const temCabecalhoDeAba = () => Boolean(inject(CHAVE_ABA, null))

export const usarAcoesDaAba = (obterAcoes) => {
  const alvo = inject(CHAVE_ABA, null)
  if (!alvo) return false
  const dono = ++seq
  watchEffect(() => { alvo.value = { dono, acoes: obterAcoes() || [] } })
  onBeforeUnmount(() => { if (alvo.value.dono === dono) alvo.value = { dono: 0, acoes: [] } })
  return true
}
