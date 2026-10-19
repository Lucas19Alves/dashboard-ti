import { extrairDataISOPlanilha } from './auditoriaHorario'

const texto = valor => String(valor ?? '').trim()

const numero = valor => {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null
  const limpo = texto(valor).replace(/^###\s*/, '').replace(/\s*(KG|UN)\s*$/i, '').replace(',', '.')
  const resultado = Number(limpo)
  return limpo && Number.isFinite(resultado) ? resultado : null
}

const horaSegundos = valor => {
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return null
    const segundos = valor.getUTCHours() * 3600 + valor.getUTCMinutes() * 60 + valor.getUTCSeconds()
    // Uma célula de data importada pelo Excel vira Date à meia-noite.
    // Sem hora explícita, ela não prova que a leitura ocorreu às 00:00.
    return valor.getUTCFullYear() >= 2020 && segundos === 0 ? null : segundos
  }
  if (typeof valor === 'number') {
    if (valor >= 0 && valor < 1) return Math.round(valor * 86400) % 86400
    if (valor > 100 && valor < 200000 && valor % 1 !== 0) return Math.round((valor % 1) * 86400) % 86400
    if (valor > 1e12) {
      const data = new Date(valor)
      if (Number.isNaN(data.getTime())) return null
      const segundos = data.getUTCHours() * 3600 + data.getUTCMinutes() * 60 + data.getUTCSeconds()
      return data.getUTCFullYear() >= 2020 && segundos === 0 ? null : segundos
    }
    return null
  }
  const valorTexto = texto(valor)
  const encontrado = valorTexto.match(/(?:^|[T\s])(\d{1,2}):(\d{2})(?::(\d{2}))?(?=[.Z+\-\s]|$)/)
  if (!encontrado) return null
  const horas = Number(encontrado[1])
  const minutos = Number(encontrado[2])
  const segundos = Number(encontrado[3] || 0)
  if (/^(?:\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})[T ]00:00(?::00(?:\.0+)?)?(?:Z|$)/.test(valorTexto)) return null
  return horas < 24 && minutos < 60 && segundos < 60 ? horas * 3600 + minutos * 60 + segundos : null
}

export const momentoLeitura = item => {
  const chaves = Object.keys(item).filter(chave => /^auditado[ _]em/i.test(chave))
  const valores = [
    ...chaves.map(chave => ({ chave, valor: item[chave] })),
    ...['Lido em', 'Carimbo de data/hora', 'Data', 'Hora'].map(chave => ({ chave, valor: item[chave] }))
  ]
  const comData = valores.map(campo => ({ ...campo, data: extrairDataISOPlanilha(campo.valor) }))
    .find(campo => campo.data && Number.isFinite(Date.parse(`${campo.data}T00:00:00Z`)))
  // Algumas planilhas usam colunas homônimas para data e hora. Uma hora
  // explícita em outra coluna prevalece sobre a meia-noite da coluna de data.
  const horas = valores.map(campo => ({ ...campo, segundos: horaSegundos(campo.valor) }))
    .filter(campo => campo.segundos !== null)
  const comHora = horas.find(campo => campo.segundos > 0) || horas[0]
  if (!comData || !comHora) return null
  const instante = Date.parse(`${comData.data}T00:00:00Z`) + comHora.segundos * 1000
  return Number.isFinite(instante)
    ? { instante, data: comData.data, hora: new Date(instante).toISOString().slice(11, 19),
        colunaData: comData.chave, colunaHora: comHora.chave }
    : null
}

const foiLido = item => {
  if (item._temPresenca !== undefined || item._lidoNaoPertence !== undefined) {
    return item._temPresenca === true || item._lidoNaoPertence === true
  }
  const situacao = texto(item._situacao || item['Situação'] || item['Situação atual da auditoria'])
    .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (situacao.includes('nao lido') || situacao.includes('sem presenca') || situacao.includes('sem leitura')) return false
  return situacao.includes('com presenca') || situacao.includes('atualizado') || situacao.includes('lido sem estoque') || situacao.includes('lido nao pertence')
}

