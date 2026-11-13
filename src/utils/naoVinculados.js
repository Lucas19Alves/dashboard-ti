import { codigoDoItem, codigoLocal, numeroBR, setorDoItem } from './itemAuditoria'

// Tratamento dos itens que chegam na loja sem local vinculado no sistema.
// Cruza a planilha "não vinculados" com o histórico das auditorias para sugerir o local certo
// e aponta itens que podem estar vinculados no local errado.

const texto = v => String(v ?? '').trim()
const dataDe = a => String(a?.data || '').slice(0, 10)
const emOrdem = lista => [...(lista || [])].filter(Boolean).sort((a, b) => dataDe(a).localeCompare(dataDe(b)) || (a.id || 0) - (b.id || 0))
const localValido = l => l && !/^n[aã]o especificado$/i.test(l)
const isoDe = v => {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10)
  const m = texto(v).match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : texto(v).slice(0, 10)
}
// "35.6.4.2 - INSTANTANEO" → "35.6.4.2"
const classeCodigo = v => texto(v).split(' - ')[0]

// Linha da planilha do ERP → item de tratamento.
export const normalizarLinha = row => ({
  codigo: texto(row['Código'] ?? row.Codigo),
  produto: texto(row.Nome || row.Produto) || 'Produto não informado',
  estoque: numeroBR(row.Estoque ?? row['Estoque atual']),
  diasSemVenda: row['Dias sem venda'] === '' || row['Dias sem venda'] == null ? null : numeroBR(row['Dias sem venda']),
  ultimaVenda: isoDe(row['Última venda']),
  ultimaCompra: isoDe(row['Última Compra'] ?? row['Última compra']),
  classe: texto(row['Classe de Produto']),
  setor: texto(row['Classe de Produto Raiz'] || row.Setor) || 'Não especificado',
  fornecedor: texto(row.Fornecedor),
  ranking: row['Ranking de Vendas'] === '' || row['Ranking de Vendas'] == null ? null : numeroBR(row['Ranking de Vendas'])
})

// Uma passada pelo histórico: onde cada código já esteve vinculado, onde foi achado sem pertencer
// e quais locais cada classe de produto costuma ocupar.
export const indexarHistorico = (auditorias) => {
  const porCodigo = new Map()
  const porClasse = new Map()
  const lista = emOrdem(auditorias)
  for (const auditoria of lista) {
    const data = dataDe(auditoria)
    for (const item of Array.isArray(auditoria?.dados) ? auditoria.dados : []) {
      const codigo = codigoDoItem(item)
      const local = codigoLocal(item?.Local)
      if (!codigo || !localValido(local)) continue
      const reg = porCodigo.get(codigo) || { vinculado: new Map(), achado: new Map(), produto: '', setor: '' }
      reg.produto = texto(item.Produto) || reg.produto
      reg.setor = setorDoItem(item)
      // Lido não pertence: o item estava fisicamente nesse local, mas o sistema o tem em outro.
      const alvo = item._lidoNaoPertence ? reg.achado : reg.vinculado
      const atual = alvo.get(local) || { vezes: 0, ultima: '' }
      atual.vezes++
      atual.ultima = data
      alvo.set(local, atual)
      porCodigo.set(codigo, reg)
      const classe = classeCodigo(item['Classe de Produto'])
      if (classe && !item._lidoNaoPertence) {
        const locais = porClasse.get(classe) || new Map()
        locais.set(local, (locais.get(local) || 0) + 1)
        porClasse.set(classe, locais)
      }
    }
  }
  return { porCodigo, porClasse, auditorias: lista.length, ultimaData: lista.length ? dataDe(lista.at(-1)) : '' }
}

const maisRecente = mapa => [...mapa.entries()].sort((a, b) => b[1].ultima.localeCompare(a[1].ultima) || b[1].vezes - a[1].vezes)[0]

// Sugestão de local, da evidência mais forte para a mais fraca.
export const sugerirLocal = (item, indice) => {
  const reg = indice.porCodigo.get(item.codigo)
  if (reg?.achado.size) {
    const [local, { vezes, ultima }] = maisRecente(reg.achado)
    return { local, confianca: 'alta', motivo: `Lido em ${local} ${vezes === 1 ? 'na auditoria' : `${vezes} vezes, a última`} de ${ultima.slice(8, 10)}/${ultima.slice(5, 7)}` }
  }
  if (reg?.vinculado.size) {
    const [local, { ultima }] = maisRecente(reg.vinculado)
    return { local, confianca: 'alta', motivo: `Estava vinculado em ${local} até ${ultima.slice(8, 10)}/${ultima.slice(5, 7)}` }
  }
  const locais = indice.porClasse.get(classeCodigo(item.classe))
  if (locais?.size) {
    const total = [...locais.values()].reduce((s, n) => s + n, 0)
    const [local, n] = [...locais.entries()].sort((a, b) => b[1] - a[1])[0]
    const parte = Math.round((n / total) * 100)
    return { local, confianca: parte >= 60 ? 'media' : 'baixa', motivo: `${parte}% dos itens da mesma classe ficam em ${local}` }
  }
  return { local: '', confianca: 'nenhuma', motivo: 'Sem histórico nas auditorias: procurar na loja' }
}

