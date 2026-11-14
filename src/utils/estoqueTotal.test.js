import { describe, expect, it } from 'vitest'
import { cruzarEstoqueTotal, faltandoColunas, formatarQuantidade, lerQuantidade, mapaEstoqueTotal, nuncaLidosNaPlanilha, semCodigo, tratarEstoqueTotal } from './estoqueTotal'
import { estoqueParado, indexarEstoque, reincidencias, semEstoqueNoSistema, validadePorCodigo } from './estoque'

// Item de auditoria (Presença/Ruptura) no formato já processado pelo sistema.
const item = (codigo, local, { lido = false, estoque = 10, dias = 1 } = {}) => ({
  'Código': codigo, Produto: `P${codigo}`, Local: `${local} - ${local}`, 'Classe de Produto Raiz': 'MERCEARIA DOCE', 'Classe de Produto': 'LEITE',
  Fornecedor: 'NESTLE', 'Dias sem venda': dias, _estoque: estoque, _temPresenca: lido, _temEstoqueSituacao: estoque > 0
})
const aud = (id, data, tipo, dados) => ({ id, data, tipo, dados })
// Linha da planilha de estoque total, como vem do ERP.
const linha = (codigo, extra = {}) => ({
  'Código': codigo, Nome: `P${codigo}`, Estoque: 10, 'Dias sem venda': 1, 'Última venda': new Date('2026-11-13T00:00:00Z'),
  'Classe de Produto': '35.6 - LEITE', 'Classe de Produto Raiz': '35 - MERCEARIA DOCE', Fornecedor: '702 - NESTLE', Gerenciado: 'Sim', ...extra
})

describe('leitura da planilha de estoque total', () => {
  it('lê estoque em kg, tira o código de setor/fornecedor e ignora códigos repetidos', () => {
    expect(lerQuantidade('26,694 KG')).toEqual({ valor: 26.694, unidade: 'KG' })
    expect(lerQuantidade('1.234,5 KG')).toEqual({ valor: 1234.5, unidade: 'KG' })
    expect(lerQuantidade(150)).toEqual({ valor: 150, unidade: '' })
    expect(semCodigo('35.3.10.7 - ABACAXI EM CALDA')).toBe('ABACAXI EM CALDA')
    expect(semCodigo('24768 - BENASSI SAO PAULO')).toBe('BENASSI SAO PAULO')
    const [a, b] = tratarEstoqueTotal([linha('1', { Estoque: '26,694 KG', Gerenciado: 'Não' }), linha('2'), linha('1'), { Nome: 'sem código' }])
    expect(a).toMatchObject({ codigo: '1', estoque: 26.694, unidade: 'KG', setor: 'MERCEARIA DOCE', fornecedor: 'NESTLE', classe: 'LEITE', ultimaVenda: '2026-11-13', gerenciado: false })
    expect(b.codigo).toBe('2')
    expect(formatarQuantidade(26.694, 'KG')).toBe('26,694 kg')
  })

  it('exige Código, Nome e Estoque', () => {
    expect(faltandoColunas(['Código', 'Nome', 'Estoque', 'Setor'])).toEqual([])
    expect(faltandoColunas(['Código', 'Produto'])).toEqual(['Nome', 'Estoque'])
  })
})

