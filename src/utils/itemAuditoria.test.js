import { describe, expect, it } from 'vitest'
import { corrigirEstoqueDosItens, numeroEstoque } from './itemAuditoria'

describe('numeroEstoque', () => {
  it('lê ponto de milhar e vírgula decimal', () => {
    expect(numeroEstoque('9.051,374 KG')).toBe(9051.374)
    expect(numeroEstoque('### 25,502 KG')).toBe(25.502)
    expect(numeroEstoque('1.234')).toBe(1234)
    expect(numeroEstoque('12')).toBe(12)
    expect(numeroEstoque('12.5')).toBe(12.5)
    expect(numeroEstoque('-3')).toBe(0)
    expect(numeroEstoque(7)).toBe(7)
    expect(numeroEstoque('')).toBe(0)
  })
  it('corrige o _estoque guardado errado', () => {
    const dados = [{ 'Estoque atual': '9.051,374 KG', _estoque: 9.051 }, { 'Estoque atual': '3', _estoque: 3 }]
    expect(corrigirEstoqueDosItens(dados)).toBe(1)
    expect(dados[0]._estoque).toBe(9051.374)
  })
})
