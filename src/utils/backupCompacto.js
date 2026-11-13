// Formato compacto do backup (sem perda): expandir(compactar(x)) é igual a JSON.parse(JSON.stringify(x)).
//
// Listas de objetos (itens das auditorias, vencimentos, não vinculados…) viram tabelas por coluna.
// Cada valor simples entra uma vez num dicionário global (ordenado pelo uso) e vira um número (token).
// Para cada coluna, escolhe o jeito mais curto de guardar os tokens:
//   k  constante                     d  lista de tokens
//   i  inteiros em sequência (diferenças)
//   h  data-hora "dd/mm/aaaa hh:mm:ss" em segundos a partir do menor horário da tabela
//   g  data-hora como diferença para a linha anterior (leituras seguidas têm horários próximos)
//   l  repetições seguidas: [valor, quantas vezes] (o mesmo usuário lê vários itens em sequência)
//   r  igual a outra coluna, só as exceções (Situação / _situacao)
//   n  número da outra coluna em texto, só as exceções ("6" / 6)
//   p  prevista por outra coluna: o último valor visto para aquele código (ou categoria) em
//      qualquer tabela anterior; só as exceções (nome, classe, fornecedor, local do produto…)
//   m  numérica: diferença para o último valor do mesmo código (estoque, dias sem venda…)
//   q  cópia de trechos da mesma coluna na tabela anterior (a lista de códigos se repete a cada auditoria)
//   o  objetos aninhados (guardados como estão, compactados por dentro)
// O resultado é quase só números pequenos e repetidos, que o gzip reduz muito.
//
// Compactação e expansão percorrem as tabelas e colunas na mesma ordem e aprendem as mesmas
// previsões, por isso nada além das exceções precisa ser gravado.

export const FORMATO_COMPACTO = 'colunar-2'

const TABELA = '§t'
const MIN_LINHAS_TABELA = 8
const CHAVES = ['Código', '_codigo', 'codigo']
const MAX_CATEGORIAS = 64 // colunas com até isso de valores distintos servem de chave de previsão

const ehObjetoSimples = v => v !== null && typeof v === 'object' && !Array.isArray(v)
const ehPrimitivo = v => v === null || typeof v !== 'object'
const chaveDe = v => (v === null ? 'z' : `${typeof v === 'string' ? 's' : typeof v === 'number' ? 'n' : 'b'}${v}`)

// Mesmas regras do JSON.stringify para valores soltos.
const normalizar = (v) => {
  if (v === undefined || typeof v === 'function' || typeof v === 'symbol') return undefined
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'bigint') throw new TypeError('BigInt não é suportado no backup')
  if (v && typeof v.toJSON === 'function') return normalizar(v.toJSON())
  return v
}

// "dd/mm/aaaa hh:mm:ss" ↔ segundos (UTC só como relógio; não há fuso envolvido).
const RE_DATA_HORA = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/
const p2 = n => String(n).padStart(2, '0')
const textoDe = (seg) => {
  const d = new Date(seg * 1000)
  return `${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}`
}
const segundosDe = (s) => {
  const m = RE_DATA_HORA.exec(s)
  if (!m) return null
  const t = Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +m[6])
  if (!Number.isFinite(t)) return null
  return textoDe(t / 1000) === s ? t / 1000 : null
}

// Texto numérico que volta igual de Number (para o modo n).
const numerico = v => typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))
// Inteiro "canônico" (número inteiro ou texto que é exatamente String(inteiro)) para o modo m.
const inteiroDe = (v) => {
  if (typeof v === 'number') return Number.isSafeInteger(v) ? v : null
  if (typeof v === 'string' && /^-?\d{1,15}$/.test(v) && String(Number(v)) === v) return Number(v)
  return null
}
const comoTipo = (modelo, n) => (typeof modelo === 'string' ? String(n) : n)

const deltas = lista => lista.map((v, i) => (i ? v - lista[i - 1] : v))
const somas = (lista) => {
  const r = new Array(lista.length)
  let acc = 0
  for (let i = 0; i < lista.length; i++) { acc += lista[i]; r[i] = acc }
  return r
}
const distintos = (t) => {
  const s = new Set()
  for (const x of t) { s.add(x); if (s.size > MAX_CATEGORIAS) break }
  return s.size
}

