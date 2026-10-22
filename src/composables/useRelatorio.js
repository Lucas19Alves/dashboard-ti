import { shallowRef } from 'vue'
import { blocoBarras, blocoTabela, imprimirRelatorio } from '../utils/print'
import { rotulosAssinatura } from './useConfiguracoes'

// Relatórios do sistema: antes de imprimir, o modal deixa escolher seções, colunas, orientação,
// observações e campos de assinatura. As escolhas ficam lembradas por relatório neste navegador.
//
// abrir({
//   id, titulo, subtitulo, contexto: [{ rotulo, valor }], indicadores: [...],
//   secoes: [{ id, titulo, descricao, padrao, gerar: opcoes => html | [{ titulo, descricao, html, novaPagina }] }],
//   colunas: { lista: [{ chave, titulo }], padrao: [chaves] }   // opcional: escolha de colunas da tabela
// })
const pendente = shallowRef(null)
const CHAVE = id => `dashboard_ti_relatorio_${id}`

export const lerPreferencias = (id) => {
  try { return JSON.parse(localStorage.getItem(CHAVE(id)) || 'null') } catch { return null }
}
export const salvarPreferencias = (id, prefs) => {
  try { localStorage.setItem(CHAVE(id), JSON.stringify(prefs)) } catch {}
}

export const gerarRelatorio = (config, escolhas) => {
  const opcoes = { colunas: escolhas.colunas }
  const secoes = []
  for (const sec of config.secoes || []) {
    if (!escolhas.secoes.includes(sec.id)) continue
    const r = sec.gerar(opcoes)
    if (Array.isArray(r)) secoes.push(...r)
    else if (r) secoes.push({ titulo: sec.titulo, descricao: sec.descricaoImpressa || '', html: r, novaPagina: sec.novaPagina })
  }
  imprimirRelatorio({
    titulo: config.titulo,
    subtitulo: config.subtitulo,
    contexto: config.contexto || [],
    indicadores: escolhas.secoes.includes('__indicadores') ? (config.indicadores || []) : [],
    secoes,
    orientacao: escolhas.orientacao,
    observacoes: escolhas.observacoes,
    assinaturas: escolhas.assinaturas ? (config.assinaturas || rotulosAssinatura()) : null
  })
}

export const useRelatorio = () => ({
  pendente,
  abrir: (config) => { pendente.value = config },
  fechar: () => { pendente.value = null }
})

// ---------- Relatório de uma tabela (listas dos modais, abas de dados, vencimentos) ----------
const RESUMOS = [['setor', 'setor'], ['Classe de Produto Raiz', 'setor'], ['_setor', 'setor'], ['Setor', 'setor'], ['_prazo', 'situação'], ['status', 'situação'], ['motivo', 'motivo'], ['_fornecedor', 'fornecedor'], ['fornecedor', 'fornecedor'], ['Local', 'local'], ['local', 'local'], ['Usuário', 'usuário'], ['usuario', 'usuário']]
const textoDe = (item, c) => {
  const bruto = c.valor ? c.valor(item) : item?.[c.chave]
  if (bruto === null || bruto === undefined || bruto === '') return '—'
  if (c.format) return c.format(bruto)
  if (c.formato) return c.formato(bruto)
  return typeof bruto === 'number' ? bruto.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : String(bruto)
}

// agrupamento: { nome, valor: item => texto } — a tabela sai agrupada como na tela (grupos maiores primeiro).
export const abrirRelatorioTabela = ({ id, titulo, subtitulo = '', contexto = [], colunas, itens, indicadores = [], tituloTabela = 'Itens', resumo: resumoPronto = null, assinaturaPadrao = false, agrupamento = null }) => {
  if (!Array.isArray(itens) || !itens.length || !Array.isArray(colunas) || !colunas.length) return
  let resumo = RESUMOS.find(([chave]) => colunas.some(c => c.chave === chave))
  let barras = []
  if (resumoPronto?.barras?.length > 1) {
    resumo = [null, resumoPronto.nome]
    barras = resumoPronto.barras
  } else if (resumo) {
    const col = colunas.find(c => c.chave === resumo[0])
    const contagem = new Map()
    for (const item of itens) {
      const v = textoDe(item, col)
      contagem.set(v, (contagem.get(v) || 0) + 1)
    }
    if (contagem.size > 1 && contagem.size < itens.length) barras = [...contagem].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([rotulo, valor]) => ({ rotulo, valor }))
  }
  pendente.value = {
    id: `tabela_${id}`,
    titulo,
    subtitulo,
    contexto,
    assinaturaPadrao,
    indicadores: [{ rotulo: 'Registros', valor: itens.length.toLocaleString('pt-BR') }, ...indicadores],
    colunas: { lista: colunas.map(c => ({ chave: c.chave, titulo: c.titulo })), padrao: colunas.map(c => c.chave) },
    secoes: [
      ...(barras.length ? [{ id: 'resumo', titulo: `Resumo por ${resumo[1]}`, descricao: `Quantidade de registros por ${resumo[1]} (até 15).`, padrao: true, gerar: () => blocoBarras({ titulo: `Registros por ${resumo[1]}`, barras }) }] : []),
      {
        id: 'tabela',
        titulo: tituloTabela,
        descricao: agrupamento ? `Lista completa agrupada por ${agrupamento.nome}, com os filtros da tela.` : 'Lista completa, na ordem e com os filtros aplicados na tela.',
        padrao: true,
        gerar: ({ colunas: escolhidas }) => {
          const usadas = colunas.filter(c => escolhidas.includes(c.chave))
          const linha = item => Object.fromEntries(usadas.map(c => [c.chave, textoDe(item, c)]))
          let linhas = itens.map(linha)
          if (agrupamento?.valor) {
            const mapa = new Map()
            for (const item of itens) {
              const k = String(agrupamento.valor(item) ?? '').trim() || 'Não informado'
              if (!mapa.has(k)) mapa.set(k, [])
              mapa.get(k).push(item)
            }
            linhas = [...mapa].sort((a, b) => b[1].length - a[1].length)
              .flatMap(([k, lista]) => [{ __grupo: k, __detalhe: `${lista.length.toLocaleString('pt-BR')} item(ns)` }, ...lista.map(linha)])
          }
          return blocoTabela({
            colunas: usadas.map(c => ({ chave: c.chave, titulo: c.titulo, alinhamento: c.alinhamento })),
            linhas
          })
        }
      }
    ]
  }
}
