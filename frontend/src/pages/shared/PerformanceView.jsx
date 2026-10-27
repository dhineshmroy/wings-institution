import { useEffect, useState } from 'react'
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { attendanceRate, bestQuizResults, mean, round, show } from '../../lib/stats'

const NAVY = '#0f2a4a', BLUE = '#2f6fed', AMBER = '#f2b134'
const className = (c) => (c ? `${c.subjects?.name} – ${c.name}` : 'Class')

// A student sees their own progress; a parent picks one of their children (the database decides who can see what).
export default function PerformanceView() {
  const { profile } = useAuth()
  const isParent = profile.role === 'parent'
  const [children, setChildren] = useState(null)
  const [studentId, setStudentId] = useState(isParent ? '' : profile.id)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isParent) return
    supabase.from('parent_students').select('student:profiles!parent_students_student_id_fkey(id, full_name)').eq('parent_id', profile.id)
      .then(({ data, error }) => {
        if (error) return setError(error.message)
        const kids = data.map((l) => l.student).filter(Boolean)
        setChildren(kids)
        if (kids[0]) setStudentId(kids[0].id)
      })
  }, [])

  useEffect(() => {
    if (!studentId) return
    setData(null)
    async function load() {
      const [s, q, a] = await Promise.all([
        supabase.from('submissions')
          .select('grade, graded_at, assignment:assignments(title, max_points, class_id, classes(name, subjects(name)))')
          .eq('student_id', studentId).not('grade', 'is', null),
        supabase.from('quiz_attempts')
          .select('quiz_id, score, max_score, submitted_at, quiz:quizzes(title, class_id, classes(name, subjects(name)))')
          .eq('student_id', studentId).eq('status', 'submitted'),
        supabase.from('attendance').select('status, session:sessions(session_date)').eq('student_id', studentId),
      ])
      const failed = s.error || q.error || a.error
      if (failed) return setError(failed.message)

      const items = []
      s.data.forEach((r) => items.push({
        kind: 'Assignment', date: r.graded_at.slice(0, 10), label: r.assignment.title,
        percent: (r.grade / r.assignment.max_points) * 100, classId: r.assignment.class_id, cls: r.assignment.classes,
      }))
      bestQuizResults(q.data).forEach((b) => items.push({
        kind: 'Quiz', date: b.when.slice(0, 10), label: b.row.quiz?.title || 'Quiz',
        percent: b.percent, classId: b.row.quiz?.class_id, cls: b.row.quiz?.classes,
      }))
      items.sort((x, y) => x.date.localeCompare(y.date))

      const timeline = items.map((i) => ({
        date: i.date, label: i.label,
        Assignments: i.kind === 'Assignment' ? round(i.percent) : null,
        Quizzes: i.kind === 'Quiz' ? round(i.percent) : null,
      }))

      const byClassMap = {}
      items.forEach((i) => { (byClassMap[i.classId] ||= { name: className(i.cls), values: [] }).values.push(i.percent) })
      const byClass = Object.values(byClassMap).map((c) => ({ name: c.name, Average: round(mean(c.values)) }))

      const months = {}
      a.data.forEach((r) => { if (r.session) (months[r.session.session_date.slice(0, 7)] ||= []).push(r) })
      const monthly = Object.keys(months).sort().map((m) => ({ month: m, Attendance: round(attendanceRate(months[m])) }))

      setData({
        timeline, byClass, monthly,
        overall: mean(items.map((i) => i.percent)),
        assignments: s.data.length, quizzes: bestQuizResults(q.data).length,
        attendance: attendanceRate(a.data),
      })
    }
    load()
  }, [studentId])

  const hasScores = data && data.timeline.length > 0

  return (
    <>
      <h2>Performance</h2>
      <p className="muted">Scores from graded assignments and quizzes over time. Quizzes count your best attempt.</p>
      {error && <p className="error">{error}</p>}
      {isParent && children && children.length === 0 && <p className="empty">No children are linked to your account yet.</p>}
      {isParent && children && children.length > 1 && (
        <label className="narrow">Child
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            {children.map((k) => <option key={k.id} value={k.id}>{k.full_name || 'Student'}</option>)}
          </select>
        </label>
      )}
      {isParent && children?.length === 1 && <h3>{children[0].full_name}</h3>}

      {studentId && !data && !error && <p className="muted">Loading…</p>}
      {data && (
        <>
          <div className="stats">
            <div className="stat panel"><strong>{show(data.overall)}</strong>Overall average</div>
            <div className="stat panel"><strong>{data.assignments}</strong>Assignments graded</div>
            <div className="stat panel"><strong>{data.quizzes}</strong>Quizzes taken</div>
            <div className="stat panel"><strong>{show(data.attendance)}</strong>Attendance</div>
          </div>

          {!hasScores && <p className="empty">No graded work yet. Charts will appear here once there are scores.</p>}

          {hasScores && (
            <>
              <section className="panel">
                <h3>Scores over time</h3>
                <div className="chart" role="img" aria-label="Line chart of assignment and quiz percentages over time">
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={data.timeline} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#d5deea" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(v) => `${v}%`} labelFormatter={(d, p) => `${d}${p?.[0]?.payload?.label ? ' · ' + p[0].payload.label : ''}`} />
                      <Legend />
                      <Line type="monotone" dataKey="Assignments" stroke={BLUE} strokeWidth={2} connectNulls dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="Quizzes" stroke={AMBER} strokeWidth={2} connectNulls dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="panel">
                <h3>Average by class</h3>
                <div className="chart" role="img" aria-label="Bar chart of the average percentage in each class">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={data.byClass} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#d5deea" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(v) => `${v}%`} />
                      <Bar dataKey="Average" fill={NAVY} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </>
          )}

          {data.monthly.length > 0 && (
            <section className="panel">
              <h3>Attendance by month</h3>
              <div className="chart" role="img" aria-label="Bar chart of attendance percentage for each month">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.monthly} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#d5deea" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v) => `${v}%`} />
                    <Bar dataKey="Attendance" fill={BLUE} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}
        </>
      )}
    </>
  )
}
