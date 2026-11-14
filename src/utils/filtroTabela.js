import { normalizarBusca } from './busca'

// Motor único de filtro, ordenação e paginação das tabelas do sistema (UiTabela).
// Sem Vue: só funções puras, testadas em filtroTabela.test.js.
//
// Coluna: { chave, titulo, valor?: item => any, formato?: valor => texto, tipo?, busca?: bool,
//           filtravel?: bool, ordenavel?: bool, rapido?: bool, oculta?: bool }
// Tipos: texto, numero, data, categoria, booleano (inferido dos valores quando não informado).
// Condição: { chave, op, valor?, valor2? }. Todas as condições precisam valer (E).
// Ordem: [{ chave, direcao: 'asc' | 'desc' }], na ordem de prioridade.

export const valorDe = (item, col) => (col.valor ? col.valor(item) : item?.[col.chave])
export const textoDe = (item, col) => {
  const v = valorDe(item, col)
  return col.formato ? col.formato(v, item) : v
}
const vazio = v => v === null || v === undefined || (typeof v === 'string' && v.trim() === '') || (typeof v === 'number' && Number.isNaN(v))

// ---------- Datas ----------
// Aceita Date, "aaaa-mm-dd(...)" e "dd/mm/aaaa(...)". Devolve "aaaa-mm-dd" ou ''.
export const diaISO = (v) => {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? '' : `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`
  const t = String(v ?? '').trim()
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}
const hojeISO = () => diaISO(new Date())
const somarDias = (iso, n) => {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + n)
  return diaISO(d)
}
export const dataBR = iso => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '')

// ---------- Números ----------
// Número de uma célula: número, texto "1.234,5" ou "26,694 KG".
export const numeroDe = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'boolean' || vazio(v)) return null
  const m = String(v).replace(/R\$\s*/i, '').trim().match(/^-?[\d.]*\d(?:,\d+)?/)
  if (!m) return null
  const n = Number(m[0].includes(',') ? m[0].replace(/\./g, '').replace(',', '.') : m[0])
  return Number.isFinite(n) ? n : null
}

// ---------- Tipos ----------
export const TIPOS = ['texto', 'numero', 'data', 'categoria', 'booleano']
const MAX_CATEGORIAS = 60
export const inferirTipo = (col, itens) => {
  if (col.tipo) return col.tipo
  const amostra = []
  for (const item of itens) {
    const v = valorDe(item, col)
    if (!vazio(v)) amostra.push(v)
    if (amostra.length >= 400) break
  }
  if (!amostra.length) return 'texto'
  if (amostra.every(v => typeof v === 'boolean')) return 'booleano'
  if (amostra.every(v => typeof v === 'number')) return 'numero'
  if (amostra.every(v => v instanceof Date || (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)))) return 'data'
  const distintos = new Set()
  for (const item of itens) {
    const v = valorDe(item, col)
    if (!vazio(v)) distintos.add(String(v).trim())
    if (distintos.size > MAX_CATEGORIAS) return 'texto'
  }
  // Poucos valores que se repetem (setor, local, status) viram lista; nomes únicos ficam texto.
  return distintos.size <= 12 || distintos.size <= itens.length * 0.5 ? 'categoria' : 'texto'
}

