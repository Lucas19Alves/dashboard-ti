import { describe, expect, it } from 'vitest'
import { lerArquivoBackup, montarArquivoBackup } from './backupFormato'
import { normalizarFormatoBackup, validarBackup } from './backup'

const itens = Array.from({ length: 50 }, (_, i) => ({ 'Código': String(1000 + i), Produto: `P${i}`, Local: 'G01A - G01A', 'Estoque atual': String(i), _estoque: i, _temPresenca: i % 3 > 0 }))
const conteudo = {
  auditorias: [{ id: 1, data: '2026-11-10', tipo: 'Presença', status: 'fechada', dados: itens, analise: { porSetor: { A: { lidos: 30, pendentes: 2 } } } }],
  vencimentos: [{ id: 1, _codigo: '1000', _validadeDate: new Date(Date.UTC(2026, 10, 20)), _validadeISO: '2026-11-20' }],
  planosAcao: [],
  naoVinculados: [{ codigo: '9', produto: 'X', sugestao: { local: '', confianca: 'nenhuma' } }]
}
const extras = { versao: 3, geradoEm: '2026-11-13T10:00:00.000Z', configuracoes: { mapaLoja: null, preferencias: { a: '1' } } }
const gzip = async texto => new Response(new Blob([texto]).stream().pipeThrough(new CompressionStream('gzip'))).blob()

describe('arquivo de backup', () => {
  it('v3 compacto: monta, lê e passa na validação com os mesmos dados', async () => {
    const { blob, compactado } = await montarArquivoBackup(conteudo, extras)
    expect(compactado).toBe(true)
    const lido = await lerArquivoBackup(blob)
    expect(lido).toStrictEqual(JSON.parse(JSON.stringify({ ...extras, ...conteudo })))
    expect(validarBackup(normalizarFormatoBackup(lido)).auditorias[0].dados).toHaveLength(50)
  })

  it('continua lendo backups antigos (v2 com gzip, v2 sem gzip e v1 sem versão)', async () => {
    const v2 = { versao: 2, geradoEm: 'x', ...conteudo }
    expect(await lerArquivoBackup(await gzip(JSON.stringify(v2)))).toStrictEqual(JSON.parse(JSON.stringify(v2)))
    expect(await lerArquivoBackup(new Blob([JSON.stringify(v2)]))).toStrictEqual(JSON.parse(JSON.stringify(v2)))
    const v1 = normalizarFormatoBackup(await lerArquivoBackup(new Blob([JSON.stringify({ auditorias: [], vencimentos: [] })])))
    expect(validarBackup(v1).versao).toBe(1)
  })

  it('erros claros para arquivo inválido', async () => {
    await expect(lerArquivoBackup(new Blob(['não é json']))).rejects.toThrow('JSON válido')
    await expect(lerArquivoBackup(new Blob([new Uint8Array([0x1f, 0x8b, 1, 2, 3])]))).rejects.toThrow('corrompido')
  })
})