const chaveUsuario = valor => {
  const usuario = texto(valor)
  const matricula = usuario.match(/^(\d+)\s*\(/)
  return matricula ? `matricula:${matricula[1]}` : usuario.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
}

const criarLeitura = item => ({
  item,
  codigo: texto(item['Código'] ?? item.Codigo) || 'Sem código',
  produto: texto(item.Produto) || 'Produto não informado',
  classe: texto(item['Classe de Produto'] || item['Classe de Produto Raiz'] || item.Setor),
  local: texto(item.Local) || 'Local não informado',
  usuario: texto(item['Usuário']) || 'Usuário não informado',
  situacao: texto(item._situacao || item['Situação'] || item['Situação atual da auditoria']),
  momento: momentoLeitura(item)
})

const registro = leitura => ({
  codigo: leitura.codigo,
  produto: leitura.produto,
  classe: leitura.classe,
  local: leitura.local,
  usuario: leitura.usuario,
  situacao: leitura.situacao,
  linhaPlanilha: leitura.item._linhaPlanilha ?? null,
  dataHora: leitura.momento ? `${leitura.momento.data} ${leitura.momento.hora}` : 'Sem data e hora verificáveis',
  colunaData: leitura.momento?.colunaData || '',
  colunaHora: leitura.momento?.colunaHora || '',
  estoque: numero(leitura.item._estoque ?? leitura.item['Estoque atual'] ?? leitura.item['Estoque Atual']),
  diasSemVenda: numero(leitura.item['Dias sem venda'] ?? leitura.item['Dias sem Venda'])
})

const formatarInstante = instante => {
  const data = new Date(instante)
  return `${data.toISOString().slice(0, 10)} ${data.toISOString().slice(11, 19)}`
}

const criarSinal = ({ tipo, titulo, resumo, usuario = '', leituras, criterio, inicio = null, fim = null, contextoHistorico = [], referencias = [], itensHistoricos = null, comparacao = null }) => ({
  tipo, titulo, resumo, usuario, criterio,
  quantidade: leituras.length,
  periodo: inicio === null ? '' : `${formatarInstante(inicio)} a ${formatarInstante(fim)}`,
  contextoHistorico, referencias, comparacao,
  registros: leituras.map(leitura => {
    const anterior = itensHistoricos?.get(leitura.codigo)
    return { ...registro(leitura), ultimoLocal: anterior?.local || '', dataUltimaAuditoria: anterior?.data || '', idUltimaAuditoria: anterior?.auditoriaId ?? '' }
  })
})

const maiorJanela = (lista, minutos, minimo, validar = () => true) => {
  let melhor = null
  let fim = 0
  for (let inicio = 0; inicio < lista.length; inicio++) {
    if (fim < inicio) fim = inicio
    while (fim < lista.length && lista[fim].momento.instante - lista[inicio].momento.instante <= minutos * 60000) fim++
    if (fim - inicio >= minimo && (!melhor || fim - inicio > melhor.length)) {
      const janela = lista.slice(inicio, fim)
      if (validar(janela)) melhor = janela
    }
  }
  return melhor
}

const maiorVariedade = (lista, minutos) => {
  let fim = 0
  let melhor = 0
  const classes = new Map()
  for (let inicio = 0; inicio < lista.length; inicio++) {
    if (fim < inicio) fim = inicio
    while (fim < lista.length && lista[fim].momento.instante - lista[inicio].momento.instante <= minutos * 60000) {
      const classe = lista[fim].classe
      if (classe) classes.set(classe, (classes.get(classe) || 0) + 1)
      fim++
    }
    melhor = Math.max(melhor, classes.size)
    const classe = lista[inicio].classe
    if (classes.has(classe)) {
      const restante = classes.get(classe) - 1
      if (restante) classes.set(classe, restante)
      else classes.delete(classe)
    }
  }
  return melhor
}

const prepararHistorico = (historico, dataAtual, tipoAuditoria) => {
  const anteriores = (Array.isArray(historico) ? historico : [])
    .filter(a => Array.isArray(a?.dados) && a.dados.length &&
      (!tipoAuditoria || a.tipo === tipoAuditoria) &&
      a.origem !== 'backup-regional' && !a.analise?.regional &&
      extrairDataISOPlanilha(a.data) && extrairDataISOPlanilha(a.data) < dataAtual)
    .sort((a, b) => extrairDataISOPlanilha(b.data).localeCompare(extrairDataISOPlanilha(a.data)))
    .slice(0, 12)
  const usuarios = new Map()
  const itens = new Map()
  const locais = new Map()
  for (const auditoria of anteriores) {
    const porUsuario = new Map()
    const dia = extrairDataISOPlanilha(auditoria.data)
    for (const item of auditoria.dados) {
      if (!item || !foiLido(item)) continue
      const leitura = criarLeitura(item)
      if (leitura.codigo !== 'Sem código' && !itens.has(leitura.codigo)) {
        itens.set(leitura.codigo, { local: leitura.local, data: dia, auditoriaId: auditoria.id })
      }
      if (leitura.local !== 'Local não informado' && leitura.classe) {
        if (!locais.has(leitura.local)) locais.set(leitura.local, new Set())
        locais.get(leitura.local).add(leitura.classe)
      }
      if (!leitura.momento || leitura.momento.data !== dia || leitura.usuario === 'Usuário não informado') continue
      const chave = chaveUsuario(leitura.usuario)
      if (!porUsuario.has(chave)) porUsuario.set(chave, [])
      porUsuario.get(chave).push(leitura)
    }
    for (const [chave, lista] of porUsuario) {
      if (lista.length < 20) continue
      lista.sort((a, b) => a.momento.instante - b.momento.instante)
      if (!usuarios.has(chave)) usuarios.set(chave, [])
      usuarios.get(chave).push({
        id: auditoria.id,
        data: dia,
        maximo30: maiorJanela(lista, 30, 1)?.length || 0,
        classes30: maiorVariedade(lista, 30)
      })
    }
  }
  return { anteriores, usuarios, itens, locais }
}

const contextoHistorico = (janela, usuario, historico) => {
  const referencias = historico.usuarios.get(chaveUsuario(usuario)) || []
  const contexto = []
  if (referencias.length) {
    contexto.push(`Histórico do usuário: ${referencias.length} auditoria(s) do mesmo tipo; maior bloco anterior de 30 minutos: ${Math.max(...referencias.map(r => r.maximo30))} leituras.`)
  }
  if (historico.anteriores.length) {
    const conhecidos = janela.filter(leitura => historico.itens.has(leitura.codigo))
    const localDiferente = conhecidos.filter(leitura => historico.itens.get(leitura.codigo).local !== leitura.local)
    const pares = new Set(janela.filter(leitura => leitura.classe && leitura.local !== 'Local não informado')
      .map(leitura => `${leitura.local}\u0000${leitura.classe}`))
    const novosNoLocal = [...pares].filter(par => {
      const [local, classe] = par.split('\u0000')
      return historico.locais.has(local) && !historico.locais.get(local).has(classe)
    }).length
    contexto.push(`Itens e locais: ${conhecidos.length} códigos com registro anterior; ${localDiferente.length} aparecem em outro local. ${novosNoLocal} combinações classe/local não aparecem no histórico disponível.`)
  }
  return { contexto, referencias }
}

export const analisarSinaisAuditoria = (dados, dataAuditoria, opcoes = {}) => {
  const leituras = (Array.isArray(dados) ? dados : [])
    .filter(item => item && foiLido(item))
    .map(criarLeitura)
  const sinais = []
  const comHorario = leituras.filter(leitura => leitura.momento && leitura.usuario !== 'Usuário não informado')
  const diaAuditoria = extrairDataISOPlanilha(dataAuditoria)
  const historico = prepararHistorico(opcoes.historico, diaAuditoria, opcoes.tipoAuditoria)
  const porUsuario = new Map()
  for (const leitura of comHorario) {
    if (!porUsuario.has(leitura.usuario)) porUsuario.set(leitura.usuario, [])
    porUsuario.get(leitura.usuario).push(leitura)
  }

  for (const [usuario, lista] of porUsuario) {
    lista.sort((a, b) => a.momento.instante - b.momento.instante)
    const locaisRapidos = maiorJanela(lista, 2, 5, janela =>
      new Set(janela.map(item => item.local).filter(local => local !== 'Local não informado')).size >= 5)
    const locais = locaisRapidos || maiorJanela(lista, 10, 8, janela =>
      new Set(janela.map(item => item.local).filter(local => local !== 'Local não informado')).size >= 3)
    if (locais) sinais.push(criarSinal({
      tipo: 'locais', usuario, titulo: locaisRapidos ? 'Cinco locais em dois minutos' : 'Leituras próximas em locais distintos',
      resumo: `${locais.length} leituras em ${new Set(locais.map(item => item.local)).size} locais; confira o percurso registrado.`,
      criterio: locaisRapidos ? 'Pelo menos 5 locais distintos em até 2 minutos.' : 'Pelo menos 8 leituras em 3 locais distintos dentro de 10 minutos.',
      leituras: locais, inicio: locais[0].momento.instante, fim: locais.at(-1).momento.instante
    }))

    const ritmo = maiorJanela(lista, 1, 40, janela =>
      new Set(janela.map(item => item.codigo).filter(codigo => codigo !== 'Sem código')).size >= 40)
    if (ritmo) sinais.push(criarSinal({
      tipo: 'ritmo', usuario, titulo: 'Volume concentrado em um minuto',
      resumo: `${ritmo.length} leituras de códigos distintos em até 1 minuto; confira os horários originais.`,
      criterio: 'Pelo menos 40 códigos distintos em até 60 segundos.',
      leituras: ritmo, inicio: ritmo[0].momento.instante, fim: ritmo.at(-1).momento.instante
    }))
  }

  // Compara blocos contíguos da equipe. Uma queda não é tratada como parada:
  // os totais anteriores e posteriores ficam visíveis no próprio sinal.
  if (diaAuditoria) {
    const inicioDia = Date.parse(`${diaAuditoria}T00:00:00Z`)
    const blocos = new Map()
    for (const leitura of comHorario.filter(item => item.momento.data === diaAuditoria)) {
      const bloco = Math.floor((leitura.momento.instante - inicioDia) / 1800000)
      if (bloco < 0 || bloco > 47) continue
      if (!blocos.has(bloco)) blocos.set(bloco, [])
      blocos.get(bloco).push(leitura)
    }
    for (let bloco = 1; bloco < 48; bloco++) {
      const antes = blocos.get(bloco - 1) || []
      const depois = blocos.get(bloco) || []
      if (antes.length < 15 || depois.length < 100 || depois.length < antes.length * 5) continue
      const usuarios = new Map()
      for (const leitura of depois) {
        if (!usuarios.has(leitura.usuario)) usuarios.set(leitura.usuario, [])
        usuarios.get(leitura.usuario).push(leitura)
      }
      for (const [usuario, registros] of usuarios) {
        const antesUsuario = antes.filter(item => item.usuario === usuario).length
        const classes = new Set(registros.map(item => item.classe).filter(Boolean)).size
        const codigos = new Set(registros.map(item => item.codigo).filter(codigo => codigo !== 'Sem código')).size
        if (antesUsuario < 5 || registros.length < 80 || registros.length < antesUsuario * 4 ||
            registros.length / depois.length < 0.5 || codigos < 80 || classes < 12) continue
        registros.sort((a, b) => a.momento.instante - b.momento.instante)
        const horaAnterior = new Date(inicioDia + (bloco - 1) * 1800000).toISOString().slice(11, 16)
        const horaAtual = new Date(inicioDia + bloco * 1800000).toISOString().slice(11, 16)
        const { contexto, referencias } = contextoHistorico(registros, usuario, historico)
        sinais.push(criarSinal({
          tipo: 'retomada', usuario, titulo: 'Retomada concentrada após queda de atividade',
          resumo: `Este usuário respondeu por ${(registros.length / depois.length * 100).toFixed(1)}% das leituras do bloco seguinte, em ${classes} classes de produto e ${new Set(registros.map(item => item.local)).size} locais. Confira o fluxo e a disposição física dos produtos.`,
          criterio: 'Blocos consecutivos de 30 min: equipe ≥5 vezes, usuário ≥4 vezes, participação ≥50%, ≥80 códigos distintos e ≥12 classes de produto.',
          leituras: registros, inicio: registros[0].momento.instante, fim: registros.at(-1).momento.instante,
          contextoHistorico: contexto, referencias, itensHistoricos: historico.itens,
          comparacao: [
            { periodo: `${horaAnterior}–${new Date(inicioDia + bloco * 1800000 - 1000).toISOString().slice(11, 16)}`, equipe: antes.length, usuario: antesUsuario },
            { periodo: `${horaAtual}–${new Date(inicioDia + (bloco + 1) * 1800000 - 1000).toISOString().slice(11, 16)}`, equipe: depois.length, usuario: registros.length }
          ]
        }))
      }
    }
  }

  for (const [usuario, lista] of porUsuario) {
    const referencias = historico.usuarios.get(chaveUsuario(usuario)) || []
    if (referencias.length < 2 || sinais.some(s => s.tipo === 'retomada' && chaveUsuario(s.usuario) === chaveUsuario(usuario))) continue
    const doDia = lista.filter(item => item.momento.data === diaAuditoria)
    const janela = maiorJanela(doDia, 30, 1)
    if (!janela) continue
    const classes = new Set(janela.map(item => item.classe).filter(Boolean)).size
    const maiorAnterior = Math.max(...referencias.map(r => r.maximo30))
    const classesAnteriores = Math.max(...referencias.map(r => r.classes30))
    const volumeFora = maiorAnterior > 0 && janela.length >= 80 && janela.length >= maiorAnterior * 2
    const variedadeFora = classesAnteriores > 0 && classes >= 20 && classes >= classesAnteriores * 2
    if (!volumeFora && !variedadeFora) continue
    const { contexto } = contextoHistorico(janela, usuario, historico)
    sinais.push(criarSinal({
      tipo: 'historico', usuario, titulo: 'Pico acima do histórico do usuário',
      resumo: `${janela.length} leituras e ${classes} classes de produto em até 30 minutos; nas ${referencias.length} auditorias anteriores comparáveis, os máximos foram ${maiorAnterior} leituras e ${classesAnteriores} classes.`,
      criterio: 'Pelo menos 2 auditorias anteriores; ≥80 leituras e 2 vezes o maior volume anterior, ou ≥20 classes e 2 vezes a maior variedade anterior.',
      leituras: janela, inicio: janela[0].momento.instante, fim: janela.at(-1).momento.instante,
      contextoHistorico: contexto, referencias, itensHistoricos: historico.itens
    }))
  }

  const usuariosComLeitura = new Map()
  for (const leitura of leituras.filter(item => item.usuario !== 'Usuário não informado')) {
    if (!usuariosComLeitura.has(leitura.usuario)) usuariosComLeitura.set(leitura.usuario, [])
    usuariosComLeitura.get(leitura.usuario).push(leitura)
  }
  const excecao = leitura => /^(lido sem estoque|lido n[aã]o pertence)$/i.test(leitura.situacao)
  const taxaGeralExcecao = leituras.length ? leituras.filter(excecao).length / leituras.length : 0
  for (const [usuario, lista] of usuariosComLeitura) {
    const excepcionais = lista.filter(excecao)
    const taxa = excepcionais.length / lista.length
    if (excepcionais.length >= 15 && taxa >= 0.15 && taxa >= taxaGeralExcecao * 1.5) {
      sinais.push(criarSinal({
        tipo: 'excecoes', usuario, titulo: 'Concentração de leituras com exceção',
        resumo: `${excepcionais.length} de ${lista.length} leituras deste usuário (${(taxa * 100).toFixed(1)}%) são “Lido sem estoque” ou “Lido não pertence”; no relatório completo, a proporção é ${(taxaGeralExcecao * 100).toFixed(1)}%.`,
        criterio: 'Pelo menos 15 leituras com exceção, 15% das leituras do usuário e 1,5 vez a proporção geral.',
        leituras: excepcionais
      }))
    }
  }

  if (comHorario.length) {
    const ultimo = comHorario.reduce((maior, leitura) => Math.max(maior, leitura.momento.instante), 0)
    const recentes = comHorario.filter(leitura => leitura.momento.instante > ultimo - 2 * 3600000)
    const anteriores = comHorario.filter(leitura => leitura.momento.instante > ultimo - 4 * 3600000 && leitura.momento.instante <= ultimo - 2 * 3600000)
    if (recentes.length >= 15 && anteriores.length >= 10) {
      for (const [usuario] of porUsuario) {
        const atuais = recentes.filter(leitura => leitura.usuario === usuario)
        const previas = anteriores.filter(leitura => leitura.usuario === usuario)
        if (atuais.length >= 15 && atuais.length / recentes.length >= 0.8 &&
            previas.length / anteriores.length <= 0.5 && atuais.length >= previas.length * 3) {
          sinais.push(criarSinal({
            tipo: 'concentracao', usuario, titulo: 'Mudança de participação nas horas finais',
            resumo: `${atuais.length} de ${recentes.length} leituras nas 2 horas finais; nas 2 horas anteriores foram ${previas.length} de ${anteriores.length}.`,
            criterio: 'Mínimo de 15 leituras, participação de 80% nas 2h finais, até 50% nas 2h anteriores e volume triplicado.',
            leituras: atuais, inicio: ultimo - 2 * 3600000, fim: ultimo
          }))
        }
      }
    }
  }

  const foraDoDia = comHorario.filter(leitura => diaAuditoria && leitura.momento.data !== diaAuditoria)
  if (foraDoDia.length) sinais.push(criarSinal({
    tipo: 'data', titulo: 'Leituras fora da data da auditoria',
    resumo: `${foraDoDia.length} leituras trazem uma data diferente de ${diaAuditoria} no relatório. Confira a origem e a importação.`,
    criterio: 'Data registrada na linha diferente da data cadastrada para a auditoria.',
    leituras: foraDoDia
  }))

  const estoqueBaixo = leituras.filter(leitura => {
    const item = registro(leitura)
    return item.estoque !== null && item.estoque >= 0 && item.estoque <= 2 &&
      item.diasSemVenda !== null && item.diasSemVenda >= 30
  })
  if (estoqueBaixo.length) sinais.push(criarSinal({
    tipo: 'estoque', titulo: 'Baixo estoque sem venda recente',
    resumo: `${estoqueBaixo.length} itens lidos com estoque de até 2 unidades e 30 dias ou mais sem venda. Confira o estoque físico e o histórico.`,
    criterio: 'Leitura registrada, estoque de 0 a 2 e ao menos 30 dias sem venda.',
    leituras: estoqueBaixo
  }))

  const ordem = { retomada: 0, historico: 1, ritmo: 2, locais: 3, excecoes: 4, data: 5, concentracao: 6, estoque: 7 }
  sinais.sort((a, b) => (ordem[a.tipo] ?? 99) - (ordem[b.tipo] ?? 99) || b.quantidade - a.quantidade)

  return {
    sinais,
    totalLeituras: leituras.length,
    leiturasComHorario: comHorario.length,
    leiturasSemHorario: leituras.length - comHorario.length,
    auditoriasHistoricas: historico.anteriores.length,
    base: 'Registros importados e preservados após o tratamento da planilha.'
  }
}
