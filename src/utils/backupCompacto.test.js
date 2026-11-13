import { describe, expect, it } from 'vitest'
import { compactar, expandir } from './backupCompacto'

const json = v => JSON.parse(JSON.stringify(v))
const idaEVolta = v => expandir(JSON.parse(JSON.stringify(compactar(v))))

// Gerador simples com semente para dados parecidos com os reais.
let s = 7
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1))
const catalogo = Array.from({ length: 120 }, (_, i) => ({ codigo: String(100100 + i), produto: `PRODUTO ${i} MARCA ${i % 7}`, local: `G0${i % 9}A`, classe: `${10 + (i % 5)} - CLASSE` }))
const itens = dia => catalogo.map((p, i) => {
  const estoque = int(0, 90)
  const lido = rnd() > 0.1
  const item = {
    'Código': p.codigo, Produto: p.produto, 'Classe de Produto Raiz': p.classe, Local: `${p.local} - ${p.local}`,
    Usuário: lido ? `55${int(10, 15)} (FULANO)` : '', Situação: lido ? 'Com Prese Encerrada - Com Estoque' : 'Sem Prese Encerrada - Com Estoque',
    'Auditado em': lido ? `${dia}/11/2026 ${String(int(8, 19)).padStart(2, '0')}:${String(int(0, 59)).padStart(2, '0')}:00` : '',
    'Estoque atual': String(estoque), 'Dias sem venda': String(int(0, 40)), 'Custo Ruptura': '12,50',
    _linhaPlanilha: i + 2, _temPresenca: lido, _estoque: estoque, _situacao: lido ? 'Com Prese Encerrada - Com Estoque' : 'Sem Prese Encerrada - Com Estoque', _lidoNaoPertence: false
  }
  if (i % 17 === 0) delete item.Usuário
  if (i % 23 === 0) item.extra = { a: [1, 2], b: null }
  return item
})

describe('backup compacto', () => {
  it('ida e volta igual ao JSON em dados de auditoria', () => {
    const dados = {
      auditorias: [3, 4, 5, 10].map((dia, k) => ({ id: k + 1, data: `2026-11-0${k + 1}`, tipo: 'Presença', status: 'fechada', dados: itens(String(dia).padStart(2, '0')), analise: { porSetor: { A: { lidos: 1 } }, itensComEstoqueZeroDetalhes: itens('03').slice(0, 9), usuarios: ['x', 'y'] } })),
      vencimentos: catalogo.slice(0, 30).map((p, i) => ({ id: i, 'Código': p.codigo, _codigo: p.codigo, Produto: p.produto, _validadeDate: new Date(Date.UTC(2026, 10, i + 1)), _diasParaVencer: i - 3, _prazo: i < 3 ? 'vencidos' : 'futuro' })),
      naoVinculados: catalogo.slice(0, 10).map(p => ({ codigo: p.codigo, produto: p.produto, sugestao: { local: p.local, confianca: 'alta' }, diasSemVenda: null })),
      configuracoes: { mapaLoja: { areas: [] } }
    }
    expect(idaEVolta(dados)).toStrictEqual(json(dados))
  })

  it('casos de borda: tipos misturados, ausentes, undefined, NaN, datas inválidas e repetidos', () => {
    const linhas = Array.from({ length: 20 }, (_, i) => ({
      a: i % 3 === 0 ? i : String(i),
      b: i % 2 ? undefined : null,
      c: i === 5 ? NaN : i === 6 ? Infinity : 1.5,
      d: i % 4 === 0 ? '31/02/2026 10:00:00' : `0${(i % 9) + 1}/01/2026 23:59:5${i % 10}`,
      e: i === 7 ? [1, { x: 2 }] : i === 8 ? { y: undefined, z: 'ok' } : 'texto',
      'Código': i % 5 === 0 ? undefined : `C${i % 4}`,
      f: i % 4,
      g: true,
      h: i === 3 ? ' 12 ' : String(i * 2),
      j: i * 2
    }))
    const dados = { lista: linhas, vazia: [], pequena: [{ a: 1 }], aninhada: [[1, 2], [linhas[0]]], texto: 'olá', n: 0 }
    expect(idaEVolta(dados)).toStrictEqual(json(dados))
  })

  it('previsão por código atravessa tabelas e fica muito menor', () => {
    const dados = { auditorias: Array.from({ length: 6 }, (_, k) => ({ id: k, dados: itens(String(k + 3).padStart(2, '0')) })) }
    const compacto = JSON.stringify(compactar(dados))
    expect(idaEVolta(dados)).toStrictEqual(json(dados))
    expect(compacto.length).toBeLessThan(JSON.stringify(dados).length / 5)
  })

  it('leitura em sequência: mesmo usuário seguido, horários crescentes com vazios e ausentes', () => {
    let seg = Date.UTC(2026, 10, 10, 8, 0, 0) / 1000
    const p2 = n => String(n).padStart(2, '0')
    const hora = () => { seg += int(3, 40); const d = new Date(seg * 1000); return `10/11/2026 ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}` }
    const linhas = Array.from({ length: 300 }, (_, i) => {
      const lido = i % 11 !== 0
      const r = { 'Código': String(500 + i), Usuário: lido ? `U${Math.floor(i / 60)}` : '', 'Auditado em': lido ? hora() : '' }
      if (i % 29 === 0) delete r['Auditado em']
      return r
    })
    const dados = { a: linhas, b: linhas.map(l => ({ ...l, 'Auditado em': l['Auditado em'] && l['Auditado em'].replace('10/11', '17/11') })) }
    const c = compactar(dados)
    const modos = JSON.stringify(c.corpo)
    expect(modos).toContain('"g"')
    expect(modos).toContain('"l"')
    expect(idaEVolta(dados)).toStrictEqual(json(dados))
  })

  it('rejeita formato desconhecido ou corrompido', () => {
    expect(() => expandir({ formato: 'x', dic: [], corpo: {} })).toThrow()
    const c = compactar({ l: itens('03') })
    c.dic = []
    expect(() => expandir(JSON.parse(JSON.stringify(c)))).toThrow()
  })
})
