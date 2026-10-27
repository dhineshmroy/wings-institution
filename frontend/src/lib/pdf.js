// Builds a PDF in the browser (nothing is uploaded anywhere).
// Charts are copied from the page: we take the chart's SVG and draw it into the PDF as a picture.
const NAVY = [15, 42, 74]
const AMBER = [242, 177, 52]

export async function chartToPng(el) {
  const svg = el?.querySelector('svg.recharts-surface') || el?.querySelector('svg')
  if (!svg) return null
  const rect = svg.getBoundingClientRect()
  const clone = svg.cloneNode(true)
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', rect.width)
  clone.setAttribute('height', rect.height)
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  bg.setAttribute('width', '100%'); bg.setAttribute('height', '100%'); bg.setAttribute('fill', '#ffffff')
  clone.insertBefore(bg, clone.firstChild)
  const xml = new XMLSerializer().serializeToString(clone)
  const img = new Image()
  await new Promise((resolve, reject) => {
    img.onload = resolve; img.onerror = reject
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml)
  })
  const scale = 2
  const canvas = document.createElement('canvas')
  canvas.width = rect.width * scale; canvas.height = rect.height * scale
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return { data: canvas.toDataURL('image/png'), w: rect.width, h: rect.height }
}

const hexToRgb = (hex) => { const n = parseInt(hex.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }

// summary: [[label, value], ...]   charts: [{ title, el, legend: [{ name, color }] }]   tables: [{ title, head: [], body: [[]] }]
export async function downloadReportPdf({ filename, title, subtitle, summary = [], charts = [], tables = [] }) {
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 14
  let y = M

  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...NAVY)
  doc.text('Wings Institution', M, y + 5)
  doc.setFontSize(13); doc.text(title, M, y + 13)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(90, 100, 110)
  if (subtitle) doc.text(subtitle, M, y + 19)
  doc.setDrawColor(...AMBER); doc.setLineWidth(0.8); doc.line(M, y + 23, W - M, y + 23)
  y += 31

  // summary figures in two columns
  const colW = (W - 2 * M) / 2
  summary.forEach(([label, value], i) => {
    const x = M + (i % 2) * colW
    if (i % 2 === 0 && i > 0) y += 11
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(110, 120, 130); doc.text(String(label), x, y)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...NAVY); doc.text(String(value ?? '—'), x, y + 5.5)
  })
  if (summary.length) y += 15

  for (const ch of charts) {
    const png = await chartToPng(ch.el)
    if (!png) continue
    const w = W - 2 * M
    const h = Math.min(95, (w * png.h) / png.w)
    if (y + h + 16 > H - 16) { doc.addPage(); y = M }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...NAVY); doc.text(ch.title, M, y + 4)
    y += 7
    doc.addImage(png.data, 'PNG', M, y, w, h)
    y += h + 3
    let x = M
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(60, 70, 80)
    ;(ch.legend || []).forEach((l) => {
      doc.setFillColor(...hexToRgb(l.color)); doc.rect(x, y - 2.5, 3, 3, 'F')
      doc.text(l.name, x + 4.5, y); x += 4.5 + doc.getTextWidth(l.name) + 6
    })
    y += 9
  }

  for (const t of tables) {
    if (y > H - 45) { doc.addPage(); y = M }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...NAVY); doc.text(t.title, M, y + 4)
    autoTable(doc, {
      startY: y + 7, head: [t.head], body: t.body.map((r) => r.map((c) => String(c ?? ''))),
      styles: { fontSize: 8.5, cellPadding: 1.8 }, headStyles: { fillColor: NAVY }, alternateRowStyles: { fillColor: [245, 249, 255] },
      margin: { left: M, right: M },
    })
    y = doc.lastAutoTable.finalY + 8
  }

  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120, 130, 140)
    doc.text(`Generated on ${new Date().toLocaleDateString()} · Page ${i} of ${pages}`, M, H - 8)
  }
  doc.save(filename)
}

export const safeFile = (s) => s.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'report'