// q: trechos copiados da sequência anterior. ops: [tamanho, deslocamento] por trecho ou 0 por literal.
const codificarCopia = (t, anterior) => {
  const posicao = new Map()
  for (let j = anterior.length - 1; j >= 0; j--) posicao.set(anterior[j], j)
  const ops = []
  const literais = []
  let esperado = 0
  let i = 0
  while (i < t.length) {
    let inicio = anterior[esperado] === t[i] ? esperado : posicao.get(t[i])
    if (inicio === undefined) { ops.push(0); literais.push(t[i]); i++; continue }
    let tam = 0
    while (i + tam < t.length && inicio + tam < anterior.length && anterior[inicio + tam] === t[i + tam]) tam++
    ops.push(tam, inicio - esperado)
    esperado = inicio + tam
    i += tam
  }
  return [ops, literais]
}
const decodificarCopia = (ops, literais, anterior, n) => {
  const t = []
  let esperado = 0
  let l = 0
  for (let k = 0; k < ops.length;) {
    const tam = ops[k++]
    if (tam === 0) { t.push(literais[l++]); continue }
    const inicio = esperado + ops[k++]
    if (!Number.isInteger(inicio) || inicio < 0 || inicio + tam > anterior.length) throw new Error('Backup compacto corrompido (cópia).')
    for (let j = 0; j < tam; j++) t.push(anterior[inicio + j])
    esperado = inicio + tam
  }
  if (t.length !== n) throw new Error('Backup compacto corrompido (cópia incompleta).')
  return t
}

