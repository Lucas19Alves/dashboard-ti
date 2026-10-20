import { describe, expect, it } from 'vitest'
import { disponibilidade, montarEscala, perfisColaboradores } from './perfilColaborador'

// Leituras sintéticas: uma a cada 30 s a partir de hhmm, no local e setor dados.
const leituras = (usuario, local, setor, n, hhmm, data = '2026-10-14') => {
  const [h, m] = hhmm.split(':').map(Number)
  return Array.from({ length: n }, (_, i) => {
    const s = h * 3600 + m * 60 + i * 30
    const hora = `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
    return { 'Usuário': usuario, Local: local, 'Classe de Produto Raiz': setor, 'Auditado em': `${data} ${hora}`, _temPresenca: true }
  })
}
const auditoria = (data, dados) => ({ data, dados, analise: {} })

describe('perfil e escala', () => {
  const historico = [
    auditoria('2026-10-07', [...leituras('FLV', 'FLV', 'HORTIFRUTI', 200, '08:00', '2026-10-07'), ...leituras('ANA', 'G01A', 'MERCEARIA', 100, '08:00', '2026-10-07'), ...leituras('ANA', 'PL01', 'BEBIDAS', 100, '09:00', '2026-10-07'), ...leituras('BIA', 'G02A', 'MERCEARIA', 150, '14:00', '2026-10-07')]),
    auditoria('2026-10-14', [...leituras('FLV', 'FLV', 'HORTIFRUTI', 200, '08:00'), ...leituras('ANA', 'G03A', 'MERCEARIA', 100, '08:00'), ...leituras('ANA', 'PL02', 'BEBIDAS', 100, '09:00'), ...leituras('BIA', 'G04A', 'MERCEARIA', 150, '14:00')])
  ]
  const perfis = perfisColaboradores(historico)

  it('monta o perfil: família, ritmo e horário', () => {
    const flv = perfis.get('FLV')
    expect(flv.familias).toEqual(['FLV'])
    expect(Math.round(flv.ritmo)).toBe(120)
    expect(perfis.get('BIA').janela.inicio).toBe(14 * 60)
    expect(disponibilidade(perfis.get('BIA'), '08:00', '20:00').horas).toBeCloseTo(6.5, 1)
  })

  it('não escala ninguém fora do perfil quando há alternativa', () => {
    const areas = [
      { bloco: 'FLV', tipo: 'flv', numero: 0, itens: 200 },
      { bloco: 'PL01', tipo: 'liquida', numero: 1, itens: 300 },
      { bloco: 'G01', tipo: 'gondola', numero: 1, itens: 100 },
      { bloco: 'G02', tipo: 'gondola', numero: 2, itens: 100 }
    ]
    const escala = montarEscala({ areas, pessoas: [{ usuario: 'FLV' }, { usuario: 'ANA' }, { usuario: 'BIA' }], perfis, inicio: '08:00', fim: '20:00' })
    const de = u => escala.grupos.find(g => g.usuario === u).areas.map(a => a.bloco)
    expect(de('FLV')).toEqual(['FLV'])
    expect(de('ANA')).toContain('PL01')
    expect(escala.grupos.every(g => g.foraDoPerfil === 0)).toBe(true)
  })

  it('avisa quando falta gente com o perfil e respeita ajuste manual', () => {
    const areas = [{ bloco: 'FLV', tipo: 'flv', numero: 0, itens: 100 }, { bloco: 'G01', tipo: 'gondola', numero: 1, itens: 100 }]
    const todos = perfis
    const escala = montarEscala({ areas, pessoas: [{ usuario: 'ANA' }, { usuario: 'BIA' }], perfis, todosPerfis: todos })
    expect(escala.avisos[0].texto).toMatch(/FLV/)
    expect(escala.avisos[0].usuarios).toEqual(['FLV'])
    const fixada = montarEscala({ areas, pessoas: [{ usuario: 'ANA' }, { usuario: 'BIA' }], perfis, fixas: new Map([['G01', 'BIA']]) })
    expect(fixada.grupos.find(g => g.usuario === 'BIA').areas.find(a => a.bloco === 'G01').fixa).toBe(true)
  })

  it('divide a carga sem passar da capacidade quando possível', () => {
    const areas = Array.from({ length: 8 }, (_, i) => ({ bloco: `G0${i + 1}`, tipo: 'gondola', numero: i + 1, itens: 200 }))
    const escala = montarEscala({ areas, pessoas: [{ usuario: 'ANA' }, { usuario: 'BIA' }], perfis, inicio: '08:00', fim: '20:00' })
    const [a, b] = escala.grupos
    expect(Math.abs(a.areas.length - b.areas.length)).toBeLessThanOrEqual(2)
    // Áreas inteiras: o melhor possível aqui fica um pouco acima de 100% para uma das duas.
    expect(Math.max(...escala.grupos.map(g => g.carga))).toBeLessThan(105)
  })

  it('escala por local (face do corredor) mantendo faces do mesmo corredor juntas', () => {
    const faces = (n, itens) => ['A', 'B', 'C', 'D'].map(f => ({ id: `G0${n}${f}`, bloco: `G0${n}`, face: f, tipo: 'gondola', numero: n, itens }))
    const areas = [...faces(1, 50), ...faces(3, 50)]
    const escala = montarEscala({ areas, pessoas: [{ usuario: 'ANA' }, { usuario: 'BIA' }], perfis })
    const ids = escala.grupos.flatMap(g => g.areas.map(a => a.id)).sort()
    expect(ids).toEqual(areas.map(a => a.id).sort())
    // Cada pessoa fica com um corredor inteiro, não com faces espalhadas.
    for (const g of escala.grupos) expect(new Set(g.areas.map(a => a.bloco)).size).toBe(1)
  })
})
