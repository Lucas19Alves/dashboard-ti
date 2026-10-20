import { describe, expect, it } from 'vitest'
import { cruzarValidadeRuptura, localDoVencimento, mapaVencimentos } from './vencimentosCruzados'

const pend = (codigo, local) => ({ 'Código': codigo, Local: `${local} - ${local}`, _temPresenca: false, _estoque: 4, 'Custo Ruptura': '10' })
const auditorias = [
  { id: 1, data: '2026-10-01', tipo: 'Presença', dados: [pend('A', 'G01A'), pend('B', 'G02B')] },
  { id: 2, data: '2026-10-08', tipo: 'Ruptura', dados: [pend('A', 'G01A')] }
]
const venc = (codigo, dias, prazo, extra = {}) => ({ _codigo: codigo, _produto: `P${codigo}`, _diasParaVencer: dias, _prazo: prazo, _estoque: 5, _validadeISO: '2026-10-20', ...extra })

describe('vencimentos cruzados', () => {
  it('usa o local da planilha e, sem ele, o da auditoria', () => {
    expect(localDoVencimento({ _local: 'G09C; G10A' }, new Map())).toEqual({ local: 'G09C', origem: 'planilha' })
    expect(localDoVencimento({ _codigo: 'A' }, new Map([['A', 'G01A']]))).toEqual({ local: 'G01A', origem: 'auditoria' })
  })

  it('monta o mapa por categoria (vencidos, hoje, a vencer)', () => {
    const itens = [venc('A', -2, 'vencidos'), venc('A', 0, 'hoje'), venc('B', 20, 'futuro'), venc('Z', 1, 'ate3')]
    const { auditoria, semLocal, pelaAuditoria } = mapaVencimentos(itens, auditorias)
    expect(auditoria.analise.porLocal).toEqual({ G01A: { lidos: 0, pendentes: 1, comProblema: 1 }, G02B: { lidos: 1, pendentes: 0, comProblema: 0 } })
    expect(auditoria.dados.map(d => [d._codigo, d.Local, d._categoria])).toEqual([['A', 'G01A', 'vencidos'], ['A', 'G01A', 'hoje'], ['B', 'G02B', 'aVencer']])
    expect(semLocal).toBe(1)
    expect(pelaAuditoria).toBe(3)
    expect(Object.keys(mapaVencimentos(itens, auditorias, ['vencidos']).auditoria.analise.porLocal)).toEqual(['G01A'])
  })

  it('cruza validade curta com ruptura recorrente', () => {
    const itens = [venc('A', 2, 'ate3'), venc('B', 60, 'futuro'), venc('C', 1, 'ate3')]
    const linhas = cruzarValidadeRuptura(itens, auditorias, { categorias: ['aVencer'] })
    expect(linhas.map(l => l.codigo)).toEqual(['A', 'B'])
    expect(cruzarValidadeRuptura(itens, auditorias, { categorias: ['vencidos'] })).toHaveLength(0)
    expect(linhas[0]).toMatchObject({ codigo: 'A', vezesRuptura: 2, custoRuptura: 20, categoria: 'aVencer' })
    expect(linhas[0].diagnostico).toMatch(/com frequência/)
  })
})
