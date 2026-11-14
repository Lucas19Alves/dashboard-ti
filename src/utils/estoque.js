import { codigoDoItem, codigoLocal, custoRupturaDoItem, fornecedorDoItem, localDoItem, numeroBR, produtoDoItem, setorDoItem, temEstoque } from './itemAuditoria'
import { isItemLido } from './itemLido'
import { ehInsumo } from './estoqueTotal'

// Análises de estoque a partir das auditorias de Presença e Ruptura (as que leem a gôndola):
// - reincidências: itens com estoque que não são lidos há semanas (somem da gôndola);
// - sem estoque no sistema: itens lidos na gôndola com estoque zerado (entrada não lançada);
// - estoque parado: itens com estoque e muitos dias sem venda.
// Tudo parte da situação de cada código na última vez em que apareceu nas auditorias.
// Com a planilha de estoque total importada (`total`: Map código → item), ela vira a base: só entram
// os itens que estão nela, com o estoque e os dias sem venda dela (ver utils/estoqueTotal.js).

export const LIMIAR_REINCIDENCIA_DIAS = 14
export const LIMIAR_PARADO_DIAS = 30
export const TIPOS_PROBLEMA = {
  reincidencia: { rotulo: 'Reincidência', curto: 'Sem leitura', icone: 'fas fa-repeat' },
  semEstoque: { rotulo: 'Sem estoque no sistema', curto: 'Estoque zerado', icone: 'fas fa-box-open' },
  parado: { rotulo: 'Estoque parado', curto: 'Sem venda', icone: 'fas fa-hourglass-half' },
  nuncaLido: { rotulo: 'Nunca lido', curto: 'Nunca lido', icone: 'fas fa-eye-slash' }
}

const TIPOS_LEITURA = new Set(['Presença', 'Ruptura'])
const dataDe = a => String(a?.data || '').slice(0, 10)
const emOrdem = lista => [...(lista || [])].filter(Boolean).sort((a, b) => dataDe(a).localeCompare(dataDe(b)) || (a.id || 0) - (b.id || 0))
export const diasEntre = (a, b) => (a && b ? Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000) : null)
const numeroOuNulo = v => (v === '' || v === null || v === undefined ? null : numeroBR(v))
const localValido = l => l && !/^n[aã]o especificado$/i.test(l)
const texto = v => String(v ?? '').trim()

// "Sem local" é só o item da lista de não vinculados (sem local vinculado no sistema).
// Os outros itens têm local no sistema; quando ele não aparece nas auditorias nem nas validades,
// o local é "não identificado" (ex.: nunca lidos), nunca "sem local".
export const SEM_LOCAL = 'Sem local (não vinculado)'
export const LOCAL_NAO_IDENTIFICADO = 'Local não identificado'
// Primeiro local de "G05A; G06B" ou "G05A - G05A".
const primeiroLocal = valor => codigoLocal(texto(String(valor || '').split(/[;,|/]/)[0]))

// Situação de um código numa auditoria (junta as linhas repetidas do mesmo código).
const lerAuditoria = (dados) => {
  const vistos = new Map()
  for (const item of dados) {
    const codigo = codigoDoItem(item)
    if (!codigo) continue
    const naoPertence = Boolean(item._lidoNaoPertence)
    const local = codigoLocal(localDoItem(item))
    const r = vistos.get(codigo) || { lido: false, naoPertence: false, localLido: '', local: '', item: null }
    if (naoPertence) {
      r.naoPertence = true
      if (localValido(local)) r.localLido = local
    } else if (isItemLido(item)) {
      r.lido = true
    }
    // A linha do local vinculado manda nos dados do item; "lido não pertence" só quando é a única.
    if (!naoPertence || !r.item) {
      r.item = item
      if (!naoPertence && localValido(local)) r.local = local
    }
    vistos.set(codigo, r)
  }
  return vistos
}

