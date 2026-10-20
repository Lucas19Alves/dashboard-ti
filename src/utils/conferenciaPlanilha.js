import { interpretarLocal } from './mapaLoja'
import { isItemLido } from './itemLido'
import { momentoLeitura } from './sinaisAuditoria'
import { separarUsuario } from './usuario'
import { codigoDoItem, codigoLocal, localDoItem, usuarioDoItem } from './itemAuditoria'

// Conferência da planilha antes de salvar: colunas, horários, locais e usuários.
// nivel: 'erro' (a análise fica incompleta) | 'aviso' (vale conferir) | 'ok'.

const COLUNAS = {
  comum: [
    { nome: 'Código', chaves: ['Código', 'Codigo'], essencial: true },
    { nome: 'Produto', chaves: ['Produto'] },
    { nome: 'Local', chaves: ['Local'], essencial: true },
    { nome: 'Usuário', chaves: ['Usuário', 'Usuario'] },
    { nome: 'Auditado em', chaves: ['Auditado em'], prefixo: /^auditado[ _]em/i },
    { nome: 'Setor', chaves: ['Classe de Produto Raiz', 'Setor'] },
    { nome: 'Situação', chaves: ['Situação', 'Situação atual da auditoria'] }
  ],
  presenca: [
    { nome: 'Estoque atual', chaves: ['Estoque atual', 'Estoque Atual', '_estoque'] },
    { nome: 'Presença confirmada', chaves: ['Presença confirmada', '_temPresenca'] }
  ]
}

const MAX_EXEMPLOS = 12

