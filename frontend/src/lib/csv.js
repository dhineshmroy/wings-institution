// ---- reading a CSV file (handles quotes, commas and new lines inside quotes) ----
export function parseCSV(text) {
  const t = text.replace(/^\ufeff/, '')
  const rows = []
  let row = [], cell = '', inQ = false
  const endRow = () => { row.push(cell); cell = ''; if (row.some((c) => c.trim() !== '')) rows.push(row); row = [] }
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]
    if (inQ) {
      if (ch === '"') { if (t[i + 1] === '"') { cell += '"'; i++ } else inQ = false } else cell += ch
    } else if (ch === '"') inQ = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; endRow() }
    else cell += ch
  }
  if (cell !== '' || row.length) endRow()
  return rows
}

// ---- writing a CSV file that opens correctly in Excel ----
function esc(v) {
  if (v === null || v === undefined) return ''
  let s = String(v)
  if (typeof v === 'string' && /^[=+\-@]/.test(s)) s = `'${s}` // stops spreadsheet formulas from running
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCSV(headers, rows) {
  return '\ufeff' + [headers, ...rows].map((r) => r.map(esc).join(',')).join('\r\n')
}

export function downloadCSV(filename, headers, rows) {
  const blob = new Blob([toCSV(headers, rows)], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(url)
}

// Supabase returns at most 1000 rows per request. This keeps asking until everything is loaded.
export async function fetchAll(build, pageSize = 1000) {
  const all = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build(from, from + pageSize - 1)
    if (error) throw error
    all.push(...data)
    if (data.length < pageSize) break
  }
  return all
}
