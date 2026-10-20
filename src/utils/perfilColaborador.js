import { interpretarLocal, nomeArea } from './mapaLoja'
import { localDoItem, setorDoItem, usuarioDoItem } from './itemAuditoria'
import { isItemLido } from './itemLido'
import { momentoLeitura } from './sinaisAuditoria'
import { PAUSA_MINUTOS } from './trajetoUsuario'
import { rotuloUsuario } from './usuario'

// Perfil de cada colaborador a partir do histórico de leituras: onde lê (área, setor e família de
// área), em que ritmo em cada família, em que horário costuma estar na loja e quanto acerta o local.
// É a base da escala sugerida e do responsável sugerido no plano de ação.

const HORA = 3600000
const DIA = 24 * HORA
const contar = (mapa, chave, n = 1) => mapa.set(chave, (mapa.get(chave) || 0) + n)
const mediana = (valores) => {
  const v = valores.filter(Number.isFinite).sort((a, b) => a - b)
  if (!v.length) return null
  const meio = Math.floor(v.length / 2)
  return v.length % 2 ? v[meio] : (v[meio - 1] + v[meio]) / 2
}

// Famílias de área: quem lê uma família não necessariamente sabe ler outra (FLV ≠ líquida).
export const FAMILIAS = {
  gondola: 'Corredores',
  liquida: 'Líquida',
  freezer: 'Frios e congelados',
  paredaoFrios: 'Frios e congelados',
  emporio: 'Frios e congelados',
  acougue: 'Açougue',
  flv: 'FLV',
  outro: 'Outros locais'
}
export const familiaDoTipo = tipo => FAMILIAS[tipo] || FAMILIAS.outro

// Unidade da escala: cada face de corredor é um local (G05A, G05B...); as demais áreas são um local só.
export const unidadeDoLocal = info => (info.tipo === 'gondola' && info.face ? `${info.bloco}${info.face}` : info.bloco)
export const nomeUnidade = u => (u.tipo === 'gondola' && u.face ? `${u.bloco}${u.face}` : nomeArea(u))

// Limiares de perfil (parcela das leituras do histórico).
const MINIMO_FAMILIA = 0.08 // abaixo disso a família não é "do perfil"
const MINIMO_SETOR = 0.08
const MINIMO_LEITURAS_RITMO = 30 // leituras com horário para confiar no ritmo de uma família

