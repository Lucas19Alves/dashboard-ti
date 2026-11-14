<script setup>
import { computed, reactive, ref, watch } from 'vue'
import {
  OPERADORES, condicaoCompleta, dataBR, descreverCondicao, diaISO, filtrarItens, inferirTipo, operador, operadorPadrao,
  opcoesDaColuna, ordenarItens, paginar, textoBusca, textoDe, valorDe
} from '../../utils/filtroTabela'
import { baixarCsv } from '../../utils/csv'
import { abrirRelatorioTabela } from '../../composables/useRelatorio'
import UiFiltroMulti from './UiFiltroMulti.vue'
import UiPaginacao from './UiPaginacao.vue'
import UiMenu from './UiMenu.vue'
import { GRUPOS, registrarAcoes } from '../../composables/useAcoes'

// Tabela padrão do sistema: busca geral, filtros rápidos por coluna, filtros avançados por condição
// (texto, número, data, lista, sim/não), ordenação por vários critérios, colunas visíveis,
// agrupamento, paginação, CSV e impressão. O estado fica guardado na sessão (por `id`).
//
// Colunas: { chave, titulo, valor?, formato?, tipo?, alinhamento?, largura?, badge?, rapido?, oculta?,
//            busca?, filtravel?, ordenavel? } (ver utils/filtroTabela.js).
// modo "lista": cada item é desenhado pelo slot #item (cartões); a barra de filtros é a mesma.
const props = defineProps({
  itens: { type: Array, default: () => [] },
  colunas: { type: Array, required: true },
  id: { type: String, default: '' },
  titulo: { type: String, default: 'Itens' },
  modo: { type: String, default: 'tabela' },
  ordemInicial: { type: [Array, Object], default: null },
  tamanhoPagina: { type: Number, default: 25 },
  // Condições aplicadas de fora (ex.: clicar num local em outra tela). Ao mudar, substituem as da mesma coluna.
  filtrosIniciais: { type: Array, default: () => [] },
  // Visões prontas: [{ rotulo, icone?, condicoes: [...], ordem?: [...] }]
  atalhos: { type: Array, default: () => [] },
  agrupavel: { type: Boolean, default: true },
  clicavel: { type: Boolean, default: false },
  exportar: { type: Boolean, default: true },
  // Ações extras da tabela, no menu "Mais" (formato de composables/useAcoes.js).
  acoes: { type: Array, default: () => [] },
  vazio: { type: String, default: 'Nenhum item.' },
  chaveItem: { type: [String, Function], default: null },
  placeholder: { type: String, default: '' },
  // Busca vinda de fora (ex.: busca geral do sistema abrindo a lista já filtrada).
  buscaInicial: { type: String, default: '' },
  // Coluna (categoria) para agrupar ao abrir pela primeira vez.
  agruparInicial: { type: String, default: '' },
  // Linha em destaque (ex.: item selecionado ao lado da tabela).
  destacar: { type: Function, default: null },
  // modo "grade": cartões lado a lado (slot #item), com a mesma barra de filtros.
  classeGrade: { type: String, default: 'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3' },
  // Altura máxima da área rolável (modais). Vazio: a tabela cresce com a página.
  altura: { type: String, default: '' }
})
const emit = defineEmits(['linha', 'filtrados'])

// ---------- Colunas ----------
// Filtro rápido é sempre uma lista de valores (categoria), mesmo com muitos valores distintos.
const cols = computed(() => props.colunas.map(c => ({ ...c, tipo: c.tipo || (c.rapido ? 'categoria' : inferirTipo(c, props.itens)) })))
const tipos = computed(() => Object.fromEntries(cols.value.map(c => [c.chave, c.tipo])))
const porChave = computed(() => new Map(cols.value.map(c => [c.chave, c])))
const filtraveis = computed(() => cols.value.filter(c => c.filtravel !== false))
const ordenaveis = computed(() => cols.value.filter(c => c.ordenavel !== false))