// Prioridade: estoque parado sem local some da auditoria; com venda recente é o que mais importa.
export const prioridade = item => {
  if (item.estoque <= 0) return 'baixa'
  if (item.diasSemVenda !== null && item.diasSemVenda <= 7) return 'alta'
  return 'media'
}

export const tratarPlanilha = (linhas, auditorias) => {
  const indice = indexarHistorico(auditorias)
  const vistos = new Set()
  const itens = []
  for (const row of linhas || []) {
    const item = normalizarLinha(row)
    if (!item.codigo || vistos.has(item.codigo)) continue
    vistos.add(item.codigo)
    itens.push({ ...item, sugestao: sugerirLocal(item, indice), prioridade: prioridade(item) })
  }
  return itens
}

// Junta a importação do dia com o que já estava salvo:
// quem continua na lista mantém status e local escolhido; quem saiu foi vinculado no sistema.
export const mesclarImportacao = (anteriores, novos, hoje) => {
  const antigos = new Map((anteriores || []).map(r => [r.codigo, r]))
  const resultado = novos.map(item => {
    const antigo = antigos.get(item.codigo)
    antigos.delete(item.codigo)
    const reaberto = antigo?.status === 'resolvido'
    return {
      ...item,
      status: !antigo || reaberto ? 'pendente' : antigo.status,
      localEscolhido: reaberto ? '' : antigo?.localEscolhido || '',
      primeiroVisto: reaberto ? hoje : antigo?.primeiroVisto || hoje,
      ultimoVisto: hoje,
      vezes: (antigo?.vezes || 0) + 1,
      resolvidoEm: ''
    }
  })
  for (const antigo of antigos.values()) {
    resultado.push(antigo.status === 'resolvido' ? antigo : { ...antigo, status: 'resolvido', resolvidoEm: hoje })
  }
  return resultado
}

// Vínculos suspeitos nas auditorias (independem da planilha):
// - achado: lido em outro local em 2+ auditorias (está fisicamente lá);
// - setor: o setor do item quase não aparece no local onde está vinculado.
export const vinculosSuspeitos = (auditorias, { minVezes = 2, minItensLocal = 10, maxParte = 0.1 } = {}) => {
  const indice = indexarHistorico(auditorias)
  const linhas = []
  for (const [codigo, reg] of indice.porCodigo) {
    for (const [local, { vezes, ultima }] of reg.achado) {
      if (vezes < minVezes) continue
      const vinculadoEm = maisRecente(reg.vinculado)?.[0] || ''
      linhas.push({ codigo, produto: reg.produto, setor: reg.setor, tipo: 'achado', local, vinculadoEm, vezes, ultima, motivo: `Lido em ${local} em ${vezes} auditorias${vinculadoEm ? `, mas vinculado em ${vinculadoEm}` : ''}` })
    }
  }
  // Setor fora do lugar: olha só a última auditoria com locais (retrato atual dos vínculos).
  const ultima = emOrdem(auditorias).filter(a => (a.dados || []).some(i => localValido(codigoLocal(i?.Local)))).at(-1)
  const porLocal = new Map()
  for (const item of ultima?.dados || []) {
    const local = codigoLocal(item?.Local)
    if (!localValido(local) || item._lidoNaoPertence) continue
    const grupo = porLocal.get(local) || []
    grupo.push(item)
    porLocal.set(local, grupo)
  }
  for (const [local, grupo] of porLocal) {
    if (grupo.length < minItensLocal) continue
    const contagem = new Map()
    grupo.forEach(i => contagem.set(setorDoItem(i), (contagem.get(setorDoItem(i)) || 0) + 1))
    const [setorLocal] = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]
    for (const item of grupo) {
      const setor = setorDoItem(item)
      if (setor === 'Não especificado' || contagem.get(setor) / grupo.length > maxParte) continue
      linhas.push({ codigo: codigoDoItem(item), produto: texto(item.Produto), setor, tipo: 'setor', local, vinculadoEm: local, vezes: 1, ultima: dataDe(ultima), motivo: `${setor} em ${local}, local de ${setorLocal}` })
    }
  }
  return linhas.sort((a, b) => (a.tipo === b.tipo ? b.vezes - a.vezes : a.tipo === 'achado' ? -1 : 1))
}

// Itens da planilha que aparecem nas auditorias (para mostrar o histórico de cada um).
export const historicoDoCodigo = (codigo, auditorias) => {
  const eventos = []
  for (const auditoria of emOrdem(auditorias)) {
    for (const item of auditoria?.dados || []) {
      if (codigoDoItem(item) !== codigo) continue
      eventos.push({ data: dataDe(auditoria), tipo: auditoria.tipo, local: codigoLocal(item.Local), naoPertence: Boolean(item._lidoNaoPertence), lido: Boolean(item._temPresenca || item._lidoNaoPertence) })
    }
  }
  return eventos.reverse()
}
