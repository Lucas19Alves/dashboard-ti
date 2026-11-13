import { describe, expect, it } from 'vitest'
import { mesclarImportacao, tratarPlanilha, vinculosSuspeitos } from './naoVinculados'

const it_ = (codigo, local, extra = {}) => ({ 'Código': codigo, Produto: `P${codigo}`, Local: `${local} - ${local}`, 'Classe de Produto Raiz': '35 - MERCEARIA DOCE', 'Classe de Produto': '35.6 - LEITE', ...extra })
const auditorias = [
  { id: 1, data: '2026-10-01', tipo: 'Presença', dados: [it_('A', 'G01A'), it_('B', 'G02B'), it_('X', 'G03A', { _lidoNaoPertence: true }), it_('C', 'G01A')] },
  { id: 2, data: '2026-10-08', tipo: 'Presença', dados: [it_('X', 'G03A', { _lidoNaoPertence: true }), it_('C', 'G01A')] }
]
const linha = (codigo, extra = {}) => ({ 'Código': codigo, Nome: `N${codigo}`, Estoque: 10, 'Dias sem venda': 1, 'Classe de Produto': '35.6 - LEITE', 'Classe de Produto Raiz': '35 - MERCEARIA DOCE', ...extra })

describe('não vinculados', () => {
  it('sugere local: achado > vinculado antes > classe > nenhum', () => {
    const [x, b, n, z] = tratarPlanilha([linha('X'), linha('B'), linha('N'), linha('Z', { 'Classe de Produto': '99 - OUTRA' }), linha('X')], auditorias)
    expect(x.sugestao).toMatchObject({ local: 'G03A', confianca: 'alta' })
    expect(b.sugestao).toMatchObject({ local: 'G02B', confianca: 'alta' })
    expect(n.sugestao.local).toBe('G01A')
    expect(z.sugestao.confianca).toBe('nenhuma')
    expect(x.prioridade).toBe('alta')
  })

  it('mescla importações: mantém quem segue, resolve quem saiu, reabre quem voltou', () => {
    const d1 = mesclarImportacao([], [{ codigo: 'A' }, { codigo: 'B' }], '2026-11-01')
    const d2 = mesclarImportacao(d1, [{ codigo: 'A' }], '2026-11-02')
    expect(d2.find(i => i.codigo === 'A')).toMatchObject({ status: 'pendente', vezes: 2, primeiroVisto: '2026-11-01' })
    expect(d2.find(i => i.codigo === 'B')).toMatchObject({ status: 'resolvido', resolvidoEm: '2026-11-02' })
    const d3 = mesclarImportacao(d2, [{ codigo: 'B' }], '2026-11-03')
    expect(d3.find(i => i.codigo === 'B')).toMatchObject({ status: 'pendente', primeiroVisto: '2026-11-03' })
  })

  it('aponta vínculo suspeito só com local vinculado diferente e sem correção depois', () => {
    const aud = (id, data, dados) => ({ id, data, tipo: 'Presença', dados })
    const lido = (c, l) => it_(c, l, { _temPresenca: true })
    const fora = (c, l) => it_(c, l, { _lidoNaoPertence: true })
    const lista = vinculosSuspeitos([
      aud(1, '2026-10-01', [lido('Y', 'G09C'), fora('Y', 'G03A'), lido('S', 'G04A'), fora('S', 'G04A'), fora('N', 'G08D'), it_('R', 'G01A'), fora('R', 'G02A')]),
      aud(2, '2026-10-08', [it_('Y', 'G09C'), fora('Y', 'G03A'), fora('S', 'G04A'), fora('N', 'G08D'), fora('R', 'G02A')]),
      aud(3, '2026-10-15', [lido('R', 'G01A')])
    ])
    // Y: vinculado G09C, lido em G03A 2x, nunca mais lido no G09C → suspeito.
    // S: lido no próprio local vinculado; N: sem local vinculado conhecido; R: lido no vinculado depois.
    expect(lista.map(l => l.codigo)).toEqual(['Y'])
    expect(lista[0]).toMatchObject({ local: 'G03A', vinculadoEm: 'G09C', vezes: 2 })
  })
})