// ---------- Estado (guardado na sessão) ----------
const chaveSessao = computed(() => (props.id ? `tabela:${props.id}` : ''))
const lerSessao = () => { try { return chaveSessao.value ? JSON.parse(sessionStorage.getItem(chaveSessao.value) || 'null') : null } catch { return null } }
const lerLocal = (k, padrao) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : padrao } catch { return padrao } }
const ordemPadrao = () => {
  const o = props.ordemInicial
  if (!o) return []
  return (Array.isArray(o) ? o : [o]).filter(x => x?.chave).map(x => ({ chave: x.chave, direcao: x.direcao === 'asc' ? 'asc' : 'desc' }))
}
let seq = 0
const novoId = () => `c${Date.now().toString(36)}${seq++}`
const salvo = lerSessao()
const estado = reactive({
  busca: salvo?.busca || '',
  condicoes: (salvo?.condicoes || props.filtrosIniciais.map(c => ({ ...c }))).map(c => ({ id: novoId(), ...c })),
  ordem: salvo?.ordem || ordemPadrao(),
  agrupar: salvo ? (salvo.agrupar || '') : props.agruparInicial
})
const tamanho = ref(lerLocal(`tabela-tamanho:${props.id}`, props.tamanhoPagina))
const pagina = ref(salvo?.pagina || 1)
const ocultas = ref(new Set(lerLocal(`tabela-colunas:${props.id}`, [])))
watch(() => ({ ...estado, pagina: pagina.value }), (v) => {
  if (!chaveSessao.value) return
  try { sessionStorage.setItem(chaveSessao.value, JSON.stringify({ ...v, condicoes: v.condicoes.map(({ id, ...c }) => c) })) } catch {}
}, { deep: true })
watch(tamanho, v => { if (props.id) try { localStorage.setItem(`tabela-tamanho:${props.id}`, JSON.stringify(v)) } catch {} })
watch(ocultas, v => { if (props.id) try { localStorage.setItem(`tabela-colunas:${props.id}`, JSON.stringify([...v])) } catch {} })
watch(() => [estado.busca, JSON.stringify(estado.condicoes), JSON.stringify(estado.ordem), tamanho.value], () => { pagina.value = 1 })

// Filtros vindos de fora substituem os da mesma coluna.
// Vale também ao abrir (immediate), por cima do estado guardado na sessão.
watch(() => JSON.stringify(props.filtrosIniciais), () => {
  if (!props.filtrosIniciais.length) return
  const chaves = new Set(props.filtrosIniciais.map(c => c.chave))
  estado.condicoes = [...estado.condicoes.filter(c => !chaves.has(c.chave)), ...props.filtrosIniciais.filter(c => condicaoCompleta(c, tipos.value[c.chave])).map(c => ({ id: novoId(), ...c }))]
}, { immediate: true })
watch(() => props.buscaInicial, (v) => { if (v) estado.busca = v }, { immediate: true })

// ---------- Dados ----------
const textos = computed(() => props.itens.map(i => textoBusca(i, cols.value)))
const filtrados = computed(() => filtrarItens(props.itens, cols.value, estado, { tipos: tipos.value, textos: textos.value }))
const ordenados = computed(() => ordenarItens(filtrados.value, cols.value, estado.ordem, tipos.value))
const pag = computed(() => paginar(ordenados.value, pagina.value, tamanho.value))
watch(filtrados, v => emit('filtrados', v), { immediate: true })
const exibidas = computed(() => cols.value.filter(c => !c.oculta && !ocultas.value.has(c.chave)))
const visiveisNoMenu = computed(() => cols.value.filter(c => !c.oculta))

const colAgrupar = computed(() => (props.agrupavel ? porChave.value.get(estado.agrupar) || null : null))
const grupos = computed(() => {
  const col = colAgrupar.value
  if (!col) return [{ chave: '', itens: pag.value.itens, total: 0 }]
  const totais = new Map()
  for (const item of ordenados.value) { const k = String(textoDe(item, col) ?? '').trim() || 'Não informado'; totais.set(k, (totais.get(k) || 0) + 1) }
  const mapa = new Map()
  for (const item of pag.value.itens) {
    const k = String(textoDe(item, col) ?? '').trim() || 'Não informado'
    if (!mapa.has(k)) mapa.set(k, [])
    mapa.get(k).push(item)
  }
  return [...mapa].map(([chave, itens]) => ({ chave, itens, total: totais.get(chave) }))
})
const recolhidos = ref(new Set())
const alternarGrupo = (k) => { const s = new Set(recolhidos.value); s.has(k) ? s.delete(k) : s.add(k); recolhidos.value = s }
const categorias = computed(() => cols.value.filter(c => c.tipo === 'categoria'))

