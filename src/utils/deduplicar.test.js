import { describe, expect, it } from 'vitest'
import { deduplicarPorCodigo } from './deduplicar'

describe('deduplicarPorCodigo', () => {
  it('mantém a posição do primeiro código e aplica a regra de substituição', () => {
    const itens = [
      { 'Código': '1', Local: 'A' },
      { 'Código': '2', Local: 'B' },
      { 'Código': '1', Local: '' },
      { 'Código': '1', Local: 'C' }
    ]
    const resultado = deduplicarPorCodigo(itens, (existente, atual) => !atual.Local && Boolean(existente.Local))
    expect(resultado).toEqual([{ 'Código': '1', Local: '' }, { 'Código': '2', Local: 'B' }])
  })

  it('preserva itens sem código e aceita a coluna Codigo sem acento', () => {
    const itens = [{ Produto: 'x' }, { Codigo: ' 7 ' }, { 'Código': '7' }, { Produto: 'y' }]
    expect(deduplicarPorCodigo(itens, () => false)).toHaveLength(3)
  })
})