// Uma passada por todas as auditorias de Presença/Ruptura: histórico e situação atual de cada código.
export const indexarEstoque = (auditorias) => {
  const lista = emOrdem(auditorias).filter(a => TIPOS_LEITURA.has(a?.tipo) && Array.isArray(a.dados) && a.dados.length)
  const itens = new Map()
  for (const auditoria of lista) {
    const data = dataDe(auditoria)
    for (const [codigo, v] of lerAuditoria(auditoria.dados)) {
      const item = v.item
      const comEstoque = temEstoque(item)
      const estoque = numeroBR(item?._estoque ?? item?.['Estoque atual'] ?? item?.['Estoque Atual'])
      const r = itens.get(codigo) || {
        codigo, produto: '', setor: '', classe: '', fornecedor: '', local: '',
        primeiraData: data, ultimaData: '', ultimaLeitura: '', pendenteDesde: '',
        aparicoes: 0, leituras: 0, seguidasSemLeitura: 0, valorEmFalta: 0,
        semEstoqueVezes: 0, semEstoqueDesde: '', naoPertence: new Map(), historico: []
      }
      r.produto = produtoDoItem(item)
      r.setor = setorDoItem(item)
      r.classe = texto(item?.['Classe de Produto']) || r.classe
      r.fornecedor = fornecedorDoItem(item)
      if (v.local) r.local = v.local
      r.estoque = estoque
      r.comEstoque = comEstoque
      r.diasSemVenda = numeroOuNulo(item?.['Dias sem venda'])
      r.custo = custoRupturaDoItem(item)
      // Custo unitário estimado: o "Custo Ruptura" é quantidade × custo (vale a última linha com os dois).
      if (estoque > 0 && r.custo > 0) r.custoUnitario = r.custo / estoque
      r.ultimaCompra = texto(item?.['Última compra'] ?? item?.['Última Compra'])
      r.ultimaData = data
      r.aparicoes++
      // "Lido não pertence" não conta como leitura: o local vinculado continuou sem o produto.
      const lido = v.lido
      if (v.naoPertence && v.localLido) {
        const n = r.naoPertence.get(v.localLido) || { vezes: 0, ultima: '' }
        n.vezes++
        n.ultima = data
        r.naoPertence.set(v.localLido, n)
      }
      let situacao
      // Valor em falta: o "Custo Ruptura" do sistema é o valor do estoque do item (quantidade × custo).
      // Vale o da última auditoria em que ele não foi achado (não se soma semana a semana);
      // zera quando o item é lido ou fica sem estoque.
      if (lido) {
        r.leituras++
        r.ultimaLeitura = data
        r.seguidasSemLeitura = 0
        r.pendenteDesde = ''
        r.valorEmFalta = 0
        situacao = comEstoque ? 'lido' : 'lidoSemEstoque'
      } else if (comEstoque) {
        r.valorEmFalta = r.custo
        r.seguidasSemLeitura++
        r.pendenteDesde ||= data
        situacao = 'pendente'
      } else {
        r.seguidasSemLeitura = 0
        r.pendenteDesde = ''
        r.valorEmFalta = 0
        situacao = 'semEstoque'
      }
      if (situacao === 'lidoSemEstoque') {
        r.semEstoqueVezes++
        r.semEstoqueDesde ||= data
      } else {
        r.semEstoqueVezes = 0
        r.semEstoqueDesde = ''
      }
      r.situacao = situacao
      r.historico.push({ data, tipo: auditoria.tipo, auditoriaId: auditoria.id, situacao, local: v.local || r.local, localLido: v.localLido, estoque, diasSemVenda: r.diasSemVenda })
      itens.set(codigo, r)
    }
  }
  // Ciclo atual: a partir da última Presença. Quem não apareceu nele saiu da lista (ex.: zerou o estoque).
  const presencas = lista.filter(a => a.tipo === 'Presença')
  const inicioCiclo = presencas.length ? dataDe(presencas.at(-1)) : (lista.length ? dataDe(lista.at(-1)) : '')
  for (const r of itens.values()) r.ativo = r.ultimaData >= inicioCiclo
  return {
    itens,
    auditorias: lista.length,
    inicioCiclo,
    ultimaData: lista.length ? dataDe(lista.at(-1)) : '',
    primeiraData: lista.length ? dataDe(lista[0]) : ''
  }
}

