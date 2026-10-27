export const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null)
export const round = (n) => (n === null || n === undefined ? null : Math.round(n))
export const show = (n) => (n === null || n === undefined ? '—' : `${Math.round(n)}%`)

// (present + late) / (present + late + absent); excused days are not counted
export function attendanceRate(rows) {
  const c = { present: 0, late: 0, absent: 0 }
  rows.forEach((r) => { if (c[r.status] !== undefined) c[r.status] += 1 })
  const d = c.present + c.late + c.absent
  return d ? ((c.present + c.late) / d) * 100 : null
}

// Best percentage per quiz, from a list of submitted attempts. Returns [{ quiz_id, percent, when, row }]
export function bestQuizResults(attempts) {
  const best = {}
  attempts.forEach((a) => {
    if (!a.max_score || Number(a.max_score) <= 0) return
    const percent = (Number(a.score) / Number(a.max_score)) * 100
    if (!best[a.quiz_id] || percent > best[a.quiz_id].percent) best[a.quiz_id] = { quiz_id: a.quiz_id, percent, when: a.submitted_at, row: a }
  })
  return Object.values(best)
}
