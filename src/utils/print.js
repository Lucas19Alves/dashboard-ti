export const printTable = async (data, columns, title = 'Relatório') => {
  if (!Array.isArray(data) || data.length === 0 || !Array.isArray(columns) || columns.length === 0) return

  const escapeHtml = (v) => {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  const container = document.createElement('div')
  container.style.position = 'absolute'
  container.style.left = '-10000px'
  container.style.top = '0'
  container.style.width = '1200px'
  container.style.background = '#fff'
  container.style.padding = '20px'

  const headers = columns
    .map(c => `<th style="text-align:${c.alinhamento || 'left'};border:1px solid #ddd;padding:8px;background:#f2f2f2;font-weight:700;">${escapeHtml(c.titulo)}</th>`)
    .join('')

  const rows = data
    .map((item) => {
      const cells = columns
        .map((c) => {
          let val = item?.[c.chave]
          if (val === undefined || val === null) val = ''
          return `<td style="text-align:${c.alinhamento || 'left'};border:1px solid #ddd;padding:8px;">${escapeHtml(val)}</td>`
        })
        .join('')
      return `<tr>${cells}</tr>`
    })
    .join('')

  container.innerHTML = `
    <div style="font-family:sans-serif;">
      <h1 style="margin:0 0 16px 0;font-size:20px;color:#111;">${escapeHtml(title)}</h1>
      <table style="width:100%;border-collapse:collapse;font-size:11px;">
        <thead><tr>${headers}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `

  document.body.appendChild(container)

  try {
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    const html2pdf = (await import('html2pdf.js')).default
    const filename = String(title || 'relatorio').replace(/[^\w\-]+/g, '_') + '.pdf'
    const opt = {
      margin: [10, 10, 10, 10],
      filename,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, scrollY: 0, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
      pagebreak: { mode: ['css', 'legacy'] }
    }
    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready } catch {}
    }
    await html2pdf().from(container).set(opt).save()
  } finally {
    document.body.removeChild(container)
  }
}

export const printTableInNewWindow = (data, columns, title = 'Relatório') => {
  if (!Array.isArray(data) || data.length === 0 || !Array.isArray(columns) || columns.length === 0) return
  if (typeof window === 'undefined') return
  const win = window.open('', '_blank')
  if (!win) return
  const doc = win.document
  const safeTitle = String(title || 'Relatório')
  const escapeHtml = (v) => {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }
  const headers = columns
    .map(c => `<th>${escapeHtml(c.titulo)}</th>`)
    .join('')
  const rows = data
    .map(item => {
      const cells = columns
        .map(c => {
          const val = item?.[c.chave]
          return `<td>${escapeHtml(val)}</td>`
        })
        .join('')
      return `<tr>${cells}</tr>`
    })
    .join('')
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(safeTitle)}</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 10mm;
          }
          body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            font-size: 11px;
            color: #111827;
            margin: 0;
            padding: 0;
          }
          h1 {
            font-size: 18px;
            margin: 0 0 12px 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th, td {
            border: 1px solid #e5e7eb;
            padding: 4px 6px;
            text-align: left;
            vertical-align: middle;
          }
          th {
            background: #f3f4f6;
            font-weight: 600;
          }
          tr:nth-child(even) td {
            background: #f9fafb;
          }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(safeTitle)}</h1>
        <table>
          <thead><tr>${headers}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>
  `
  doc.open()
  doc.write(html)
  doc.close()
  win.document.title = safeTitle
  win.onafterprint = () => { win.close() }
  setTimeout(() => { win.focus(); win.print() }, 300)
}

export const printHtmlInNewWindow = (title = 'Relatório', bodyHtml = '') => {
  if (typeof window === 'undefined') return
  const win = window.open('', '_blank')
  if (!win) return
  const doc = win.document
  const safeTitle = String(title || 'Relatório')
  const escapeHtml = (v) => {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(safeTitle)}</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 10mm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            font-size: 11px;
            color: #111827;
            margin: 0;
            padding: 0;
          }
          h1 {
            font-size: 18px;
            margin: 0 0 12px 0;
          }
          h2 {
            font-size: 14px;
            margin: 16px 0 8px 0;
          }
          p {
            margin: 4px 0;
          }
          .cards {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin: 8px 0 12px 0;
          }
          .card {
            flex: 1 1 22%;
            min-width: 140px;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            padding: 8px 10px;
            background: #f9fafb;
          }
          .card-label {
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
            color: #6b7280;
            margin-bottom: 4px;
          }
          .card-value {
            font-size: 18px;
            font-weight: 700;
            color: #111827;
          }
          .card-sub {
            font-size: 10px;
            color: #6b7280;
            margin-top: 2px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 4px;
          }
          th, td {
            border: 1px solid #e5e7eb;
            padding: 4px 6px;
            text-align: left;
            vertical-align: middle;
          }
          th {
            background: #f3f4f6;
            font-weight: 600;
          }
          tr:nth-child(even) td {
            background: #f9fafb;
          }
          .section {
            page-break-inside: avoid;
            margin-bottom: 14px;
          }
        </style>
      </head>
      <body>
        ${bodyHtml}
      </body>
    </html>
  `
  doc.open()
  doc.write(html)
  doc.close()
  win.document.title = safeTitle
  win.onafterprint = () => { win.close() }
  setTimeout(() => { win.focus(); win.print() }, 300)
}