// ---------- Operadores ----------
// aridade: 0 (sem valor), 1, 2 (entre), 'lista' (vários valores da coluna).
export const OPERADORES = {
  texto: [
    { op: 'contem', rotulo: 'contém', aridade: 1 },
    { op: 'naoContem', rotulo: 'não contém', aridade: 1 },
    { op: 'igual', rotulo: 'é igual a', aridade: 1 },
    { op: 'comeca', rotulo: 'começa com', aridade: 1 },
    { op: 'termina', rotulo: 'termina com', aridade: 1 },
    { op: 'vazio', rotulo: 'está vazio', aridade: 0 },
    { op: 'naoVazio', rotulo: 'está preenchido', aridade: 0 }
  ],
  categoria: [
    { op: 'em', rotulo: 'é', aridade: 'lista' },
    { op: 'naoEm', rotulo: 'não é', aridade: 'lista' },
    { op: 'contem', rotulo: 'contém', aridade: 1 },
    { op: 'vazio', rotulo: 'está vazio', aridade: 0 },
    { op: 'naoVazio', rotulo: 'está preenchido', aridade: 0 }
  ],
  numero: [
    { op: 'igual', rotulo: '=', aridade: 1 },
    { op: 'diferente', rotulo: '≠', aridade: 1 },
    { op: 'maior', rotulo: '>', aridade: 1 },
    { op: 'maiorIgual', rotulo: '≥', aridade: 1 },
    { op: 'menor', rotulo: '<', aridade: 1 },
    { op: 'menorIgual', rotulo: '≤', aridade: 1 },
    { op: 'entre', rotulo: 'entre', aridade: 2 },
    { op: 'vazio', rotulo: 'está vazio', aridade: 0 },
    { op: 'naoVazio', rotulo: 'está preenchido', aridade: 0 }
  ],
  data: [
    { op: 'igual', rotulo: 'é em', aridade: 1 },
    { op: 'antes', rotulo: 'antes de', aridade: 1 },
    { op: 'depois', rotulo: 'depois de', aridade: 1 },
    { op: 'entre', rotulo: 'entre', aridade: 2 },
    { op: 'ultimos', rotulo: 'nos últimos (dias)', aridade: 1, numerico: true },
    { op: 'proximos', rotulo: 'nos próximos (dias)', aridade: 1, numerico: true },
    { op: 'passado', rotulo: 'já passou', aridade: 0 },
    { op: 'vazio', rotulo: 'está vazio', aridade: 0 },
    { op: 'naoVazio', rotulo: 'está preenchido', aridade: 0 }
  ],
  booleano: [
    { op: 'sim', rotulo: 'é sim', aridade: 0 },
    { op: 'nao', rotulo: 'é não', aridade: 0 }
  ]
}
export const operador = (tipo, op) => (OPERADORES[tipo] || OPERADORES.texto).find(o => o.op === op) || null
export const operadorPadrao = tipo => ({ texto: 'contem', categoria: 'em', numero: 'maiorIgual', data: 'ultimos', booleano: 'sim' })[tipo] || 'contem'

// Uma condição está pronta para filtrar quando tem os valores que o operador pede.
export const condicaoCompleta = (cond, tipo) => {
  const o = operador(tipo, cond.op)
  if (!o) return false
  if (o.aridade === 0) return true
  if (o.aridade === 'lista') return Array.isArray(cond.valor) && cond.valor.length > 0
  if (vazio(cond.valor)) return false
  return o.aridade === 2 ? !vazio(cond.valor2) : true
}

// Valor da célula comparável para cada tipo.
const comparavel = (v, tipo) => {
  if (tipo === 'numero') return numeroDe(v)
  if (tipo === 'data') return diaISO(v) || null
  if (tipo === 'booleano') return v === true || /^(s|sim|true|1)$/i.test(String(v ?? '').trim())
  return vazio(v) ? '' : String(v).trim()
}