export const perfisColaboradores = (auditorias) => {
  const perfis = new Map()
  const obter = usuario => {
    if (!perfis.has(usuario)) {
      perfis.set(usuario, {
        usuario, total: 0, auditorias: 0, porArea: new Map(), porUnidade: new Map(), porSetor: new Map(), porFamilia: new Map(),
        tempoFamilia: new Map(), leiturasTempoFamilia: new Map(), tempoAtivo: 0, leiturasComTempo: 0,
        inicios: [], fins: [], foraDoLocal: 0
      })
    }
    return perfis.get(usuario)
  }

  for (const auditoria of auditorias || []) {
    const porUsuario = new Map()
    for (const item of Array.isArray(auditoria?.dados) ? auditoria.dados : []) {
      const usuario = usuarioDoItem(item)
      if (!usuario || !isItemLido(item)) continue
      const info = interpretarLocal(localDoItem(item))
      const familia = familiaDoTipo(info.tipo)
      const p = obter(usuario)
      p.total++
      contar(p.porArea, info.bloco)
      contar(p.porUnidade, unidadeDoLocal(info))
      contar(p.porSetor, setorDoItem(item))
      contar(p.porFamilia, familia)
      const m = momentoLeitura(item)
      const lista = porUsuario.get(usuario) || []
      if (m) lista.push({ t: m.instante, familia })
      porUsuario.set(usuario, lista)
    }
    for (const [usuario, lista] of porUsuario) {
      const p = obter(usuario)
      p.auditorias++
      if (lista.length < 2) continue
      lista.sort((a, b) => a.t - b.t)
      // Janela do dia (minutos desde 0h) e tempo ativo por família, sem contar pausas.
      p.inicios.push((lista[0].t % DIA) / 60000)
      p.fins.push((lista.at(-1).t % DIA) / 60000)
      for (let i = 1; i < lista.length; i++) {
        const gap = lista[i].t - lista[i - 1].t
        if (gap > PAUSA_MINUTOS * 60000) continue
        p.tempoAtivo += gap
        p.leiturasComTempo++
        contar(p.tempoFamilia, lista[i].familia, gap)
        contar(p.leiturasTempoFamilia, lista[i].familia)
      }
    }
    for (const d of auditoria?.analise?.itensLidoNaoPertenceDetalhes || []) {
      const usuario = String(d?.usuario || '').trim()
      if (perfis.has(usuario)) perfis.get(usuario).foraDoLocal++
    }
  }

  for (const p of perfis.values()) {
    p.ritmo = p.tempoAtivo >= 10 * 60000 ? p.leiturasComTempo / (p.tempoAtivo / HORA) : null
    p.ritmoFamilia = new Map([...p.tempoFamilia].map(([f, ms]) => {
      const n = p.leiturasTempoFamilia.get(f) || 0
      return [f, n >= MINIMO_LEITURAS_RITMO && ms > 0 ? n / (ms / HORA) : null]
    }).filter(([, r]) => r))
    // Acerto: leituras feitas no local certo.
    p.acerto = p.total ? Math.max(0, 1 - p.foraDoLocal / p.total) : 1
    p.janela = p.inicios.length >= 2 ? { inicio: mediana(p.inicios), fim: mediana(p.fins) } : null
    const familias = [...p.porFamilia].sort((a, b) => b[1] - a[1])
    p.familias = familias.filter(([, n]) => n / p.total >= MINIMO_FAMILIA).map(([f]) => f)
    p.especialidade = familias[0] ? { familia: familias[0][0], parcela: familias[0][1] / p.total } : null
    p.maiorArea = Math.max(1, ...p.porArea.values())
    p.maiorUnidade = Math.max(1, ...p.porUnidade.values())
    p.maiorSetor = Math.max(1, ...p.porSetor.values())
    p.setoresHabituais = [...p.porSetor].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s]) => s)
  }
  return perfis
}

// A área é do perfil da pessoa? (já leu aquela área, a família dela ou o setor dela)
export const doPerfil = (perfil, area, setor) => {
  if (!perfil?.total) return false
  const familia = familiaDoTipo(area.tipo)
  return (perfil.porArea.get(area.bloco) || 0) >= 10
    || (perfil.porFamilia.get(familia) || 0) / perfil.total >= MINIMO_FAMILIA
    || (setor && (perfil.porSetor.get(setor) || 0) / perfil.total >= MINIMO_SETOR && familia !== FAMILIAS.flv && familia !== FAMILIAS.acougue)
}

// Afinidade 0–1: o próprio local e a área (corredor) pesam mais, depois o setor e a família.
export const afinidadePerfil = (perfil, area, setor) => {
  if (!perfil?.total) return 0
  const familia = familiaDoTipo(area.tipo)
  const naArea = (perfil.porArea.get(area.bloco) || 0) / perfil.maiorArea
  const noLocal = area.id ? (perfil.porUnidade.get(area.id) || 0) / perfil.maiorUnidade : naArea
  const noSetor = setor ? (perfil.porSetor.get(setor) || 0) / perfil.maiorSetor : 0
  const naFamilia = (perfil.porFamilia.get(familia) || 0) / perfil.total
  return 0.25 * noLocal + 0.15 * naArea + 0.35 * noSetor + 0.25 * naFamilia
}

// Ritmo da pessoa naquela família (ou o geral, ou o padrão).
export const ritmoNaArea = (perfil, area, ritmoPadrao) =>
  perfil?.ritmoFamilia?.get(familiaDoTipo(area.tipo)) || perfil?.ritmo || ritmoPadrao

const minutos = hhmm => { const [h, m] = String(hhmm || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0) }

// Horas em que a pessoa costuma estar na loja dentro do horário da auditoria: começa no horário
// em que ela costuma começar a ler (30 min de folga) e vai até o fim da jornada (8 h) ou o
// horário em que costuma parar, o que for mais tarde — sem passar do fim da auditoria.
const JORNADA_MIN = 8 * 60
export const disponibilidade = (perfil, inicio, fim) => {
  const ini = minutos(inicio)
  const fi = minutos(fim)
  if (!perfil?.janela) return { inicio: ini, fim: fi, horas: Math.max(0.5, (fi - ini) / 60), estimada: false }
  const a = Math.min(fi, Math.max(ini, perfil.janela.inicio - 30))
  const b = Math.min(fi, Math.max(perfil.janela.fim + 30, a + JORNADA_MIN))
  return { inicio: a, fim: b, horas: Math.max(0, (b - a) / 60), estimada: true }
}

