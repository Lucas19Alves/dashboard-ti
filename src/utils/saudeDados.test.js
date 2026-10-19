import { describe, expect, it } from 'vitest'
import { descreverUltimoBackup, formatarBytes, precisaLembrarBackup } from './saudeDados'

const agora = new Date('2026-10-10T12:00:00Z')
const diasAtras = dias => new Date(agora.getTime() - dias * 86_400_000)

describe('saudeDados', () => {
  it('descreve o último backup', () => {
    expect(descreverUltimoBackup(null, agora)).toMatch(/Nenhum backup/)
    expect(descreverUltimoBackup(diasAtras(0), agora)).toBe('Backup feito hoje')
    expect(descreverUltimoBackup(diasAtras(1), agora)).toBe('Último backup ontem')
    expect(descreverUltimoBackup(diasAtras(9), agora)).toBe('Último backup há 9 dias')
  })

  it('lembra do backup apenas quando há dados e passou do prazo', () => {
    expect(precisaLembrarBackup(null, false, agora)).toBe(false)
    expect(precisaLembrarBackup(null, true, agora)).toBe(true)
    expect(precisaLembrarBackup(diasAtras(0), true, agora)).toBe(false)
    expect(precisaLembrarBackup(diasAtras(1), true, agora)).toBe(true)
    expect(precisaLembrarBackup(diasAtras(0), true, agora, 2)).toBe(true)
  })

  it('formata bytes', () => {
    expect(formatarBytes(512)).toBe('512 B')
    expect(formatarBytes(2048)).toBe('2.0 KB')
    expect(formatarBytes(5 * 1024 ** 2)).toBe('5.0 MB')
  })
})
