import { describe, expect, it } from 'vitest'
import { gerarCsv } from './csv'

describe('gerarCsv', () => {
  it('gera cabeçalho, escapa aspas e neutraliza fórmulas', () => {
    const csv = gerarCsv(
      [{ a: 'x"y', b: '=SOMA(1)' }, { a: null, b: 3 }],
      [{ chave: 'a', titulo: 'A' }, ['b', 'B']]
    )
    expect(csv.split('\r\n')).toEqual(['"A";"B"', '"x""y";"\'=SOMA(1)"', '"";"3"'])
  })
})
