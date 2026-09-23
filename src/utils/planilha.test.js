import { describe, expect, it } from 'vitest'
import { matrizParaObjetos } from './planilha'

describe('matrizParaObjetos', () => {
  it('encontra o cabeçalho real e preserva colunas duplicadas', () => {
    const resultado = matrizParaObjetos([
      ['Relatório de auditoria'],
      [],
      ['Código', 'Produto', 'Auditado em', 'Auditado em'],
      [123, 'Arroz', '01/01/2026', '08:30']
    ])

    expect(resultado.colunas).toEqual(['Código', 'Produto', 'Auditado em', 'Auditado em_1'])
    expect(resultado.linhas).toEqual([{
      Código: 123,
      Produto: 'Arroz',
      'Auditado em': '01/01/2026',
      'Auditado em_1': '08:30'
    }])
  })

  it('ignora linhas vazias', () => {
    const resultado = matrizParaObjetos([
      ['Código', 'Produto'],
      ['', ''],
      [1, 'Produto']
    ])
    expect(resultado.linhas).toHaveLength(1)
  })
})
