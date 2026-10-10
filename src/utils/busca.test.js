import { describe, expect, it } from 'vitest'
import { correspondeBusca, formatarDataBR, normalizarBusca } from './busca'

describe('busca', () => {
  it('ignora acentos e caixa', () => {
    expect(normalizarBusca('  Presença ')).toBe('presenca')
  })

  it('exige todos os termos em qualquer campo', () => {
    expect(correspondeBusca('presenca 10/03', ['Presença', '10/03/2026'])).toBe(true)
    expect(correspondeBusca('etiqueta 10/03', ['Presença', '10/03/2026'])).toBe(false)
    expect(correspondeBusca('', ['x'])).toBe(true)
  })

  it('formata data ISO para pt-BR', () => {
    expect(formatarDataBR('2026-03-10')).toBe('10/03/2026')
    expect(formatarDataBR('2026-03-10T00:00:00Z')).toBe('10/03/2026')
  })
})
