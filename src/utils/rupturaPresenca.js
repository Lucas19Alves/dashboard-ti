// Ruptura é a continuação da Presença do dia anterior: a planilha de ruptura traz só os itens que
// ficaram pendentes (sem local), então o % por setor parte do resultado final da Presença e desconta
// a evolução — pendentes que foram lidos ou saíram da lista deixam de ser pendentes.
// O % geral da ruptura (sobre o SKU) não muda.

export const VERSAO_RUPTURA_PRESENCA = 1
const DIAS_MAX_ANTES = 6 // presença da mesma semana

const codigo = item => String(item?.['Código'] ?? '').trim()
const setorDe = item => (item?.['Classe de Produto Raiz'] || item?.['Setor'] || 'Não especificado').toString().trim()
const dataISO = valor => String(valor ?? '').slice(0, 10)
const diasEntre = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000)

// Mesma classificação da análise de presença, a partir dos campos normalizados do item.
export const statusItem = (item) => {
  const temPresenca = Boolean(item?._temPresenca)
  const estoqueSituacao = item?._temEstoqueSituacao
  const temEstoque = estoqueSituacao !== null && estoqueSituacao !== undefined ? Boolean(estoqueSituacao) : (Number(item?._estoque) || 0) > 0
  if ((temPresenca && !temEstoque) || item?._lidoNaoPertence) return 'comProblema'
  if (temPresenca) return 'lidos'
  return temEstoque ? 'pendentes' : null
}

// Presença mais recente antes da ruptura (na mesma semana) que tenha os itens salvos.
export const presencaBaseDaRuptura = (dataRuptura, auditorias = []) => {
  const dia = dataISO(dataRuptura)
  if (!dia) return null
  return auditorias
    .filter(a => a?.tipo === 'Presença' && Array.isArray(a.dados) && a.dados.length)
    .filter(a => {
      const d = dataISO(a.data)
      return d < dia && diasEntre(d, dia) <= DIAS_MAX_ANTES
    })
    .sort((a, b) => dataISO(b.data).localeCompare(dataISO(a.data)) || (b.id || 0) - (a.id || 0))[0] || null
}

// Itens da ruptura sem local recebem o local em que estavam na presença.
export const completarLocaisPelaPresenca = (dadosRuptura = [], dadosPresenca = []) => {
  const locais = new Map()
  for (const item of dadosPresenca) {
    const local = (item?.['Local'] || '').toString().trim()
    if (local && !locais.has(codigo(item))) locais.set(codigo(item), local)
  }
  return dadosRuptura.map(item => {
    if ((item?.['Local'] || '').toString().trim()) return item
    const local = locais.get(codigo(item))
    return local ? { ...item, Local: local } : item
  })
}

// Setores da ruptura: situação final da presença + evolução de cada item na ruptura.
// - pendente na presença: continua pendente se ainda está pendente na ruptura; senão foi resolvido (lido)
//   ou passou a ter problema;
// - lido/com problema na presença: só muda se voltou a ficar pendente na ruptura;
// - itens que não estavam na presença entram com a situação da ruptura.
export const setoresPelaPresenca = (dadosRuptura = [], dadosPresenca = []) => {
  const porSetor = {}
  const somar = (setor, campo) => {
    porSetor[setor] ??= { lidos: 0, pendentes: 0, comProblema: 0 }
    porSetor[setor][campo]++
  }
  const ruptura = new Map(dadosRuptura.map(item => [codigo(item), item]))
  const vistos = new Set()
  for (const item of dadosPresenca) {
    const antes = statusItem(item)
    const chave = codigo(item)
    if (!antes || vistos.has(chave)) continue
    vistos.add(chave)
    const agora = ruptura.has(chave) ? statusItem(ruptura.get(chave)) : null
    const final = antes === 'pendentes'
      ? (agora === 'pendentes' || agora === 'comProblema' ? agora : 'lidos')
      : (agora === 'pendentes' ? 'pendentes' : antes)
    somar(setorDe(item), final)
  }
  for (const item of dadosRuptura) {
    if (vistos.has(codigo(item))) continue
    const agora = statusItem(item)
    if (agora) somar(setorDe(item), agora)
  }
  return porSetor
}
