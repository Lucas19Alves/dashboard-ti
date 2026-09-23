import 'fake-indexeddb/auto'
import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { normalizarFormatoBackup, validarBackup } from './backup'

describe('validarBackup', () => {
  it('aceita as versões suportadas', () => {
    const backup = { versao: 2, auditorias: [], vencimentos: [] }
    expect(validarBackup(backup)).toBe(backup)
  })

  it('rejeita arquivo incompleto antes da restauração', () => {
    expect(() => validarBackup({ versao: 2, auditorias: [] }))
      .toThrow('auditorias ou vencimentos estão ausentes')
  })

  it('rejeita versão futura', () => {
    expect(() => validarBackup({ versao: 99, auditorias: [], vencimentos: [] }))
      .toThrow('não é compatível')
  })

  it('rejeita registros corrompidos', () => {
    expect(() => validarBackup({ versao: 2, auditorias: [null], vencimentos: [] }))
      .toThrow('registros estão corrompidos')
  })

  it('converte backup regional antigo para auditorias compatíveis', () => {
    const convertido = normalizarFormatoBackup({
      exportedAt: '2026-09-23T10:00:00.000Z',
      regionId: 'sp6',
      sessions: [{
        id: 'sp6-2026-09-22-tuesday',
        isoDate: '2026-09-22',
        auditType: 'Presença',
        stores: [{ code: '337', name: 'Loja 337', totalSku: 100, pendingItems: 10, updatedItems: 90, readPct: 90, pendingPct: 10 }],
        summary: { totalSku: 100, pendingItems: 10, updatedItems: 90, readPct: 90, pendingPct: 10 },
        forecast: { projected: 100 }
      }]
    })

    expect(convertido.origem).toBe('backup-regional')
    expect(convertido.auditorias).toHaveLength(1)
    expect(convertido.auditorias[0].analise.porSetor['Loja 337'].pendentes).toBe(10)
    expect(() => validarBackup(convertido)).not.toThrow()
  })

  if (process.env.REGIONAL_BACKUP_FIXTURE) {
    it('converte integralmente o arquivo regional informado', () => {
      const arquivo = JSON.parse(fs.readFileSync(process.env.REGIONAL_BACKUP_FIXTURE, 'utf8'))
      const convertido = validarBackup(normalizarFormatoBackup(arquivo))
      expect(convertido.origem).toBe('backup-regional')
      expect(convertido.auditorias).toHaveLength(arquivo.sessions.length)
      expect(convertido.auditorias.every(auditoria => auditoria.analise && Array.isArray(auditoria.dados))).toBe(true)
    })
  }
})
