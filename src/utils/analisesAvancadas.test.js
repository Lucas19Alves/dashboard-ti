import { describe, expect, it } from 'vitest'
import { previsaoAuditoria } from './previsao'
import { evolucaoUsuarios, mapaReincidencia, reincidenciaLocais, reincidenciaProdutos, rupturaEmValor, tempoAtivoMs } from './historicoAuditorias'
import { gerarAcoes, mediana } from './planoAcao'
import { numeroBR } from './itemAuditoria'

const lido = (usuario, local, hora, extra = {}) => ({ 'Usuário': usuario, Local: local, 'Auditado em': `2026-10-14 ${hora}`, _temPresenca: true, _estoque: 2, 'Código': extra.codigo || Math.random().toString(36).slice(2), ...extra })
const pendente = (codigo, local, extra = {}) => ({ 'Código': codigo, Produto: `P${codigo}`, Local: local, _temPresenca: false, _estoque: 3, 'Classe de Produto Raiz': 'MERCEARIA', ...extra })

describe('itens', () => {
  it('lê valores em formato brasileiro', () => {
    expect(numeroBR('1.234,56')).toBe(1234.56)
    expect(numeroBR('R$ 12,5')).toBe(12.5)
    expect(numeroBR('12.5')).toBe(12.5)
    expect(numeroBR('')).toBe(0)
  })
})

describe('previsão', () => {
  const dados = [
    ...Array.from({ length: 60 }, (_, i) => lido('A', 'G01A', `15:${String(i).padStart(2, '0')}:00`)),
    ...Array.from({ length: 200 }, (_, i) => pendente(String(i), 'G02A'))
  ]
  const auditoria = { data: '2026-10-14', sku: 1000, analise: { totalItens: 1000, itensPendentes: 200 }, dados }

  it('projeta o fechamento pelo ritmo da última hora', () => {
    const p = previsaoAuditoria(auditoria, { fim: '18:00' })
    expect(p.ritmo).toBe(60)
    expect(p.faltam).toBe(170) // 200 pendentes - 30 permitidos (3% de 1000)
    expect(p.pendentesPrevistos).toBe(200 - 60 * (2 + 1 / 60))
    expect(p.situacao).toBe('atrasada')
    expect(p.pessoasNecessarias).toBe(Math.ceil(170 / (2 + 1 / 60) / 60))
  })

  it('sem horários não há previsão', () => {
    expect(previsaoAuditoria({ dados: [pendente('1', 'G01A')] })).toBeNull()
  })
})

describe('reincidência', () => {
  const a1 = { id: 1, data: '2026-09-01', analise: { porLocal: { G01A: { lidos: 90, pendentes: 10 }, G02A: { lidos: 100, pendentes: 0 } } }, dados: [pendente('1', 'G01A'), pendente('2', 'G01A')] }
  const a2 = { id: 2, data: '2026-09-08', analise: { porLocal: { G01A: { lidos: 95, pendentes: 5 }, G02A: { lidos: 98, pendentes: 2 } } }, dados: [pendente('1', 'G01A', { 'Custo Ruptura': '10,5' })] }

  it('conta auditorias fora da meta por local', () => {
    const [primeiro] = reincidenciaLocais([a2, a1])
    expect(primeiro).toMatchObject({ local: 'G01A', auditorias: 2, foraMeta: 2, sequencia: 2 })
  })

  it('lista produtos pendentes em mais de uma auditoria', () => {
    expect(reincidenciaProdutos([a1, a2]).map(p => [p.codigo, p.vezes])).toEqual([['1', 2]])
  })

  it('mapa de reincidência conta ocorrências fora da meta', () => {
    expect(mapaReincidencia([a1, a2]).analise.porLocal).toEqual({ G01A: { lidos: 0, pendentes: 2, comProblema: 0 }, G02A: { lidos: 2, pendentes: 0, comProblema: 0 } })
  })

  it('ruptura em valor é uma foto por auditoria: média, última e por mês, sem somar semanas', () => {
    const r = rupturaEmValor([a1, a2])
    expect(r.auditorias.map(f => f.valor)).toEqual([0, 10.5])
    expect(r.ultima).toMatchObject({ valor: 10.5, itens: 1 })
    expect(r.media).toBe(5.25)
    expect(r.porSetor[0]).toMatchObject({ chave: 'MERCEARIA', valor: 5.25, ultima: 10.5 })
    const semanas = ['2026-10-06', '2026-10-13', '2026-10-20'].map((data, i) => ({ id: 10 + i, data, dados: [pendente('9', 'G01A', { 'Custo Ruptura': '100' })] }))
    const mes = rupturaEmValor(semanas).meses[0]
    expect(mes).toMatchObject({ chave: '2026-10', valor: 100, ultima: 100, auditorias: 3 }) // não vira 300
    expect(rupturaEmValor(semanas).porProduto[0]).toMatchObject({ vezes: 3, valorMedio: 100, naUltima: true })
  })
})