// ---------------------------------------------------------------- compactar
export const compactar = (valor) => {
  const dicionario = new Map() // chave do valor → token provisório (1..; 0 = ausente)
  const valores = [undefined]
  const usos = [0]
  const comTokens = [] // [array, soNegativos] para renumerar no fim
  const previsores = new Map() // "coluna|chave" → Map(token da chave → token)
  const anteriores = new Map() // coluna → tokens da última tabela com ela

  const token = (v) => {
    const k = chaveDe(v)
    let t = dicionario.get(k)
    if (t === undefined) {
      t = valores.length
      dicionario.set(k, t)
      valores.push(v)
      usos.push(0)
    }
    return t
  }
  const registrar = (arr, negativos = false) => {
    for (const t of arr) {
      if (!negativos) usos[t]++
      else if (t < 0) usos[-t - 1]++
    }
    comTokens.push([arr, negativos])
  }
  // Tamanho estimado: a própria lista + os valores novos que entrariam no dicionário.
  const custo = (opcao, arr, negativos = false) => {
    let total = JSON.stringify(opcao).length
    if (!arr) return total
    const novos = new Set()
    for (const x of arr) {
      const t = negativos ? (x < 0 ? -x - 1 : 0) : x
      if (t && !usos[t] && !novos.has(t)) { novos.add(t); total += JSON.stringify(valores[t]).length + 1 }
    }
    return total
  }
  const mapa = (nome, chave) => {
    const k = `${nome}|${chave}`
    let m = previsores.get(k)
    if (!m) { m = new Map(); previsores.set(k, m) }
    return m
  }

  const tabela = (linhas) => {
    const n = linhas.length
    const colunas = []
    const vistos = new Set()
    for (const l of linhas) for (const k of Object.keys(l)) if (!vistos.has(k)) { vistos.add(k); colunas.push(k) }

    // Valores normalizados; objetos aninhados são compactados aqui (linha a linha, coluna a coluna).
    const brutos = colunas.map(() => new Array(n))
    const temObjeto = colunas.map(() => false)
    for (let i = 0; i < n; i++) {
      const linha = linhas[i]
      for (let c = 0; c < colunas.length; c++) {
        const v = normalizar(linha[colunas[c]])
        if (v === undefined) continue
        if (ehPrimitivo(v)) brutos[c][i] = v
        else { brutos[c][i] = no(v); temObjeto[c] = true }
      }
    }

    const saida = []
    for (let c = 0; c < colunas.length; c++) {
      if (!temObjeto[c]) continue
      const presentes = []
      const vals = []
      for (let i = 0; i < n; i++) if (i in brutos[c]) { presentes.push(i); vals.push(brutos[c][i]) }
      saida.push(['o', colunas[c], deltas(presentes), vals])
    }

    const simples = colunas.map((_, c) => c).filter(c => !temObjeto[c])
    const tokens = []
    for (const c of simples) {
      const t = new Array(n)
      for (let i = 0; i < n; i++) t[i] = i in brutos[c] ? token(brutos[c][i]) : 0
      tokens[c] = t
    }
    const chave = simples.find(c => CHAVES.includes(colunas[c]))
    const ordem = chave === undefined ? simples : [chave, ...simples.filter(c => c !== chave)]
    const feitas = []
    const candidatas = [] // colunas que servem de chave de previsão

    for (const c of ordem) {
      const nome = colunas[c]
      const t = tokens[c]
      const b = brutos[c]
      const opcoes = [] // [custo, opcao, arrTokens, negativos]
      const propor = (opcao, arr, negativos = false) => opcoes.push([custo(opcao, arr, negativos), opcao, arr, negativos])

      if (t.every(x => x === t[0])) { const um = [t[0]]; propor(['k', nome, um], um) }
      else propor(['d', nome, t], t)

      let inteiros = true
      for (let i = 0; i < n && inteiros; i++) if (!(i in b) || !Number.isInteger(b[i])) inteiros = false
      if (inteiros) propor(['i', nome, deltas(Array.from({ length: n }, (_, i) => b[i]))])

      let base = Infinity
      const seg = new Array(n)
      let datas = 0
      for (let i = 0; i < n; i++) {
        if (typeof b[i] !== 'string') continue
        const s = segundosDe(b[i])
        if (s !== null) { seg[i] = s; datas++; if (s < base) base = s }
      }
      if (datas >= n / 4) {
        const vals = Array.from({ length: n }, (_, i) => (seg[i] !== undefined ? seg[i] - base : -t[i] - 1))
        propor(['h', nome, base, vals], vals, true)
        // Diferença para o horário da linha anterior com horário (leituras seguidas ficam próximas).
        const difs = []
        const outras = []
        const outrasTokens = []
        let ultimo = 0
        for (let i = 0; i < n; i++) {
          if (seg[i] !== undefined) { difs.push(seg[i] - ultimo); ultimo = seg[i] } else { outras.push(i); outrasTokens.push(t[i]) }
        }
        propor(['g', nome, difs, deltas(outras), outrasTokens], outrasTokens)
      }

      // Repetições seguidas (mesmo usuário lendo vários itens em sequência).
      {
        const toks = []
        const tams = []
        for (let i = 0; i < n; i++) {
          if (i && t[i] === t[i - 1]) tams[tams.length - 1]++
          else { toks.push(t[i]); tams.push(1) }
        }
        if (toks.length < n * 0.7) propor(['l', nome, toks, tams], toks)
      }

      const amostra = Math.min(n, 30)
      for (const r of feitas) {
        const tr = tokens[r]
        const br = brutos[r]
        let iguais = 0
        let numeros = 0
        for (let i = 0; i < amostra; i++) {
          if (tr[i] === t[i]) iguais++
          if (numerico(br[i]) && b[i] === Number(br[i])) numeros++
        }
        for (const [modo, acertos] of [['r', iguais], ['n', numeros]]) {
          if (acertos < amostra * 0.7) continue
          const exLinhas = []
          const exTokens = []
          for (let i = 0; i < n; i++) {
            const previsto = modo === 'r' ? tr[i] : (numerico(br[i]) ? token(Number(br[i])) : -1)
            if (previsto !== t[i]) { exLinhas.push(i); exTokens.push(t[i]) }
          }
          propor([modo, nome, colunas[r], deltas(exLinhas), exTokens], exTokens)
        }
      }

      const anterior = anteriores.get(nome)
      if (anterior) {
        const [ops, literais] = codificarCopia(t, anterior)
        propor(['q', nome, ops, literais], literais)
      }

      for (const k of candidatas) {
        const base = mapa(nome, colunas[k])
        const local = new Map()
        const tk = tokens[k]
        const exLinhas = []
        const exTokens = []
        const numDeltas = c !== k && k === chave ? new Array(n).fill(0) : null
        const numEx = []
        const numExTokens = []
        for (let i = 0; i < n; i++) {
          const previsto = local.has(tk[i]) ? local.get(tk[i]) : base.get(tk[i])
          if (previsto !== t[i]) { exLinhas.push(i); exTokens.push(t[i]) }
          if (numDeltas) {
            const pv = previsto ? valores[previsto] : undefined
            const a = inteiroDe(b[i])
            const p = inteiroDe(pv)
            if (a !== null && p !== null && typeof pv === typeof b[i]) numDeltas[i] = a - p
            else { numEx.push(i); numExTokens.push(t[i]) }
          }
          local.set(tk[i], t[i])
        }
        propor(['p', nome, colunas[k], deltas(exLinhas), exTokens], exTokens)
        if (numDeltas && numEx.length < n / 2) propor(['m', nome, colunas[k], numDeltas, deltas(numEx), numExTokens], numExTokens)
      }

      const [, melhor, arr, negativos] = opcoes.reduce((a, o) => (o[0] < a[0] ? o : a))
      if (arr) registrar(arr, negativos)
      saida.push(melhor)

      // Aprende as previsões e a sequência desta coluna (a expansão faz o mesmo, na mesma ordem).
      for (const k of candidatas) {
        const m = mapa(nome, colunas[k])
        const tk = tokens[k]
        for (let i = 0; i < n; i++) m.set(tk[i], t[i])
      }
      anteriores.set(nome, t)
      feitas.push(c)
      if (c === chave || distintos(t) <= MAX_CATEGORIAS) candidatas.push(c)
    }
    return { [TABELA]: [n, saida] }
  }

  const no = (v) => {
    v = normalizar(v)
    if (v === undefined || ehPrimitivo(v)) return v
    if (Array.isArray(v)) {
      const itens = v.map(x => { const y = normalizar(x); return y === undefined ? null : y })
      if (itens.length >= MIN_LINHAS_TABELA && itens.every(ehObjetoSimples)) return tabela(itens)
      return itens.map(no)
    }
    const r = {}
    for (const [k, x] of Object.entries(v)) {
      const y = no(x)
      if (y !== undefined) r[k] = y
    }
    return r
  }

  const corpo = no(valor)

  // Renumera pelo uso: os mais usados ficam com números menores; os nunca gravados saem.
  const ordem = valores.map((_, t) => t).slice(1).sort((a, b) => usos[b] - usos[a] || a - b)
  const novo = new Int32Array(valores.length)
  ordem.forEach((t, i) => { novo[t] = i + 1 })
  for (const [arr, negativos] of comTokens) {
    for (let i = 0; i < arr.length; i++) {
      const t = arr[i]
      if (!negativos) arr[i] = novo[t]
      else if (t < 0) arr[i] = -novo[-t - 1] - 1
    }
  }
  return { formato: FORMATO_COMPACTO, dic: ordem.filter(t => usos[t] > 0).map(t => valores[t]), corpo }
}

