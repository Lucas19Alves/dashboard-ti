import { describe, expect, it } from 'vitest'
import { paginar, paginarEquilibrado } from './paginas'

describe('paginar', () => {
  it('divide em páginas do tamanho pedido', () => {
    expect(paginar([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  it('sempre devolve ao menos uma página', () => {
    expect(paginar([], 10)).toEqual([[]])
    expect(paginar(null, 10)).toEqual([[]])
  })

  it('equilibra as páginas', () => {
    expect(paginarEquilibrado(Array.from({ length: 13 }, (_, i) => i), 11).map(p => p.length)).toEqual([7, 6])
    expect(paginarEquilibrado([1, 2, 3], 11)).toEqual([[1, 2, 3]])
  })
})
