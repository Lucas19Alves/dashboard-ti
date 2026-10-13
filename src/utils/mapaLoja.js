// Mapa da loja a partir dos códigos de local da auditoria.
//
// Convenções (padrão das lojas, ajustável pelo usuário no mapa):
// - G05A: corredor 05, face A. O número é o corredor (o espaço por onde se anda); cada corredor tem
//   4 faces de gôndola: A de frente para B e C de frente para D (C/D no fundo, A/B na frente).
//   Corredores são numerados da direita para a esquerda; vizinhos dividem a mesma gôndola (costas).
// - PL01: paredão de líquida (primeira gôndola à direita).
// - F01..: freezers, à esquerda.  PF01: paredão de frios.  EMP01: empório de frios.
// - ACG: açougue.  FLV: frutas, legumes e verduras.
// - Outros locais com lugar na planta padrão: PA01 (acima dos corredores), CS01 (abaixo), PAO, IF01/IF02,
//   I01/I02, SORV e GELO. Os demais ficam fora do mapa; no modo edição podem ser adicionados ou removidos.

export const TIPOS_AREA = {
  gondola: { nome: 'Corredor', icone: 'fas fa-road' },
  liquida: { nome: 'Paredão de líquida', icone: 'fas fa-wine-bottle' },
  freezer: { nome: 'Freezer', icone: 'fas fa-snowflake' },
  paredaoFrios: { nome: 'Paredão de frios', icone: 'fas fa-temperature-low' },
  emporio: { nome: 'Empório de frios', icone: 'fas fa-cheese' },
  acougue: { nome: 'Açougue', icone: 'fas fa-drumstick-bite' },
  flv: { nome: 'FLV', icone: 'fas fa-carrot' },
  outro: { nome: 'Outro local', icone: 'fas fa-location-dot' }
}

const PREFIXOS = { PL: 'liquida', PF: 'paredaoFrios', EMP: 'emporio', ACG: 'acougue', FLV: 'flv', F: 'freezer' }
const dois = n => String(n).padStart(2, '0')

// "G05A - G05A" → corredor 05, face A: { tipo: 'gondola', bloco: 'G05', face: 'A', numero: 5 }
export const interpretarLocal = (valor) => {
  const base = String(valor ?? '').split(' - ')[0].trim().toUpperCase().replace(/\s+/g, '')
  let m = base.match(/^G(\d{1,3})([A-Z])$/)
  if (m) return { tipo: 'gondola', bloco: `G${dois(m[1])}`, face: m[2], numero: Number(m[1]) }
  m = base.match(/^(PL|PF|EMP|ACG|FLV|F)(\d{0,3})$/)
  if (m) {
    const numero = m[2] ? Number(m[2]) : 1
    return { tipo: PREFIXOS[m[1]], bloco: m[2] ? `${m[1]}${dois(m[2])}` : m[1], numero }
  }
  return { tipo: 'outro', bloco: base || 'SEM LOCAL', numero: 0 }
}

export const nomeArea = (area) => {
  if (!area) return ''
  if (area.tipo === 'gondola') return `Corredor ${dois(area.numero)}`
  if (area.tipo === 'acougue') return 'Açougue'
  if (area.tipo === 'flv') return 'FLV'
  return area.bloco
}

const vazio = () => ({ lidos: 0, pendentes: 0, comProblema: 0, total: 0 })
const somar = (destino, d) => {
  destino.lidos += d.lidos || 0
  destino.pendentes += d.pendentes || 0
  destino.comProblema += d.comProblema || 0
  destino.total += (d.lidos || 0) + (d.pendentes || 0) + (d.comProblema || 0)
}
export const percentualPendente = d => (d?.total ? (d.pendentes / d.total) * 100 : 0)