// ---------- Filtros rápidos (listas das colunas mais usadas) ----------
const rapidos = computed(() => {
  const marcados = filtraveis.value.filter(c => c.rapido)
  return (marcados.length ? marcados : filtraveis.value.filter(c => c.tipo === 'categoria' && c.rapido !== false).slice(0, 3))
})
const valoresRapido = chave => estado.condicoes.find(c => c.chave === chave && c.op === 'em')?.valor || []
const definirRapido = (chave, valores) => {
  const i = estado.condicoes.findIndex(c => c.chave === chave && c.op === 'em')
  if (!valores.length) { if (i >= 0) estado.condicoes.splice(i, 1); return }
  if (i >= 0) estado.condicoes[i].valor = valores
  else estado.condicoes.push({ id: novoId(), chave, op: 'em', valor: valores })
}
// Contagem de cada valor considerando os outros filtros (não o da própria coluna).
const opcoesFiltradas = chave => () => opcoesDaColuna(filtrarItens(props.itens, cols.value, estado, { tipos: tipos.value, textos: textos.value, ignorar: chave }), porChave.value.get(chave))
const opcoesTodas = chave => () => opcoesDaColuna(props.itens, porChave.value.get(chave))

// ---------- Filtros avançados ----------
const painel = ref('') // '', 'filtros', 'exibicao'
const alternarPainel = p => { painel.value = painel.value === p ? '' : p }
const adicionarCondicao = () => {
  const col = filtraveis.value.find(c => !estado.condicoes.some(x => x.chave === c.chave)) || filtraveis.value[0]
  if (!col) return
  estado.condicoes.push({ id: novoId(), chave: col.chave, op: operadorPadrao(col.tipo), valor: col.tipo === 'categoria' ? [] : '', valor2: '' })
  painel.value = 'filtros'
}
const mudarColuna = (cond, chave) => {
  const tipo = tipos.value[chave]
  Object.assign(cond, { chave, op: operadorPadrao(tipo), valor: tipo === 'categoria' ? [] : '', valor2: '' })
}
const mudarOperador = (cond, op) => {
  const antes = operador(tipos.value[cond.chave], cond.op)
  const depois = operador(tipos.value[cond.chave], op)
  cond.op = op
  if ((antes?.aridade === 'lista') !== (depois?.aridade === 'lista') || antes?.numerico !== depois?.numerico) { cond.valor = depois?.aridade === 'lista' ? [] : ''; cond.valor2 = '' }
}
const removerCondicao = id => { estado.condicoes = estado.condicoes.filter(c => c.id !== id) }
const opsDe = cond => OPERADORES[tipos.value[cond.chave]] || OPERADORES.texto
const opDe = cond => operador(tipos.value[cond.chave], cond.op)
const tipoInput = cond => (tipos.value[cond.chave] === 'data' && !opDe(cond)?.numerico ? 'date' : 'text')
const completas = computed(() => estado.condicoes.filter(c => porChave.value.has(c.chave) && condicaoCompleta(c, tipos.value[c.chave])))
const chips = computed(() => [
  ...(estado.busca.trim() ? [{ id: 'busca', texto: `Busca: "${estado.busca.trim()}"` }] : []),
  ...completas.value.map(c => ({ id: c.id, texto: descreverCondicao(c, porChave.value.get(c.chave), tipos.value[c.chave]) }))
])
const removerChip = id => { if (id === 'busca') estado.busca = ''; else removerCondicao(id) }
const limparTudo = () => { estado.busca = ''; estado.condicoes = [] }

// ---------- Atalhos ----------
const assinatura = conds => JSON.stringify(conds.map(({ chave, op, valor, valor2 }) => ({ chave, op, valor, valor2: valor2 || undefined })))
const atalhoAtivo = a => assinatura(estado.condicoes) === assinatura(a.condicoes || [])
const aplicarAtalho = (a) => {
  if (atalhoAtivo(a)) { estado.condicoes = []; return }
  estado.condicoes = (a.condicoes || []).map(c => ({ id: novoId(), ...c }))
  if (a.ordem) estado.ordem = a.ordem.map(o => ({ ...o }))
}

