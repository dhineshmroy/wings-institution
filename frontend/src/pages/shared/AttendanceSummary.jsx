import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { fmtDate } from '../../lib/dates'

const clock = (iso) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

// Attendance % = (present + late) / (present + late + absent). Excused days are not counted.
function summarize(records) {
  const c = { present: 0, late: 0, absent: 0, excused: 0 }
  records.forEach((r) => { c[r.status] += 1 })
  const denom = c.present + c.late + c.absent
  return { ...c, pct: denom ? Math.round(((c.present + c.late) / denom) * 100) : null }
}

export default function AttendanceSummary() {
  const { profile } = useAuth()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('attendance')
      .select('status, student_id, checked_in_at, checked_out_at, student:profiles!attendance_student_id_fkey(full_name), session:sessions(session_date, classes(id, name, subjects(name)))')
      .then(({ data, error }) => (error ? setError(error.message) : setRows(data)))
  }, [])

  const groups = {}
  rows?.forEach((r) => {
    const cls = r.session?.classes
    if (!cls) return
    const key = `${r.student_id}-${cls.id}`
    groups[key] ||= { student: r.student?.full_name || 'Student', className: `${cls.subjects?.name} – ${cls.name}`, records: [] }
    groups[key].records.push({ date: r.session.session_date, status: r.status, inAt: r.checked_in_at, outAt: r.checked_out_at })
  })

  return (
    <>
      <h2>Attendance</h2>
      <p className="muted">Attendance % counts present and late days. Excused days are not counted against you.</p>
      {error && <p className="error">{error}</p>}
      {rows && Object.keys(groups).length === 0 && <p className="empty">No attendance has been recorded yet.</p>}
      {Object.values(groups).map((g, i) => {
        const s = summarize(g.records)
        const recent = [...g.records].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10)
        return (
          <section className="panel" key={i}>
            <h3>{profile.role === 'parent' ? `${g.student} · ` : ''}{g.className}</h3>
            <p className="big-pct">{s.pct === null ? '—' : `${s.pct}%`}</p>
            <p className="muted">{s.present} present · {s.late} late · {s.absent} absent · {s.excused} excused</p>
            <ul className="plain">
              {recent.map((r, j) => (
                <li key={j}>{fmtDate(r.date)} <span className={`tag st-${r.status}`}>{r.status}</span>{r.inAt && <span className="muted small-text"> arrived {clock(r.inAt)}{r.outAt ? `, left ${clock(r.outAt)}` : ''}</span>}</li>
              ))}
            </ul>
          </section>
        )
      })}
    </>
  )
}
