import { describe, expect, it } from 'vitest'
import { agruparProblemas, estoqueParado, indexarEstoque, reincidencias, semEstoqueNoSistema } from './estoque'

// Item já normalizado como sai do processamento da Presença.
const item = (codigo, { local = 'G01A', lido = false, estoque = 10, dsv = 5, naoPertence = false, custo = '2,00' } = {}) => ({
  'Código': codigo, Produto: `P${codigo}`, Local: `${local} - ${local}`, 'Classe de Produto Raiz': '35 - MERCEARIA', Fornecedor: 'F1',
  'Dias sem venda': dsv, 'Custo Ruptura': custo,
  _temPresenca: lido, _estoque: estoque, _temEstoqueSituacao: estoque > 0, _lidoNaoPertence: naoPertence
})
const aud = (id, data, tipo, dados) => ({ id, data, tipo, dados })

describe('estoque: reincidências', () => {
  const auditorias = [
    aud(1, '2026-10-06', 'Presença', [item('A', { lido: true }), item('B'), item('C', { lido: true }), item('D', { lido: true })]),
    aud(2, '2026-10-13', 'Presença', [item('A'), item('B'), item('C', { lido: true }), item('D')]),
    aud(3, '2026-10-14', 'Ruptura', [item('A'), item('B'), item('D'), item('D', { local: 'G09B', naoPertence: true })]),
    aud(4, '2026-10-20', 'Presença', [item('A'), item('B', { dsv: 60 }), item('C'), item('D'), item('D', { local: 'G09B', naoPertence: true })]),
    aud(5, '2026-10-21', 'Etiqueta', [item('C')])
  ]
  const indice = indexarEstoque(auditorias)

  it('conta só Presença e Ruptura e acha os itens com 14+ dias sem leitura', () => {
    const linhas = reincidencias(indice)
    expect(linhas.map(l => l.codigo).sort()).toEqual(['A', 'B', 'D'])
    const a = linhas.find(l => l.codigo === 'A')
    expect(a).toMatchObject({ dias: 14, desde: '2026-10-06', auditoriasSemLeitura: 3, nuncaLido: false })
    // Valor do estoque não achado na última auditoria (não soma as semanas).
    expect(a.valorEmFalta).toBe(2)
  })

  it('valor em falta é o da última auditoria e zera quando o item é lido', () => {
    const indice2 = indexarEstoque([
      aud(1, '2026-10-06', 'Presença', [item('X')]),
      aud(2, '2026-10-13', 'Presença', [item('X', { lido: true }), item('Y', { lido: true })]),
      aud(3, '2026-10-14', 'Ruptura', [item('Y')]),
      aud(4, '2026-10-20', 'Presença', [item('X'), item('Y')]),
      aud(5, '2026-10-27', 'Presença', [item('X', { custo: '7,50' }), item('Y', { lido: true })])
    ])
    expect(indice2.itens.get('X').valorEmFalta).toBe(7.5)
    expect(indice2.itens.get('Y').valorEmFalta).toBe(0)
  })

  it('nunca lido e sem venda vira provável estoque inexistente; lido em outro local aponta o local', () => {
    const linhas = reincidencias(indice)
    expect(linhas.find(l => l.codigo === 'B')).toMatchObject({ nuncaLido: true, dias: 14 })
    expect(linhas.find(l => l.codigo === 'B').diagnostico).toMatch(/estoque que não existe/)
    expect(linhas.find(l => l.codigo === 'D')).toMatchObject({ achadoEm: 'G09B' })
  })

  it('respeita o limiar e ignora quem saiu do ciclo atual', () => {
    expect(reincidencias(indice, { limiar: 21 })).toEqual([])
    const comSaida = indexarEstoque([...auditorias, aud(6, '2026-10-27', 'Presença', [item('B')])])
    expect(reincidencias(comSaida).map(l => l.codigo)).toEqual(['B'])
  })
})

describe('estoque: sem estoque no sistema e parado', () => {
  const auditorias = [
    aud(1, '2026-10-06', 'Presença', [item('Z', { lido: true, estoque: 0 }), item('P', { lido: true, dsv: 40, estoque: 80 })]),
    aud(2, '2026-10-13', 'Presença', [item('Z', { lido: true, estoque: 0 }), item('P', { lido: true, dsv: 47, estoque: 80 }), item('Q', { lido: true, dsv: 10 })])
  ]
  const indice = indexarEstoque(auditorias)

  it('lido com estoque zerado conta as auditorias seguidas', () => {
    expect(semEstoqueNoSistema(indice)).toEqual([expect.objectContaining({ codigo: 'Z', vezes: 2, desde: '2026-10-06' })])
  })

  it('parado cruza com a validade', () => {
    const [p] = estoqueParado(indice, [{ _codigo: 'P', _validadeISO: '2026-10-20', _diasParaVencer: 7 }])
    expect(p).toMatchObject({ codigo: 'P', dias: 47, venceEm: 7 })
    expect(p.diagnostico).toMatch(/Vence em 7/)
    expect(estoqueParado(indice, [], { limiar: 60 })).toEqual([])
  })
})

describe('estoque: agrupamento', () => {
  it('agrupa problemas por local', () => {
    const grupos = agruparProblemas({
      reincidentes: [{ local: 'G01A', valorEmFalta: 5 }, { local: 'G01A', valorEmFalta: 1 }],
      semEstoque: [{ local: 'G02B' }],
      naoVinculados: [{ sugestao: { local: 'G02B' } }],
      suspeitos: [{ vinculadoEm: 'G01A' }]
    }, 'local')
    expect(grupos[0]).toMatchObject({ chave: 'G01A', reincidentes: 2, suspeitos: 1, total: 3, custo: 6 })
    expect(grupos[1]).toMatchObject({ chave: 'G02B', semEstoque: 1, naoVinculados: 1 })
  })
})