// Dados comuns de uma linha: cadastro pelas auditorias (mesmos nomes de setor e fornecedor das outras
// telas) e estoque/dias sem venda pela planilha de estoque total, quando ela existe.
// Local: o vinculado nas auditorias; sem ele, o da planilha de validades (`localExtra`).
const base = (r, t = null, localExtra = '') => ({
  codigo: r?.codigo || t.codigo,
  produto: r?.produto || t.produto,
  setor: r?.setor || t.setor,
  fornecedor: r?.fornecedor || t.fornecedor,
  local: r?.local || localExtra || '',
  localOrigem: r?.local ? 'auditoria' : localExtra ? 'validades' : '',
  estoque: t ? t.estoque : r.estoque,
  unidade: t?.unidade || '',
  diasSemVenda: t ? t.diasSemVenda : r.diasSemVenda,
  ultimaVenda: t?.ultimaVenda || '',
  ultimaData: r?.ultimaData || '',
  ultimaLeitura: r?.ultimaLeitura || ''
})

// Onde o item foi achado fora do lugar depois da última leitura no local vinculado.
const achadoEm = (r, desde = '') => [...r.naoPertence.entries()]
  .filter(([, n]) => n.ultima >= desde)
  .sort((a, b) => b[1].ultima.localeCompare(a[1].ultima) || b[1].vezes - a[1].vezes)[0]?.[0] || ''

export const diagnosticoReincidencia = ({ nuncaLido, diasSemVenda, achado, dias }) => {
  const vende = diasSemVenda !== null && diasSemVenda <= 7
  const parado = diasSemVenda === null || diasSemVenda >= LIMIAR_PARADO_DIAS
  if (achado) return `Lido em ${achado}, fora do local vinculado: devolver ao local ou corrigir o vínculo`
  if (vende) return 'Vende, mas não é achado no local: procurar no depósito e em outros locais e repor a gôndola'
  if (nuncaLido && parado) return 'Nunca lido e sem venda: provável estoque que não existe, contar e ajustar'
  if (parado) return `Sem leitura há ${dias} dias e sem venda: contar o físico e ajustar o estoque`
  return 'Procurar no depósito, repor a gôndola e conferir o vínculo do local'
}

// Itens com estoque que não são lidos há `limiar` dias ou mais (Presença/Ruptura).
// Com a planilha de estoque total, só quem ainda tem estoque nela; e entram também os que têm estoque
// e saíram da auditoria (já apareceram, mas não na última Presença), qualquer que seja o limiar:
// fora da auditoria, ninguém mais confere esses itens.
export const reincidencias = (indice, { limiar = LIMIAR_REINCIDENCIA_DIAS, total = null } = {}) => {
  const linhas = []
  for (const r of indice.itens.values()) {
    if (!r.ativo || r.situacao !== 'pendente' || ehInsumo(r)) continue
    const t = total?.get(r.codigo) || null
    if (total && !(t?.estoque > 0)) continue
    const diasSemVenda = t ? t.diasSemVenda : r.diasSemVenda
    const nuncaLido = !r.ultimaLeitura
    const desde = r.ultimaLeitura || r.pendenteDesde
    const dias = diasEntre(desde, r.ultimaData)
    if (dias === null || dias < limiar) continue
    const achado = achadoEm(r, desde)
    const vende = diasSemVenda !== null && diasSemVenda <= 7
    linhas.push({
      ...base(r, t),
      tipo: 'reincidencia',
      dias,
      nuncaLido,
      desde,
      auditoriasSemLeitura: r.seguidasSemLeitura,
      valorEmFalta: r.valorEmFalta,
      achadoEm: achado,
      gravidade: 2 + (vende ? 2 : 0) + Math.min(3, Math.floor(dias / 14)) + (r.valorEmFalta > 0 ? 1 : 0) + (achado ? 1 : 0),
      diagnostico: diagnosticoReincidencia({ nuncaLido, diasSemVenda, achado, dias })
    })
  }
  for (const t of total?.values() || []) {
    const r = indice.itens.get(t.codigo)
    if (!r || r.ativo || !(t.estoque > 0) || ehInsumo(t)) continue
    const nuncaLido = !r.ultimaLeitura
    const desde = r.ultimaLeitura || r.primeiraData
    const dias = diasEntre(desde, indice.ultimaData) ?? 0
    const achado = achadoEm(r, desde)
    const vende = t.diasSemVenda !== null && t.diasSemVenda <= 7
    linhas.push({
      ...base(r, t),
      tipo: 'reincidencia',
      saiuDaAuditoria: true,
      dias,
      nuncaLido,
      desde,
      auditoriasSemLeitura: r.seguidasSemLeitura,
      valorEmFalta: r.valorEmFalta,
      achadoEm: achado,
      gravidade: 3 + (vende ? 2 : 0) + Math.min(3, Math.floor(dias / 14)) + (r.valorEmFalta > 0 ? 1 : 0) + (achado ? 1 : 0),
      diagnostico: achado
        ? `Saiu da auditoria e foi lido em ${achado}: devolver ao local ou corrigir o vínculo`
        : nuncaLido
          ? 'Tem estoque, nunca foi lido e saiu da auditoria: contar o físico e ajustar o estoque'
          : vende
            ? 'Vende, mas saiu da auditoria sem ser lido: procurar no depósito e em outros locais e repor a gôndola'
            : 'Saiu da auditoria sem ser lido: procurar o produto, repor a gôndola ou contar e ajustar o estoque'
    })
  }
  return linhas.sort((a, b) => b.gravidade - a.gravidade || b.dias - a.dias || b.valorEmFalta - a.valorEmFalta)
}

