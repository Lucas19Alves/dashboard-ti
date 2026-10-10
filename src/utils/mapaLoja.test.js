import { describe, expect, it } from 'vitest'
import { agregarPorArea, gerarLayoutPadrao, interpretarLocal, mesclarLayout, percentualPendente } from './mapaLoja'

describe('interpretarLocal', () => {
  it('reconhece gôndola, corredor e face', () => {
    expect(interpretarLocal('G05A - G05A')).toEqual({ tipo: 'gondola', bloco: 'G05', face: 'A', numero: 5 })
    expect(interpretarLocal('g2c')).toMatchObject({ bloco: 'G02', face: 'C' })
  })

  it('reconhece freezers, paredões, empório, açougue e FLV', () => {
    expect(interpretarLocal('F01 - F01')).toMatchObject({ tipo: 'freezer', bloco: 'F01' })
    expect(interpretarLocal('PF01 - PF01')).toMatchObject({ tipo: 'paredaoFrios', bloco: 'PF01' })
    expect(interpretarLocal('PL01')).toMatchObject({ tipo: 'liquida', bloco: 'PL01' })
    expect(interpretarLocal('EMP01')).toMatchObject({ tipo: 'emporio', bloco: 'EMP01' })
    expect(interpretarLocal('ACG')).toMatchObject({ tipo: 'acougue', bloco: 'ACG' })
    expect(interpretarLocal('FLV01')).toMatchObject({ tipo: 'flv', bloco: 'FLV01' })
    expect(interpretarLocal('DEPOSITO 3')).toMatchObject({ tipo: 'outro', bloco: 'DEPOSITO3' })
  })
})

describe('agregarPorArea', () => {
  it('soma locais por área e por face e conta usuários', () => {
    const auditoria = {
      analise: { porLocal: { 'G05A - G05A': { lidos: 9, pendentes: 1 }, 'G05B - G05B': { lidos: 10 }, 'F01 - F01': { pendentes: 4 } } },
      dados: [{ 'Usuário': 'Ana', Local: 'G05A - G05A', lido: true }, { 'Usuário': 'Ana', Local: 'G05B - G05B', lido: true }, { 'Usuário': 'Bia', Local: 'G05A - G05A', lido: false }]
    }
    const areas = agregarPorArea(auditoria, i => i.lido)
    const g5 = areas.get('G05')
    expect(g5).toMatchObject({ lidos: 19, pendentes: 1, total: 20 })
    expect(g5.faces.A).toMatchObject({ lidos: 9, pendentes: 1 })
    expect(g5.usuarios.get('Ana')).toBe(2)
    expect(g5.usuarios.has('Bia')).toBe(false)
    expect(percentualPendente(g5)).toBeCloseTo(5)
    expect(areas.get('F01')).toMatchObject({ pendentes: 4, lidos: 0 })
  })
})

describe('layout', () => {
  const areas = [
    { bloco: 'G01', tipo: 'gondola', numero: 1 }, { bloco: 'G02', tipo: 'gondola', numero: 2 },
    { bloco: 'PL01', tipo: 'liquida', numero: 1 }, { bloco: 'F01', tipo: 'freezer', numero: 1 }, { bloco: 'FLV', tipo: 'flv', numero: 1 }
  ]

  it('numera corredores da direita para a esquerda com líquida na ponta direita', () => {
    const { colunas, posicoes } = gerarLayoutPadrao(areas)
    const pos = id => posicoes.find(p => p.id === id)
    expect(pos('PL01').x + pos('PL01').w).toBe(colunas)
    expect(pos('G01').x).toBeGreaterThan(pos('G02').x)
    expect(pos('F01').x).toBeLessThan(pos('G02').x)
  })

  it('mantém posições salvas e acrescenta áreas novas', () => {
    const padrao = gerarLayoutPadrao(areas)
    const mesclado = mesclarLayout(padrao, { posicoes: [{ id: 'FLV', x: 40, y: 2, w: 8, h: 4 }, { id: 'EXTRA', x: 1, y: 1, w: 2, h: 2 }] })
    expect(mesclado.posicoes.find(p => p.id === 'FLV')).toMatchObject({ x: 40, y: 2 })
    expect(mesclado.posicoes.some(p => p.id === 'EXTRA')).toBe(true)
    expect(mesclado.colunas).toBeGreaterThanOrEqual(48)
  })
})