// ---------------------------------------------------------------- expandir
export const expandir = ({ formato, dic, corpo }) => {
  if (formato !== FORMATO_COMPACTO) throw new Error('Formato de backup compacto desconhecido.')
  if (!Array.isArray(dic)) throw new Error('Backup compacto sem dicionário.')

  // Identidade por valor, como na compactação: tokens do dicionário e ids extras para valores
  // que só aparecem como previsão (nunca gravados).
  const ids = new Map(dic.map((v, i) => [chaveDe(v), i + 1]))
  const extras = []
  const idDe = (v) => {
    if (v === undefined) return 0
    const k = chaveDe(v)
    let id = ids.get(k)
    if (id === undefined) { extras.push(v); id = dic.length + extras.length; ids.set(k, id) }
    return id
  }
  const valorDe = (t) => {
    if (t === 0) return undefined
    if (!Number.isInteger(t) || t < 0) throw new Error('Backup compacto corrompido (token inválido).')
    if (t <= dic.length) return dic[t - 1]
    if (t <= dic.length + extras.length) return extras[t - dic.length - 1]
    throw new Error('Backup compacto corrompido (token fora do dicionário).')
  }
  const previsores = new Map()
  const anteriores = new Map()
  const mapa = (nome, chave) => {
    const k = `${nome}|${chave}`
    let m = previsores.get(k)
    if (!m) { m = new Map(); previsores.set(k, m) }
    return m
  }

  const tabela = ([n, colunas]) => {
    if (!Number.isInteger(n) || n < 0 || !Array.isArray(colunas)) throw new Error('Backup compacto corrompido (tabela).')
    // Objetos aninhados primeiro, na mesma ordem da compactação (linha a linha, coluna a coluna).
    const objetos = new Map()
    for (const c of colunas) if (c[0] === 'o') objetos.set(c[1], { vals: c[3], posicao: new Map(somas(c[2]).map((l, j) => [l, j])) })
    for (let i = 0; i < n; i++) {
      for (const o of objetos.values()) {
        const j = o.posicao.get(i)
        if (j !== undefined) o.vals[j] = no(o.vals[j])
      }
    }

    const tokens = new Map()
    const candidatas = []
    const chave = colunas.find(c => c[0] !== 'o' && CHAVES.includes(c[1]))?.[1]
    for (const col of colunas) {
      const [modo, nome] = col
      if (modo === 'o') continue
      const ref = (modo === 'r' || modo === 'n' || modo === 'p' || modo === 'm') ? tokens.get(col[2]) : null
      if (ref === undefined) throw new Error('Backup compacto corrompido (coluna de referência).')
      let t
      if (modo === 'k') t = new Array(n).fill(col[2][0])
      else if (modo === 'd') t = col[2].slice()
      else if (modo === 'i') t = somas(col[2]).map(idDe)
      else if (modo === 'h') {
        t = col[3].map((x) => {
          if (!Number.isInteger(x)) throw new Error('Backup compacto corrompido (data-hora).')
          return x >= 0 ? idDe(textoDe(col[2] + x)) : -x - 1
        })
      } else if (modo === 'g') {
        t = new Array(n)
        const outras = somas(col[3])
        for (let e = 0; e < outras.length; e++) t[outras[e]] = col[4][e]
        let ultimo = 0
        let d = 0
        for (let i = 0; i < n; i++) {
          if (t[i] !== undefined) continue
          const x = col[2][d++]
          if (!Number.isInteger(x)) throw new Error('Backup compacto corrompido (data-hora).')
          ultimo += x
          t[i] = idDe(textoDe(ultimo))
        }
      } else if (modo === 'l') {
        t = []
        for (let k = 0; k < col[2].length; k++) {
          const tam = col[3][k]
          if (!Number.isInteger(tam) || tam < 1 || t.length + tam > n) throw new Error('Backup compacto corrompido (repetições).')
          for (let j = 0; j < tam; j++) t.push(col[2][k])
        }
      } else if (modo === 'q') {
        const anterior = anteriores.get(nome)
        if (!anterior) throw new Error('Backup compacto corrompido (cópia sem anterior).')
        t = decodificarCopia(col[2], col[3], anterior, n)
      } else if (modo === 'r' || modo === 'n') {
        t = new Array(n)
        for (let i = 0; i < n; i++) {
          if (modo === 'r') t[i] = ref[i]
          else { const s = valorDe(ref[i]); t[i] = numerico(s) ? idDe(Number(s)) : 0 }
        }
        const exLinhas = somas(col[3])
        for (let e = 0; e < exLinhas.length; e++) t[exLinhas[e]] = col[4][e]
      } else if (modo === 'p' || modo === 'm') {
        const m = mapa(nome, col[2])
        const exLinhas = somas(modo === 'p' ? col[3] : col[4])
        const exTokens = modo === 'p' ? col[4] : col[5]
        t = new Array(n)
        let e = 0
        for (let i = 0; i < n; i++) {
          if (e < exLinhas.length && exLinhas[e] === i) t[i] = exTokens[e++]
          else {
            const previsto = m.has(ref[i]) ? m.get(ref[i]) : 0
            if (modo === 'p') t[i] = previsto
            else { const pv = valorDe(previsto); t[i] = idDe(comoTipo(pv, inteiroDe(pv) + col[3][i])) }
          }
          m.set(ref[i], t[i])
        }
      } else {
        throw new Error(`Backup compacto corrompido (modo ${modo}).`)
      }
      if (t.length !== n) throw new Error('Backup compacto corrompido (coluna com tamanho errado).')

      // Aprende como na compactação (a coluna-chave usada no modo p/m já aprendeu acima).
      for (const k of candidatas) {
        if ((modo === 'p' || modo === 'm') && k === col[2]) continue
        const m = mapa(nome, k)
        const tk = tokens.get(k)
        for (let i = 0; i < n; i++) m.set(tk[i], t[i])
      }
      tokens.set(nome, t)
      anteriores.set(nome, t)
      if (nome === chave || distintos(t) <= MAX_CATEGORIAS) candidatas.push(nome)
    }

    const linhas = new Array(n)
    for (let i = 0; i < n; i++) {
      const linha = {}
      for (const col of colunas) {
        const nome = col[1]
        let v
        if (col[0] === 'o') {
          const o = objetos.get(nome)
          const j = o.posicao.get(i)
          v = j === undefined ? undefined : o.vals[j]
        } else {
          v = valorDe(tokens.get(nome)[i])
        }
        if (v !== undefined) linha[nome] = v
      }
      linhas[i] = linha
    }
    return linhas
  }

  const no = (v) => {
    if (ehPrimitivo(v)) return v
    if (Array.isArray(v)) return v.map(no)
    if (TABELA in v && Object.keys(v).length === 1) return tabela(v[TABELA])
    const r = {}
    for (const [k, x] of Object.entries(v)) r[k] = no(x)
    return r
  }
  return no(corpo)
}
