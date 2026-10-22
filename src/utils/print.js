// Relatórios impressos (Salvar como PDF pelo navegador) com o mesmo visual do sistema:
// cabeçalho, indicadores, gráficos de barras em CSS e tabelas.
import { configuracoes } from '../composables/useConfiguracoes'

export const escapeHtml = (v) => String(v ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const TONS = { bom: '#047857', ruim: '#b91c1c', alerta: '#b45309', neutro: '#1e3a8a', cinza: '#64748b' }
const cor = tom => TONS[tom] || TONS.neutro
const numero = v => (typeof v === 'number' ? v.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : v)
const alinhar = col => (col.alinhamento === 'right' ? 'right' : col.alinhamento === 'center' ? 'center' : 'left')

// Visual sóbrio para repassar a líderes: A4, tipografia em pt, cabeçalho com régua,
// seções numeradas, tabelas que quebram página repetindo o cabeçalho e rodapé paginado.
const ESTILOS = `
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html { font-size: 9.5pt; }
  body { font-family: "IBM Plex Sans", Inter, system-ui, -apple-system, "Segoe UI", Arial, sans-serif; color: #0f172a; margin: 0; line-height: 1.35; }
  .tela { max-width: 190mm; margin: 0 auto; padding: 10mm 0; }
  .paisagem .tela { max-width: 277mm; }
  @media print { .tela, .paisagem .tela { max-width: none; padding: 0; } }
  .topo { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; padding-bottom: 8px; border-bottom: 2px solid #1e3a8a; margin-bottom: 10px; }
  .topo .sistema { font-size: 7.5pt; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: #1e3a8a; }
  .topo h1 { font-size: 16pt; margin: 2px 0 0; letter-spacing: -.01em; }
  .topo p { margin: 2px 0 0; color: #475569; font-size: 9pt; }
  .topo .meta { text-align: right; font-size: 8pt; color: #475569; white-space: nowrap; }
  .topo .meta b { color: #0f172a; }
  .contexto { display: grid; grid-template-columns: repeat(auto-fit, minmax(42mm, 1fr)); gap: 0; border: 1px solid #cbd5e1; border-radius: 4px; margin-bottom: 10px; }
  .contexto div { padding: 4px 8px; border-right: 1px solid #e2e8f0; }
  .contexto div:last-child { border-right: 0; }
  .contexto span { display: block; font-size: 6.8pt; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #64748b; }
  .contexto b { font-size: 9pt; }
  h2 { font-size: 10.5pt; margin: 0 0 4px; color: #0f172a; }
  .sub { color: #64748b; font-size: 8pt; margin: 0 0 6px; }
  .indicadores { display: grid; grid-template-columns: repeat(auto-fit, minmax(32mm, 1fr)); gap: 6px; margin-bottom: 12px; break-inside: avoid; }
  .indicador { border: 1px solid #cbd5e1; border-left: 3px solid var(--cor, #1e3a8a); border-radius: 3px; padding: 5px 8px; }
  .indicador .rotulo { font-size: 6.8pt; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #64748b; }
  .indicador .valor { font-size: 14pt; font-weight: 800; color: var(--cor-texto, #0f172a); line-height: 1.15; }
  .indicador .detalhe { font-size: 7.5pt; color: #64748b; }
  .secao { break-inside: avoid; page-break-inside: avoid; margin-bottom: 12px; }
  .secao.tabela { break-inside: auto; page-break-inside: auto; }
  .secao.tabela > h2, .secao.tabela > .sub { break-after: avoid; page-break-after: avoid; }
  .painel { border: 1px solid #e2e8f0; border-radius: 4px; padding: 8px 10px; }
  .barras { display: grid; gap: 3px; }
  .barra { display: grid; grid-template-columns: 30% 1fr minmax(18mm, auto); align-items: center; gap: 6px; font-size: 8.5pt; }
  .barra .r { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; color: #334155; }
  .barra .trilho { position: relative; height: 7px; border-radius: 2px; background: #eef2f7; }
  .barra .preenchido { position: absolute; inset: 0 auto 0 0; border-radius: 2px; }
  .barra .meta { position: absolute; top: -2px; bottom: -2px; width: 0; border-left: 1.2px dashed #334155; }
  .barra .v { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .colunas { display: flex; align-items: flex-end; gap: 4px; height: 34mm; padding: 0 30px 0 2px; border-bottom: 1px solid #94a3b8; position: relative; }
  .colunas .c { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; height: 100%; }
  .colunas .c .b { width: 70%; max-width: 9mm; border-radius: 1px 1px 0 0; }
  .colunas .c .n { font-size: 7pt; font-weight: 700; margin-bottom: 1px; }
  .colunas .linha-meta { position: absolute; left: 0; right: 0; border-top: 1.2px dashed #334155; }
  .colunas .linha-meta span { position: absolute; right: 0; top: -5px; font-size: 7pt; color: #334155; background: #fff; padding: 0 2px; }
  .rotulos { display: flex; gap: 4px; padding: 2px 30px 0 2px; }
  .rotulos span { flex: 1; text-align: center; font-size: 7pt; color: #64748b; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .empilhada { display: flex; height: 10px; border-radius: 2px; overflow: hidden; gap: 1px; }
  .legenda { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: 5px; font-size: 8pt; color: #334155; }
  .legenda i { display: inline-block; width: 8px; height: 8px; border-radius: 1px; margin-right: 4px; vertical-align: -1px; }
  .destaques { margin: 0; padding: 0; list-style: none; display: grid; gap: 3px; }
  .destaques li { padding: 4px 8px; border-left: 3px solid var(--cor, #1e3a8a); background: #f8fafc; font-size: 8.5pt; }
  table { width: 100%; border-collapse: collapse; font-size: 8.3pt; }
  th { background: #f1f5f9; color: #334155; font-size: 7pt; text-transform: uppercase; letter-spacing: .04em; font-weight: 700; padding: 4px 5px; text-align: left; border-bottom: 1.2px solid #94a3b8; }
  td { padding: 3px 5px; border-bottom: 1px solid #e2e8f0; vertical-align: top; overflow-wrap: anywhere; }
  tr:nth-child(even) td { background: #fafbfc; }
  tr.grupo td { background: #eef2f7 !important; font-weight: 700; color: #14213d; border-top: 1.5px solid #94a3b8; padding: 4px 5px; }
  tr.grupo td span { float: right; font-weight: 600; color: #475569; }
  tr.grupo { break-after: avoid; page-break-after: avoid; }
  tr { break-inside: avoid; }
  td .mini { display: inline-block; vertical-align: middle; width: 14mm; height: 5px; border-radius: 1px; background: #eef2f7; margin-right: 5px; position: relative; overflow: hidden; }
  td .mini b { position: absolute; inset: 0 auto 0 0; }
  .num { font-variant-numeric: tabular-nums; white-space: nowrap; }
  .vazio { color: #94a3b8; font-style: italic; }
  thead { display: table-header-group; }
  .pagina { break-before: page; page-break-before: always; }
  .capitulo { break-after: avoid; page-break-after: avoid; display: flex; align-items: baseline; justify-content: space-between; gap: 12px; border-bottom: 1px solid #94a3b8; padding-bottom: 3px; margin: 4px 0 8px; }
  .capitulo h2 { font-size: 11.5pt; margin: 0; }
  .capitulo h2 .num { color: #1e3a8a; margin-right: 6px; }
  .capitulo p { margin: 0; color: #64748b; font-size: 8pt; text-align: right; max-width: 60%; }
  .selo { display: inline-block; border-radius: 2px; padding: 0 5px; font-size: 7.5pt; font-weight: 700; white-space: nowrap; border: 1px solid currentColor; }
  .chips { display: flex; flex-wrap: wrap; gap: 3px; }
  .chips span { border: 1px solid #cbd5e1; border-radius: 2px; padding: 1px 6px; font-weight: 600; font-size: 8pt; }
  .nota { font-size: 8pt; color: #64748b; margin: 4px 0 0; }
  .observacoes { border: 1px solid #cbd5e1; border-radius: 3px; padding: 6px 9px; white-space: pre-wrap; font-size: 9pt; }
  .assinaturas { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14mm; margin-top: 16mm; break-inside: avoid; }
  .assinaturas div { border-top: 1px solid #0f172a; padding-top: 3px; font-size: 8pt; color: #475569; text-align: center; }
  svg.spark { display: block; }
  .aviso-tela { position: sticky; top: 0; background: #1e3a8a; color: #fff; padding: 6px 12px; font-size: 9pt; text-align: center; }
  @media print { .aviso-tela { display: none; } }
`

const agoraBR = () => new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

// Empresa, unidade e emissor vêm de Configurações > Relatórios.
const origem = () => [configuracoes.relatorio.empresa, configuracoes.relatorio.unidade].map(v => String(v || '').trim()).filter(Boolean).join(' · ')
const cabecalho = (titulo, subtitulo) => {
  const emissor = String(configuracoes.relatorio.emissor || '').trim()
  return `<div class="topo"><div><div class="sistema">${escapeHtml(origem() || 'Dashboard TI')} · Relatório</div><h1>${escapeHtml(titulo)}</h1>${subtitulo ? `<p>${escapeHtml(subtitulo)}</p>` : ''}</div>
  <div class="meta">Gerado em <b>${escapeHtml(agoraBR())}</b>${emissor ? `<br>Emitido por <b>${escapeHtml(emissor)}</b>` : ''}</div></div>`
}

// Ficha técnica do relatório: período, filtros, loja... ([{ rotulo, valor }]).
export const blocoContexto = (itens = []) => {
  const validos = itens.filter(i => i && i.valor !== undefined && i.valor !== null && i.valor !== '')
  return validos.length ? `<div class="contexto">${validos.map(i => `<div><span>${escapeHtml(i.rotulo)}</span><b>${escapeHtml(i.valor)}</b></div>`).join('')}</div>` : ''
}

export const blocoObservacoes = (texto) => (String(texto || '').trim() ? `<div class="secao"><h2>Observações</h2><div class="observacoes">${escapeHtml(texto.trim())}</div></div>` : '')

export const blocoAssinaturas = (rotulos = ['Responsável', 'Liderança', 'Data']) => `<div class="assinaturas">${rotulos.map(r => `<div>${escapeHtml(r)}</div>`).join('')}</div>`

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
export const blocoDestaques = ({ titulo = 'Destaques', itens = [] }) => (itens.length ? `<div class="secao"><h2>${escapeHtml(titulo)}</h2><ul class="destaques">
  ${itens.map(i => `<li style="--cor:${cor(i.tom === 'bom' ? 'bom' : i.tom === 'ruim' ? 'ruim' : 'neutro')}">${escapeHtml(i.texto)}</li>`).join('')}</ul></div>` : '')

// Tabela; colunas com `barra: { max, tom? }` ganham mini barra antes do valor.
// Linha { __grupo: 'título', __detalhe: 'n itens' } vira cabeçalho de grupo ocupando a largura toda.
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
    <tbody>${linhas.map(l => (l?.__grupo !== undefined
      ? `<tr class="grupo"><td colspan="${colunas.length}">${escapeHtml(l.__grupo)}<span>${escapeHtml(l.__detalhe || '')}</span></td></tr>`
      : `<tr>${colunas.map(c => `<td${c.alinhamento === 'right' ? ' class="num"' : ''} style="text-align:${alinhar(c)}">${celula(l, c)}</td>`).join('')}</tr>`)).join('')}</tbody></table></div>`
}

// Título de capítulo; `novaPagina` começa uma folha nova.
export const blocoCapitulo = ({ numero, titulo, descricao = '', novaPagina = false }) => `<div class="capitulo${novaPagina ? ' pagina' : ''}">
  <h2>${numero ? `<span class="num">${escapeHtml(numero)}.</span>` : ''}${escapeHtml(titulo)}</h2>${descricao ? `<p>${escapeHtml(descricao)}</p>` : ''}</div>`

export const selo = (texto, tom = 'neutro') => {
  return `<span class="selo" style="color:${cor(tom)}">${escapeHtml(texto)}</span>`
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

const textoCss = t => `"${String(t ?? '').replace(/[\\"]/g, '\\$&').replace(/[\r\n]+/g, ' ').replace(/</g, '\\3c ')}"`