// Itens lidos na gôndola com estoque zerado no sistema na última auditoria em que apareceram.
// Com a planilha de estoque total, sai quem já tem estoque nela (a entrada foi lançada).
export const semEstoqueNoSistema = (indice, { total = null } = {}) => {
  const linhas = []
  for (const r of indice.itens.values()) {
    if (!r.ativo || r.situacao !== 'lidoSemEstoque' || ehInsumo(r)) continue
    if (total?.get(r.codigo)?.estoque > 0) continue
    const vezes = r.semEstoqueVezes
    linhas.push({
      ...base(r),
      tipo: 'semEstoque',
      vezes,
      desde: r.semEstoqueDesde,
      dias: diasEntre(r.semEstoqueDesde, r.ultimaData),
      gravidade: 2 + (vezes >= 2 ? 1 : 0) + (vezes >= 4 ? 1 : 0),
      diagnostico: vezes >= 2
        ? `Na gôndola com estoque zerado em ${vezes} auditorias seguidas: conferir a nota de entrada e ajustar o estoque`
        : 'Na gôndola com estoque zerado no sistema: conferir a nota de entrada e ajustar o estoque'
    })
  }
  return linhas.sort((a, b) => b.gravidade - a.gravidade || b.vezes - a.vezes || a.produto.localeCompare(b.produto))
}

// Menor validade de cada código nos vencimentos (para cruzar com estoque parado).
export const validadePorCodigo = (vencimentos) => {
  const mapa = new Map()
  for (const v of vencimentos || []) {
    const codigo = texto(v?._codigo)
    if (!codigo || !v._validadeISO) continue
    const atual = mapa.get(codigo)
    if (!atual || v._validadeISO < atual.validade) mapa.set(codigo, { validade: v._validadeISO, dias: v._diasParaVencer ?? null, estoque: Number(v._estoque) || 0, local: primeiroLocal(v._local) || atual?.local || '' })
  }
  return mapa
}

// Local de cada código pela planilha de validades (coluna Locais), para itens que não aparecem nas auditorias.
export const localPorValidade = (vencimentos) => {
  const mapa = new Map()
  for (const v of vencimentos || []) {
    const codigo = texto(v?._codigo)
    const local = primeiroLocal(v?._local)
    if (codigo && local && !mapa.has(codigo)) mapa.set(codigo, local)
  }
  return mapa
}

