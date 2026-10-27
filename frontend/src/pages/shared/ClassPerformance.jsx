import { useEffect, useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts'
import { supabase } from '../../lib/supabaseClient'
import { attendanceRate, bestQuizResults, mean, round, show } from '../../lib/stats'

// Admin sees every class; a teacher only sees their own (the database decides).
export default function ClassPerformance() {
  const [classes, setClasses] = useState([])
  const [classId, setClassId] = useState('')
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('classes').select('id, name, subjects(name)').eq('active', true).order('name').then(({ data }) => setClasses(data || []))
  }, [])

  useEffect(() => {
    if (!classId) return setRows(null)
    setRows(null); setError('')
    async function load() {
      const [r, s, q, a] = await Promise.all([
        supabase.from('enrollments').select('student_id, student:profiles!enrollments_student_id_fkey(full_name)').eq('class_id', classId),
        supabase.from('submissions').select('student_id, grade, assignment:assignments!inner(class_id, max_points)')
          .eq('assignment.class_id', classId).not('grade', 'is', null),
        supabase.from('quiz_attempts').select('student_id, quiz_id, score, max_score, submitted_at, quiz:quizzes!inner(class_id)')
          .eq('quiz.class_id', classId).eq('status', 'submitted'),
        supabase.from('attendance').select('student_id, status, session:sessions!inner(class_id)').eq('session.class_id', classId),
      ])
      const failed = r.error || s.error || q.error || a.error
      if (failed) return setError(failed.message)

      const list = r.data.map((e) => {
        const id = e.student_id
        const aPct = s.data.filter((x) => x.student_id === id).map((x) => (x.grade / x.assignment.max_points) * 100)
        const qPct = bestQuizResults(q.data.filter((x) => x.student_id === id)).map((x) => x.percent)
        const att = attendanceRate(a.data.filter((x) => x.student_id === id))
        const all = [...aPct, ...qPct]
        return {
          id, name: e.student?.full_name || 'Student',
          assignments: mean(aPct), quizzes: mean(qPct), overall: mean(all), attendance: att,
          needsAttention: (mean(all) !== null && mean(all) < 50) || (att !== null && att < 75),
        }
      }).sort((x, y) => x.name.localeCompare(y.name))
      setRows(list)
    }
    load()
  }, [classId])

  const scored = rows?.filter((r) => r.overall !== null) || []
  const classAvg = mean(scored.map((r) => r.overall))
  const chart = scored.map((r) => ({ name: r.name, Average: round(r.overall), low: r.overall < 50 }))

  return (
    <>
      <h2>Class performance</h2>
      <p className="muted">How each student is doing across assignments, quizzes and attendance. Students under 50% overall or 75% attendance are flagged.</p>
      <label className="narrow">Class
        <select value={classId} onChange={(e) => setClassId(e.target.value)}>
          <option value="">Choose a class…</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.subjects?.name} – {c.name}</option>)}
        </select>
      </label>
      {error && <p className="error">{error}</p>}
      {classId && !rows && !error && <p className="muted">Loading…</p>}

      {rows && (
        <>
          <div className="stats">
            <div className="stat panel"><strong>{rows.length}</strong>Students</div>
            <div className="stat panel"><strong>{show(classAvg)}</strong>Class average</div>
            <div className="stat panel"><strong>{rows.filter((r) => r.needsAttention).length}</strong>Need attention</div>
          </div>

          {chart.length > 0 && (
            <section className="panel">
              <h3>Overall average by student</h3>
              <div className="chart" role="img" aria-label="Bar chart of each student's overall average percentage">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chart} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#d5deea" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} />
                    <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v) => `${v}%`} />
                    <Bar dataKey="Average" radius={[4, 4, 0, 0]}>
                      {chart.map((c, i) => <Cell key={i} fill={c.low ? '#c0392b' : '#2f6fed'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          <div className="table-wrap">
            <table>
              <thead><tr><th>Student</th><th>Assignments</th><th>Quizzes</th><th>Overall</th><th>Attendance</th><th></th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td>{show(r.assignments)}</td>
                    <td>{show(r.quizzes)}</td>
                    <td><strong>{show(r.overall)}</strong></td>
                    <td>{show(r.attendance)}</td>
                    <td>{r.needsAttention && <span className="tag st-absent">Needs attention</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <p className="empty">No students are enrolled in this class.</p>}
          </div>
        </>
      )}
    </>
  )
}
