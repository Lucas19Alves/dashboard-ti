// Relatórios impressos (Salvar como PDF pelo navegador) com o mesmo visual do sistema:
// cabeçalho, indicadores, gráficos de barras em CSS e tabelas.

export const escapeHtml = (v) => String(v ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const TONS = { bom: '#059669', ruim: '#dc2626', alerta: '#d97706', neutro: '#2563eb', cinza: '#94a3b8' }
const cor = tom => TONS[tom] || TONS.neutro
const numero = v => (typeof v === 'number' ? v.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : v)
const alinhar = col => (col.alinhamento === 'right' ? 'right' : col.alinhamento === 'center' ? 'center' : 'left')

const ESTILOS = `
  @page { size: A4 landscape; margin: 10mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Inter, system-ui, -apple-system, "Segoe UI", sans-serif; font-size: 11px; color: #0f172a; margin: 0; }
  .topo { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; padding: 14px 18px; border-radius: 12px; background: #1d4ed8; color: #fff; margin-bottom: 14px; }
  .topo h1 { font-size: 19px; margin: 0; }
  .topo p { margin: 3px 0 0; opacity: .85; font-size: 11px; }
  .topo .marca { text-align: right; font-size: 10px; opacity: .85; white-space: nowrap; }
  .topo .marca b { display: block; font-size: 12px; opacity: 1; }
  h2 { font-size: 13px; margin: 0 0 8px; color: #0f172a; }
  .sub { color: #64748b; font-size: 10px; margin: -4px 0 8px; }
  .cards, .indicadores { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; margin-bottom: 14px; }
  .card, .indicador { border-radius: 10px; padding: 9px 11px; background: #f8fafc; border: 1px solid #e2e8f0; border-top: 3px solid var(--cor, #2563eb); }
  .card-label, .indicador .rotulo { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #64748b; }
  .card-value, .indicador .valor { font-size: 19px; font-weight: 800; margin-top: 2px; color: var(--cor-texto, #0f172a); }
  .card-sub, .indicador .detalhe { font-size: 9.5px; color: #64748b; margin-top: 1px; }
  .section, .secao { break-inside: avoid; page-break-inside: avoid; margin-bottom: 16px; }
  .secao.tabela { break-inside: auto; page-break-inside: auto; }
  .secao.tabela > h2, .secao.tabela > .sub { break-after: avoid; page-break-after: avoid; }
  .grade { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .grade > .secao { margin-bottom: 0; }
  .painel { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; }
  .barras { display: grid; gap: 5px; }
  .barra { display: grid; grid-template-columns: 28% 1fr minmax(64px, auto); align-items: center; gap: 8px; }
  .barra .r { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; color: #334155; }
  .barra .trilho { position: relative; height: 10px; border-radius: 99px; background: #eef2f7; }
  .barra .preenchido { position: absolute; inset: 0 auto 0 0; border-radius: 99px; }
  .barra .meta { position: absolute; top: -3px; bottom: -3px; width: 0; border-left: 1.5px dashed #475569; }
  .barra .v { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .colunas { display: flex; align-items: flex-end; gap: 6px; height: 130px; padding: 0 44px 0 2px; border-bottom: 1px solid #cbd5e1; position: relative; }
  .colunas .c { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; height: 100%; }
  .colunas .c .b { width: 70%; max-width: 34px; border-radius: 4px 4px 0 0; }
  .colunas .c .n { font-size: 9px; font-weight: 700; margin-bottom: 2px; }
  .colunas .linha-meta { position: absolute; left: 0; right: 0; border-top: 1.5px dashed #475569; }
  .colunas .linha-meta span { position: absolute; right: 0; top: -6px; font-size: 8.5px; color: #475569; background: #fff; padding: 0 2px; }
  .rotulos { display: flex; gap: 6px; padding: 3px 44px 0 2px; }
  .rotulos span { flex: 1; text-align: center; font-size: 8.5px; color: #64748b; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .empilhada { display: flex; height: 16px; border-radius: 99px; overflow: hidden; gap: 2px; background: #fff; }
  .legenda { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 7px; font-size: 10px; color: #334155; }
  .legenda i { display: inline-block; width: 9px; height: 9px; border-radius: 3px; margin-right: 4px; vertical-align: -1px; }
  .destaques { margin: 0; padding: 0; list-style: none; display: grid; gap: 5px; }
  .destaques li { padding: 6px 9px; border-radius: 8px; background: #f8fafc; border-left: 3px solid var(--cor, #2563eb); }
  table { width: 100%; border-collapse: collapse; margin-top: 2px; }
  th { background: #f1f5f9; color: #475569; font-size: 9.5px; text-transform: uppercase; letter-spacing: .03em; font-weight: 700; padding: 6px 7px; text-align: left; border-bottom: 1px solid #cbd5e1; }
  td { padding: 5px 7px; border-bottom: 1px solid #eef2f7; vertical-align: middle; }
  tr:nth-child(even) td { background: #fafbfc; }
  tr { break-inside: avoid; }
  td .mini { display: inline-block; vertical-align: middle; width: 54px; height: 6px; border-radius: 99px; background: #eef2f7; margin-right: 6px; position: relative; overflow: hidden; }
  td .mini b { position: absolute; inset: 0 auto 0 0; border-radius: 99px; }
  .rodape { margin-top: 10px; font-size: 9px; color: #94a3b8; text-align: right; }
  .vazio { color: #94a3b8; font-style: italic; }
  thead { display: table-header-group; }
  .pagina { break-before: page; page-break-before: always; }
  .capitulo { break-after: avoid; page-break-after: avoid; display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; border-bottom: 2px solid #1d4ed8; padding-bottom: 6px; margin-bottom: 12px; }
  .capitulo h2 { display: flex; align-items: center; gap: 8px; font-size: 16px; margin: 0; }
  .capitulo h2 .num { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 6px; background: #1d4ed8; color: #fff; font-size: 12px; }
  .capitulo p { margin: 0; color: #64748b; font-size: 10px; text-align: right; max-width: 55%; }
  .sumario { display: flex; flex-wrap: wrap; gap: 6px; margin: -6px 0 12px; font-size: 10px; color: #475569; }
  .sumario span { border: 1px solid #e2e8f0; border-radius: 99px; padding: 2px 9px; }
  .sumario b { color: #1d4ed8; margin-right: 3px; }
  .selo { display: inline-block; border-radius: 99px; padding: 1px 7px; font-size: 9px; font-weight: 700; white-space: nowrap; }
  .chips { display: flex; flex-wrap: wrap; gap: 5px; }
  .chips span { border-radius: 6px; padding: 3px 8px; background: #fef2f2; color: #b91c1c; font-weight: 600; font-size: 10px; }
  .nota { font-size: 9.5px; color: #64748b; margin: 6px 0 0; }
  svg.spark { display: block; }
`

const cabecalho = (titulo, subtitulo) => {
  const agora = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  return `<div class="topo"><div><h1>${escapeHtml(titulo)}</h1>${subtitulo ? `<p>${escapeHtml(subtitulo)}</p>` : ''}</div>
    <div class="marca"><b>Dashboard TI</b>Gerado em ${escapeHtml(agora)}</div></div>`
}

// ---------- Blocos ----------
export const blocoIndicadores = (indicadores = []) => (indicadores.length ? `<div class="indicadores">${indicadores.map(i => `
  <div class="indicador" style="--cor:${cor(i.tom)};${i.tom && i.tom !== 'neutro' ? `--cor-texto:${cor(i.tom)}` : ''}">
    <div class="rotulo">${escapeHtml(i.rotulo)}</div><div class="valor">${escapeHtml(numero(i.valor))}</div>
    ${i.detalhe ? `<div class="detalhe">${escapeHtml(i.detalhe)}</div>` : ''}
  </div>`).join('')}</div>` : '')

// Barras horizontais. `meta` (mesma unidade de valor) desenha linha tracejada.
export const blocoBarras = ({ titulo, subtitulo, barras = [], meta = null, sufixo = '', maximo = null }) => {
  if (!barras.length) return ''
  const max = maximo ?? (Math.max(meta || 0, ...barras.map(b => Number(b.valor) || 0)) * 1.05 || 1)
  const pct = v => Math.max(0, Math.min(100, ((Number(v) || 0) / max) * 100))
  return `<div class="secao painel"><h2>${escapeHtml(titulo)}</h2>${subtitulo ? `<p class="sub">${escapeHtml(subtitulo)}</p>` : ''}
    <div class="barras">${barras.map(b => `<div class="barra"><span class="r" title="${escapeHtml(b.rotulo)}">${escapeHtml(b.rotulo)}</span>
      <span class="trilho"><span class="preenchido" style="width:${pct(b.valor)}%;background:${cor(b.tom)}"></span>${meta !== null ? `<span class="meta" style="left:${pct(meta)}%"></span>` : ''}</span>
      <span class="v">${escapeHtml(b.texto ?? `${numero(b.valor)}${sufixo}`)}</span></div>`).join('')}</div></div>`
}

// Colunas verticais (ex.: evolução mensal, leituras por hora).
export const blocoColunas = ({ titulo, subtitulo, colunas = [], meta = null, sufixo = '' }) => {
  if (!colunas.length) return ''
  const max = Math.max(meta ? meta * 1.4 : 0, ...colunas.map(c => Number(c.valor) || 0)) * 1.12 || 1
  const pct = v => Math.max(0, Math.min(100, ((Number(v) || 0) / max) * 100))
  return `<div class="secao painel"><h2>${escapeHtml(titulo)}</h2>${subtitulo ? `<p class="sub">${escapeHtml(subtitulo)}</p>` : ''}
    <div class="colunas">${meta !== null ? `<div class="linha-meta" style="bottom:${pct(meta)}%"><span>meta ${escapeHtml(numero(meta))}${escapeHtml(sufixo)}</span></div>` : ''}
    ${colunas.map(c => `<div class="c"><span class="n">${Number.isFinite(Number(c.valor)) ? escapeHtml(`${numero(Number(c.valor))}${sufixo}`) : ''}</span><span class="b" style="height:${pct(c.valor)}%;background:${cor(c.tom)}"></span></div>`).join('')}</div>
    <div class="rotulos">${colunas.map(c => `<span>${escapeHtml(c.rotulo)}</span>`).join('')}</div></div>`
}

// Composição (partes de um todo) em uma barra empilhada com legenda.
export const blocoComposicao = ({ titulo, partes = [] }) => {
  const total = partes.reduce((s, p) => s + (Number(p.valor) || 0), 0)
  if (!total) return ''
  return `<div class="secao painel"><h2>${escapeHtml(titulo)}</h2><div class="empilhada">${partes.filter(p => p.valor > 0).map(p => `<span style="width:${(p.valor / total) * 100}%;background:${cor(p.tom)}"></span>`).join('')}</div>
    <div class="legenda">${partes.map(p => `<span><i style="background:${cor(p.tom)}"></i>${escapeHtml(p.rotulo)}: <b>${escapeHtml(numero(p.valor))}</b> (${((p.valor / total) * 100).toFixed(1)}%)</span>`).join('')}</div></div>`
}

export const blocoDestaques = ({ titulo = 'Destaques', itens = [] }) => (itens.length ? `<div class="secao"><h2>${escapeHtml(titulo)}</h2><ul class="destaques">
  ${itens.map(i => `<li style="--cor:${cor(i.tom === 'bom' ? 'bom' : i.tom === 'ruim' ? 'ruim' : 'neutro')}">${escapeHtml(i.texto)}</li>`).join('')}</ul></div>` : '')

// Tabela; colunas com `barra: { max, tom? }` ganham mini barra antes do valor.
export const blocoTabela = ({ titulo, subtitulo, colunas = [], linhas = [] }) => {
  if (!linhas.length) return ''
  const celula = (linha, col) => {
    const v = linha?.[col.chave]
    const texto = escapeHtml(col.format && v != null ? col.format(v) : numero(v ?? ''))
    if (col.html) return col.html(v, linha)
    if (!col.barra || typeof v !== 'number') return texto
    const largura = Math.max(0, Math.min(100, (v / (col.barra.max || 1)) * 100))
    const tom = typeof col.barra.tom === 'function' ? col.barra.tom(v, linha) : col.barra.tom
    return `<span class="mini"><b style="width:${largura}%;background:${cor(tom)}"></b></span>${texto}`
  }
  return `<div class="secao tabela">${titulo ? `<h2>${escapeHtml(titulo)}</h2>` : ''}${subtitulo ? `<p class="sub">${escapeHtml(subtitulo)}</p>` : ''}<table>
    <thead><tr>${colunas.map(c => `<th style="text-align:${alinhar(c)}">${escapeHtml(c.titulo)}</th>`).join('')}</tr></thead>
    <tbody>${linhas.map(l => `<tr>${colunas.map(c => `<td style="text-align:${alinhar(c)}">${celula(l, c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
}

// Título de capítulo; `novaPagina` começa uma folha nova.
export const blocoCapitulo = ({ numero, titulo, descricao = '', novaPagina = false }) => `<div class="capitulo${novaPagina ? ' pagina' : ''}">
  <h2>${numero ? `<span class="num">${escapeHtml(numero)}</span>` : ''}${escapeHtml(titulo)}</h2>${descricao ? `<p>${escapeHtml(descricao)}</p>` : ''}</div>`

export const selo = (texto, tom = 'neutro') => {
  const fundo = { bom: '#ecfdf5', ruim: '#fef2f2', alerta: '#fffbeb', neutro: '#eff6ff', cinza: '#f1f5f9' }[tom] || '#eff6ff'
  return `<span class="selo" style="background:${fundo};color:${cor(tom)}">${escapeHtml(texto)}</span>`
}

// Mini gráfico de linha em SVG; `meta` desenha linha tracejada e o último ponto fica colorido.
export const sparkline = (valores = [], { meta = null, largura = 96, altura = 22 } = {}) => {
  const v = valores.map(Number).filter(Number.isFinite)
  if (v.length < 2) return '<span class="vazio">—</span>'
  const max = Math.max(...v, meta ?? 0) * 1.1 || 1
  const x = i => ((i / (v.length - 1)) * (largura - 4) + 2).toFixed(1)
  const y = n => (altura - 2 - (n / max) * (altura - 4)).toFixed(1)
  const ultimo = v.at(-1)
  const tom = meta !== null && ultimo > meta ? 'ruim' : 'bom'
  return `<svg class="spark" width="${largura}" height="${altura}" viewBox="0 0 ${largura} ${altura}">
    ${meta !== null ? `<line x1="0" x2="${largura}" y1="${y(meta)}" y2="${y(meta)}" stroke="#94a3b8" stroke-width="1" stroke-dasharray="3 2"/>` : ''}
    <polyline fill="none" stroke="#64748b" stroke-width="1.4" stroke-linejoin="round" points="${v.map((n, i) => `${x(i)},${y(n)}`).join(' ')}"/>
    <circle cx="${x(v.length - 1)}" cy="${y(ultimo)}" r="2.4" fill="${cor(tom)}"/></svg>`
}

export const grade = (...blocos) => {
  const validos = blocos.filter(Boolean)
  if (!validos.length) return ''
  return validos.length === 1 ? validos[0] : `<div class="grade secao">${validos.join('')}</div>`
}

// ---------- Janela de impressão ----------
const textoCss = t => `"${String(t ?? '').replace(/[\\"]/g, '\\$&').replace(/[\r\n]+/g, ' ').replace(/</g, '\\3c ')}"`
// Numeração das folhas no rodapé (navegadores com suporte a margens de @page).
const estiloPaginacao = rodape => `@page { @bottom-left { content: ${textoCss(rodape)}; font: 8.5px Inter, system-ui, sans-serif; color: #94a3b8; }
  @bottom-right { content: "Página " counter(page) " de " counter(pages); font: 8.5px Inter, system-ui, sans-serif; color: #94a3b8; } }`

const abrirJanela = (titulo, corpo, { rodape = null } = {}) => {
  if (typeof window === 'undefined') return
  const win = window.open('', '_blank')
  if (!win) return
  win.document.open()
  win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8" /><title>${escapeHtml(titulo)}</title><style>${ESTILOS}${rodape ? estiloPaginacao(rodape) : ''}</style></head>
    <body>${corpo}${rodape ? '' : '<p class="rodape">Dashboard TI · dados salvos neste navegador</p>'}</body></html>`)
  win.document.close()
  win.onafterprint = () => { win.close() }
  setTimeout(() => { win.focus(); win.print() }, 350)
}

// Relatório completo: cabeçalho + blocos HTML já montados.
// `rodape` ativa a numeração "Página X de Y" com esse texto à esquerda.
export const imprimirRelatorioVisual = ({ titulo, subtitulo = '', indicadores = [], blocos = [], antesDosIndicadores = '', rodape = null }) => {
  abrirJanela(titulo, `${cabecalho(titulo, subtitulo)}${antesDosIndicadores}${blocoIndicadores(indicadores)}${blocos.filter(Boolean).join('')}`, { rodape })
}

// Lista de itens com resumo gráfico opcional.
export const imprimirListaVisual = ({ titulo, subtitulo = '', indicadores = [], grafico = null, colunas, linhas }) => {
  imprimirRelatorioVisual({
    titulo,
    subtitulo,
    indicadores,
    blocos: [grafico ? blocoBarras({ titulo: grafico.titulo, barras: grafico.barras }) : '', blocoTabela({ titulo: 'Itens', colunas, linhas })]
  })
}

// Colunas usadas para resumir automaticamente uma tabela impressa.
const COLUNAS_RESUMO = [['Classe de Produto Raiz', 'setor'], ['_setor', 'setor'], ['setor', 'setor'], ['Setor', 'setor'], ['_prazo', 'situação'], ['Local', 'local'], ['_fornecedor', 'fornecedor'], ['Usuário', 'usuário']]

// Compatível com as chamadas existentes: tabela + gráfico automático de contagem.
export const printTableInNewWindow = (data, columns, title = 'Relatório') => {
  if (!Array.isArray(data) || data.length === 0 || !Array.isArray(columns) || columns.length === 0) return
  const linhas = data.map(item => Object.fromEntries(columns.map(c => [c.chave, c.format && item?.[c.chave] != null ? c.format(item[c.chave]) : item?.[c.chave]])))
  let grafico = null
  const candidata = COLUNAS_RESUMO.find(([chave]) => columns.some(c => c.chave === chave) || data.some(d => d?.[chave] !== undefined && typeof d[chave] !== 'number'))
  if (candidata && data.length > 1) {
    const contagem = new Map()
    for (const item of data) {
      const v = String(item?.[candidata[0]] ?? '').trim() || 'Não informado'
      contagem.set(v, (contagem.get(v) || 0) + 1)
    }
    if (contagem.size > 1 && contagem.size < data.length) {
      grafico = { titulo: `Itens por ${candidata[1]}`, barras: [...contagem].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([rotulo, valor]) => ({ rotulo, valor })) }
    }
  }
  imprimirListaVisual({
    titulo: title,
    indicadores: [{ rotulo: 'Registros', valor: data.length.toLocaleString('pt-BR') }],
    grafico,
    colunas: columns.map(c => ({ ...c, format: undefined })),
    linhas
  })
}

// Compatível com as chamadas existentes que montam o HTML do corpo.
export const printHtmlInNewWindow = (title = 'Relatório', bodyHtml = '') => {
  abrirJanela(String(title || 'Relatório').replace(/_/g, ' '), bodyHtml)
}