// Itens com estoque e `limiar` dias ou mais sem venda.
// Com a planilha de estoque total, entram todos os itens dela (também os que não aparecem nas auditorias).
export const estoqueParado = (indice, vencimentos = [], { limiar = LIMIAR_PARADO_DIAS, total = null } = {}) => {
  const validades = validadePorCodigo(vencimentos)
  const fontes = total
    ? [...total.values()].filter(t => !ehInsumo(t)).map(t => ({ t, r: indice.itens.get(t.codigo) || null }))
    : [...indice.itens.values()].filter(r => r.ativo && r.comEstoque && !ehInsumo(r)).map(r => ({ t: null, r }))
  const linhas = []
  for (const { t, r } of fontes) {
    const estoque = t ? t.estoque : r.estoque
    const diasSemVenda = t ? t.diasSemVenda : r.diasSemVenda
    if (!(estoque > 0) || diasSemVenda === null || diasSemVenda < limiar) continue
    const codigo = t?.codigo || r.codigo
    const v = validades.get(codigo)
    const venceEm = v && v.dias !== null ? Number(v.dias) : null
    const naoAchado = Boolean(r?.ativo) && r.situacao === 'pendente'
    const nuncaAuditado = !r
    const saiu = Boolean(r) && !r.ativo
    let diagnostico
    if (venceEm !== null && venceEm < 0) diagnostico = 'Vencido e sem venda: retirar, registrar a perda e rever o pedido'
    else if (venceEm !== null && venceEm <= 30) diagnostico = `Vence em ${venceEm} dia(s) e não gira: rebaixar ou negociar troca com o fornecedor`
    else if (naoAchado) diagnostico = 'Sem venda e não achado na gôndola: contar o físico, pode ser estoque que não existe'
    else if (nuncaAuditado) diagnostico = `Sem venda há ${diasSemVenda} dias e nunca apareceu nas auditorias: achar o produto, conferir o local e expor, ou contar e ajustar`
    else if (saiu) diagnostico = `Sem venda há ${diasSemVenda} dias e fora da auditoria: achar o produto e expor, ou contar e ajustar`
    else if (diasSemVenda >= 90) diagnostico = `Sem venda há ${diasSemVenda} dias: suspender o pedido e avaliar saída do mix`
    else diagnostico = `Sem venda há ${diasSemVenda} dias: melhorar a exposição ou rebaixar`
    linhas.push({
      ...base(r, t, v?.local),
      tipo: 'parado',
      dias: diasSemVenda,
      validade: v?.validade || '',
      venceEm,
      naoAchado,
      nuncaAuditado,
      saiu,
      gravidade: 1 + (venceEm !== null && venceEm <= 30 ? 3 : 0) + (naoAchado || nuncaAuditado || saiu ? 1 : 0) + (estoque >= 50 ? 1 : 0) + (diasSemVenda >= 90 ? 1 : 0),
      diagnostico
    })
  }
  return linhas.sort((a, b) => b.gravidade - a.gravidade || b.dias - a.dias || b.estoque - a.estoque)
}

// ---------- Onde agir ----------
// Soma os problemas por local, setor ou fornecedor.
export const agruparProblemas = ({ reincidentes = [], semEstoque = [], parados = [], nuncaLidos = [], naoVinculados = [], suspeitos = [] }, campo) => {
  const mapa = new Map()
  const somar = (chave, tipo, extra = 0) => {
    const k = chave || (campo !== 'local' ? 'Não informado' : tipo === 'naoVinculados' ? SEM_LOCAL : LOCAL_NAO_IDENTIFICADO)
    const r = mapa.get(k) || { chave: k, reincidentes: 0, semEstoque: 0, parados: 0, nuncaLidos: 0, naoVinculados: 0, suspeitos: 0, custo: 0, total: 0 }
    r[tipo]++
    r.total++
    r.custo += extra
    mapa.set(k, r)
  }
  for (const l of reincidentes) somar(l[campo], 'reincidentes', l.valorEmFalta || 0)
  for (const l of semEstoque) somar(l[campo], 'semEstoque')
  for (const l of parados) somar(l[campo], 'parados')
  for (const l of nuncaLidos) somar(l[campo], 'nuncaLidos')
  const campoNv = { local: i => i.sugestao?.local, setor: i => i.setor, fornecedor: i => i.fornecedor }[campo]
  if (campoNv) for (const i of naoVinculados) somar(campoNv(i), 'naoVinculados')
  if (campo === 'local' || campo === 'setor') for (const s of suspeitos) somar(campo === 'local' ? s.vinculadoEm : s.setor, 'suspeitos')
  return [...mapa.values()].sort((a, b) => b.total - a.total || b.custo - a.custo || a.chave.localeCompare(b.chave, 'pt-BR', { numeric: true }))
}

