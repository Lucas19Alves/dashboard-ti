import { describe, expect, it } from 'vitest'
import { conferirPlanilha } from './conferenciaPlanilha'

const item = (extra = {}) => ({ 'Código': '1', Produto: 'P', Local: 'G01A - G01A', 'Usuário': '123 (ANA)', 'Auditado em': '2026-10-14 09:00:00', 'Classe de Produto Raiz': 'X', 'Situação': 'Atualizado', ...extra })

describe('conferência da planilha', () => {
  it('aprova planilha completa', () => {
    const r = conferirPlanilha([item(), item({ 'Código': '2' })], { tipo: 'Etiqueta', data: '2026-10-14' })
    expect(r.nivel).toBe('ok')
    expect(r.lidos).toBe(2)
  })

  it('aponta coluna essencial faltando', () => {
    const { Local, ...semLocal } = item()
    const r = conferirPlanilha([semLocal], { tipo: 'Etiqueta' })
    expect(r.nivel).toBe('erro')
    expect(r.verificacoes.find(v => v.chave === 'colunas').resumo).toMatch(/Local/)
  })

  it('conta horários, outro dia, locais e usuários', () => {
    const r = conferirPlanilha([
      item({ 'Auditado em': '' }),
      item({ 'Código': '2', 'Auditado em': '2026-10-13 09:00:00' }),
      item({ 'Código': '3', Local: 'DEPOSITO' }),
      item({ 'Código': '4', 'Usuário': 'ANA' })
    ], { tipo: 'Etiqueta', data: '2026-10-14' })
    const v = Object.fromEntries(r.verificacoes.map(x => [x.chave, x]))
    expect(v.horario.resumo).toMatch(/^1 de 4/)
    expect(v.dia.exemplos).toEqual(['2 (13/10/2026)'])
    expect(v.locais.exemplos).toEqual(['DEPOSITO (1)'])
    expect(v.usuarios.exemplos).toEqual(['ANA'])
  })
})
