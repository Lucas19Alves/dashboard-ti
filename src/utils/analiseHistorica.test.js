import { describe, expect, it } from 'vitest'
import {
  agruparPorMes,
  auditoriaAnteriorDoTipo,
  compararAuditorias,
  consolidarSetores,
  consolidarUsuarios,
  dentroDoIntervalo,
  gerarInsights,
  intervaloAnterior,
  intervaloDoPeriodo,
  itensParaMeta,
  resumirAuditorias,
  tendencia
} from './analiseHistorica'

const aud = (id, data, pendentes, extra = {}) => ({ id, data, tipo: 'Presença', status: 'fechada', sku: 100, analise: { itensPendentes: pendentes }, ...extra })

describe('analiseHistorica', () => {
  it('calcula intervalos rápido, personalizado e anterior', () => {
    expect(intervaloDoPeriodo({ periodo: '3m' }, new Date(2026, 9, 10))).toEqual({ inicio: '2026-07-10', fim: '2026-10-10' })
    expect(intervaloDoPeriodo({ periodo: 'todos' })).toEqual({ inicio: null, fim: null })
    expect(intervaloDoPeriodo({ tipo: 'personalizado', inicio: '2026-01-01', fim: 'x' })).toEqual({ inicio: '2026-01-01', fim: null })
    expect(intervaloAnterior({ inicio: '2026-10-01', fim: '2026-10-10' })).toEqual({ inicio: '2026-09-21', fim: '2026-09-30' })
  })

  it('filtra por data ISO sem erro de fuso', () => {
    expect(dentroDoIntervalo({ data: '2026-10-10' }, { inicio: '2026-10-10', fim: '2026-10-10' })).toBe(true)
    expect(dentroDoIntervalo({ data: '2026-10-11' }, { inicio: null, fim: '2026-10-10' })).toBe(false)
  })

  it('resume com métricas derivadas do SKU', () => {
    const r = resumirAuditorias([aud(1, '2026-01-01', 2), aud(2, '2026-01-02', 10), aud(3, '2026-02-01', 0, { status: 'em_andamento' })])
    expect(r).toMatchObject({ total: 3, fechadas: 2, dentroMeta: 1, taxaMeta: 50 })
    expect(r.mediaPendente).toBeCloseTo(4)
    expect(agruparPorMes([aud(1, '2026-02-01', 2), aud(2, '2026-01-02', 10)]).map(m => m.rotulo)).toEqual(['Jan/26', 'Fev/26'])
  })

  it('detecta tendência', () => {
    expect(tendencia([5, 4, 3, 2]).direcao).toBe('melhorando')
    expect(tendencia([1, 2, 3, 4]).direcao).toBe('piorando')
    expect(tendencia([1, 2]).direcao).toBe('indefinida')
  })

  it('consolida setores com reincidência', () => {
    const lista = [
      aud(1, '2026-01-01', 0, { analise: { porSetor: { A: { lidos: 90, pendentes: 10 }, B: { lidos: 100, pendentes: 0 } } } }),
      aud(2, '2026-01-08', 0, { analise: { porSetor: { A: { lidos: 95, pendentes: 5 } } } })
    ]
    const a = consolidarSetores(lista).find(s => s.setor === 'A')
    expect(a).toMatchObject({ auditorias: 2, acimaDaMeta: 2, reincidencia: 100, ultimo: 5 })
  })

  it('consolida usuários', () => {
    const [u] = consolidarUsuarios([
      aud(1, '2026-01-01', 0, { analise: { porUsuario: { Ana: { lidos: 9, comProblema: 1 } } } }),
      aud(2, '2026-01-05', 0, { analise: { porUsuario: { Ana: { lidos: 10 } } } })
    ])
    expect(u).toMatchObject({ usuario: 'Ana', leituras: 20, auditorias: 2, ultimaData: '2026-01-05', mediaPorAuditoria: 10 })
    expect(u.percProblema).toBeCloseTo(5)
  })

  it('compara com a auditoria anterior do mesmo tipo', () => {
    const anterior = aud(1, '2026-01-01', 5, { analise: { itensPendentes: 5, porSetor: { A: { lidos: 90, pendentes: 10 }, B: { lidos: 50 } } } })
    const atual = aud(2, '2026-01-08', 2, { analise: { itensPendentes: 2, porSetor: { A: { lidos: 98, pendentes: 2 }, C: { lidos: 10 } } } })
    const outroTipo = aud(3, '2026-01-07', 1, { tipo: 'Etiqueta' })
    expect(auditoriaAnteriorDoTipo(atual, [anterior, atual, outroTipo])?.id).toBe(1)
    const c = compararAuditorias(atual, anterior)
    expect(c.diferencaPendente).toBeCloseTo(-3)
    expect(c.melhoraram.map(s => s.setor)).toEqual(['A'])
    expect(c.novos).toEqual(['C'])
    expect(c.ausentes).toEqual(['B'])
  })

  it('calcula itens para a meta', () => {
    expect(itensParaMeta(aud(1, '2026-01-01', 10))).toBe(7)
    expect(itensParaMeta(aud(1, '2026-01-01', 1))).toBe(-2)
  })

  it('gera insights', () => {
    const meses = [{ rotulo: 'Jan/26', mediaPendente: 6 }, { rotulo: 'Fev/26', mediaPendente: 4 }, { rotulo: 'Mar/26', mediaPendente: 2 }]
    const textos = gerarInsights({ resumo: { mediaPendente: 2 }, resumoAnterior: { mediaPendente: 5 }, meses, tipos: [], setores: [] }).map(i => i.texto)
    expect(textos.some(t => t.includes('caindo'))).toBe(true)
    expect(textos.some(t => t.includes('Mar/26'))).toBe(true)
  })
})
