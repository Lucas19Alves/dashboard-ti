// Mapa da loja a partir dos códigos de local da auditoria.
//
// Convenções (padrão das lojas, ajustável pelo usuário no mapa):
// - G05A: corredor 05, face A. O número é o corredor (o espaço por onde se anda); cada corredor tem
//   4 faces de gôndola: A de frente para B e C de frente para D (C/D no fundo, A/B na frente).
//   Corredores são numerados da direita para a esquerda; vizinhos dividem a mesma gôndola (costas).
// - PL01: paredão de líquida (primeira gôndola à direita).
// - F01..: freezers, à esquerda.  PF01: paredão de frios.  EMP01: empório de frios.
// - ACG: açougue.  FLV: frutas, legumes e verduras.
// - Locais fora do padrão ficam fora do mapa, exceto PA01 (à direita do paredão de frios), PAO (acima do FLV)
//   e GELO (abaixo dos corredores); no modo edição qualquer um pode ser adicionado ou removido.

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
    area.usuarios.set(usuario, (area.usuarios.get(usuario) || 0) + 1)
    if (info.face) {
      area.faces[info.face] ??= { ...vazio(), usuarios: new Map() }
      const face = area.faces[info.face].usuarios
      face.set(usuario, (face.get(usuario) || 0) + 1)
    }
  }
  return areas
}

// ---------- Layout ----------
const TAMANHOS = {
  gondola: { w: 4, h: 16 },
  liquida: { w: 2, h: 18 },
  freezer: { w: 3, h: 3 },
  paredaoFrios: { w: 6, h: 2 },
  emporio: { w: 6, h: 3 },
  acougue: { w: 6, h: 3 },
  flv: { w: 8, h: 4 }
}
const LINHAS_PADRAO = 27
const TAMANHO_OUTRO = { w: 4, h: 2 }
const especial = (regex) => a => a.tipo === 'outro' && regex.test(a.bloco)
const ehPA = especial(/^PA\d+$/)
const ehPao = especial(/^PAO\d*$/)
const ehGelo = especial(/^GELO\d*$/)

// Posições iniciais: freezers à esquerda, corredores numerados da direita para a esquerda,
// paredão de líquida na extrema direita, açougue/empório/paredão de frios no fundo (topo do mapa).
export const gerarLayoutPadrao = (areas) => {
  const lista = [...areas]
  const porTipo = tipo => lista.filter(a => a.tipo === tipo).sort((a, b) => a.numero - b.numero)
  const especiais = filtro => lista.filter(filtro).sort((a, b) => a.bloco.localeCompare(b.bloco, 'pt-BR', { numeric: true }))
  const pas = especiais(ehPA)
  const freezers = porTipo('freezer')
  const gondolas = porTipo('gondola')
  const liquidas = porTipo('liquida')
  const paredoes = porTipo('paredaoFrios')
  const colunasFreezer = Math.max(1, Math.ceil(freezers.length / 4))
  const larguraEsquerda = Math.max(9, colunasFreezer * 4 + 1)
  // Posição pelo número do corredor: corredores sem itens na auditoria deixam o espaço vazio.
  const maiorCorredor = Math.max(0, ...gondolas.map(g => g.numero))
  const colunas = Math.max(larguraEsquerda + maiorCorredor * 4 + 3, 14 + (paredoes.length + pas.length) * 7, 30)
  const posicoes = []
  const colocar = (area, x, y, tamanho = TAMANHOS[area.tipo]) => posicoes.push({ id: area.bloco, x, y, w: tamanho.w, h: tamanho.h })

  porTipo('acougue').forEach((a, i) => colocar(a, i * 7, 0))
  porTipo('emporio').forEach((a, i) => colocar(a, 7 + i * 7, 0))
  paredoes.forEach((a, i) => colocar(a, 14 + i * 7, 0))
  pas.forEach((a, i) => colocar(a, 14 + (paredoes.length + i) * 7, 0, TAMANHOS.paredaoFrios))
  freezers.forEach((a, i) => colocar(a, Math.floor(i / 4) * 4, 5 + (i % 4) * 4))
  porTipo('flv').forEach((a, i) => colocar(a, i * 9, LINHAS_PADRAO - 4))
  especiais(ehPao).forEach((a, i) => colocar(a, i * 9, LINHAS_PADRAO - 7, { w: 8, h: 2 }))
  const alturaLiquida = liquidas.length ? Math.max(3, Math.floor(18 / liquidas.length)) : 0
  liquidas.forEach((a, i) => colocar(a, colunas - 2, 5 + i * alturaLiquida, { w: 2, h: alturaLiquida - (liquidas.length > 1 ? 1 : 0) }))
  // Corredores encostados: a face esquerda de um e a direita do vizinho formam a mesma gôndola.
  gondolas.forEach(a => colocar(a, colunas - 7 - (a.numero - 1) * 4, 5))
  // Gelo abaixo dos corredores, a partir do primeiro (direita).
  especiais(ehGelo).forEach((a, i) => colocar(a, colunas - 9 - i * 7, 5 + TAMANHOS.gondola.h + 1, { w: 6, h: 2 }))
  return { colunas, linhas: LINHAS_PADRAO, posicoes }
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
