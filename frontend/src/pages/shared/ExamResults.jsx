import { useEffect, useRef, useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { supabase } from '../../lib/supabaseClient'
import { EXAM_TYPES, GRADE_ORDER, gradeOf, num } from '../../lib/grades'
import { downloadReportPdf, safeFile } from '../../lib/pdf'

export default function ExamResults({ exam, classLabel }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const chartRef = useRef(null)

  useEffect(() => {
    supabase.from('exam_marks').select('*, student:profiles!exam_marks_student_id_fkey(full_name)').eq('exam_id', exam.id)
      .then(({ data, error }) => (error ? setError(error.message) : setRows(data)))
  }, [exam.id])

  if (error) return <p className="error">{error}</p>
  if (!rows) return <p className="muted">Loading…</p>

  const max = Number(exam.max_marks)
  const passMark = exam.pass_marks != null ? Number(exam.pass_marks) : max * 0.35
  const scored = rows.filter((r) => !r.absent && r.marks !== null).sort((a, b) => Number(b.marks) - Number(a.marks))
  const absent = rows.filter((r) => r.absent)
  const marks = scored.map((r) => Number(r.marks))
  const avg = marks.length ? marks.reduce((a, b) => a + b, 0) / marks.length : null
  const passRate = marks.length ? (marks.filter((m) => m >= passMark).length / marks.length) * 100 : null
  const pct = (m) => (m / max) * 100
  const rank = (m) => marks.filter((x) => x > m).length + 1
  const dist = GRADE_ORDER.map((g) => ({ grade: g, Students: scored.filter((r) => gradeOf(pct(Number(r.marks))) === g).length }))

  const stat = [
    ['Class', classLabel], ['Exam', `${EXAM_TYPES[exam.exam_type]}${exam.term ? ` · ${exam.term}` : ''} · ${exam.exam_date}`],
    ['Students with marks', scored.length], ['Absent', absent.length],
    ['Average', avg === null ? '—' : `${num(avg)} / ${num(max)} (${Math.round(pct(avg))}%)`],
    ['Highest / lowest', marks.length ? `${num(marks[0])} / ${num(marks[marks.length - 1])}` : '—'],
    ['Pass rate', passRate === null ? '—' : `${Math.round(passRate)}%`], ['Pass mark', num(passMark)],
  ]

  const pdf = () => downloadReportPdf({
    filename: `${safeFile(exam.title)}-results.pdf`, title: `${exam.title}: class results`, subtitle: classLabel, summary: stat,
    charts: [{ title: 'Grade distribution', el: chartRef.current, legend: [{ name: 'Number of students', color: '#2f6fed' }] }],
    tables: [{
      title: 'Marks', head: ['Position', 'Student', 'Marks', '%', 'Grade', 'Remarks'],
      body: [...scored.map((r) => [rank(Number(r.marks)), r.student?.full_name, `${num(r.marks)} / ${num(max)}`, `${Math.round(pct(Number(r.marks)))}%`, gradeOf(pct(Number(r.marks))), r.remarks || '']),
             ...absent.map((r) => ['—', r.student?.full_name, 'Absent', '', '', r.remarks || ''])],
    }],
  })

  return (
    <section className="panel">
      <div className="row-between">
        <h3>Results: {exam.title}</h3>
        {rows.length > 0 && <button className="small" onClick={pdf}>Download PDF</button>}
      </div>
      {rows.length === 0 && <p className="empty">No marks have been entered yet.</p>}
      {rows.length > 0 && (
        <>
          <div className="stats">
            <div className="stat panel"><strong>{avg === null ? '—' : `${Math.round(pct(avg))}%`}</strong>Class average</div>
            <div className="stat panel"><strong>{marks.length ? num(marks[0]) : '—'}</strong>Highest</div>
            <div className="stat panel"><strong>{passRate === null ? '—' : `${Math.round(passRate)}%`}</strong>Passed</div>
          </div>
          <div className="chart" ref={chartRef} role="img" aria-label="Bar chart of how many students got each grade">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dist} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d5deea" />
                <XAxis dataKey="grade" /><YAxis allowDecimals={false} /><Tooltip />
                <Bar dataKey="Students" fill="#2f6fed" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Position</th><th>Student</th><th>Marks</th><th>%</th><th>Grade</th><th>Remarks</th></tr></thead>
              <tbody>
                {scored.map((r) => (
                  <tr key={r.id}><td>{rank(Number(r.marks))}</td><td>{r.student?.full_name}</td><td>{num(r.marks)} / {num(max)}</td>
                    <td>{Math.round(pct(Number(r.marks)))}%</td><td><span className="tag">{gradeOf(pct(Number(r.marks)))}</span></td><td>{r.remarks}</td></tr>
                ))}
                {absent.map((r) => <tr key={r.id}><td>—</td><td>{r.student?.full_name}</td><td colSpan="3"><span className="tag st-late">Absent</span></td><td>{r.remarks}</td></tr>)}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