// Paisagem quando alguma tabela tem muitas colunas; senão retrato.
export const orientacaoAutomatica = (html) => {
  const maior = Math.max(0, ...String(html).split('<thead>').slice(1).map(t => (t.split('</thead>')[0].match(/<th/g) || []).length))
  return maior > 8 ? 'paisagem' : 'retrato'
}

const abrirJanela = (titulo, corpo, { orientacao = 'auto', rodape = '' } = {}) => {
  if (typeof window === 'undefined') return
  const final = orientacao === 'auto' ? orientacaoAutomatica(corpo) : orientacao
  const win = window.open('', '_blank')
  if (!win) return
  const textoRodape = rodape || `${origem() || 'Dashboard TI'} · ${titulo}`
  win.document.open()
  win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8" /><title>${escapeHtml(titulo)}</title><style>${ESTILOS}
    @page { size: A4 ${final === 'paisagem' ? 'landscape' : 'portrait'}; margin: 14mm 12mm 16mm;
      @bottom-left { content: ${textoCss(textoRodape)}; font: 7.5pt "IBM Plex Sans", Inter, system-ui, sans-serif; color: #64748b; }
      @bottom-right { content: "Página " counter(page) " de " counter(pages); font: 7.5pt "IBM Plex Sans", Inter, system-ui, sans-serif; color: #64748b; } }</style></head>
    <body class="${final}"><div class="aviso-tela">Na janela de impressão, escolha “Salvar como PDF” · A4 ${final}</div><div class="tela">${corpo}</div></body></html>`)
  win.document.close()
  win.onafterprint = () => { win.close() }
  setTimeout(() => { win.focus(); win.print() }, 400)
}

// Relatório padrão do sistema: cabeçalho, ficha técnica, indicadores e seções numeradas.
// secoes: [{ titulo, descricao, html, novaPagina }] (seções sem html são ignoradas).
export const imprimirRelatorio = ({ titulo, subtitulo = '', contexto = [], indicadores = [], secoes = [], orientacao = configuracoes.relatorio.orientacao || 'paisagem', observacoes = '', assinaturas = null, rodape = '' }) => {
  const validas = secoes.filter(sec => sec && String(sec.html || '').trim())
  const numerar = validas.filter(sec => sec.titulo).length > 1
  let n = 0
  const corpo = [
    cabecalho(titulo, subtitulo),
    blocoContexto(contexto),
    blocoIndicadores(indicadores),
    ...validas.map(sec => `${sec.titulo ? blocoCapitulo({ numero: numerar ? String(++n) : '', titulo: sec.titulo, descricao: sec.descricao || '', novaPagina: Boolean(sec.novaPagina) }) : ''}${sec.html}`),
    blocoObservacoes(observacoes),
    assinaturas ? blocoAssinaturas(assinaturas) : ''
  ].join('')
  abrirJanela(titulo, corpo, { orientacao, rodape })
}

