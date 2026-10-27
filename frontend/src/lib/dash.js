import { addDays, parseISODate, toISODate } from './dates'

export const mondayOf = (d) => {
  const x = new Date(d); x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}
// the Mondays of the last n weeks, oldest first, as YYYY-MM-DD
export const weekList = (n) => {
  const m = mondayOf(new Date())
  return Array.from({ length: n }, (_, i) => toISODate(addDays(m, -(n - 1 - i) * 7)))
}
export const weekOf = (dateStr) => toISODate(mondayOf(parseISODate(String(dateStr).slice(0, 10))))
export const shortDate = (iso) => parseISODate(String(iso).slice(0, 10)).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
export const rate = (good, total) => (total ? (good / total) * 100 : null)
export const delta = (cur, prev) => (prev ? ((cur - prev) / prev) * 100 : null)
export const sum = (a) => a.reduce((s, x) => s + Number(x || 0), 0)
export const avg = (a) => (a.length ? sum(a) / a.length : null)
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

export function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'Just now'
  if (s < 3600) { const m = Math.floor(s / 60); return `${m} minute${m === 1 ? '' : 's'} ago` }
  if (s < 86400) { const h = Math.floor(s / 3600); return `${h} hour${h === 1 ? '' : 's'} ago` }
  if (s < 86400 * 7) { const d = Math.floor(s / 86400); return `${d} day${d === 1 ? '' : 's'} ago` }
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

// attendance rows [{ status, session: { session_date } }] -> attendance % for each week in `weeks`
export function weeklyRates(rows, weeks) {
  const good = weeks.map(() => 0), total = weeks.map(() => 0)
  rows.forEach((r) => {
    const i = weeks.indexOf(weekOf(r.session.session_date))
    if (i < 0) return
    if (r.status === 'present' || r.status === 'late') { good[i]++; total[i]++ } else if (r.status === 'absent') total[i]++
  })
  return weeks.map((_, i) => rate(good[i], total[i]))
}

export function overallRate(rows) {
  let good = 0, total = 0
  rows.forEach((r) => {
    if (r.status === 'present' || r.status === 'late') { good++; total++ } else if (r.status === 'absent') total++
  })
  return rate(good, total)
}

export const niceMax = (m) => {
  if (m <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(m)), n = m / p
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p
}

export const compact = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 100) / 10}k` : String(Math.round(n)))