describe('cruzamento com as auditorias', () => {
  // A: lido; B: não lido há 3 semanas; Z: lido com estoque zerado; S: só na Presença antiga (saiu);
  // N: nunca auditado, comprado antes (nunca lido); V: nunca auditado e na lista de não vinculados;
  // C: nunca auditado, comprado depois da última Presença (aguardando); P: insumo (setor OUTROS).
  const auditorias = [
    aud(1, '2026-10-20', 'Presença', [item('A', 'G01', { lido: true }), item('B', 'G02', { lido: true }), item('S', 'G03', { lido: true }), item('Z', 'G04', { lido: true, estoque: 0 })]),
    aud(2, '2026-11-10', 'Presença', [item('A', 'G01', { lido: true }), item('B', 'G02'), item('Z', 'G04', { lido: true, estoque: 0 }), item('Y', 'G05', { lido: true, estoque: 0 })])
  ]
  const indice = indexarEstoque(auditorias)
  const total = mapaEstoqueTotal(tratarEstoqueTotal([
    linha('A', { 'Dias sem venda': 45 }), linha('B', { Estoque: 7, 'Dias sem venda': 3 }), linha('S'), linha('N', { 'Dias sem venda': 60 }), linha('Y', { Estoque: 5 }),
    linha('P', { 'Classe de Produto Raiz': '19 - OUTROS', 'Dias sem venda': 90 }),
    linha('V'), linha('C', { 'Última Compra': new Date('2026-11-12T00:00:00Z') }), linha('N2', { 'Última Compra': new Date('2026-11-01T00:00:00Z') })
  ]))
  const naoVinculados = [{ codigo: 'V', status: 'pendente', sugestao: { local: '' } }]

  it('reincidência usa o estoque da planilha, some quando o item zerou e inclui quem saiu da auditoria', () => {
    const linhas = reincidencias(indice, { total })
    expect(linhas.map(l => l.codigo).sort()).toEqual(['B', 'S'])
    expect(linhas.find(l => l.codigo === 'B')).toMatchObject({ estoque: 7, diasSemVenda: 3, local: 'G02' })
    expect(linhas.find(l => l.codigo === 'B').saiuDaAuditoria).toBeUndefined()
    const s = linhas.find(l => l.codigo === 'S')
    expect(s).toMatchObject({ saiuDaAuditoria: true, local: 'G03', dias: 21, ultimaLeitura: '2026-10-20' })
    expect(s.diagnostico).toContain('saiu da auditoria')
    // Quem saiu entra mesmo abaixo do limiar: fora da auditoria ninguém mais confere.
    expect(reincidencias(indice, { total, limiar: 60 }).map(l => l.codigo)).toEqual(['S'])
    expect(reincidencias(indice, { total: mapaEstoqueTotal(tratarEstoqueTotal([linha('A')])) })).toEqual([])
  })

  it('estoque zerado sai da lista quando a planilha já mostra estoque', () => {
    expect(semEstoqueNoSistema(indice).map(l => l.codigo).sort()).toEqual(['Y', 'Z'])
    expect(semEstoqueNoSistema(indice, { total }).map(l => l.codigo)).toEqual(['Z'])
  })

  it('parados entram pela planilha, também os nunca auditados; insumos ficam de fora', () => {
    const parados = estoqueParado(indice, [], { total })
    expect(parados.map(l => l.codigo).sort()).toEqual(['A', 'N'])
    expect(parados.find(l => l.codigo === 'N')).toMatchObject({ nuncaAuditado: true, local: '', setor: 'MERCEARIA DOCE' })
    expect(parados.find(l => l.codigo === 'A')).toMatchObject({ nuncaAuditado: false, saiu: false, local: 'G01', dias: 45 })
  })

  it('nunca lidos: comprados antes da última Presença; fora os não vinculados, os que chegaram depois e os insumos', () => {
    const lista = nuncaLidosNaPlanilha({ total, indice, naoVinculados })
    expect(lista.map(l => l.codigo).sort()).toEqual(['N', 'N2'])
    expect(lista[0]).toMatchObject({ tipo: 'nuncaLido', local: '' })
    expect(lista[0].diagnostico).toContain('nunca foi lido')
  })

  it('lista completa traz situação, local e validade de cada item', () => {
    const validades = validadePorCodigo([{ _codigo: 'A', _validadeISO: '2026-11-20', _diasParaVencer: 6 }])
    const linhas = new Map(cruzarEstoqueTotal({ total, indice, validades, naoVinculados }).map(l => [l.codigo, l]))
    expect(linhas.get('A')).toMatchObject({ situacao: 'lido', local: 'G01', validade: '2026-11-20', venceEm: 6 })
    expect(linhas.get('B').situacao).toBe('pendente')
    expect(linhas.get('S').situacao).toBe('saiu')
    expect(linhas.get('N').situacao).toBe('nuncaLido')
    expect(linhas.get('V').situacao).toBe('naoVinculado')
    expect(linhas.get('C').situacao).toBe('aguardando')
    expect(linhas.get('P').situacao).toBe('insumo')
  })
})