export const conferirPlanilha = (dados, { tipo = 'Etiqueta', data = '' } = {}) => {
  const linhas = Array.isArray(dados) ? dados : []
  const chaves = new Set()
  linhas.slice(0, 200).forEach(item => Object.keys(item || {}).forEach(k => chaves.add(k)))
  const temColuna = c => c.chaves.some(k => chaves.has(k)) || (c.prefixo && [...chaves].some(k => c.prefixo.test(k)))
  const esperadas = [...COLUNAS.comum, ...(tipo === 'Etiqueta' ? [] : COLUNAS.presenca)]
  const faltando = esperadas.filter(c => !temColuna(c))

  let lidos = 0
  const semHorario = []
  const outroDia = []
  const semUsuario = []
  const usuariosSemMatricula = new Set()
  const locaisForaPadrao = new Map()
  let semLocal = 0
  const codigos = new Map()
  const dia = String(data || '').slice(0, 10)

  for (const item of linhas) {
    const codigo = codigoDoItem(item)
    if (codigo) codigos.set(codigo, (codigos.get(codigo) || 0) + 1)
    const local = item?.Local ? codigoLocal(localDoItem(item)) : ''
    if (!local) semLocal++
    else if (interpretarLocal(local).tipo === 'outro') locaisForaPadrao.set(local, (locaisForaPadrao.get(local) || 0) + 1)
    if (!isItemLido(item)) continue
    lidos++
    const usuario = usuarioDoItem(item)
    if (!usuario) semUsuario.push(codigo)
    else if (!separarUsuario(usuario).matricula) usuariosSemMatricula.add(usuario)
    const momento = momentoLeitura(item)
    if (!momento) semHorario.push(codigo)
    else if (dia && momento.data !== dia) outroDia.push(`${codigo} (${momento.data.split('-').reverse().join('/')})`)
  }
  const repetidos = [...codigos].filter(([, n]) => n > 1)

  const pct = n => (lidos ? (n / lidos) * 100 : 0)
  const verificacoes = [
    {
      chave: 'colunas',
      titulo: 'Colunas da planilha',
      nivel: faltando.some(c => c.essencial) ? 'erro' : faltando.length ? 'aviso' : 'ok',
      resumo: faltando.length ? `Faltando: ${faltando.map(c => c.nome).join(', ')}` : 'Todas as colunas esperadas foram encontradas',
      detalhe: faltando.length ? 'Sem essas colunas, partes da análise (mapa, usuários, horários) ficam vazias.' : ''
    },
    {
      chave: 'horario',
      titulo: 'Leituras sem horário',
      nivel: !lidos || !semHorario.length ? 'ok' : pct(semHorario.length) > 20 ? 'erro' : 'aviso',
      resumo: semHorario.length ? `${semHorario.length} de ${lidos} leituras (${pct(semHorario.length).toFixed(0)}%) sem data e hora` : 'Todas as leituras têm data e hora',
      detalhe: semHorario.length ? 'Ficam fora do andamento por hora, da previsão, do trajeto e do ritmo dos usuários.' : '',
      exemplos: semHorario.slice(0, MAX_EXEMPLOS)
    },
    {
      chave: 'dia',
      titulo: 'Leituras de outro dia',
      nivel: outroDia.length ? 'aviso' : 'ok',
      resumo: outroDia.length ? `${outroDia.length} leitura(s) com data diferente da auditoria` : dia ? 'Todas as leituras são do dia da auditoria' : 'Sem data de auditoria para comparar',
      detalhe: outroDia.length ? 'Pode ser a planilha de outro dia ou leituras feitas antes/depois.' : '',
      exemplos: outroDia.slice(0, MAX_EXEMPLOS)
    },
    {
      chave: 'locais',
      titulo: 'Locais fora do padrão do mapa',
      nivel: locaisForaPadrao.size || semLocal ? 'aviso' : 'ok',
      resumo: locaisForaPadrao.size || semLocal
        ? [locaisForaPadrao.size ? `${locaisForaPadrao.size} local(is) fora do padrão` : '', semLocal ? `${semLocal} item(ns) sem local` : ''].filter(Boolean).join(' · ')
        : 'Todos os locais seguem o padrão (G05A, PL01, F01...)',
      detalhe: locaisForaPadrao.size ? 'Não aparecem no mapa da loja até serem posicionados no modo de edição do mapa.' : '',
      exemplos: [...locaisForaPadrao].sort((a, b) => b[1] - a[1]).slice(0, MAX_EXEMPLOS).map(([l, n]) => `${l} (${n})`)
    },
    {
      chave: 'usuarios',
      titulo: 'Usuários',
      nivel: semUsuario.length || usuariosSemMatricula.size ? 'aviso' : 'ok',
      resumo: semUsuario.length || usuariosSemMatricula.size
        ? [semUsuario.length ? `${semUsuario.length} leitura(s) sem usuário` : '', usuariosSemMatricula.size ? `${usuariosSemMatricula.size} usuário(s) sem matrícula` : ''].filter(Boolean).join(' · ')
        : 'Todas as leituras têm usuário com matrícula',
      detalhe: usuariosSemMatricula.size ? 'Sem matrícula, a mesma pessoa pode aparecer com nomes diferentes entre auditorias.' : '',
      exemplos: [...usuariosSemMatricula].slice(0, MAX_EXEMPLOS)
    },
    {
      chave: 'repetidos',
      titulo: 'Códigos repetidos',
      nivel: repetidos.length ? 'aviso' : 'ok',
      resumo: repetidos.length ? `${repetidos.length} código(s) aparecem mais de uma vez` : 'Nenhum código repetido',
      detalhe: repetidos.length ? 'Normal quando o produto está em mais de um local; confira se não é a planilha duplicada.' : '',
      exemplos: repetidos.slice(0, MAX_EXEMPLOS).map(([c, n]) => `${c} (${n}×)`)
    }
  ]
  const nivel = verificacoes.some(v => v.nivel === 'erro') ? 'erro' : verificacoes.some(v => v.nivel === 'aviso') ? 'aviso' : 'ok'
  return { total: linhas.length, lidos, pendentes: linhas.length - lidos, nivel, verificacoes }
}