// Agrupa contagens (analise.porLocal) e usuários (dados) por área do mapa.
export const agregarPorArea = (auditoria, isItemLido = () => false) => {
  const areas = new Map()
  const obter = (info) => {
    if (!areas.has(info.bloco)) {
      areas.set(info.bloco, { bloco: info.bloco, tipo: info.tipo, numero: info.numero, ...vazio(), faces: {}, usuarios: new Map(), locais: new Set() })
    }
    return areas.get(info.bloco)
  }
  for (const [local, d] of Object.entries(auditoria?.analise?.porLocal || {})) {
    const info = interpretarLocal(local)
    const area = obter(info)
    somar(area, d || {})
    area.locais.add(local)
    if (info.face) {
      area.faces[info.face] ??= { ...vazio(), usuarios: new Map() }
      somar(area.faces[info.face], d || {})
    }
  }
  for (const item of Array.isArray(auditoria?.dados) ? auditoria.dados : []) {
    const usuario = (item?.['Usuário'] || '').toString().trim()
    if (!usuario || !isItemLido(item)) continue
    const info = interpretarLocal(item?.['Local'])
    const area = obter(info)
    const n = item._peso || 1 // itens consolidados de várias auditorias trazem a contagem
    area.usuarios.set(usuario, (area.usuarios.get(usuario) || 0) + n)
    if (info.face) {
      area.faces[info.face] ??= { ...vazio(), usuarios: new Map() }
      const face = area.faces[info.face].usuarios
      face.set(usuario, (face.get(usuario) || 0) + n)
    }
  }
  return areas
}

// Junta várias auditorias em uma só para o mapa do período: soma as contagens por local e
// resume as leituras em uma linha por usuário+local (com `_peso`), sem copiar os itens.
export const consolidarParaMapa = (auditorias = [], isItemLido = () => false) => {
  const porLocal = {}
  const leituras = new Map()
  for (const auditoria of auditorias) {
    for (const [local, d] of Object.entries(auditoria?.analise?.porLocal || {})) {
      const destino = (porLocal[local] ??= { lidos: 0, pendentes: 0, comProblema: 0 })
      destino.lidos += d?.lidos || 0
      destino.pendentes += d?.pendentes || 0
      destino.comProblema += d?.comProblema || 0
    }
    for (const item of Array.isArray(auditoria?.dados) ? auditoria.dados : []) {
      const usuario = (item?.['Usuário'] || '').toString().trim()
      if (!usuario || !isItemLido(item)) continue
      const local = (item?.['Local'] || '').toString().trim()
      const chave = `${usuario}\u0000${local}`
      leituras.set(chave, (leituras.get(chave) || 0) + 1)
    }
  }
  const dados = [...leituras].map(([chave, n]) => {
    const [usuario, local] = chave.split('\u0000')
    return { 'Usuário': usuario, Local: local, _peso: n }
  })
  return { analise: { porLocal }, dados }
}

// ---------- Layout ----------
const TAMANHOS = {
  gondola: { w: 4, h: 16 },
  liquida: { w: 2, h: 20 },
  freezer: { w: 2, h: 7 },
  paredaoFrios: { w: 3, h: 6 },
  emporio: { w: 3, h: 7 },
  acougue: { w: 5, h: 3 },
  flv: { w: 7, h: 8 },
  outro: { w: 3, h: 2 }
}
const TAMANHO_OUTRO = { w: 4, h: 2 }
const LARGURA_ESQUERDA = 20 // colunas do bloco à esquerda dos corredores
const TOPO_CORREDORES = 5

// Planta padrão do bloco esquerdo (colunas 0–19), pelo código do local: [regex, x, y, w, h].
const PLANTA_ESQUERDA = [
  [/^PF0?1$/, 1, 1, 5, 2],
  [/^PF0?2$/, 1, 3, 3, 6],
  [/^PF0?3$/, 1, 9, 3, 6],
  [/^PF0?4$/, 1, 15, 3, 6],
  [/^ACG(0?1)?$/, 6, 0, 5, 3],
  [/^IF0?1$/, 11, 1, 4, 2],
  [/^I0?2$/, 15, 1, 3, 2],
  [/^F0?3$/, 5, 5, 2, 7],
  [/^F0?2$/, 8, 5, 2, 7],
  [/^F0?1$/, 11, 5, 2, 7],
  [/^EMP(0?1)?$/, 15, 5, 3, 7],
  [/^FLV(0?1)?$/, 5, 13, 7, 8],
  [/^PAO\d*$/, 13, 13, 2, 8],
  [/^IF0?2$/, 16, 13, 3, 2],
  [/^I0?1$/, 16, 15, 3, 3],
  [/^SORV/, 16, 18, 3, 3],
  [/^GELO\d*$/, 16, 22, 3, 2]
]

