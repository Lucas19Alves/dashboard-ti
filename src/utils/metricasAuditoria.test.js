import { describe, expect, it } from 'vitest'
import { inicioSemanaOperacional, metricasAuditoria, montarAgendaSemana, paraISOLocal, serieEvolucao } from './metricasAuditoria'

const tipos = { 1: ['Etiqueta'], 2: ['Presença'], 3: ['Ruptura'], 4: ['Etiqueta'] }

describe('metricasAuditoria', () => {
  it('deriva percentuais do SKU atual', () => {
    const m = metricasAuditoria({ sku: 200, analise: { itensPendentes: 5, totalItens: 100 } })
    expect(m).toMatchObject({ total: 200, pendentes: 5, lidos: 195 })
    expect(m.percentualPendente).toBeCloseTo(2.5)
  })

  it('semana operacional: sexta aponta para a próxima segunda', () => {
    expect(paraISOLocal(inicioSemanaOperacional(new Date(2026, 9, 7)))).toBe('2026-10-05') // quarta
    expect(paraISOLocal(inicioSemanaOperacional(new Date(2026, 9, 9)))).toBe('2026-10-12') // sexta
  })

  it('monta a agenda com estado de cada tipo planejado', () => {
    const auditorias = [
      { id: 1, data: '2026-10-05', tipo: 'Etiqueta', status: 'fechada', sku: 100, analise: { itensPendentes: 1 } },
      { id: 2, data: '2026-10-06', tipo: 'Presença', status: 'em_andamento', sku: 100, analise: { itensPendentes: 10 } }
    ]
    const agenda = montarAgendaSemana(auditorias, tipos, new Date(2026, 9, 7, 10))
    expect(agenda.map(d => d.itens[0].estado)).toEqual(['meta', 'andamento', 'hoje', 'futura'])
    expect(agenda[2].ehHoje).toBe(true)
  })

  it('série de evolução fica em ordem cronológica e limitada', () => {
    const lista = [3, 1, 2].map(id => ({ id, data: `2026-10-0${id}`, tipo: 'Etiqueta', sku: 100, analise: { itensPendentes: id } }))
    expect(serieEvolucao(lista, 'Etiqueta', 2).map(p => p.valor)).toEqual([2, 3])
  })
})