export const textoHora = min => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(Math.round(min % 60)).padStart(2, '0')}`

// ---------- Escala ----------
// Distribui as áreas entre as pessoas escolhidas:
// 1. só dentro do perfil de cada uma (área, família ou setor que ela já lê);
// 2. pelo maior encaixe: afinidade × eficiência naquela família × acerto;
// 3. sem passar da capacidade (ritmo na família × horas em que costuma estar na loja);
// 4. sem espalhar a pessoa por muitas áreas (limite por pessoa e preferência por áreas vizinhas);
// 5. depois um rebalanceamento tira carga de quem passou do horário.
// fixas: Map área → usuário escolhido à mão (entra primeiro e não se move).
export const montarEscala = ({ areas = [], pessoas = [], perfis = new Map(), setores = new Map(), inicio = '08:00', fim = '20:00', ritmoPadrao = 120, fixas = new Map(), todosPerfis = null }) => {
  // Cada item de `areas` é um local da escala: { id, bloco, tipo, numero, face?, itens } (id = bloco quando não informado).
  const lista = areas.filter(a => a.itens > 0).map(a => ({ ...a, id: a.id || a.bloco, setor: setores.get(a.id || a.bloco) || setores.get(a.bloco) || '', familia: familiaDoTipo(a.tipo) }))
  const totalItens = lista.reduce((s, a) => s + a.itens, 0)
  const horasTurno = Math.max(0.5, (minutos(fim) - minutos(inicio)) / 60)
  const pessoasNecessarias = Math.max(1, Math.ceil(totalItens / Math.max(1, ritmoPadrao * horasTurno)))
  const vazio = { totalItens, pessoasNecessarias, grupos: [], horasNecessarias: 0, termino: null, cabeNoHorario: false, aderencia: 0, avisos: [] }
  if (!pessoas.length || !lista.length) return vazio

  // Eficiência relativa: ritmo da pessoa na família ÷ mediana do grupo na mesma família.
  const medianaFamilia = new Map()
  for (const f of new Set(lista.map(a => a.familia))) {
    medianaFamilia.set(f, mediana(pessoas.map(p => perfis.get(p.usuario)?.ritmoFamilia?.get(f) || perfis.get(p.usuario)?.ritmo).filter(Boolean)) || ritmoPadrao)
  }

  const grupos = pessoas.map((p, i) => {
    const perfil = perfis.get(p.usuario) || null
    const disp = disponibilidade(perfil, inicio, fim)
    return { pessoa: i + 1, usuario: p.usuario, perfil, disp, areas: [], itens: 0, horas: 0, itensPerfil: 0 }
  })
  // Limite de áreas (corredor inteiro ou área) por pessoa, para ninguém ficar espalhado pela loja.
  const limiteAreas = Math.ceil(new Set(lista.map(a => a.bloco)).size / grupos.length) + 1
  const blocosDe = g => new Set(g.areas.map(a => a.bloco))
  // Parcela justa: carga média esperada se o trabalho fosse dividido pela capacidade de cada um.
  const horasTotais = lista.reduce((t, a) => t + a.itens / (medianaFamilia.get(a.familia) || ritmoPadrao), 0)
  const parcelaJusta = horasTotais / Math.max(0.5, grupos.reduce((t, g) => t + g.disp.horas, 0))
  const acimaDaParcela = depois => 2 * Math.max(0, depois - parcelaJusta * 1.1)
  const horasDe = (g, area) => area.itens / ritmoNaArea(g.perfil, area, ritmoPadrao)
  const carga = (g, extra = 0) => (g.horas + extra) / Math.max(0.25, g.disp.horas)
  const encaixe = (g, area) => {
    const perfilOk = doPerfil(g.perfil, area, area.setor)
    const ritmo = ritmoNaArea(g.perfil, area, ritmoPadrao)
    const eficiencia = Math.min(1.5, Math.max(0.6, ritmo / (medianaFamilia.get(area.familia) || ritmoPadrao)))
    const acerto = g.perfil ? 0.85 + 0.15 * g.perfil.acerto : 0.9
    return { perfilOk, nota: afinidadePerfil(g.perfil, area, area.setor) * (0.75 + 0.25 * eficiencia) * acerto }
  }
  // Mesmo corredor (outra face) conta mais que corredor vizinho: a pessoa anda menos.
  const proximidade = (g, area) => (g.areas.some(a => a.bloco === area.bloco) ? 0.25 : g.areas.some(a => a.familia === area.familia && (a.tipo !== 'gondola' || Math.abs((a.numero || 0) - (area.numero || 0)) <= 1)) ? 0.12 : 0)
  const atribuir = (g, area, extra = {}) => {
    const { perfilOk, nota } = encaixe(g, area)
    const horas = horasDe(g, area)
    g.areas.push({ ...area, horas, nota, habitual: perfilOk, foraDoPerfil: !perfilOk, ...extra })
    g.itens += area.itens
    g.horas += horas
    if (perfilOk) g.itensPerfil += area.itens
  }
  const tirar = (g, area) => {
    g.areas = g.areas.filter(a => a.id !== area.id)
    g.itens -= area.itens
    g.horas -= area.horas
    if (area.habitual) g.itensPerfil -= area.itens
  }
  const custo = (g, area) => {
    const { perfilOk, nota } = encaixe(g, area)
    const depois = carga(g, horasDe(g, area))
    const blocos = blocosDe(g)
    const excessoAreas = Math.max(0, blocos.size + (blocos.has(area.bloco) ? 0 : 1) - limiteAreas)
    return (perfilOk ? 0 : 10) - nota + 0.6 * depois + 2.5 * Math.max(0, depois - 1) + acimaDaParcela(depois) + 0.3 * excessoAreas - proximidade(g, area)
  }

  // 1. Ajustes manuais.
  const livres = []
  for (const area of lista) {
    const g = grupos.find(x => x.usuario === fixas.get(area.id))
    if (g) atribuir(g, area, { fixa: true })
    else livres.push(area)
  }
  // 2. Mais restritas primeiro (menos gente com perfil), depois as maiores.
  const elegiveis = area => grupos.filter(g => encaixe(g, area).perfilOk).length
  const itensBloco = new Map()
  for (const a of livres) itensBloco.set(a.bloco, (itensBloco.get(a.bloco) || 0) + a.itens)
  livres.sort((a, b) => elegiveis(a) - elegiveis(b) || itensBloco.get(b.bloco) - itensBloco.get(a.bloco) || String(a.id).localeCompare(String(b.id)))
  // Primeiro tenta dar a área inteira (todas as faces do corredor) a uma pessoa; só divide
  // face a face quando ninguém com perfil comporta a área inteira.
  const porBloco = new Map()
  for (const area of livres) porBloco.set(area.bloco, [...(porBloco.get(area.bloco) || []), area])
  const custoBloco = (g, unidades) => {
    const { perfilOk, nota } = encaixe(g, unidades[0])
    const horas = unidades.reduce((t, a) => t + horasDe(g, a), 0)
    const depois = carga(g, horas)
    const excessoAreas = Math.max(0, blocosDe(g).size + 1 - limiteAreas)
    return { valor: (perfilOk ? 0 : 10) - nota + 0.6 * depois + 2.5 * Math.max(0, depois - 1) + acimaDaParcela(depois) + 0.3 * excessoAreas - proximidade(g, unidades[0]), cabe: perfilOk && depois <= 1 }
  }
  for (const unidades of porBloco.values()) {
    const opcoes = grupos.map(g => ({ g, ...custoBloco(g, unidades) })).sort((a, b) => a.valor - b.valor)
    const inteira = opcoes.find(o => o.cabe)
    if (inteira || unidades.length === 1) {
      for (const area of unidades) atribuir((inteira || opcoes[0]).g, area)
      continue
    }
    for (const area of [...unidades].sort((a, b) => b.itens - a.itens)) {
      const melhor = [...grupos].sort((a, b) => custo(a, area) - custo(b, area))[0]
      atribuir(melhor, area)
    }
  }
  // 3. Rebalanceamento: tira áreas de quem passou da capacidade, sempre para alguém com perfil.
  for (let rodada = 0; rodada < 200; rodada++) {
    const doador = [...grupos].sort((a, b) => carga(b) - carga(a))[0]
    if (carga(doador) <= 1) break
    let melhor = null
    for (const area of doador.areas.filter(a => !a.fixa)) {
      for (const g of grupos) {
        if (g === doador || !encaixe(g, area).perfilOk) continue
        const recebedor = carga(g, horasDe(g, area))
        const restante = carga(doador, -area.horas)
        const pior = Math.max(recebedor, restante)
        if (pior >= carga(doador) - 0.01) continue
        const ganho = carga(doador) - pior + 0.2 * encaixe(g, area).nota
        if (!melhor || ganho > melhor.ganho) melhor = { area, g, ganho }
      }
    }
    if (!melhor) break
    tirar(doador, melhor.area)
    const { fixa, horas, nota, habitual, foraDoPerfil, ...area } = melhor.area
    atribuir(melhor.g, area)
  }

  const ordem = ['liquida', 'gondola', 'emporio', 'paredaoFrios', 'freezer', 'acougue', 'flv', 'outro']
  const resultado = grupos.map(g => {
    const termino = g.disp.inicio + g.horas * 60
    const p = g.perfil
    return {
      pessoa: g.pessoa,
      usuario: g.usuario,
      areas: [...g.areas].sort((a, b) => ordem.indexOf(a.tipo) - ordem.indexOf(b.tipo) || (a.numero || 0) - (b.numero || 0) || String(a.id).localeCompare(String(b.id))),
      itens: g.itens,
      locais: g.areas.reduce((s, a) => s + (a.locais || 1), 0),
      horas: g.horas,
      ritmo: g.horas ? g.itens / g.horas : (p?.ritmo || ritmoPadrao),
      disponivel: g.disp,
      carga: carga(g) * 100,
      termino,
      passa: termino > minutos(fim) + 1 || carga(g) > 1.001,
      aderencia: g.itens ? (g.itensPerfil / g.itens) * 100 : 0,
      foraDoPerfil: g.areas.filter(a => a.foraDoPerfil).length,
      acerto: p ? p.acerto * 100 : null,
      especialidade: p?.especialidade || null,
      familias: p?.familias || [],
      setoresHabituais: p?.setoresHabituais || [],
      semHistorico: !p,
      janela: p?.janela || null
    }
  })

  // Avisos e sugestões.
  const avisos = []
  const fora = resultado.flatMap(g => g.areas.filter(a => a.foraDoPerfil).map(a => ({ a, g })))
  const familiasSemGente = [...new Set(fora.map(({ a }) => a.familia))]
  for (const familia of familiasSemGente) {
    const areasFam = fora.filter(({ a }) => a.familia === familia)
    const candidatos = [...(todosPerfis || new Map()).values()]
      .filter(p => !pessoas.some(x => x.usuario === p.usuario) && p.familias.includes(familia))
      .sort((a, b) => (b.porFamilia.get(familia) || 0) - (a.porFamilia.get(familia) || 0))
      .slice(0, 2)
    avisos.push({
      tom: 'ruim',
      texto: `Ninguém escalado tem perfil de ${familia}: ${areasFam.map(({ a }) => nomeUnidade(a)).join(', ')} ficou fora do perfil.`,
      sugestao: candidatos.length ? `Inclua ${candidatos.map(c => rotuloUsuario(c.usuario)).join(' ou ')}` : '',
      usuarios: candidatos.map(c => c.usuario)
    })
  }
  for (const g of resultado.filter(x => x.passa)) {
    avisos.push({ tom: 'alerta', texto: `${rotuloUsuario(g.usuario)} passa do horário (${textoHora(g.termino)}, capacidade ${g.carga.toFixed(0)}%).`, sugestao: '', usuarios: [] })
  }

  const termino = Math.max(...resultado.map(g => g.termino))
  const itensPerfil = resultado.reduce((s, g) => s + (g.aderencia / 100) * g.itens, 0)
  return {
    totalItens,
    pessoasNecessarias,
    grupos: resultado,
    horasNecessarias: Math.max(0, (termino - minutos(inicio)) / 60),
    termino,
    cabeNoHorario: resultado.every(g => !g.passa),
    aderencia: totalItens ? (itensPerfil / totalItens) * 100 : 0,
    avisos
  }
}
