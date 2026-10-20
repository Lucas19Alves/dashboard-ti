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

  it('soma ruptura em valor dos itens pendentes', () => {
    const r = rupturaEmValor([a1, a2])
    expect(r.total).toBe(10.5)
    expect(r.porSetor[0]).toMatchObject({ chave: 'MERCEARIA', valor: 10.5 })
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

  it('mediana', () => {
    expect(mediana([3, 1, 2])).toBe(2)
    expect(mediana([])).toBeNull()
  })
})

describe('escala por afinidade', () => {
  it('mantém cada colaborador nas áreas e setores em que costuma ler', async () => {
    const { historicoLeitores, escalaPorAfinidade } = await import('./planoAcao')
    const item = (usuario, local, setor) => ({ 'Usuário': usuario, Local: local, 'Classe de Produto Raiz': setor, _temPresenca: true })
    const passado = [{ dados: [
      ...Array(30).fill(0).map(() => item('Ana', 'G01A', 'BEBIDAS')), ...Array(30).fill(0).map(() => item('Ana', 'G02A', 'BEBIDAS')),
      ...Array(30).fill(0).map(() => item('Bia', 'F01', 'FRIOS')), ...Array(10).fill(0).map(() => item('Bia', 'G03A', 'FRIOS'))
    ] }]
    const historico = historicoLeitores(passado)
    const setores = new Map([['G01', 'BEBIDAS'], ['G02', 'BEBIDAS'], ['G03', 'FRIOS'], ['F01', 'FRIOS']])
    const areas = [
      { bloco: 'G01', tipo: 'gondola', numero: 1, itens: 100 }, { bloco: 'G02', tipo: 'gondola', numero: 2, itens: 100 },
      { bloco: 'G03', tipo: 'gondola', numero: 3, itens: 100 }, { bloco: 'F01', tipo: 'freezer', numero: 1, itens: 100 }
    ]
    const escala = escalaPorAfinidade({ areas, pessoas: [{ usuario: 'Ana', ritmo: 100 }, { usuario: 'Bia', ritmo: 100 }], historico, setores, horas: 2 })
    const de = u => escala.grupos.find(g => g.usuario === u).areas.map(a => a.bloco).sort()
    expect(de('Ana')).toEqual(['G01', 'G02'])
    expect(de('Bia')).toEqual(['F01', 'G03'])
    expect(escala.aderencia).toBe(100)

    // Área fixada à mão vai para quem foi escolhido; o restante se reequilibra.
    const ajustada = escalaPorAfinidade({ areas, pessoas: [{ usuario: 'Ana', ritmo: 100 }, { usuario: 'Bia', ritmo: 100 }], historico, setores, horas: 2, fixas: new Map([['F01', 'Ana']]) })
    const deAjustada = u => ajustada.grupos.find(g => g.usuario === u).areas
    expect(deAjustada('Ana').find(a => a.bloco === 'F01')).toMatchObject({ fixa: true, habitual: false })
    expect(deAjustada('Bia').map(a => a.bloco)).toContain('G03')
    expect(ajustada.grupos.reduce((s, g) => s + g.itens, 0)).toBe(400)
  })
})
