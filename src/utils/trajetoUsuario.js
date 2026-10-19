import { interpretarLocal, nomeArea } from './mapaLoja'
import { momentoLeitura } from './sinaisAuditoria'

// Trajeto de um usuário pela loja: leituras em ordem de horário agrupadas em paradas
// (leituras seguidas no mesmo local) e o caminho entre elas.

export const PAUSA_MINUTOS = 15 // intervalo sem leitura considerado pausa

const usuarioDoItem = item => (item?.['Usuário'] || '').toString().trim()
const localDoItem = item => (item?.['Local'] || '').toString().split(' - ')[0].trim().toUpperCase() || 'SEM LOCAL'

// Ponto do local dentro da área do mapa (unidades do grid). Nos corredores, C/D ficam no fundo
// e A/B na frente: o ponto fica no meio do corredor, na altura e do lado da face lida.
export const pontoNoMapa = (posicao, local) => {
  if (!posicao) return null
  const info = interpretarLocal(local)
  const cx = posicao.x + posicao.w / 2
  const cy = posicao.y + posicao.h / 2
  if (info.tipo !== 'gondola' || !info.face) return { x: cx, y: cy }
  // Como no mapa da loja: D/B de um lado do corredor, C/A do outro.
  const vertical = posicao.w < posicao.h
  const fundo = info.face === 'C' || info.face === 'D'
  const lado = info.face === 'C' || info.face === 'A' ? 1 : -1
  return vertical
    ? { x: cx + lado * posicao.w * 0.15, y: posicao.y + posicao.h * (fundo ? 0.25 : 0.75) }
    : { x: posicao.x + posicao.w * (fundo ? 0.25 : 0.75), y: cy + lado * posicao.h * 0.15 }
}

export const formatarDuracao = (ms) => {
  const minutos = Math.floor(ms / 60000)
  if (minutos < 1) return '< 1 min'
  if (minutos < 60) return `${minutos} min`
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

export const horaDe = instante => new Date(instante).toISOString().slice(11, 16)

// Leituras com horário do usuário, por dia (yyyy-mm-dd) em ordem cronológica.
export const leiturasDoUsuario = (dados, usuario, isItemLido = () => true) => {
  const porDia = new Map()
  let semHorario = 0
  for (const item of Array.isArray(dados) ? dados : []) {
    if (usuarioDoItem(item) !== usuario || !isItemLido(item)) continue
    const momento = momentoLeitura(item)
    if (!momento) { semHorario++; continue }
    const local = localDoItem(item)
    const info = interpretarLocal(local)
    const lista = porDia.get(momento.data) || []
    lista.push({ instante: momento.instante, local, bloco: info.bloco, tipo: info.tipo, codigo: item['Código'], produto: item['Produto'] })
    porDia.set(momento.data, lista)
  }
  for (const lista of porDia.values()) lista.sort((a, b) => a.instante - b.instante)
  return { porDia, semHorario }
}

// Agrupa leituras seguidas no mesmo local em paradas.
export const montarTrajeto = (leituras = []) => {
  const paradas = []
  for (const leitura of leituras) {
    const ultima = paradas.at(-1)
    const pausa = ultima ? leitura.instante - ultima.fim > PAUSA_MINUTOS * 60000 : false
    if (ultima && ultima.local === leitura.local && !pausa) {
      ultima.fim = leitura.instante
      ultima.leituras++
      continue
    }
    paradas.push({
      indice: paradas.length,
      local: leitura.local,
      bloco: leitura.bloco,
      tipo: leitura.tipo,
      area: nomeArea({ bloco: leitura.bloco, ...interpretarLocal(leitura.local) }),
      inicio: leitura.instante,
      fim: leitura.instante,
      leituras: 1,
      pausaAntes: ultima ? leitura.instante - ultima.fim : 0,
      aposPausa: pausa
    })
  }
  const inicio = leituras[0]?.instante ?? null
  const fim = leituras.at(-1)?.instante ?? null
  const pausas = paradas.filter(p => p.aposPausa)
  const tempoPausado = pausas.reduce((s, p) => s + p.pausaAntes, 0)
  const ativo = inicio === null ? 0 : fim - inicio - tempoPausado
  const trocasArea = paradas.slice(1).filter((p, i) => p.bloco !== paradas[i].bloco).length
  const porArea = new Map()
  for (const p of paradas) {
    const a = porArea.get(p.bloco) || { bloco: p.bloco, area: p.area, leituras: 0, tempo: 0, visitas: 0 }
    a.leituras += p.leituras
    a.tempo += p.fim - p.inicio
    a.visitas++
    porArea.set(p.bloco, a)
  }
  return {
    paradas,
    inicio,
    fim,
    leituras: leituras.length,
    pausas: pausas.length,
    tempoPausado,
    ativo,
    ritmo: ativo > 0 ? leituras.length / (ativo / 3600000) : 0,
    trocasArea,
    areas: [...porArea.values()].sort((a, b) => b.leituras - a.leituras)
  }
}
