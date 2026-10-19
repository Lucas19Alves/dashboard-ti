import { describe, expect, it } from 'vitest'
import { formatarDuracao, leiturasDoUsuario, montarTrajeto, pontoNoMapa } from './trajetoUsuario'

const item = (usuario, local, hora) => ({ 'Usuário': usuario, Local: local, 'Auditado em': `2026-10-08 ${hora}`, Produto: 'X', 'Código': '1' })

describe('trajeto do usuário', () => {
  const dados = [
    item('Ana', 'G01A - G01A', '08:00:00'),
    item('Ana', 'G01A - G01A', '08:01:00'),
    item('Bia', 'G01A - G01A', '08:02:00'),
    item('Ana', 'G02C - G02C', '08:05:00'),
    item('Ana', 'G02C - G02C', '08:40:00'),
    item('Ana', 'ACG', '08:41:00'),
    { 'Usuário': 'Ana', Local: 'FLV' }
  ]

  it('separa leituras do usuário por dia, em ordem', () => {
    const { porDia, semHorario } = leiturasDoUsuario(dados, 'Ana')
    expect([...porDia.keys()]).toEqual(['2026-10-08'])
    expect(porDia.get('2026-10-08').map(l => l.local)).toEqual(['G01A', 'G01A', 'G02C', 'G02C', 'ACG'])
    expect(semHorario).toBe(1)
  })

  it('agrupa paradas e quebra o mesmo local depois de uma pausa', () => {
    const trajeto = montarTrajeto(leiturasDoUsuario(dados, 'Ana').porDia.get('2026-10-08'))
    expect(trajeto.paradas.map(p => [p.local, p.leituras])).toEqual([['G01A', 2], ['G02C', 1], ['G02C', 1], ['ACG', 1]])
    expect(trajeto.pausas).toBe(1)
    expect(trajeto.trocasArea).toBe(2)
    expect(trajeto.ativo).toBe(6 * 60000)
  })

  it('posiciona faces do corredor no fundo ou na frente', () => {
    const p = { x: 0, y: 0, w: 4, h: 16 }
    expect(pontoNoMapa(p, 'G01C')).toEqual({ x: 2.6, y: 4 })
    expect(pontoNoMapa(p, 'G01B')).toEqual({ x: 1.4, y: 12 })
    expect(pontoNoMapa(p, 'ACG')).toEqual({ x: 2, y: 8 })
  })

  it('formata durações', () => {
    expect(formatarDuracao(30000)).toBe('< 1 min')
    expect(formatarDuracao(90 * 60000)).toBe('1h30')
  })
})