export const testarCondicao = (v, cond, tipo) => {
  const op = cond.op
  if (tipo === 'booleano') {
    const b = comparavel(v, tipo)
    return op === 'sim' ? b : !b
  }
  const x = comparavel(v, tipo)
  const ehVazio = x === null || x === ''
  if (op === 'vazio') return ehVazio
  if (op === 'naoVazio') return !ehVazio
  if (tipo === 'numero') {
    if (ehVazio) return false
    const a = numeroDe(cond.valor)
    const b = numeroDe(cond.valor2)
    if (op === 'igual') return x === a
    if (op === 'diferente') return x !== a
    if (op === 'maior') return x > a
    if (op === 'maiorIgual') return x >= a
    if (op === 'menor') return x < a
    if (op === 'menorIgual') return x <= a
    if (op === 'entre') return x >= Math.min(a, b) && x <= Math.max(a, b)
    return true
  }
  if (tipo === 'data') {
    const hoje = hojeISO()
    if (op === 'passado') return !ehVazio && x < hoje
    if (ehVazio) return false
    if (op === 'ultimos') return x <= hoje && x >= somarDias(hoje, -Math.abs(numeroDe(cond.valor) ?? 0))
    if (op === 'proximos') return x >= hoje && x <= somarDias(hoje, Math.abs(numeroDe(cond.valor) ?? 0))
    const a = diaISO(cond.valor)
    const b = diaISO(cond.valor2)
    if (op === 'igual') return x === a
    if (op === 'antes') return x < a
    if (op === 'depois') return x > a
    if (op === 'entre') return x >= (a < b ? a : b) && x <= (a < b ? b : a)
    return true
  }
  // texto e categoria: sem acento e sem diferenciar maiúsculas
  const t = normalizarBusca(x)
  if (op === 'em') return (cond.valor || []).some(c => normalizarBusca(c) === t)
  if (op === 'naoEm') return !(cond.valor || []).some(c => normalizarBusca(c) === t)
  const alvo = normalizarBusca(cond.valor)
  if (op === 'contem') return t.includes(alvo)
  if (op === 'naoContem') return !t.includes(alvo)
  if (op === 'igual') return t === alvo
  if (op === 'comeca') return t.startsWith(alvo)
  if (op === 'termina') return t.endsWith(alvo)
  return true
}

// ---------- Busca geral ----------
// Termos separados por espaço (todos precisam aparecer), "frase exata" entre aspas e -termo para excluir.
export const interpretarBusca = (consulta) => {
  const incluir = []
  const excluir = []
  const texto = String(consulta ?? '')
  const re = /(-?)"([^"]+)"|(-?)(\S+)/g
  let m
  while ((m = re.exec(texto))) {
    const negado = (m[1] || m[3]) === '-'
    const termo = normalizarBusca(m[2] ?? m[4])
    if (!termo || termo === '-') continue
    ;(negado ? excluir : incluir).push(termo)
  }
  return { incluir, excluir }
}
export const textoBusca = (item, colunas) => normalizarBusca(colunas.filter(c => c.busca !== false).map(c => {
  const v = valorDe(item, c)
  const f = c.formato ? c.formato(v, item) : ''
  return v instanceof Date ? dataBR(diaISO(v)) : `${v ?? ''} ${f ?? ''}`
}).join(' | '))
export const casaBusca = (alvo, { incluir, excluir }) => incluir.every(t => alvo.includes(t)) && !excluir.some(t => alvo.includes(t))

// ---------- Filtrar ----------
// `tipos`: { chave: tipo }. `textos`: textos de busca já calculados (mesma ordem de `itens`).
// `ignorar`: chave cuja condição não entra (contagem das opções de um filtro rápido).
export const filtrarItens = (itens, colunas, { busca = '', condicoes = [] } = {}, { tipos = {}, textos = null, ignorar = null } = {}) => {
  const porChave = new Map(colunas.map(c => [c.chave, c]))
  const ativas = condicoes.filter(c => c.chave !== ignorar && porChave.has(c.chave) && condicaoCompleta(c, tipos[c.chave] || 'texto'))
  const consulta = interpretarBusca(busca)
  const comBusca = consulta.incluir.length || consulta.excluir.length
  const saida = []
  for (let i = 0; i < itens.length; i++) {
    const item = itens[i]
    let ok = true
    for (const c of ativas) {
      if (!testarCondicao(valorDe(item, porChave.get(c.chave)), c, tipos[c.chave] || 'texto')) { ok = false; break }
    }
    if (ok && comBusca) ok = casaBusca(textos ? textos[i] : textoBusca(item, colunas), consulta)
    if (ok) saida.push(item)
  }
  return saida
}

