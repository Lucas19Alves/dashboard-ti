import { describe, expect, it } from 'vitest'
import { completarLocaisPelaPresenca, presencaBaseDaRuptura, setoresPelaPresenca } from './rupturaPresenca'

const item = (codigo, setor, situacao, extra = {}) => ({
  'Código': codigo,
  'Classe de Produto Raiz': setor,
  _temPresenca: situacao === 'lido' || situacao === 'problema',
  _temEstoqueSituacao: situacao !== 'problema',
  _lidoNaoPertence: false,
  ...extra
})

describe('ruptura como continuação da presença', () => {
  const presenca = [
    item('1', 'BAZAR', 'lido', { Local: 'G01A - G01A' }),
    item('2', 'BAZAR', 'pendente', { Local: 'G01B - G01B' }),
    item('3', 'BAZAR', 'pendente', { Local: 'G02C - G02C' }),
    item('4', 'BAZAR', 'pendente'),
    item('5', 'FLV', 'lido'),
    item('6', 'FLV', 'problema')
  ]

  it('parte da presença e desconta os pendentes resolvidos na ruptura', () => {
    const ruptura = [
      item('2', 'BAZAR', 'pendente'), // continua pendente
      item('3', 'BAZAR', 'lido'), // lido na ruptura
      // '4' saiu da lista: resolvido
      item('5', 'FLV', 'pendente'), // estava lido e voltou a faltar
      item('9', 'LIMPEZA', 'pendente') // não estava na presença
    ]
    expect(setoresPelaPresenca(ruptura, presenca)).toEqual({
      BAZAR: { lidos: 3, pendentes: 1, comProblema: 0 },
      FLV: { lidos: 0, pendentes: 1, comProblema: 1 },
      LIMPEZA: { lidos: 0, pendentes: 1, comProblema: 0 }
    })
  })

  it('completa o local vazio com o local da presença', () => {
    const [a, b] = completarLocaisPelaPresenca([item('2', 'BAZAR', 'pendente'), item('3', 'BAZAR', 'pendente', { Local: 'X' })], presenca)
    expect(a.Local).toBe('G01B - G01B')
    expect(b.Local).toBe('X')
  })

  it('usa a presença mais recente da mesma semana antes da ruptura', () => {
    const auditorias = [
      { id: 1, tipo: 'Presença', data: '2026-09-29', dados: [presenca[0]] },
      { id: 2, tipo: 'Presença', data: '2026-10-06', dados: [presenca[0]] },
      { id: 3, tipo: 'Etiqueta', data: '2026-10-06', dados: [presenca[0]] },
      { id: 4, tipo: 'Presença', data: '2026-10-07', dados: [presenca[0]] }
    ]
    expect(presencaBaseDaRuptura('2026-10-07', auditorias)?.id).toBe(2)
    expect(presencaBaseDaRuptura('2026-10-20', auditorias)).toBeNull()
  })
})
