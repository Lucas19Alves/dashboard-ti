import { describe, expect, it } from 'vitest'
import { formatarData, formatarDataHora, formatarDataSemana } from './data'

describe('formatarData', () => {
  it('sempre devolve DD/MM/AAAA', () => {
    expect(formatarData('2026-03-10')).toBe('10/03/2026')
    expect(formatarData('2026-03-10T00:00:00Z')).toBe('10/03/2026')
    expect(formatarData(new Date(2026, 0, 5))).toBe('05/01/2026')
    expect(formatarData('10/03/2026')).toBe('10/03/2026')
  })
  it('usa o texto de vazio quando não há data', () => {
    expect(formatarData('')).toBe('')
    expect(formatarData(null, '—')).toBe('—')
    expect(formatarData('xyz', '—')).toBe('—')
  })
})

describe('formatarDataHora', () => {
  it('junta DD/MM/AAAA e HH:MM', () => {
    expect(formatarDataHora(new Date(2026, 10, 16, 9, 5))).toBe('16/11/2026 09:05')
    expect(formatarDataHora(null, 'ainda não')).toBe('ainda não')
  })
})

describe('formatarDataSemana', () => {
  it('prefixa o dia da semana', () => {
    expect(formatarDataSemana(new Date(2026, 10, 16))).toMatch(/^seg.*, 16\/11\/2026$/)
  })
})

describe('relatório impresso', () => {
  it('células de data sem formato saem em DD/MM/AAAA', async () => {
    const { blocoTabela } = await import('./print')
    const html = blocoTabela({ colunas: [{ chave: 'ultima', titulo: 'Última auditoria' }], linhas: [{ ultima: '2026-11-10' }, { ultima: new Date(2026, 10, 3) }] })
    expect(html).toContain('10/11/2026')
    expect(html).toContain('03/11/2026')
    expect(html).not.toContain('2026-11-10')
  })
})
