export const WEEKDAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// Local dates as YYYY-MM-DD (avoids the UTC shift that toISOString() causes)
export function toISODate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
export const todayISO = () => toISODate(new Date())
export const isoWeekday = (d) => (d.getDay() === 0 ? 7 : d.getDay()) // 1 = Monday ... 7 = Sunday
export function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x }
export function parseISODate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
export const fmtDate = (s) =>
  parseISODate(s).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
export function fmtTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}