// ---------- Ordenar ----------
const comparar = (a, b, tipo) => {
  const va = comparavel(a, tipo)
  const vb = comparavel(b, tipo)
  const za = va === null || va === ''
  const zb = vb === null || vb === ''
  if (za || zb) return za === zb ? 0 : za ? 1 : -1 // vazios sempre no fim
  if (tipo === 'numero') return va - vb
  if (tipo === 'booleano') return Number(va) - Number(vb)
  return String(va).localeCompare(String(vb), 'pt-BR', { numeric: true, sensitivity: 'base' })
}
export const ordenarItens = (itens, colunas, ordem = [], tipos = {}) => {
  const criterios = ordem.map(o => ({ ...o, col: colunas.find(c => c.chave === o.chave) })).filter(o => o.col)
  if (!criterios.length) return itens
  return itens.map((item, i) => ({ item, i })).sort((x, y) => {
    for (const { col, direcao } of criterios) {
      const tipo = tipos[col.chave] || 'texto'
      const va = valorDe(x.item, col)
      const vb = valorDe(y.item, col)
      const r = comparar(va, vb, tipo)
      if (r) {
        const vazioA = comparavel(va, tipo) === null || comparavel(va, tipo) === ''
        const vazioB = comparavel(vb, tipo) === null || comparavel(vb, tipo) === ''
        return vazioA || vazioB ? r : direcao === 'desc' ? -r : r
      }
    }
    return x.i - y.i
  }).map(x => x.item)
}

// ---------- Opções de um filtro de lista (com contagem) ----------
export const opcoesDaColuna = (itens, col) => {
  const contagem = new Map()
  for (const item of itens) {
    const v = valorDe(item, col)
    if (vazio(v)) continue
    const k = String(v).trim()
    contagem.set(k, (contagem.get(k) || 0) + 1)
  }
  return [...contagem].map(([valor, total]) => ({ valor, total }))
    .sort((a, b) => b.total - a.total || a.valor.localeCompare(b.valor, 'pt-BR', { numeric: true }))
}

// ---------- Paginação ----------
export const TAMANHOS_PAGINA = [10, 25, 50, 100, 250]
export const paginar = (lista, pagina, tamanho) => {
  const total = lista.length
  const paginas = Math.max(1, Math.ceil(total / tamanho))
  const atual = Math.min(Math.max(1, pagina), paginas)
  const inicio = (atual - 1) * tamanho
  return { itens: lista.slice(inicio, inicio + tamanho), pagina: atual, paginas, inicio: total ? inicio + 1 : 0, fim: Math.min(total, inicio + tamanho), total }
}
// Números de página com reticências: 1 … 4 5 6 … 20
export const paginasVisiveis = (atual, total, vizinhas = 1) => {
  const set = new Set([1, total])
  for (let p = atual - vizinhas; p <= atual + vizinhas; p++) if (p >= 1 && p <= total) set.add(p)
  const ordem = [...set].sort((a, b) => a - b)
  const saida = []
  for (let i = 0; i < ordem.length; i++) {
    if (i && ordem[i] - ordem[i - 1] > 1) saida.push(ordem[i] - ordem[i - 1] === 2 ? ordem[i] - 1 : '…')
    saida.push(ordem[i])
  }
  return saida
}

// ---------- Texto de uma condição (chips e relatório) ----------
export const descreverCondicao = (cond, col, tipo) => {
  const o = operador(tipo, cond.op)
  if (!col || !o) return ''
  const fmt = v => (tipo === 'data' && !o.numerico ? dataBR(diaISO(v)) : tipo === 'numero' ? Number(numeroDe(v)).toLocaleString('pt-BR') : String(v))
  if (o.aridade === 0) return `${col.titulo} ${o.rotulo}`
  if (o.aridade === 'lista') {
    const v = cond.valor || []
    return `${col.titulo} ${o.rotulo} ${v.slice(0, 2).join(', ')}${v.length > 2 ? ` +${v.length - 2}` : ''}`
  }
  if (o.aridade === 2) return `${col.titulo} entre ${fmt(cond.valor)} e ${fmt(cond.valor2)}`
  if (o.numerico) return `${col.titulo} ${o.rotulo.replace(' (dias)', '')} ${cond.valor} dias`
  return `${col.titulo} ${o.rotulo} ${fmt(cond.valor)}`
}
