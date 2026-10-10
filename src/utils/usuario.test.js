import { describe, expect, it } from 'vitest'
import { rotuloUsuario, separarUsuario } from './usuario'

describe('separarUsuario', () => {
  it('separa matrícula e nome do padrão do ERP', () => {
    expect(separarUsuario('5485398 (GISELE FERREIRA DE NORONHA)')).toEqual({
      original: '5485398 (GISELE FERREIRA DE NORONHA)',
      matricula: '5485398',
      nome: 'Gisele Ferreira de Noronha'
    })
  })

  it('aceita variações e textos fora do padrão', () => {
    expect(separarUsuario('123 - JOAO DA SILVA').nome).toBe('Joao da Silva')
    expect(separarUsuario('987654')).toMatchObject({ matricula: '987654', nome: '' })
    expect(separarUsuario('Ana Souza')).toMatchObject({ matricula: '', nome: 'Ana Souza' })
  })

  it('gera rótulo curto', () => {
    expect(rotuloUsuario('5485398 (GISELE FERREIRA DE NORONHA)')).toBe('Gisele Ferreira de Noronha (5485398)')
    expect(rotuloUsuario('Ana')).toBe('Ana')
  })
})