// ---------- Ordenação ----------
const direcaoPadrao = col => (col.tipo === 'numero' || col.tipo === 'data' ? 'desc' : 'asc')
const posicaoOrdem = chave => estado.ordem.findIndex(o => o.chave === chave)
const clicarCabecalho = (col, evento) => {
  if (col.ordenavel === false) return
  const i = posicaoOrdem(col.chave)
  const padrao = direcaoPadrao(col)
  if (evento?.shiftKey) {
    if (i < 0) estado.ordem.push({ chave: col.chave, direcao: padrao })
    else if (estado.ordem[i].direcao === padrao) estado.ordem[i].direcao = padrao === 'asc' ? 'desc' : 'asc'
    else estado.ordem.splice(i, 1)
    return
  }
  if (i === 0 && estado.ordem.length === 1) {
    if (estado.ordem[0].direcao === padrao) estado.ordem[0].direcao = padrao === 'asc' ? 'desc' : 'asc'
    else estado.ordem = []
  } else estado.ordem = [{ chave: col.chave, direcao: padrao }]
}
const iconeOrdem = (chave) => {
  const o = estado.ordem.find(x => x.chave === chave)
  return !o ? 'fa-sort text-slate-300' : o.direcao === 'asc' ? 'fa-sort-up text-blue-600' : 'fa-sort-down text-blue-600'
}
const adicionarOrdem = () => {
  const col = ordenaveis.value.find(c => posicaoOrdem(c.chave) < 0)
  if (col) estado.ordem.push({ chave: col.chave, direcao: direcaoPadrao(col) })
}
const moverOrdem = (i, d) => { const o = estado.ordem; const j = i + d; if (j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]] }
const textoOrdem = computed(() => estado.ordem.map(o => `${porChave.value.get(o.chave)?.titulo || o.chave} ${o.direcao === 'asc' ? '↑' : '↓'}`).join(', '))
const rotuloDirecao = (chave, d) => {
  const t = tipos.value[chave]
  if (t === 'numero') return d === 'asc' ? 'menor → maior' : 'maior → menor'
  if (t === 'data') return d === 'asc' ? 'mais antiga primeiro' : 'mais recente primeiro'
  return d === 'asc' ? 'A → Z' : 'Z → A'
}

// ---------- Colunas visíveis ----------
const alternarColuna = (chave) => {
  const s = new Set(ocultas.value)
  if (s.has(chave)) s.delete(chave)
  else if (exibidas.value.length > 1) s.add(chave)
  ocultas.value = s
}

