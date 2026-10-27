import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'

// Student sees their own grades; a parent sees their children's (the database decides).
export default function GradesView() {
  const { profile } = useAuth()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('submissions')
      .select('grade, feedback, graded_at, student_id, student:profiles!submissions_student_id_fkey(full_name), assignment:assignments(title, max_points, classes(id, name, subjects(name)))')
      .not('grade', 'is', null)
      .order('graded_at', { ascending: false })
      .then(({ data, error }) => (error ? setError(error.message) : setRows(data)))
  }, [])

  const groups = {}
  rows?.forEach((r) => {
    const cls = r.assignment?.classes
    if (!cls) return
    const key = `${r.student_id}-${cls.id}`
    groups[key] ||= { student: r.student?.full_name || 'Student', className: `${cls.subjects?.name} – ${cls.name}`, items: [] }
    groups[key].items.push(r)
  })

  return (
    <>
      <h2>Grades</h2>
      <p className="muted">Marked assignments and teacher feedback. The average is the mean of the percentage scores.</p>
      {error && <p className="error">{error}</p>}
      {rows && Object.keys(groups).length === 0 && <p className="empty">No graded work yet.</p>}
      {Object.values(groups).map((g, i) => {
        const avg = Math.round(g.items.reduce((sum, r) => sum + (r.grade / r.assignment.max_points) * 100, 0) / g.items.length)
        return (
          <section className="panel" key={i}>
            <h3>{profile.role === 'parent' ? `${g.student} · ` : ''}{g.className}</h3>
            <p className="big-pct">{avg}%</p>
            <p className="muted">Average across {g.items.length} graded assignment{g.items.length === 1 ? '' : 's'}</p>
            <ul className="plain">
              {g.items.map((r, j) => (
                <li key={j}>
                  <strong>{r.assignment.title}</strong>: {r.grade} / {r.assignment.max_points}
                  {r.feedback && <div className="muted small-text">{r.feedback}</div>}
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </>
  )
}
