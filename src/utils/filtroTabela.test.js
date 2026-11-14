import { describe, expect, it } from 'vitest'
import { condicaoCompleta, descreverCondicao, diaISO, filtrarItens, inferirTipo, interpretarBusca, numeroDe, opcoesDaColuna, ordenarItens, paginar, paginasVisiveis, testarCondicao } from './filtroTabela'

const hoje = diaISO(new Date())
const dias = n => { const d = new Date(); d.setDate(d.getDate() + n); return diaISO(d) }
const itens = [
  { codigo: '1', produto: 'Café Pilão 500g', setor: 'MERCEARIA', estoque: 10, validade: dias(-2), ativo: true },
  { codigo: '2', produto: 'Cafe Melitta', setor: 'MERCEARIA', estoque: 0, validade: dias(5), ativo: false },
  { codigo: '3', produto: 'Leite Integral', setor: 'LACTEOS', estoque: 120, validade: dias(20), ativo: true },
  { codigo: '4', produto: 'Sabão em pó', setor: 'LIMPEZA', estoque: null, validade: '', ativo: true }
]
const colunas = [
  { chave: 'codigo', titulo: 'Código' },
  { chave: 'produto', titulo: 'Produto', tipo: 'texto' },
  { chave: 'setor', titulo: 'Setor' },
  { chave: 'estoque', titulo: 'Estoque' },
  { chave: 'validade', titulo: 'Validade' },
  { chave: 'ativo', titulo: 'Ativo' }
]
const tipos = Object.fromEntries(colunas.map(c => [c.chave, inferirTipo(c, itens)]))
const filtrar = (estado) => filtrarItens(itens, colunas, estado, { tipos }).map(i => i.codigo)

describe('filtroTabela', () => {
  it('infere o tipo de cada coluna', () => {
    expect(tipos).toMatchObject({ setor: 'categoria', estoque: 'numero', validade: 'data', ativo: 'booleano' })
    expect(inferirTipo({ chave: 'x' }, Array.from({ length: 100 }, (_, i) => ({ x: `Produto ${i}` })))).toBe('texto')
  })

  it('lê números e datas em formatos brasileiros', () => {
    expect(numeroDe('1.234,5')).toBe(1234.5)
    expect(numeroDe('26,694 KG')).toBe(26.694)
    expect(numeroDe('R$ 12,00')).toBe(12)
    expect(numeroDe('')).toBeNull()
    expect(diaISO('13/11/2026')).toBe('2026-11-13')
    expect(diaISO('2026-11-13T00:00:00Z')).toBe('2026-11-13')
  })

  it('busca geral: sem acento, todos os termos, "frase" e -exclusão', () => {
    expect(filtrar({ busca: 'cafe' })).toEqual(['1', '2'])
    expect(filtrar({ busca: 'cafe -melitta' })).toEqual(['1'])
    expect(filtrar({ busca: '"leite integral"' })).toEqual(['3'])
    expect(filtrar({ busca: 'cafe lacteos' })).toEqual([])
    expect(interpretarBusca('a -b "c d"')).toEqual({ incluir: ['a', 'c d'], excluir: ['b'] })
  })

  it('condições por tipo', () => {
    expect(filtrar({ condicoes: [{ chave: 'setor', op: 'em', valor: ['MERCEARIA', 'LIMPEZA'] }] })).toEqual(['1', '2', '4'])
    expect(filtrar({ condicoes: [{ chave: 'setor', op: 'naoEm', valor: ['MERCEARIA'] }] })).toEqual(['3', '4'])
    expect(filtrar({ condicoes: [{ chave: 'estoque', op: 'maior', valor: '5' }] })).toEqual(['1', '3'])
    expect(filtrar({ condicoes: [{ chave: 'estoque', op: 'entre', valor: '0', valor2: '10' }] })).toEqual(['1', '2'])
    expect(filtrar({ condicoes: [{ chave: 'estoque', op: 'vazio' }] })).toEqual(['4'])
    expect(filtrar({ condicoes: [{ chave: 'validade', op: 'passado' }] })).toEqual(['1'])
    expect(filtrar({ condicoes: [{ chave: 'validade', op: 'proximos', valor: '7' }] })).toEqual(['2'])
    expect(filtrar({ condicoes: [{ chave: 'validade', op: 'depois', valor: hoje }] })).toEqual(['2', '3'])
    expect(filtrar({ condicoes: [{ chave: 'ativo', op: 'nao' }] })).toEqual(['2'])
    expect(filtrar({ condicoes: [{ chave: 'produto', op: 'comeca', valor: 'CAFÉ' }] })).toEqual(['1', '2'])
    // Condição incompleta não filtra
    expect(filtrar({ condicoes: [{ chave: 'estoque', op: 'entre', valor: '1' }] })).toHaveLength(4)
    expect(condicaoCompleta({ op: 'em', valor: [] }, 'categoria')).toBe(false)
    expect(testarCondicao('abc', { op: 'naoContem', valor: 'x' }, 'texto')).toBe(true)
  })

  it('várias condições valem juntas e combinam com a busca', () => {
    expect(filtrar({ busca: 'cafe', condicoes: [{ chave: 'estoque', op: 'maior', valor: '0' }] })).toEqual(['1'])
  })

  it('ordena por vários critérios, com vazios sempre no fim', () => {
    const porEstoque = ordenarItens(itens, colunas, [{ chave: 'estoque', direcao: 'desc' }], tipos).map(i => i.codigo)
    expect(porEstoque).toEqual(['3', '1', '2', '4'])
    const asc = ordenarItens(itens, colunas, [{ chave: 'estoque', direcao: 'asc' }], tipos).map(i => i.codigo)
    expect(asc).toEqual(['2', '1', '3', '4'])
    const multi = ordenarItens(itens, colunas, [{ chave: 'setor', direcao: 'asc' }, { chave: 'estoque', direcao: 'desc' }], tipos).map(i => i.codigo)
    expect(multi).toEqual(['3', '4', '1', '2'])
  })

  it('opções com contagem, paginação e descrição', () => {
    expect(opcoesDaColuna(itens, colunas[2])).toEqual([{ valor: 'MERCEARIA', total: 2 }, { valor: 'LACTEOS', total: 1 }, { valor: 'LIMPEZA', total: 1 }])
    expect(paginar([1, 2, 3, 4, 5], 2, 2)).toMatchObject({ itens: [3, 4], pagina: 2, paginas: 3, inicio: 3, fim: 4 })
    expect(paginar([1, 2], 9, 10)).toMatchObject({ pagina: 1, paginas: 1 })
    expect(paginasVisiveis(5, 20)).toEqual([1, '…', 4, 5, 6, '…', 20])
    expect(paginasVisiveis(2, 4)).toEqual([1, 2, 3, 4])
    expect(descreverCondicao({ op: 'entre', valor: '1', valor2: '10' }, colunas[3], 'numero')).toBe('Estoque entre 1 e 10')
    expect(descreverCondicao({ op: 'em', valor: ['A', 'B', 'C'] }, colunas[2], 'categoria')).toBe('Setor é A, B +1')
  })
})
