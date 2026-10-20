import { PAUSA_MINUTOS } from './trajetoUsuario'
import { isItemLido } from './itemLido'
import { momentoLeitura } from './sinaisAuditoria'
import { codigoLocal, localDoItem, setorDoItem, usuarioDoItem } from './itemAuditoria'
import { ritmosDaAuditoria } from './planoAcao'

// Dados da ficha do colaborador e das duplas que rendem mais juntas.

const dataDe = a => String(a?.data || '').slice(0, 10)
const emOrdem = lista => [...(lista || [])].filter(Boolean).sort((a, b) => dataDe(a).localeCompare(dataDe(b)) || (a.id || 0) - (b.id || 0))
const media = v => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : null)

// Ritmo por setor: o tempo entre duas leituras seguidas (sem pausa) conta para o setor da segunda.
export const ritmoPorSetor = (auditorias, usuario) => {
  const setores = new Map()
  for (const auditoria of emOrdem(auditorias)) {
    const leituras = []
    for (const item of Array.isArray(auditoria?.dados) ? auditoria.dados : []) {
      if (usuarioDoItem(item) !== usuario || !isItemLido(item)) continue
      const setor = setorDoItem(item)
      const s = setores.get(setor) || { setor, leituras: 0, tempo: 0 }
      s.leituras++
      setores.set(setor, s)
      const m = momentoLeitura(item)
      if (m) leituras.push({ instante: m.instante, setor })
    }
    leituras.sort((a, b) => a.instante - b.instante)
    for (let i = 1; i < leituras.length; i++) {
      const gap = leituras[i].instante - leituras[i - 1].instante
      if (gap <= PAUSA_MINUTOS * 60000) setores.get(leituras[i].setor).tempo += gap
    }
  }
  const total = [...setores.values()].reduce((s, x) => s + x.leituras, 0)
  return [...setores.values()]
    .map(s => ({ ...s, participacao: total ? (s.leituras / total) * 100 : 0, ritmo: s.tempo >= 10 * 60000 ? s.leituras / (s.tempo / 3600000) : null }))
    .sort((a, b) => b.leituras - a.leituras)
}

// Leituras do colaborador por local em todo o histórico (para o mapa da ficha).
export const mapaLeiturasColaborador = (auditorias, usuario) => {
  const porLocal = {}
  for (const auditoria of auditorias || []) {
    for (const item of Array.isArray(auditoria?.dados) ? auditoria.dados : []) {
      if (usuarioDoItem(item) !== usuario || !isItemLido(item)) continue
      const local = codigoLocal(localDoItem(item))
      ;(porLocal[local] ??= { lidos: 0, pendentes: 0, comProblema: 0 }).lidos++
    }
  }
  const dados = Object.entries(porLocal).map(([local, d]) => ({ 'Usuário': usuario, Local: local, _peso: d.lidos }))
  return { analise: { porLocal }, dados }
}

// Leituras com problema do colaborador (estoque zero ou fora do local), das mais recentes.
export const problemasColaborador = (auditorias, usuario) => emOrdem(auditorias).reverse().flatMap(auditoria => [
  ...(auditoria?.analise?.itensComEstoqueZeroDetalhes || []).filter(x => x.usuario === usuario).map(x => ({ ...x, motivo: 'Estoque zero' })),
  ...(auditoria?.analise?.itensLidoNaoPertenceDetalhes || []).filter(x => x.usuario === usuario).map(x => ({ ...x, motivo: 'Fora do local' }))
].map(x => ({ data: dataDe(auditoria), tipo: auditoria.tipo, codigo: x.codigo, produto: x.produto, local: x.local, motivo: x.motivo })))

// Duplas: em cada auditoria, pessoas que leram o mesmo setor (20%+ das leituras de cada uma).
// Rendimento = quanto o ritmo das duas ficou acima/abaixo do ritmo médio de cada uma, nas auditorias juntas.
export const duplas = (auditorias, { minimo = 2 } = {}) => {
  const porAuditoria = []
  const ritmosPorUsuario = new Map()
  for (const auditoria of emOrdem(auditorias)) {
    const ritmos = new Map(ritmosDaAuditoria(auditoria).map(r => [r.usuario, r.ritmo]))
    if (ritmos.size < 2) continue
    const setores = new Map()
    for (const item of Array.isArray(auditoria?.dados) ? auditoria.dados : []) {
      const usuario = usuarioDoItem(item)
      if (!ritmos.has(usuario) || !isItemLido(item)) continue
      const m = setores.get(usuario) || new Map()
      const setor = setorDoItem(item)
      m.set(setor, (m.get(setor) || 0) + 1)
      setores.set(usuario, m)
    }
    const principais = new Map([...setores].map(([u, m]) => {
      const total = [...m.values()].reduce((s, n) => s + n, 0)
      return [u, new Set([...m].filter(([, n]) => n / total >= 0.2).map(([s]) => s))]
    }))
    for (const [u, r] of ritmos) ritmosPorUsuario.set(u, [...(ritmosPorUsuario.get(u) || []), r])
    porAuditoria.push({ auditoria, ritmos, principais })
  }
  const mediaUsuario = new Map([...ritmosPorUsuario].map(([u, lista]) => [u, media(lista)]))
  const pares = new Map()
  for (const { auditoria, ritmos, principais } of porAuditoria) {
    const usuarios = [...ritmos.keys()].sort()
    for (let i = 0; i < usuarios.length; i++) {
      for (let j = i + 1; j < usuarios.length; j++) {
        const [a, b] = [usuarios[i], usuarios[j]]
        const comuns = [...(principais.get(a) || [])].filter(s => principais.get(b)?.has(s))
        if (!comuns.length) continue
        const razao = ((ritmos.get(a) / mediaUsuario.get(a)) + (ritmos.get(b) / mediaUsuario.get(b))) / 2
        const chave = `${a}\u0000${b}`
        const p = pares.get(chave) || { a, b, juntas: 0, razoes: [], setores: new Map(), ultima: '' }
        p.juntas++
        p.razoes.push(razao)
        comuns.forEach(s => p.setores.set(s, (p.setores.get(s) || 0) + 1))
        p.ultima = dataDe(auditoria)
        pares.set(chave, p)
      }
    }
  }
  return [...pares.values()]
    .filter(p => p.juntas >= minimo)
    .map(p => ({
      a: p.a,
      b: p.b,
      juntas: p.juntas,
      ultima: p.ultima,
      rendimento: (media(p.razoes) - 1) * 100, // % acima (+) ou abaixo (−) do ritmo normal das duas
      setores: [...p.setores].sort((x, y) => y[1] - x[1]).map(([s]) => s)
    }))
    .sort((x, y) => y.rendimento - x.rendimento)
}
