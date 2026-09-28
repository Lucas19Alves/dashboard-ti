import { describe, expect, it } from 'vitest'
import { extrairDataISOPlanilha, extrairHoraPlanilha } from './auditoriaHorario'

describe('dados temporais de auditoria', () => {
  it('preserva a hora gravada no Excel sem deslocamento de fuso', () => {
    expect(extrairHoraPlanilha('1899-12-30T09:17:50.000Z')).toBe(9)
    expect(extrairHoraPlanilha(new Date('1899-12-30T07:30:00.000Z'))).toBe(7)
  })

  it('preserva o dia da auditoria em valores ISO UTC', () => {
    expect(extrairDataISOPlanilha('2026-09-28T00:00:00.000Z')).toBe('2026-09-28')
    expect(extrairDataISOPlanilha(new Date('2026-09-28T00:00:00.000Z'))).toBe('2026-09-28')
  })

  it('aceita data e hora no formato brasileiro', () => {
    expect(extrairDataISOPlanilha('28/09/2026 09:17:50')).toBe('2026-09-28')
    expect(extrairHoraPlanilha('28/09/2026 09:17:50')).toBe(9)
  })
})
