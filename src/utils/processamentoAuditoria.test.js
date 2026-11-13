import { describe, expect, it } from 'vitest'
import { analisarDadosEtiqueta, analisarDadosPresenca, analisarDadosRuptura, detectarTipoDados, tratarLinhasEtiqueta, tratarLinhasPresenca } from './processamentoAuditoria'

const presenca = (codigo, situacao, extra = {}) => ({ 'Código': codigo, Produto: `P${codigo}`, 'Classe de Produto Raiz': '10 - DOCE', Local: 'G01A - G01A', Situação: situacao, 'Estoque atual': '5', ...extra })

describe('processamento das planilhas', () => {
  it('presença: normaliza, tira sem leitura e sem estoque e junta códigos repetidos', () => {
    const linhas = [
      presenca('1', 'Com Prese Encerrada - Com Estoque'),
      presenca('2', 'Sem Prese Encerrada - Com Estoque'),
      presenca('3', 'Sem Prese Encerrada - Sem Estoque'),
      presenca('2', 'Com Prese Encerrada - Com Estoque', { Local: 'G09B - G09B', 'Lido não pertence': 'Sim' })
    ]
    const { dados, duplicados, redirecionar } = tratarLinhasPresenca(linhas)
    expect(redirecionar).toBeUndefined()
    expect(dados.map(d => d['Código'])).toEqual(['1', '2'])
    expect(duplicados).toBe(1)
    expect(dados[1]).toMatchObject({ _temPresenca: false, _lidoNaoPertence: false, _temEstoqueSituacao: true, Local: 'G01A - G01A' })
    const analise = analisarDadosPresenca(dados, 100)
    expect(analise).toMatchObject({ itensPendentes: 1, totalItens: 100, parcialPercentual: 1 })
  })

  it('redireciona quando o tipo da planilha é outro', () => {
    expect(tratarLinhasPresenca([presenca('1', 'Atualizado')]).redirecionar).toBe('Etiqueta')
    expect(tratarLinhasEtiqueta([presenca('1', 'Com Prese Encerrada - Com Estoque')]).redirecionar).toBe('Presença')
  })

  it('etiqueta: pendente é "não lido com estoque"; desatualizado conta como lido', () => {
    const { dados } = tratarLinhasEtiqueta([presenca('1', 'Atualizado'), presenca('2', 'Não lido com estoque'), presenca('3', 'Desatualizado'), presenca('4', 'Sem estoque')])
    expect(dados.map(d => d['Código'])).toEqual(['1', '2', '3'])
    expect(analisarDadosEtiqueta(dados, 0)).toMatchObject({ itensPendentes: 1, itensDesatualizados: 1, totalItens: 3 })
    expect(detectarTipoDados(dados)).toBe('Etiqueta')
  })

  it('ruptura: setores partem da presença anterior da mesma semana', () => {
    const base = { id: 9, tipo: 'Presença', data: '2026-11-10', dados: tratarLinhasPresenca([presenca('1', 'Sem Prese Encerrada - Com Estoque'), presenca('2', 'Com Prese Encerrada - Com Estoque')]).dados }
    const { dados } = tratarLinhasPresenca([presenca('1', 'Com Prese Encerrada - Com Estoque')], { tipoAuditoria: 'Ruptura' })
    const analise = analisarDadosRuptura(dados, 10, { dataReferencia: '2026-11-11' }, [base])
    expect(analise.basePresenca).toMatchObject({ id: 9, data: '2026-11-10' })
    expect(analise.porSetor['10 - DOCE']).toMatchObject({ lidos: 2, pendentes: 0 })
  })
})