// ---------- Exportar ----------
const valorCsv = (item, c) => {
  const v = valorDe(item, c)
  if (v instanceof Date) return dataBR(diaISO(v))
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não'
  if (c.tipo === 'data' && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return dataBR(diaISO(v))
  return v
}
const nomeArquivo = () => `${(props.id || props.titulo).toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-')}-${diaISO(new Date())}`
const exportarCsv = () => baixarCsv(ordenados.value.map(i => Object.fromEntries(exibidas.value.map(c => [c.chave, valorCsv(i, c)]))), exibidas.value.map(c => ({ chave: c.chave, titulo: c.titulo })), nomeArquivo())
const imprimir = () => abrirRelatorioTabela({
  id: props.id || nomeArquivo(),
  titulo: props.titulo,
  contexto: [
    ...chips.value.map(c => ({ rotulo: 'Filtro', valor: c.texto })),
    estado.ordem.length && { rotulo: 'Ordem', valor: textoOrdem.value },
    { rotulo: 'Listados', valor: `${filtrados.value.length.toLocaleString('pt-BR')} de ${props.itens.length.toLocaleString('pt-BR')}` }
  ].filter(Boolean),
  colunas: exibidas.value.map(c => ({ ...c, valor: item => { const t = textoDe(item, c); return t instanceof Date ? dataBR(diaISO(t)) : t }, formato: undefined })),
  itens: ordenados.value,
  agrupamento: colAgrupar.value ? { nome: colAgrupar.value.titulo.toLowerCase(), valor: item => textoDe(item, colAgrupar.value) } : null
})

// Menu "Mais" da barra: ações da tela que usa a tabela + exportações da lista filtrada.
const acoesMenu = computed(() => [
  ...props.acoes,
  ...(props.exportar ? [
    { id: 'csv', rotulo: 'Baixar CSV', detalhe: 'Lista filtrada, colunas visíveis', icone: 'fas fa-file-csv', grupo: GRUPOS.exportar, desativado: !filtrados.value.length, termos: 'csv excel planilha exportar baixar', executar: exportarCsv },
    { id: 'imprimir', rotulo: 'Imprimir / PDF', detalhe: 'Relatório da lista filtrada', icone: 'fas fa-print', grupo: GRUPOS.exportar, desativado: !filtrados.value.length, termos: 'pdf imprimir relatorio', executar: imprimir }
  ] : [])
])
if (props.id || props.titulo !== 'Itens') registrarAcoes(props.titulo, () => acoesMenu.value)

// Quantos ajustes de exibição estão fora do padrão (ordem, agrupamento, colunas).
const ajustesExibicao = computed(() =>
  (JSON.stringify(estado.ordem) !== JSON.stringify(ordemPadrao()) ? 1 : 0) + ((estado.agrupar || '') !== (props.agruparInicial || '') ? 1 : 0) + (ocultas.value.size ? 1 : 0))

// ---------- Células ----------
const alinhar = c => (c.alinhamento === 'right' || (!c.alinhamento && c.tipo === 'numero') ? 'text-right tabular-nums' : c.alinhamento === 'center' ? 'text-center' : 'text-left')
const exibir = (item, c) => {
  const t = textoDe(item, c)
  if (t === null || t === undefined || t === '') return '—'
  if (t instanceof Date) return dataBR(diaISO(t))
  if (typeof t === 'boolean') return t ? 'Sim' : 'Não'
  if (typeof t === 'number') return t.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
  if (c.tipo === 'data' && !c.formato && /^\d{4}-\d{2}-\d{2}/.test(t)) return dataBR(diaISO(t))
  return t
}
const chaveDe = (item, i) => (typeof props.chaveItem === 'function' ? props.chaveItem(item) : props.chaveItem ? item?.[props.chaveItem] : `${pag.value.inicio}-${i}`)
const int = v => v.toLocaleString('pt-BR')
const temFiltro = computed(() => chips.value.length > 0)

// Troca todas as condições (cartões de resumo que filtram a tabela).
const aplicarCondicoes = (conds) => { estado.condicoes = conds.map(c => ({ id: novoId(), ...c })) }
defineExpose({ filtrados, ordenados, limparTudo, definirRapido, aplicarCondicoes, condicoes: computed(() => estado.condicoes) })
</script>

<template>
  <div class="space-y-3">
    <!-- Barra: busca + botões -->
    <div class="flex flex-wrap items-center gap-2">
      <div class="relative min-w-0 flex-1 basis-60">
        <i class="fas fa-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400"></i>
        <input v-model="estado.busca" type="search" class="ui-input h-9 py-0 pl-8 text-sm" :placeholder="placeholder || `Buscar em ${titulo.toLowerCase()}...`" title='Todos os termos precisam aparecer. Use "frase exata" e -palavra para excluir.' />
      </div>
      <button type="button" class="ferramenta" :class="painel === 'filtros' || completas.length ? 'ativa' : ''" :aria-expanded="painel === 'filtros'" @click="estado.condicoes.length ? alternarPainel('filtros') : adicionarCondicao()">
        <i class="fas fa-filter"></i>Filtros<span v-if="completas.length" class="contador">{{ completas.length }}</span>
      </button>
      <button type="button" class="ferramenta" :class="painel === 'exibicao' || ajustesExibicao ? 'ativa' : ''" :aria-expanded="painel === 'exibicao'" title="Ordenar, agrupar e escolher colunas" @click="alternarPainel('exibicao')">
        <i class="fas fa-sliders"></i><span class="hidden sm:inline">Exibição</span><span v-if="ajustesExibicao" class="contador">{{ ajustesExibicao }}</span>
      </button>
      <div class="ml-auto flex items-center gap-1.5">
        <slot name="acoes" :filtrados="ordenados" />
        <UiMenu :acoes="acoesMenu" estilo="ferramenta" compacto />
      </div>
    </div>

    <!-- Filtros rápidos e atalhos -->
    <div v-if="rapidos.length || atalhos.length" class="flex flex-wrap items-center gap-2">
      <button v-for="a in atalhos" :key="a.rotulo" type="button" class="inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition" :class="atalhoAtivo(a) ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'" @click="aplicarAtalho(a)">
        <i v-if="a.icone" :class="a.icone"></i>{{ a.rotulo }}
      </button>
      <span v-if="atalhos.length && rapidos.length" class="mx-1 hidden h-5 w-px bg-slate-200 sm:block"></span>
      <UiFiltroMulti v-for="c in rapidos" :key="c.chave" :rotulo="c.titulo" :model-value="valoresRapido(c.chave)" :opcoes="opcoesFiltradas(c.chave)" @update:model-value="definirRapido(c.chave, $event)" />
    </div>

    <!-- Painel: filtros avançados -->
    <section v-if="painel === 'filtros'" class="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
      <p class="mb-2 text-xs text-slate-500">Mostra só os itens que atendem a <b>todas</b> as condições.</p>
      <div class="space-y-2">
        <div v-for="c in estado.condicoes" :key="c.id" class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[minmax(0,12rem)_minmax(0,11rem)_minmax(0,1fr)_auto]">
          <select class="ui-input h-9 py-0 text-sm" :value="c.chave" aria-label="Coluna" @change="mudarColuna(c, $event.target.value)">
            <option v-for="col in filtraveis" :key="col.chave" :value="col.chave">{{ col.titulo }}</option>
          </select>
          <button type="button" class="size-9 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 sm:order-last" title="Remover condição" @click="removerCondicao(c.id)"><i class="fas fa-xmark"></i></button>
          <select class="ui-input h-9 py-0 text-sm" :value="c.op" aria-label="Condição" @change="mudarOperador(c, $event.target.value)">
            <option v-for="o in opsDe(c)" :key="o.op" :value="o.op">{{ o.rotulo }}</option>
          </select>
          <div class="col-span-2 flex min-w-0 items-center gap-2 sm:col-span-1">
            <UiFiltroMulti v-if="opDe(c)?.aridade === 'lista'" v-model="c.valor" bloco :opcoes="opcoesTodas(c.chave)" />
            <template v-else-if="opDe(c)?.aridade === 1 || opDe(c)?.aridade === 2">
              <input v-model="c.valor" :type="tipoInput(c)" :inputmode="tipos[c.chave] === 'numero' || opDe(c)?.numerico ? 'decimal' : undefined" class="ui-input h-9 min-w-0 py-0 text-sm" :placeholder="opDe(c)?.numerico ? 'dias' : 'valor'" />
              <template v-if="opDe(c)?.aridade === 2"><span class="text-xs text-slate-500">e</span><input v-model="c.valor2" :type="tipoInput(c)" class="ui-input h-9 min-w-0 py-0 text-sm" placeholder="valor" /></template>
            </template>
            <span v-else class="text-xs text-slate-400">sem valor</span>
          </div>
        </div>
      </div>
      <div class="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" class="text-sm font-semibold text-blue-700 hover:underline" @click="adicionarCondicao"><i class="fas fa-plus mr-1"></i>Adicionar condição</button>
        <button v-if="estado.condicoes.length" type="button" class="text-sm font-semibold text-slate-500 hover:text-red-600" @click="estado.condicoes = []">Remover todas</button>
        <button type="button" class="ml-auto text-sm font-semibold text-slate-600 hover:text-slate-900" @click="painel = ''">Fechar</button>
      </div>
    </section>

    <!-- Painel: exibição (ordem, agrupamento e colunas) -->
    <section v-if="painel === 'exibicao'" class="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
      <div>
      <h3 class="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Ordenar</h3>
      <p class="mb-2 text-xs text-slate-500">Ordena pelo primeiro critério; empates seguem o próximo. Dica: clique no título da coluna (Shift + clique soma um critério).</p>
      <p v-if="!estado.ordem.length" class="text-sm text-slate-500">Na ordem original.</p>
      <div class="space-y-2">
        <div v-for="(o, i) in estado.ordem" :key="o.chave" class="flex flex-wrap items-center gap-2">
          <span class="w-5 text-center text-xs font-bold text-slate-400">{{ i + 1 }}</span>
          <select v-model="o.chave" class="ui-input h-9 w-auto min-w-40 flex-1 py-0 text-sm sm:flex-none" aria-label="Ordenar por">
            <option v-for="col in ordenaveis" :key="col.chave" :value="col.chave" :disabled="col.chave !== o.chave && posicaoOrdem(col.chave) >= 0">{{ col.titulo }}</option>
          </select>
          <div class="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
            <button v-for="d in ['asc', 'desc']" :key="d" type="button" class="rounded-md px-2.5 py-1 text-xs font-semibold" :class="o.direcao === d ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'" @click="o.direcao = d">{{ rotuloDirecao(o.chave, d) }}</button>
          </div>
          <button type="button" class="size-8 rounded-lg text-slate-400 hover:bg-white disabled:opacity-30" :disabled="i === 0" title="Subir" @click="moverOrdem(i, -1)"><i class="fas fa-arrow-up"></i></button>
          <button type="button" class="size-8 rounded-lg text-slate-400 hover:bg-white disabled:opacity-30" :disabled="i === estado.ordem.length - 1" title="Descer" @click="moverOrdem(i, 1)"><i class="fas fa-arrow-down"></i></button>
          <button type="button" class="size-8 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600" title="Remover" @click="estado.ordem.splice(i, 1)"><i class="fas fa-xmark"></i></button>
        </div>
      </div>
      <div class="mt-2 flex flex-wrap items-center gap-3">
        <button v-if="estado.ordem.length < ordenaveis.length" type="button" class="text-sm font-semibold text-blue-700 hover:underline" @click="adicionarOrdem"><i class="fas fa-plus mr-1"></i>Adicionar critério</button>
        <button type="button" class="text-sm font-semibold text-slate-500 hover:text-slate-900" @click="estado.ordem = ordemPadrao()">Ordem padrão</button>
      </div>
      </div>

      <div v-if="agrupavel && categorias.length" class="border-t border-slate-200 pt-3">
        <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Agrupar</h3>
        <select v-model="estado.agrupar" class="ui-input h-9 w-auto min-w-48 py-0 text-sm" aria-label="Agrupar por">
          <option value="">Sem agrupar</option>
          <option v-for="c in categorias" :key="c.chave" :value="c.chave">Por {{ c.titulo.toLowerCase() }}</option>
        </select>
      </div>

      <div v-if="modo === 'tabela'" class="border-t border-slate-200 pt-3">
        <h3 class="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Colunas</h3>
        <p class="mb-2 text-xs text-slate-500">Colunas mostradas na tabela, no CSV e na impressão.</p>
        <div class="flex flex-wrap gap-2">
          <label v-for="c in visiveisNoMenu" :key="c.chave" class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm">
            <input type="checkbox" class="accent-blue-600" :checked="!ocultas.has(c.chave)" @change="alternarColuna(c.chave)" />{{ c.titulo }}
          </label>
        </div>
        <button v-if="ocultas.size" type="button" class="mt-2 text-sm font-semibold text-slate-500 hover:text-slate-900" @click="ocultas = new Set()">Mostrar todas</button>
      </div>

      <div class="flex justify-end border-t border-slate-200 pt-3">
        <button type="button" class="text-sm font-semibold text-slate-600 hover:text-slate-900" @click="painel = ''">Fechar</button>
      </div>
    </section>

    <!-- Filtros ativos -->
    <div v-if="temFiltro" class="flex flex-wrap items-center gap-1.5">
      <button v-for="c in chips" :key="c.id" type="button" class="inline-flex max-w-full items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800 hover:border-red-200 hover:bg-red-50 hover:text-red-700" title="Remover filtro" @click="removerChip(c.id)">
        <span class="truncate">{{ c.texto }}</span><i class="fas fa-xmark text-[10px]"></i>
      </button>
      <button type="button" class="px-1.5 text-xs font-semibold text-slate-500 hover:text-red-600" @click="limparTudo">Limpar tudo</button>
    </div>

    <p class="text-xs text-slate-500">
      <b class="tabular-nums text-slate-800">{{ int(filtrados.length) }}</b><template v-if="filtrados.length !== itens.length"> de {{ int(itens.length) }}</template>
      {{ filtrados.length === 1 ? 'item' : 'itens' }}<template v-if="estado.ordem.length"> · ordem: {{ textoOrdem }}</template>
    </p>

    <!-- Vazio -->
    <div v-if="!filtrados.length" class="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center">
      <i class="fas fa-inbox text-2xl text-slate-300"></i>
      <p class="mt-2 text-sm font-medium text-slate-600"><slot name="vazio">{{ itens.length ? 'Nenhum item com esses filtros.' : vazio }}</slot></p>
      <button v-if="itens.length && temFiltro" type="button" class="mt-2 text-xs font-semibold text-blue-700 hover:underline" @click="limparTudo">Limpar filtros</button>
    </div>

    <!-- Grade (cartões lado a lado) -->
    <template v-else-if="modo === 'grade'">
      <section v-for="g in grupos" :key="g.chave || 'todos'" class="space-y-2">
        <h3 v-if="g.chave" class="flex items-baseline justify-between font-semibold text-slate-900">{{ g.chave }}<span class="text-xs font-normal text-slate-500">{{ g.total }}</span></h3>
        <div :class="classeGrade">
          <template v-for="(item, i) in g.itens" :key="chaveDe(item, i)"><slot name="item" :item="item" :indice="i" /></template>
        </div>
      </section>
    </template>

    <!-- Lista (cartões) -->
    <template v-else-if="modo === 'lista'">
      <section v-for="g in grupos" :key="g.chave || 'todos'" class="ui-card overflow-hidden">
        <header v-if="g.chave" class="flex items-baseline justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-2"><h3 class="font-semibold text-slate-900">{{ g.chave }}</h3><span class="text-xs text-slate-500">{{ g.total }}</span></header>
        <ul class="divide-y divide-slate-100">
          <li v-for="(item, i) in g.itens" :key="chaveDe(item, i)" :class="clicavel ? 'cursor-pointer hover:bg-slate-50' : ''" @click="clicavel && emit('linha', item)"><slot name="item" :item="item" :indice="i" /></li>
        </ul>
      </section>
    </template>

    <!-- Tabela -->
    <div v-else class="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div class="overflow-auto" :class="altura">
        <table class="w-full text-sm">
          <thead class="sticky top-0 z-10 bg-slate-50 text-xs text-slate-500 shadow-[0_1px_0_var(--color-slate-200)]">
            <tr>
              <th v-for="c in exibidas" :key="c.chave" scope="col" class="whitespace-nowrap px-3 py-2.5 font-semibold" :class="[alinhar(c), c.ordenavel !== false ? 'cursor-pointer select-none hover:text-blue-700' : '']" :aria-sort="estado.ordem[0]?.chave === c.chave ? (estado.ordem[0].direcao === 'asc' ? 'ascending' : 'descending') : undefined" @click="clicarCabecalho(c, $event)">
                {{ c.titulo }}
                <template v-if="c.ordenavel !== false"><i class="fas ml-0.5 text-[10px]" :class="iconeOrdem(c.chave)"></i><sup v-if="estado.ordem.length > 1 && posicaoOrdem(c.chave) >= 0" class="ml-0.5 text-[9px] text-blue-600">{{ posicaoOrdem(c.chave) + 1 }}</sup></template>
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-for="g in grupos" :key="g.chave || 'todos'">
              <tr v-if="g.chave" class="cursor-pointer bg-slate-50/60 hover:bg-slate-100/70" @click="alternarGrupo(g.chave)">
                <td :colspan="exibidas.length" class="border-t border-slate-200 px-3 py-2">
                  <span class="flex items-center gap-2"><i class="fas fa-chevron-down text-[10px] text-slate-400 transition" :class="recolhidos.has(g.chave) ? '-rotate-90' : ''"></i><b class="text-slate-800">{{ g.chave }}</b><span class="ml-auto text-xs font-semibold text-slate-500">{{ int(g.total) }}</span></span>
                </td>
              </tr>
              <template v-if="!recolhidos.has(g.chave)">
                <tr v-for="(item, i) in g.itens" :key="chaveDe(item, i)" class="border-t border-slate-100" :class="[clicavel ? 'cursor-pointer hover:bg-blue-50/50' : 'hover:bg-slate-50/70', destacar?.(item) ? '!bg-blue-50' : '']" @click="clicavel && emit('linha', item)">
                  <td v-for="(c, ci) in exibidas" :key="c.chave" class="px-3 py-2" :class="[alinhar(c), ci === 0 ? 'font-semibold text-slate-800' : 'text-slate-600', c.largura || '']">
                    <slot :name="`celula-${c.chave}`" :item="item" :valor="valorDe(item, c)" :texto="exibir(item, c)">
                      <span v-if="c.badge" class="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold" :class="c.badge(valorDe(item, c), item)">{{ exibir(item, c) }}</span>
                      <span v-else class="block max-w-[28rem] truncate" :title="String(exibir(item, c))">{{ exibir(item, c) }}</span>
                    </slot>
                  </td>
                </tr>
              </template>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <UiPaginacao v-if="filtrados.length" v-model:pagina="pagina" v-model:tamanho="tamanho" :paginas="pag.paginas" :inicio="pag.inicio" :fim="pag.fim" :total="pag.total" />
  </div>
</template>

<style scoped>
.ferramenta {
  display: inline-flex;
  height: 2.25rem;
  align-items: center;
  gap: 0.4rem;
  border-radius: 0.5rem;
  border: 1px solid color-mix(in oklab, var(--color-slate-300) 80%, transparent);
  background: var(--color-white);
  padding: 0 0.75rem;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-slate-700);
  white-space: nowrap;
}
.ferramenta:hover:not(:disabled) { border-color: var(--color-slate-400); background: var(--color-slate-50); }
.ferramenta:disabled { opacity: 0.45; cursor: not-allowed; }
.ferramenta.ativa { border-color: var(--color-blue-300); background: var(--color-blue-50); color: var(--color-blue-800); }
.contador {
  display: inline-flex;
  min-width: 1.15rem;
  height: 1.15rem;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background: var(--color-blue-600);
  padding: 0 0.3rem;
  font-size: 10px;
  color: var(--color-white);
}
</style>
