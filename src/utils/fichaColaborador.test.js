import { describe, expect, it } from 'vitest'
import { duplas, mapaLeiturasColaborador, problemasColaborador, ritmoPorSetor } from './fichaColaborador'

// Leituras a cada `passo` segundos a partir de 08:00.
const leituras = (usuario, setor, n, passo, data = '2026-10-14', inicio = 8 * 3600) => Array.from({ length: n }, (_, i) => {
  const h = new Date((inicio + i * passo) * 1000).toISOString().slice(11, 19)
  return { 'Usuário': usuario, 'Classe de Produto Raiz': setor, Local: 'G01A - G01A', 'Auditado em': `${data} ${h}`, _temPresenca: true }
})

describe('ficha do colaborador', () => {
  it('calcula ritmo por setor', () => {
    const [s] = ritmoPorSetor([{ id: 1, data: '2026-10-14', dados: leituras('Ana', 'BEBIDAS', 61, 60) }], 'Ana')
    expect(s).toMatchObject({ setor: 'BEBIDAS', leituras: 61, participacao: 100 })
    expect(Math.round(s.ritmo)).toBe(61)
  })

  it('soma leituras por local e lista problemas', () => {
    const auditorias = [{ id: 1, data: '2026-10-14', dados: leituras('Ana', 'X', 3, 60), analise: { itensComEstoqueZeroDetalhes: [{ usuario: 'Ana', codigo: '1' }, { usuario: 'Bia', codigo: '2' }] } }]
    expect(mapaLeiturasColaborador(auditorias, 'Ana').analise.porLocal).toEqual({ G01A: { lidos: 3, pendentes: 0, comProblema: 0 } })
    expect(problemasColaborador(auditorias, 'Ana')).toMatchObject([{ codigo: '1', motivo: 'Estoque zero' }])
  })

  it('encontra duplas que rendem mais juntas no mesmo setor', () => {
    // Ana e Bia mais rápidas juntas (passo 30s) do que com Caio (passo 90s).
    const auditorias = [
      { id: 1, data: '2026-10-01', dados: [...leituras('Ana', 'X', 40, 30, '2026-10-01'), ...leituras('Bia', 'X', 40, 30, '2026-10-01')] },
      { id: 2, data: '2026-10-02', dados: [...leituras('Ana', 'X', 40, 30, '2026-10-02'), ...leituras('Bia', 'X', 40, 30, '2026-10-02')] },
      { id: 3, data: '2026-10-03', dados: [...leituras('Ana', 'X', 40, 90, '2026-10-03'), ...leituras('Caio', 'X', 40, 90, '2026-10-03')] },
      { id: 4, data: '2026-10-04', dados: [...leituras('Bia', 'X', 40, 90, '2026-10-04'), ...leituras('Caio', 'X', 40, 90, '2026-10-04')] }
    ]
    const [melhor] = duplas(auditorias, { minimo: 2 })
    expect(melhor).toMatchObject({ a: 'Ana', b: 'Bia', juntas: 2, setores: ['X'] })
    expect(melhor.rendimento).toBeGreaterThan(0)
  })
})
