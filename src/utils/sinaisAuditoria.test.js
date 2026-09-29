import { describe, expect, it } from 'vitest'
import { analisarSinaisAuditoria } from './sinaisAuditoria'

const leitura = (usuario, local, hora, extras = {}) => ({
  'Código': `${usuario}-${local}-${hora}`,
  Produto: 'Produto de exemplo',
  'Usuário': usuario,
  Local: local,
  'Auditado em': '28/09/2026',
  'Auditado em_1': hora,
  _temPresenca: true,
  ...extras
})

describe('pontos de atenção da auditoria', () => {
  it('sinaliza muitos locais em dez minutos e ignora registros sem leitura', () => {
    const dados = Array.from({ length: 8 }, (_, i) => leitura('Ana', `Local ${i % 3}`, `09:0${i}`))
    dados.push(leitura('Ana', 'Local 4', '09:08', { _temPresenca: false }))
    const resultado = analisarSinaisAuditoria(dados, '2026-09-28')
    expect(resultado.sinais.filter(sinal => sinal.tipo === 'locais')).toHaveLength(1)
    expect(resultado.sinais[0].quantidade).toBe(8)
    expect(resultado.totalLeituras).toBe(8)
  })

  it('sinaliza mudança forte na participação nas duas horas finais', () => {
    const dados = [
      ...Array.from({ length: 12 }, (_, i) => leitura(i < 3 ? 'Ana' : 'Bia', 'Loja', `09:${String(i).padStart(2, '0')}`)),
      ...Array.from({ length: 20 }, (_, i) => leitura(i < 18 ? 'Ana' : 'Bia', 'Loja', `11:${String(i).padStart(2, '0')}`))
    ]
    const sinais = analisarSinaisAuditoria(dados, '2026-09-28').sinais
    expect(sinais.find(sinal => sinal.tipo === 'concentracao')?.usuario).toBe('Ana')
  })

  it('sinaliza apenas itens lidos com estoque baixo e muitos dias sem venda', () => {
    const dados = [
      leitura('Ana', 'Loja', '09:00', { _estoque: 1, 'Dias sem venda': '35' }),
      leitura('Ana', 'Loja', '09:01', { _estoque: 5, 'Dias sem venda': 40 }),
      leitura('Ana', 'Loja', '09:02', { _estoque: 1, 'Dias sem venda': 40, _temPresenca: false }),
      leitura('Ana', 'Loja', '09:03', { _estoque: 1 })
    ]
    const sinal = analisarSinaisAuditoria(dados, '2026-09-28').sinais.find(item => item.tipo === 'estoque')
    expect(sinal.quantidade).toBe(1)
    expect(sinal.registros[0]).toMatchObject({ estoque: 1, diasSemVenda: 35 })
  })

  it('usa a coluna de hora quando a coluna de data é um Date à meia-noite', () => {
    const dados = Array.from({ length: 1000 }, (_, i) => {
      const minuto = Math.floor(i * 360 / 999)
      return leitura('Ana', `Local ${i % 3}`, `${String(9 + Math.floor(minuto / 60)).padStart(2, '0')}:${String(minuto % 60).padStart(2, '0')}`, {
        'Código': String(i + 1),
        'Auditado em': new Date('2026-09-28T00:00:00.000Z')
      })
    })
    const resultado = analisarSinaisAuditoria(dados, '2026-09-28')
    const sinal = resultado.sinais.find(item => item.tipo === 'locais')
    expect(resultado.leiturasComHorario).toBe(1000)
    expect(sinal.quantidade).toBeLessThan(100)
    expect(sinal.registros.every(item => item.colunaHora === 'Auditado em_1')).toBe(true)
    expect(sinal.periodo).toMatch(/^2026-09-28 0?9:|^2026-09-28 1[0-5]:/)
    const [inicio, fim] = sinal.periodo.split(' a ').map(valor => Date.parse(valor.replace(' ', 'T') + 'Z'))
    expect(fim - inicio).toBeLessThanOrEqual(10 * 60000)
  })

  it('não inventa meia-noite nem a data a partir do cadastro da auditoria', () => {
    const semHora = Array.from({ length: 8 }, (_, i) => leitura('Ana', `Local ${i % 3}`, '', {
      'Auditado em': new Date('2026-09-28T00:00:00.000Z')
    }))
    const semData = Array.from({ length: 8 }, (_, i) => leitura('Bia', `Local ${i % 3}`, `09:0${i}`, { 'Auditado em': '' }))
    const dataSerializada = leitura('Caio', 'Loja', '', { 'Auditado em': '2026-09-28T00:00:00.000Z' })
    const resultado = analisarSinaisAuditoria([...semHora, ...semData, dataSerializada], '2026-09-28')
    expect(resultado.leiturasSemHorario).toBe(17)
    expect(resultado.sinais.some(sinal => sinal.tipo === 'locais')).toBe(false)
  })

  it('mostra todos os registros e intervalo exato de uma janela de 10 minutos', () => {
    const dados = Array.from({ length: 8 }, (_, i) => leitura('Ana', `Local ${i % 3}`, `09:0${i}`))
    const sinal = analisarSinaisAuditoria(dados, '2026-09-28').sinais.find(item => item.tipo === 'locais')
    expect(sinal.periodo).toBe('2026-09-28 09:00:00 a 2026-09-28 09:07:00')
    expect(sinal.registros).toHaveLength(8)
    expect(sinal.registros[0]).toMatchObject({ dataHora: '2026-09-28 09:00:00', colunaData: 'Auditado em', colunaHora: 'Auditado em_1' })
  })

  it('sinaliza volume concentrado e datas diferentes da auditoria', () => {
    const dados = Array.from({ length: 40 }, (_, i) => leitura('Ana', 'Loja', '09:00', {
      'Código': String(i + 1), 'Auditado em': '27/09/2026'
    }))
    const sinais = analisarSinaisAuditoria(dados, '2026-09-28').sinais
    expect(sinais.find(sinal => sinal.tipo === 'ritmo')?.quantidade).toBe(40)
    expect(sinais.find(sinal => sinal.tipo === 'data')?.quantidade).toBe(40)
  })

  it('usa os segundos reais para delimitar dez minutos', () => {
    const dados = Array.from({ length: 7 }, (_, i) => leitura('Ana', `Local ${i % 3}`, '09:00:59'))
    const fora = leitura('Ana', 'Local 2', '09:11:00')
    expect(analisarSinaisAuditoria([...dados, fora], '2026-09-28').sinais.some(s => s.tipo === 'locais')).toBe(false)
    const noLimite = leitura('Ana', 'Local 2', '09:10:59')
    const sinal = analisarSinaisAuditoria([...dados, noLimite], '2026-09-28').sinais.find(s => s.tipo === 'locais')
    expect(sinal.periodo).toBe('2026-09-28 09:00:59 a 2026-09-28 09:10:59')
  })

  it('lê a hora serializada pelo Excel e identifica cinco locais em dois minutos', () => {
    const dados = Array.from({ length: 5 }, (_, i) => leitura('Ana', `Local ${i}`, '', {
      'Código': String(i + 1),
      'Auditado em': new Date('2026-09-28T00:00:00.000Z'),
      'Auditado em_1': new Date(Date.UTC(1899, 11, 30, 9, 0, i * 15)),
      _linhaPlanilha: i + 2
    }))
    const sinal = analisarSinaisAuditoria(dados, '2026-09-28').sinais.find(s => s.tipo === 'locais')
    expect(sinal.criterio).toContain('2 minutos')
    expect(sinal.periodo).toBe('2026-09-28 09:00:00 a 2026-09-28 09:01:00')
    expect(sinal.registros.map(r => r.linhaPlanilha)).toEqual([2, 3, 4, 5, 6])
  })

  it('destaca exceções operacionais apenas quando a taxa e o volume são relevantes', () => {
    const dados = [
      ...Array.from({ length: 20 }, (_, i) => leitura('Ana', 'Loja', `09:${String(i).padStart(2, '0')}`, {
        'Situação': i < 15 ? 'Lido sem estoque' : 'Atualizado'
      })),
      ...Array.from({ length: 100 }, (_, i) => leitura('Bia', 'Loja', `10:${String(i % 60).padStart(2, '0')}`, {
        'Situação': 'Atualizado'
      }))
    ]
    const sinais = analisarSinaisAuditoria(dados, '2026-09-28').sinais.filter(s => s.tipo === 'excecoes')
    expect(sinais).toHaveLength(1)
    expect(sinais[0].usuario).toBe('Ana')
    expect(sinais[0].registros).toHaveLength(15)
    expect(sinais[0].registros[0].situacao).toBe('Lido sem estoque')
  })

  it('identifica retomada concentrada após queda da equipe com classes distintas', () => {
    const antes = Array.from({ length: 20 }, (_, i) => leitura(i < 10 ? 'Operador 1' : 'Operador 2', 'G05B',
      `16:${String(30 + i).padStart(2, '0')}:00`, { 'Código': `A${i}`, 'Classe de Produto': 'Classe anterior' }))
    const depois = Array.from({ length: 110 }, (_, i) => leitura(i < 80 ? 'Operador 1' : 'Operador 2', i < 80 ? 'G05C' : 'G05B',
      `17:${String(Math.floor(i / 4)).padStart(2, '0')}:00`, { 'Código': `D${i}`, 'Classe de Produto': `Classe ${i % 20}`, _linhaPlanilha: i + 2 }))
    const resultado = analisarSinaisAuditoria([...antes, ...depois], '2026-09-28')
    const sinal = resultado.sinais.find(item => item.tipo === 'retomada')
    expect(sinal.usuario).toBe('Operador 1')
    expect(sinal.quantidade).toBe(80)
    expect(sinal.comparacao).toEqual([
      { periodo: '16:30–16:59', equipe: 20, usuario: 10 },
      { periodo: '17:00–17:29', equipe: 110, usuario: 80 }
    ])
    expect(sinal.resumo).toContain('20 classes')
    expect(sinal.registros).toHaveLength(80)
    expect(sinal.registros[0].linhaPlanilha).toBe(2)
    expect(resultado.auditoriasHistoricas).toBe(0)
  })

  it('não confunde aumento de volume com o sinal quando a variedade de classes é baixa', () => {
    const antes = Array.from({ length: 20 }, (_, i) => leitura(i < 10 ? 'Operador 1' : 'Operador 2', 'G05B',
      `16:${String(30 + i).padStart(2, '0')}:00`, { 'Código': `A${i}` }))
    const depois = Array.from({ length: 110 }, (_, i) => leitura(i < 80 ? 'Operador 1' : 'Operador 2', 'G05B',
      `17:${String(Math.floor(i / 4)).padStart(2, '0')}:00`, { 'Código': `D${i}`, 'Classe de Produto': 'Uma classe' }))
    expect(analisarSinaisAuditoria([...antes, ...depois], '2026-09-28').sinais.some(s => s.tipo === 'retomada')).toBe(false)
  })

  it('compara picos e locais de itens apenas com auditorias anteriores do mesmo tipo', () => {
    const historico = [26, 27].map((dia, indice) => ({
      id: indice + 1, tipo: 'Etiqueta', data: `2026-09-${dia}`,
      dados: Array.from({ length: 30 }, (_, i) => leitura('123 (OPERADOR ANTIGO)', 'G05B',
        `09:${String(i).padStart(2, '0')}:00`, { 'Código': `P${i}`, 'Classe de Produto': `Classe ${i % 4}`, 'Auditado em': `${dia}/09/2026` }))
    }))
    historico.push({ id: 3, tipo: 'Ruptura', data: '2026-09-27', dados: historico[0].dados })
    historico.push({ id: 4, tipo: 'Etiqueta', data: '2026-09-29', dados: historico[0].dados })
    const atual = Array.from({ length: 90 }, (_, i) => leitura('123 (OPERADOR ATUAL)', 'G05C',
      `10:${String(Math.floor(i / 3)).padStart(2, '0')}:00`, { 'Código': i < 10 ? `P${i}` : `N${i}`, 'Classe de Produto': `Classe ${i % 20}` }))
    const resultado = analisarSinaisAuditoria(atual, '2026-09-28', { tipoAuditoria: 'Etiqueta', historico })
    const sinal = resultado.sinais.find(item => item.tipo === 'historico')
    expect(resultado.auditoriasHistoricas).toBe(2)
    expect(sinal.quantidade).toBe(90)
    expect(sinal.referencias).toHaveLength(2)
    expect(sinal.contextoHistorico.join(' ')).toContain('10 códigos com registro anterior; 10 aparecem em outro local')
    expect(sinal.registros[0]).toMatchObject({ ultimoLocal: 'G05B', dataUltimaAuditoria: '2026-09-27', idUltimaAuditoria: 2 })
  })
})
