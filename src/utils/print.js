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
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    }
    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready } catch {}
    }
    await html2pdf().from(container).set(opt).save()
  } finally {
    document.body.removeChild(container)
  }
}
