import { describe, expect, it } from 'vitest'
import { dataDaPlanilha, fotoDoEstoque, giroDosItens, projetar, resumoDaFoto, serieDoHistorico, vendaEstimada } from './historicoEstoque'

const foto = (data, itens) => ({ id: data, data, itens })

describe('histórico do estoque', () => {
  it('data da foto é a última venda da planilha', () => {
    expect(dataDaPlanilha([{ ultimaVenda: '2026-11-10' }, { ultimaVenda: '2026-11-13' }], '2026-11-14T07:51:00Z')).toBe('2026-11-13')
    expect(dataDaPlanilha([], '2026-11-14T07:51:00Z')).toBe('2026-11-14')
    const f = fotoDoEstoque([{ codigo: '1', estoque: 5, diasSemVenda: 2, ultimaCompra: '2026-11-01', setor: 'X', ultimaVenda: '2026-11-12' }], { importadoEm: '2026-11-13T08:00:00Z', arquivo: 'a.xlsx' })
    expect(f.meta.id).toBe('2026-11-12')
    expect(f.itens.itens[0]).toEqual({ c: '1', e: 5, d: 2, u: '2026-11-01', s: 'X' })
  })

  it('resumo conta parados e valor estimado, sem insumos', () => {
    const custos = new Map([['1', 2], ['2', 10]])
    const r = resumoDaFoto([
      { c: '1', e: 10, d: 40, s: 'MERCEARIA' },
      { c: '2', e: 1, d: 1, s: 'MERCEARIA' },
      { c: '3', e: 0, d: 50, s: 'MERCEARIA' },
      { c: '4', e: 99, d: 99, s: 'OUTROS' }
    ], { custos, limiarParado: 30 })
    expect(r).toMatchObject({ itens: 3, comEstoque: 2, parados: 1, valor: 30, valorParado: 20 })
  })

  it('projeta pela tendência das fotos', () => {
    const serie = serieDoHistorico([
      foto('2026-11-01', [{ c: '1', e: 1, d: 40, s: 'A' }]),
      foto('2026-11-08', [{ c: '1', e: 1, d: 40, s: 'A' }, { c: '2', e: 1, d: 40, s: 'A' }]),
      foto('2026-11-15', [{ c: '1', e: 1, d: 40, s: 'A' }, { c: '2', e: 1, d: 40, s: 'A' }, { c: '3', e: 1, d: 40, s: 'A' }])
    ])
    const p = projetar(serie, 'parados')
    expect(p.porSemana).toBeCloseTo(1)
    expect(p.final).toBeCloseTo(7)
    expect(p.dataFinal).toBe('2026-12-13')
    expect(projetar(serie.slice(0, 2), 'parados')).toBeNull()
  })

  it('estima a venda pela queda do estoque sem compra no meio', () => {
    const fotos = [
      foto('2026-11-01', [{ c: '1', e: 100, u: '2026-10-01' }, { c: '2', e: 10, u: '2026-10-01' }]),
      foto('2026-11-08', [{ c: '1', e: 86, u: '2026-10-01' }, { c: '2', e: 50, u: '2026-11-05' }]),
      foto('2026-11-15', [{ c: '1', e: 72, u: '2026-10-01' }, { c: '2', e: 50, u: '2026-11-05' }])
    ]
    const v = vendaEstimada(fotos)
    expect(v.get('1')).toMatchObject({ venda: 2, dias: 14 })
    // o item 2 teve compra no primeiro intervalo; no segundo não vendeu
    expect(v.get('2')).toMatchObject({ venda: 0, dias: 7 })
    const total = new Map([
      ['1', { codigo: '1', estoque: 72, setor: 'A' }],
      ['2', { codigo: '2', estoque: 50, setor: 'A' }]
    ])
    const giro = giroDosItens({ total, fotos, dataBase: '2026-11-15' })
    expect(giro[0]).toMatchObject({ codigo: '1', cobertura: 36, zeraEm: '2026-12-21', situacao: '30 a 90 dias' })
    expect(giro[1]).toMatchObject({ codigo: '2', semGiro: true, situacao: 'Sem giro' })
  })
})