describe('usuários ao longo do tempo', () => {
  it('ignora pausas no tempo ativo', () => {
    expect(tempoAtivoMs([0, 60000, 120000, 120000 + 40 * 60000])).toBe(120000)
  })

  it('calcula ritmo por auditoria', () => {
    const dados = Array.from({ length: 61 }, (_, i) => lido('Ana', 'G01A', `09:${String(i % 60).padStart(2, '0')}:00`.replace('09:00:00', i === 60 ? '10:00:00' : '09:00:00')))
    const [ana] = evolucaoUsuarios([{ id: 1, data: '2026-10-14', dados, analise: { porUsuario: { Ana: { lidos: 61, comProblema: 0 } } } }])
    expect(Math.round(ana.serie[0].ritmo)).toBe(61)
  })
})

describe('plano e escala', () => {
  it('gera ações com prioridade e responsável', () => {
    const auditoria = {
      analise: { porLocal: { G01A: { lidos: 50, pendentes: 50 }, G02A: { lidos: 98, pendentes: 2 }, G03A: { lidos: 100, pendentes: 0 } } },
      dados: [lido('Ana', 'G01B', '09:00:00'), lido('Ana', 'G01A', '09:01:00'), lido('Bia', 'G01A', '09:02:00'), pendente('1', 'G01A')]
    }
    const acoes = gerarAcoes(auditoria)
    expect(acoes.map(a => [a.local, a.prioridade])).toEqual([['G01A', 'alta'], ['G02A', 'baixa']])
    expect(acoes[0]).toMatchObject({ responsavelSugerido: 'Ana', setor: 'MERCEARIA' })
  })

  it('sobe a prioridade de local reincidente e escolhe responsável pelo perfil', async () => {
    const { perfisColaboradores } = await import('./perfilColaborador')
    const auditoria = {
      tipo: 'Etiqueta',
      analise: { porLocal: { G01A: { lidos: 95, pendentes: 5 }, FLV: { lidos: 90, pendentes: 10 } }, porUsuario: { Ana: {}, Flavio: {} } },
      dados: [lido('Ana', 'G01A', '09:00:00'), lido('Flavio', 'FLV', '09:00:00')]
    }
    const anteriores = [1, 2].map(() => ({ analise: { porLocal: { G01A: { lidos: 80, pendentes: 20 } } } }))
    const historico = [{ dados: [...Array(40).fill(0).map(() => lido('Ana', 'G01A', '09:00:00')), ...Array(40).fill(0).map(() => lido('Flavio', 'FLV', '09:00:00'))], analise: {} }]
    const acoes = gerarAcoes(auditoria, 3, { anteriores, perfis: perfisColaboradores(historico) })
    const g01 = acoes.find(a => a.local === 'G01A')
    expect(g01).toMatchObject({ prioridade: 'alta', reincidente: true, responsavelSugerido: 'Ana' })
    expect(g01.descricao).toMatch(/etiqueta.*Reincidente/)
    expect(acoes.find(a => a.local === 'FLV').responsavelSugerido).toBe('Flavio')
  })

  it('mediana', () => {
    expect(mediana([3, 1, 2])).toBe(2)
    expect(mediana([])).toBeNull()
  })
})
