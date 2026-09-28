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
    expect(sinal.exemplos[0]).toMatchObject({ estoque: 1, diasSemVenda: 35 })
  })
})