// Posições iniciais (planta padrão da loja):
// - bloco esquerdo fixo: paredões de frios, açougue, freezers, empório, FLV, pão, ilhas e gelo;
// - corredores numerados da direita para a esquerda, encostados, com PA01 acima e CS01 abaixo;
// - paredão de líquida na extrema direita.
// Áreas conhecidas fora da planta (ex.: F04, PF05) vão para o primeiro espaço livre;
// locais fora do padrão sem posição na planta ficam fora do mapa.
export const gerarLayoutPadrao = (areas) => {
  const lista = [...areas]
  const gondolas = lista.filter(a => a.tipo === 'gondola')
  const liquidas = lista.filter(a => a.tipo === 'liquida').sort((a, b) => a.numero - b.numero)
  const maiorCorredor = Math.max(0, ...gondolas.map(g => g.numero))
  const fimCorredores = LARGURA_ESQUERDA + maiorCorredor * 4
  const xLiquida = fimCorredores + 2
  const colunas = xLiquida + 2
  const posicoes = []
  const usados = new Set()
  const colocar = (area, x, y, w, h) => {
    posicoes.push({ id: area.bloco, x, y, w, h })
    usados.add(area.bloco)
  }

  for (const area of lista) {
    const planta = PLANTA_ESQUERDA.find(([regex]) => regex.test(area.bloco))
    if (planta) colocar(area, ...planta.slice(1))
  }
  // Corredores encostados: a face esquerda de um e a direita do vizinho formam a mesma gôndola.
  gondolas.forEach(a => colocar(a, LARGURA_ESQUERDA + (maiorCorredor - a.numero) * 4, TOPO_CORREDORES, 4, 16))
  const alturaLiquida = liquidas.length ? Math.max(3, Math.floor(20 / liquidas.length)) : 0
  liquidas.forEach((a, i) => colocar(a, xLiquida, 1 + i * alturaLiquida, 2, alturaLiquida - (liquidas.length > 1 ? 1 : 0)))
  const largura = Math.max(4, fimCorredores - LARGURA_ESQUERDA)
  lista.filter(a => /^PA0?1$/.test(a.bloco)).forEach(a => colocar(a, LARGURA_ESQUERDA, 1, xLiquida - LARGURA_ESQUERDA, 2))
  lista.filter(a => /^CS0?1$/.test(a.bloco)).forEach(a => colocar(a, LARGURA_ESQUERDA, TOPO_CORREDORES + 17, largura, 2))

  const layout = { colunas, linhas: TOPO_CORREDORES + 20, posicoes }
  for (const area of lista) {
    if (usados.has(area.bloco) || area.tipo === 'outro') continue
    colocar(area, ...Object.values(encontrarEspacoLivre(layout, TAMANHOS[area.tipo] || TAMANHO_OUTRO)))
  }
  layout.linhas = Math.max(layout.linhas, ...posicoes.map(p => p.y + p.h + 1))
  return layout
}

