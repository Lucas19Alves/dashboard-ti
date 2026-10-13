import { describe, expect, it } from 'vitest'
import { agregarPorArea, encontrarEspacoLivre, gerarLayoutPadrao, interpretarLocal, mesclarLayout, percentualPendente, redimensionarLayout } from './mapaLoja'

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
    expect(g5.faces.A.usuarios.get('Ana')).toBe(1)
    expect(g5.faces.B.usuarios.get('Ana')).toBe(1)
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
    expect(pos('G02').x + pos('G02').w).toBe(pos('G01').x) // vizinhos encostados
    expect(pos('F01').x).toBeLessThan(pos('G02').x)
  })

  it('segue a planta padrão da loja', () => {
    const blocos = ['PF01', 'PF02', 'ACG', 'IF01', 'I02', 'F01', 'F02', 'F03', 'F04', 'EMP01', 'PAO', 'IF02', 'I01', 'SORVETE', 'GELO', 'PA01', 'CS01', 'DEPOSITO']
    const extras = [...areas.filter(a => a.tipo === 'gondola' || a.tipo === 'liquida' || a.tipo === 'flv'), ...blocos.map(b => ({ bloco: b, ...interpretarLocal(b) }))]
    const { colunas, posicoes } = gerarLayoutPadrao(extras)
    const pos = id => posicoes.find(p => p.id === id)
    expect(pos('PF01')).toMatchObject({ x: 1, y: 1, w: 5, h: 2 })
    expect(pos('ACG')).toMatchObject({ x: 6, y: 0 })
    expect(pos('F03').x).toBeLessThan(pos('F02').x)
    expect(pos('F02').x).toBeLessThan(pos('F01').x)
    expect(pos('FLV')).toMatchObject({ x: 5, y: 13, w: 7, h: 8 })
    expect(pos('PAO')).toMatchObject({ x: 13, y: 13 })
    expect(pos('SORVETE')).toMatchObject({ x: 16, y: 18 })
    expect(pos('GELO')).toMatchObject({ x: 16, y: 22 })
    // Corredores entre o bloco esquerdo e a líquida; PA01 em cima e CS01 embaixo.
    expect(pos('G02')).toMatchObject({ x: 20, y: 5 })
    expect(pos('G01')).toMatchObject({ x: 24, y: 5 })
    expect(pos('PL01')).toMatchObject({ x: 30, y: 1, h: 20 })
    expect(colunas).toBe(32)
    expect(pos('PA01')).toMatchObject({ x: 20, y: 1, w: 10 })
    expect(pos('CS01')).toMatchObject({ x: 20, y: 22, w: 8 })
    // Área conhecida fora da planta vai para um espaço livre; local fora do padrão fica fora do mapa.
    const f4 = pos('F04')
    expect(posicoes.filter(p => p.id !== 'F04').every(p => f4.x + f4.w <= p.x || p.x + p.w <= f4.x || f4.y + f4.h <= p.y || p.y + p.h <= f4.y)).toBe(true)
    expect(pos('DEPOSITO')).toBeUndefined()
  })

  it('encontra espaço livre sem sobrepor áreas visíveis', () => {
    const layout = { colunas: 10, linhas: 4, posicoes: [{ id: 'A', x: 0, y: 0, w: 6, h: 2 }, { id: 'B', x: 6, y: 0, w: 4, h: 4, oculto: true }] }
    expect(encontrarEspacoLivre(layout)).toEqual({ x: 6, y: 0, w: 4, h: 2 })
    expect(encontrarEspacoLivre({ colunas: 4, linhas: 2, posicoes: [{ id: 'A', x: 0, y: 0, w: 4, h: 2 }] })).toEqual({ x: 0, y: 2, w: 4, h: 2 })
  })

  it('mantém posições salvas e acrescenta áreas novas', () => {
    const padrao = gerarLayoutPadrao(areas)
    const mesclado = mesclarLayout(padrao, { posicoes: [{ id: 'FLV', x: 40, y: 2, w: 8, h: 4 }, { id: 'EXTRA', x: 1, y: 1, w: 2, h: 2 }] })
    expect(mesclado.posicoes.find(p => p.id === 'FLV')).toMatchObject({ x: 40, y: 2 })
    expect(mesclado.posicoes.some(p => p.id === 'EXTRA')).toBe(true)
    expect(mesclado.colunas).toBeGreaterThanOrEqual(48)
  })

  it('aumenta e diminui o mapa em qualquer borda sem cortar áreas', () => {
    const base = { colunas: 10, linhas: 6, posicoes: [{ id: 'A', x: 2, y: 1, w: 3, h: 2 }] }
    const esquerda = redimensionarLayout(base, 'esquerda', 2)
    expect(esquerda).toMatchObject({ colunas: 12, deslocamento: { x: 2, y: 0 } })
    expect(esquerda.posicoes[0]).toMatchObject({ x: 4, y: 1 })
    expect(redimensionarLayout(base, 'esquerda', -5)).toMatchObject({ colunas: 8, posicoes: [{ x: 0 }] })
    expect(redimensionarLayout(base, 'direita', -9).colunas).toBe(5)
    expect(redimensionarLayout(base, 'topo', -1)).toMatchObject({ linhas: 5, posicoes: [{ y: 0 }] })
    expect(redimensionarLayout(base, 'base', 3).linhas).toBe(9)
    expect(redimensionarLayout({ ...base, posicoes: [{ id: 'A', x: 0, y: 0, w: 10, h: 6 }] }, 'direita', -2)).toBeNull()
  })

  it('respeita tamanho salvo e desloca áreas novas junto com o mapa', () => {
    const padrao = gerarLayoutPadrao(areas)
    const flv = padrao.posicoes.find(p => p.id === 'FLV')
    const mesclado = mesclarLayout(padrao, { colunas: padrao.colunas + 4, linhas: padrao.linhas, deslocamento: { x: 4, y: 0 }, posicoes: [] })
    expect(mesclado.colunas).toBe(padrao.colunas + 4)
    expect(mesclado.posicoes.find(p => p.id === 'FLV')).toMatchObject({ x: flv.x + 4, y: flv.y })
  })
})
