import { extrairDataISOPlanilha } from './auditoriaHorario'

const texto = valor => String(valor ?? '').trim()

const numero = valor => {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null
  const limpo = texto(valor).replace(/^###\s*/, '').replace(/\s*(KG|UN)\s*$/i, '').replace(',', '.')
  const resultado = Number(limpo)
  return limpo && Number.isFinite(resultado) ? resultado : null
}

const horaMinutos = valor => {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) return valor.getUTCHours() * 60 + valor.getUTCMinutes()
  if (typeof valor === 'number') {
    if (valor >= 0 && valor < 1) return Math.floor(valor * 1440)
    if (valor > 100 && valor < 200000 && valor % 1 !== 0) return Math.floor((valor % 1) * 1440)
    if (valor > 1e12) {
      const data = new Date(valor)
      return data.getUTCHours() * 60 + data.getUTCMinutes()
    }
    return null
  }
  const valorTexto = texto(valor)
  const encontrado = valorTexto.match(/(?:^|[T\s])(\d{1,2}):(\d{2})(?::\d{2})?(?:\.|Z|$)/) || valorTexto.match(/^(\d{1,2}):(\d{2})$/)
  if (!encontrado) return null
  const horas = Number(encontrado[1])
  const minutos = Number(encontrado[2])
  return horas < 24 && minutos < 60 ? horas * 60 + minutos : null
}

const momentoLeitura = (item, dataAuditoria) => {
  const chaves = Object.keys(item).filter(chave => /^auditado[ _]em/i.test(chave))
  const valores = [...chaves.map(chave => item[chave]), item['Lido em'], item['Carimbo de data/hora'], item.Hora]
  const data = valores.map(extrairDataISOPlanilha).find(Boolean) || extrairDataISOPlanilha(dataAuditoria)
  const minutos = valores.map(horaMinutos).find(valor => valor !== null)
  if (!data || minutos === undefined) return null
  const instante = Date.parse(`${data}T00:00:00Z`)
  return Number.isFinite(instante) ? instante + minutos * 60000 : null
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

const exemplo = item => ({
  codigo: texto(item['Código'] || item.Codigo) || 'Sem código',
  produto: texto(item.Produto) || 'Produto não informado',
  local: texto(item.Local) || 'Local não informado',
  usuario: texto(item['Usuário']) || 'Usuário não informado'
})

export const analisarSinaisAuditoria = (dados, dataAuditoria) => {
  const leituras = (Array.isArray(dados) ? dados : [])
    .filter(item => item && foiLido(item))
    .map(item => ({ ...exemplo(item), item, instante: momentoLeitura(item, dataAuditoria) }))
  const sinais = []
  const comHorario = leituras.filter(leitura => leitura.instante !== null && leitura.usuario !== 'Usuário não informado')
  const porUsuario = new Map()
  for (const leitura of comHorario) {
    if (!porUsuario.has(leitura.usuario)) porUsuario.set(leitura.usuario, [])
    porUsuario.get(leitura.usuario).push(leitura)
  }

  for (const [usuario, lista] of porUsuario) {
    lista.sort((a, b) => a.instante - b.instante)
    let melhor = null
    const locaisJanela = new Map()
    for (let inicio = 0, fim = 0; inicio < lista.length; inicio++) {
      if (fim < inicio) fim = inicio
      while (fim < lista.length && lista[fim].instante - lista[inicio].instante <= 10 * 60000) {
        const local = lista[fim].local
        if (local !== 'Local não informado') locaisJanela.set(local, (locaisJanela.get(local) || 0) + 1)
        fim++
      }
      if (fim - inicio >= 8 && locaisJanela.size >= 3 && (!melhor || fim - inicio > melhor.quantidade)) {
        melhor = { leituras: lista.slice(inicio, fim), quantidade: fim - inicio, locais: [...locaisJanela.keys()] }
      }
      const local = lista[inicio].local
      if (locaisJanela.has(local)) {
        const restante = locaisJanela.get(local) - 1
        if (restante) locaisJanela.set(local, restante)
        else locaisJanela.delete(local)
      }
    }
    if (melhor) sinais.push({
      tipo: 'locais', usuario,
      titulo: 'Leituras próximas em locais distintos',
      resumo: `${melhor.leituras.length} itens em ${melhor.locais.length} locais em até 10 minutos. Confira o percurso e os horários registrados.`,
      exemplos: melhor.leituras.slice(0, 5).map(({ item }) => exemplo(item)),
      quantidade: melhor.leituras.length
    })
  }

  if (comHorario.length) {
    const ultimo = comHorario.reduce((maior, leitura) => Math.max(maior, leitura.instante), 0)
    const recentes = comHorario.filter(leitura => leitura.instante > ultimo - 2 * 3600000)
    const anteriores = comHorario.filter(leitura => leitura.instante > ultimo - 4 * 3600000 && leitura.instante <= ultimo - 2 * 3600000)
    if (recentes.length >= 15 && anteriores.length >= 10) {
      for (const [usuario] of porUsuario) {
        const atuais = recentes.filter(leitura => leitura.usuario === usuario)
        const previas = anteriores.filter(leitura => leitura.usuario === usuario)
        const participacaoAtual = atuais.length / recentes.length
        const participacaoAnterior = previas.length / anteriores.length
        if (atuais.length >= 15 && participacaoAtual >= 0.8 && participacaoAnterior <= 0.5 && atuais.length >= previas.length * 3) {
          sinais.push({
            tipo: 'concentracao', usuario,
            titulo: 'Concentração nas horas finais',
            resumo: `${atuais.length} de ${recentes.length} leituras nas 2 horas finais dos registros vieram deste usuário; nas 2 horas anteriores foram ${previas.length} de ${anteriores.length}. Confira a distribuição da equipe.`,
            exemplos: atuais.slice(-5).map(({ item }) => exemplo(item)),
            quantidade: atuais.length
          })
        }
      }
    }
  }

  const estoqueBaixo = leituras.filter(({ item }) => {
    const estoque = numero(item._estoque ?? item['Estoque atual'] ?? item['Estoque Atual'])
    const dias = numero(item['Dias sem venda'] ?? item['Dias sem Venda'])
    return estoque !== null && estoque >= 0 && estoque <= 2 && dias !== null && dias >= 30
  })
  if (estoqueBaixo.length) sinais.push({
    tipo: 'estoque',
    titulo: 'Leituras de itens com baixo estoque e sem venda recente',
    resumo: `${estoqueBaixo.length} item(ns) lido(s) com estoque de até 2 unidades e 30 dias ou mais sem venda. Confira o estoque físico e o histórico de vendas.`,
    exemplos: estoqueBaixo.slice(0, 8).map(({ item }) => ({
      ...exemplo(item),
      estoque: numero(item._estoque ?? item['Estoque atual'] ?? item['Estoque Atual']),
      diasSemVenda: numero(item['Dias sem venda'] ?? item['Dias sem Venda'])
    })),
    quantidade: estoqueBaixo.length
  })

  return { sinais, totalLeituras: leituras.length, leiturasComHorario: comHorario.length }
}
