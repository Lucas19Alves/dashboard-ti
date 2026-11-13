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

  it('mescla importações: mantém status, resolve quem saiu, reabre quem voltou', () => {
    const d1 = mesclarImportacao([], [{ codigo: 'A' }, { codigo: 'B' }], '2026-11-01')
    d1[0].status = 'vinculado'
    d1[0].localEscolhido = 'G01A'
    const d2 = mesclarImportacao(d1, [{ codigo: 'A' }], '2026-11-02')
    expect(d2.find(i => i.codigo === 'A')).toMatchObject({ status: 'vinculado', localEscolhido: 'G01A', vezes: 2, primeiroVisto: '2026-11-01' })
    expect(d2.find(i => i.codigo === 'B')).toMatchObject({ status: 'resolvido', resolvidoEm: '2026-11-02' })
    const d3 = mesclarImportacao(d2, [{ codigo: 'B' }], '2026-11-03')
    expect(d3.find(i => i.codigo === 'B')).toMatchObject({ status: 'pendente', primeiroVisto: '2026-11-03' })
  })

  it('aponta vínculos suspeitos por leitura em outro local e por setor', () => {
    const muitos = Array.from({ length: 12 }, (_, i) => it_(`M${i}`, 'G05A'))
    const fora = it_('L', 'G05A', { 'Classe de Produto Raiz': '40 - LIMPEZA' })
    const lista = vinculosSuspeitos([...auditorias, { id: 3, data: '2026-10-15', tipo: 'Presença', dados: [...muitos, fora] }])
    expect(lista.find(l => l.tipo === 'achado')).toMatchObject({ codigo: 'X', local: 'G03A', vezes: 2 })
    expect(lista.find(l => l.tipo === 'setor')).toMatchObject({ codigo: 'L', local: 'G05A' })
  })
})