// Junta o layout salvo pelo usuário com as áreas encontradas na auditoria.
// Áreas sem posição salva seguem o padrão, deslocadas junto com o mapa (bordas aumentadas à esquerda/topo).
// O tamanho salvo vale enquanto couber todo o conteúdo.
export const mesclarLayout = (padrao, salvo) => {
  const salvas = new Map((salvo?.posicoes || []).map(p => [p.id, p]))
  const dx = salvo?.deslocamento?.x || 0
  const dy = salvo?.deslocamento?.y || 0
  const posicoes = padrao.posicoes.map(p => salvas.get(p.id) ? { ...p, ...salvas.get(p.id) } : { ...p, x: p.x + dx, y: p.y + dy })
  for (const p of salvo?.posicoes || []) if (!posicoes.some(x => x.id === p.id)) posicoes.push({ ...p })
  const visiveis = posicoes.filter(p => !p.oculto)
  const colunas = Math.max(1, salvo?.colunas || padrao.colunas + dx, ...visiveis.map(p => p.x + p.w))
  const linhas = Math.max(1, salvo?.linhas || padrao.linhas + dy, ...visiveis.map(p => p.y + p.h))
  return { colunas, linhas, posicoes }
}

// Aumenta (passo > 0) ou diminui (passo < 0) o mapa em uma borda. Na esquerda/topo as áreas se deslocam.
// Diminuir nunca corta áreas: o passo é limitado ao espaço vazio daquela borda.
export const redimensionarLayout = (layout, lado, passo) => {
  const horizontal = lado === 'esquerda' || lado === 'direita'
  const inicio = lado === 'esquerda' || lado === 'topo'
  const eixo = horizontal ? 'x' : 'y'
  const medida = horizontal ? 'w' : 'h'
  const total = horizontal ? 'colunas' : 'linhas'
  const visiveis = layout.posicoes.filter(p => !p.oculto)
  const folga = inicio
    ? Math.min(layout[total], ...visiveis.map(p => p[eixo]))
    : layout[total] - Math.max(0, ...visiveis.map(p => p[eixo] + p[medida]))
  const delta = passo < 0 ? -Math.min(-passo, Math.max(0, folga), layout[total] - 1) : passo
  if (!delta) return null
  const desloca = inicio ? delta : 0
  return {
    ...layout,
    [total]: layout[total] + delta,
    deslocamento: { x: (layout.deslocamento?.x || 0) + (horizontal ? desloca : 0), y: (layout.deslocamento?.y || 0) + (horizontal ? 0 : desloca) },
    posicoes: layout.posicoes.map(p => (desloca ? { ...p, [eixo]: Math.max(0, p[eixo] + desloca) } : p))
  }
}

// Primeiro espaço livre (de cima para baixo, da esquerda para a direita) para uma área w×h.
export const encontrarEspacoLivre = (layout, { w, h } = TAMANHO_OUTRO) => {
  const ocupadas = (layout?.posicoes || []).filter(p => !p.oculto)
  const livre = (x, y) => ocupadas.every(p => x + w <= p.x || p.x + p.w <= x || y + h <= p.y || p.y + p.h <= y)
  const colunas = Math.max(w, layout?.colunas || 0)
  for (let y = 0; y + h <= (layout?.linhas || 0); y++) {
    for (let x = 0; x + w <= colunas; x++) if (livre(x, y)) return { x, y, w, h }
  }
  return { x: 0, y: Math.max(layout?.linhas || 0, ...ocupadas.map(p => p.y + p.h)), w, h }
}

// Layout válido: lista de áreas com id e posição/tamanho numéricos.
export const layoutValido = (layout) => Boolean(layout && typeof layout === 'object' && Array.isArray(layout.posicoes) &&
  layout.posicoes.every(p => p && typeof p.id === 'string' && ['x', 'y', 'w', 'h'].every(k => Number.isFinite(p[k]))))

const CHAVE = 'dashboard_ti_mapa_loja_v1'
export const carregarLayoutSalvo = () => {
  try {
    const dados = JSON.parse(localStorage.getItem(CHAVE) || 'null')
    return layoutValido(dados) ? dados : null
  } catch {
    return null
  }
}
export const salvarLayout = (layout) => {
  try { localStorage.setItem(CHAVE, JSON.stringify(layout)) } catch {}
}
export const limparLayoutSalvo = () => {
  try { localStorage.removeItem(CHAVE) } catch {}
}