// Busca de itens no índice e na planilha de estoque total (código exato primeiro, depois por nome).
// Com a planilha, o estoque mostrado é o dela.
export const buscarItens = (indice, termo, limite = 30, total = null) => {
  const t = texto(termo).toLowerCase()
  if (t.length < 2) return []
  const casa = (codigo, produto) => codigo.toLowerCase().includes(t) || produto.toLowerCase().includes(t)
  const vistos = new Set()
  const resultado = []
  const incluir = (codigo) => {
    if (vistos.has(codigo)) return
    const r = indice.itens.get(codigo) || null
    const e = total?.get(codigo) || null
    if (!r && !e) return
    vistos.add(codigo)
    resultado.push({ ...base(r, e), noEstoqueTotal: Boolean(e) })
  }
  incluir(texto(termo))
  for (const r of indice.itens.values()) {
    if (resultado.length >= limite) break
    if (casa(r.codigo, r.produto)) incluir(r.codigo)
  }
  for (const e of total?.values() || []) {
    if (resultado.length >= limite) break
    if (casa(e.codigo, e.produto)) incluir(e.codigo)
  }
  return resultado
}

// ---------- Lista de conferência (impressa a partir do "Onde agir") ----------
// Um grupo por local, setor ou fornecedor; em cada grupo, uma linha por item com todos os problemas
// dele juntos (um item pode ser reincidente e parado ao mesmo tempo). Por local, os grupos seguem a
// ordem dos corredores (para percorrer a loja); por setor/fornecedor, os com mais itens primeiro.
export const listaConferencia = ({ reincidentes = [], semEstoque = [], parados = [], nuncaLidos = [], naoVinculados = [], suspeitos = [] }, campo, { tipos = null } = {}) => {
  const grupos = new Map()
  const vazio = tipo => (campo !== 'local' ? 'Não informado' : tipo === 'naoVinculado' ? SEM_LOCAL : LOCAL_NAO_IDENTIFICADO)
  const incluir = (tipo, chave, item) => {
    if (tipos && !tipos.includes(tipo)) return
    const k = chave || vazio(tipo)
    const g = grupos.get(k) || { chave: k, itens: new Map() }
    const linha = g.itens.get(item.codigo) || { codigo: item.codigo, produto: item.produto, local: item.local || '', estoque: item.estoque ?? null, unidade: item.unidade || '', problemas: [], oQueFazer: [] }
    if (!linha.problemas.includes(item.problema)) linha.problemas.push(item.problema)
    if (item.oQueFazer && !linha.oQueFazer.includes(item.oQueFazer)) linha.oQueFazer.push(item.oQueFazer)
    g.itens.set(item.codigo, linha)
    grupos.set(k, g)
  }
  const deLista = (lista, tipo) => {
    for (const l of lista) incluir(tipo, l[campo], { ...l, problema: TIPOS_PROBLEMA[tipo].rotulo, oQueFazer: l.diagnostico })
  }
  deLista(reincidentes, 'reincidencia')
  deLista(semEstoque, 'semEstoque')
  deLista(parados, 'parado')
  deLista(nuncaLidos, 'nuncaLido')
  const campoNv = { local: i => i.sugestao?.local, setor: i => i.setor, fornecedor: i => i.fornecedor }[campo]
  for (const i of naoVinculados) {
    incluir('naoVinculado', campoNv(i), { ...i, local: i.sugestao?.local ? `${i.sugestao.local} (sugerido)` : '', problema: 'Não vinculado', oQueFazer: i.sugestao?.local ? `Vincular em ${i.sugestao.local}` : 'Achar o local e vincular' })
  }
  if (campo === 'local' || campo === 'setor') {
    for (const s of suspeitos) incluir('suspeito', campo === 'local' ? s.vinculadoEm : s.setor, { ...s, local: s.vinculadoEm, problema: 'Vínculo suspeito', oQueFazer: s.motivo })
  }
  const natural = (a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })
  const lista = [...grupos.values()].map(g => ({
    chave: g.chave,
    itens: [...g.itens.values()].sort((a, b) => natural(a.local, b.local) || natural(a.produto || '', b.produto || ''))
  }))
  const semChave = k => [SEM_LOCAL, LOCAL_NAO_IDENTIFICADO, 'Não informado'].includes(k)
  return lista.sort((a, b) => semChave(a.chave) - semChave(b.chave) || (campo === 'local' ? natural(a.chave, b.chave) : b.itens.length - a.itens.length || natural(a.chave, b.chave)))
}
