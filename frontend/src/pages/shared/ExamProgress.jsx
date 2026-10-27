import { useEffect, useMemo, useRef, useState } from 'react'
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { EXAM_TYPES, gradeOf, num } from '../../lib/grades'
import { mean } from '../../lib/stats'
import { downloadReportPdf, safeFile } from '../../lib/pdf'

const PALETTE = ['#2f6fed', '#f2b134', '#0f2a4a', '#1e7d4f', '#8f1d4a', '#4b3a8f']
const pctText = (n) => (n === null || n === undefined ? '—' : `${Math.round(n)}%`)

// One component for everyone:
//  student  -> their own marks      parent -> pick a child
//  teacher / admin -> pick a class, then a student
export default function ExamProgress() {
  const { profile } = useAuth()
  const isStaff = profile.role === 'admin' || profile.role === 'teacher'
  const isParent = profile.role === 'parent'
  const [classes, setClasses] = useState([])
  const [classId, setClassId] = useState('')
  const [people, setPeople] = useState(isStaff || isParent ? [] : [{ id: profile.id, full_name: profile.full_name }])
  const [studentId, setStudentId] = useState(isStaff || isParent ? '' : profile.id)
  const [results, setResults] = useState(null)
  const [subject, setSubject] = useState('all')
  const [error, setError] = useState('')
  const lineRef = useRef(null)
  const barRef = useRef(null)

  useEffect(() => {
    if (isStaff) supabase.from('classes').select('id, name, subjects(name)').eq('active', true).order('name').then(({ data }) => setClasses(data || []))
    if (isParent) {
      supabase.from('parent_students').select('student:profiles!parent_students_student_id_fkey(id, full_name)').eq('parent_id', profile.id)
        .then(({ data, error }) => {
          if (error) return setError(error.message)
          const kids = data.map((l) => l.student).filter(Boolean)
          setPeople(kids); if (kids[0]) setStudentId(kids[0].id)
        })
    }
  }, [])

  useEffect(() => {
    if (!isStaff) return
    setStudentId(''); setResults(null)
    if (!classId) return setPeople([])
    supabase.from('enrollments').select('student_id, student:profiles!enrollments_student_id_fkey(full_name)').eq('class_id', classId)
      .then(({ data, error }) => {
        if (error) return setError(error.message)
        setPeople(data.map((e) => ({ id: e.student_id, full_name: e.student?.full_name })).sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '')))
      })
  }, [classId])

  useEffect(() => {
    if (!studentId) return setResults(null)
    setResults(null); setError(''); setSubject('all')
    supabase.rpc('student_exam_results', { p_student: studentId })
      .then(({ data, error }) => (error ? setError(error.message) : setResults(data)))
  }, [studentId])

  const studentName = people.find((p) => p.id === studentId)?.full_name || (isStaff || isParent ? 'Student' : profile.full_name || 'Student')

  const d = useMemo(() => {
    const rows = (results || []).map((r) => {
      const max = Number(r.max_marks)
      const pct = r.marks !== null && !r.absent ? (Number(r.marks) / max) * 100 : null
      const avgPct = r.class_avg !== null && r.class_avg !== undefined ? (Number(r.class_avg) / max) * 100 : null
      return { ...r, max, pct, avgPct, grade: gradeOf(pct) }
    })
    const subjects = [...new Set(rows.map((r) => r.subject))]
    const shown = subject === 'all' ? rows : rows.filter((r) => r.subject === subject)
    const scored = shown.filter((r) => r.pct !== null)

    const line = scored.map((r) => ({
      date: r.exam_date, label: r.title, subject: r.subject,
      Student: Math.round(r.pct), 'Class average': r.avgPct === null ? null : Math.round(r.avgPct),
    }))

    // average per term (or per exam type when no term was written), one bar per subject
    const groups = {}
    scored.forEach((r) => {
      const key = (r.term || '').trim() || EXAM_TYPES[r.exam_type]
      const g = (groups[key] ||= { first: r.exam_date, subj: {} })
      if (r.exam_date < g.first) g.first = r.exam_date
      ;(g.subj[r.subject] ||= []).push(r.pct)
    })
    const barSubjects = [...new Set(scored.map((r) => r.subject))]
    const bars = Object.entries(groups).sort((a, b) => a[1].first.localeCompare(b[1].first)).map(([group, g]) => {
      const row = { group }
      Object.entries(g.subj).forEach(([s, v]) => { row[s] = Math.round(mean(v)) })
      return row
    })

    const overall = mean(scored.map((r) => r.pct))
    const bySubject = barSubjects.map((s) => ({ s, avg: mean(scored.filter((r) => r.subject === s).map((r) => r.pct)) }))
    const best = bySubject.length > 1 ? [...bySubject].sort((a, b) => b.avg - a.avg)[0] : null
    const weak = bySubject.length > 1 ? [...bySubject].sort((a, b) => a.avg - b.avg)[0] : null

    let trend = null
    if (scored.length >= 4) {
      const k = Math.min(3, Math.floor(scored.length / 2))
      trend = mean(scored.slice(-k).map((r) => r.pct)) - mean(scored.slice(-2 * k, -k).map((r) => r.pct))
    }
    return { rows, subjects, shown, scored, line, bars, barSubjects, overall, best, weak, trend }
  }, [results, subject])

  const trendText = d.trend === null ? 'Not enough exams yet' : Math.abs(d.trend) < 1 ? 'Steady' : d.trend > 0 ? `Improving (+${Math.round(d.trend)} points)` : `Slipping (${Math.round(d.trend)} points)`
  const tableRows = [...d.shown].sort((a, b) => b.exam_date.localeCompare(a.exam_date))
  const tableBody = () => tableRows.map((r) => [
    r.exam_date, r.title, `${EXAM_TYPES[r.exam_type]}${r.term ? ` · ${r.term}` : ''}`, `${r.subject} – ${r.class_name}`,
    r.absent ? 'Absent' : `${num(r.marks)} / ${num(r.max)}`, r.pct === null ? '' : `${Math.round(r.pct)}%`, r.grade,
    r.avgPct === null ? '' : `${Math.round(r.avgPct)}%`, r.rank ? `${r.rank} of ${r.class_count}` : '', r.remarks || '',
  ])

  const pdf = () => downloadReportPdf({
    filename: `${safeFile(studentName)}-exam-progress.pdf`,
    title: 'Student exam progress report',
    subtitle: `${studentName}${subject !== 'all' ? ` · ${subject}` : ''}`,
    summary: [
      ['Student', studentName], ['Overall average', pctText(d.overall)], ['Exams sat', d.scored.length], ['Trend', trendText],
      ['Strongest subject', d.best ? `${d.best.s} (${pctText(d.best.avg)})` : '—'], ['Needs most focus', d.weak ? `${d.weak.s} (${pctText(d.weak.avg)})` : '—'],
    ],
    charts: [
      { title: 'Marks over time', el: d.line.length ? lineRef.current : null, legend: [{ name: studentName, color: PALETTE[0] }, { name: 'Class average', color: PALETTE[1] }] },
      { title: 'Average by term', el: d.bars.length ? barRef.current : null, legend: d.barSubjects.map((s, i) => ({ name: s, color: PALETTE[i % PALETTE.length] })) },
    ],
    tables: [{ title: 'Exam marks', head: ['Date', 'Exam', 'Type', 'Class', 'Marks', '%', 'Grade', 'Class avg', 'Position', 'Remarks'], body: tableBody() }],
  })

  const needsPick = (isStaff && !studentId) || (isParent && !studentId && people.length > 1)

  return (
    <>
      <h2>{isStaff ? 'Student progress' : 'Exams and progress'}</h2>
      <p className="muted">Unit and term exam marks, with charts that show how a student is progressing. Download or print the report.</p>
      {error && <p className="error">{error}</p>}

      <div className="inline-form no-print">
        {isStaff && (
          <label>Class
            <select value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">Choose a class…</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.subjects?.name} – {c.name}</option>)}
            </select>
          </label>
        )}
        {(isStaff ? classId : isParent && people.length > 1) && (
          <label>Student
            <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              {isStaff && <option value="">Choose a student…</option>}
              {people.map((p) => <option key={p.id} value={p.id}>{p.full_name || 'Student'}</option>)}
            </select>
          </label>
        )}
        {d.subjects.length > 1 && (
          <label>Subject
            <select value={subject} onChange={(e) => setSubject(e.target.value)}>
              <option value="all">All subjects</option>{d.subjects.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        )}
        {results && results.length > 0 && (
          <>
            <button onClick={pdf}>Download PDF</button>
            <button className="ghost" onClick={() => window.print()}>Print</button>
          </>
        )}
      </div>

      {isParent && people.length === 0 && !error && <p className="empty">No children are linked to your account yet.</p>}
      {needsPick && <p className="empty">{isStaff ? 'Choose a class and a student to see their progress.' : 'Choose a child.'}</p>}
      {studentId && !results && !error && <p className="muted">Loading…</p>}
      {results && results.length === 0 && <p className="empty">No exam marks have been entered yet.</p>}

      {results && results.length > 0 && (
        <div className="report-area">
          <h3 className="print-only">{studentName}: exam progress</h3>
          <div className="stats">
            <div className="stat panel"><strong>{pctText(d.overall)}</strong>Overall average</div>
            <div className="stat panel"><strong>{d.scored.length}</strong>Exams sat</div>
            <div className="stat panel"><strong className="small-val">{trendText}</strong>Recent trend</div>
            {d.best && <div className="stat panel"><strong className="small-val">{d.best.s} ({pctText(d.best.avg)})</strong>Strongest subject</div>}
            {d.weak && <div className="stat panel"><strong className="small-val">{d.weak.s} ({pctText(d.weak.avg)})</strong>Needs most focus</div>}
          </div>

          {d.line.length > 0 && (
            <section className="panel">
              <h3>Marks over time</h3>
              <div className="chart" ref={lineRef} role="img" aria-label="Line chart of the student's exam percentages over time, with the class average">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={d.line} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#d5deea" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v) => `${v}%`} labelFormatter={(l, p) => (p?.[0] ? `${l} · ${p[0].payload.label} (${p[0].payload.subject})` : l)} />
                    <Legend />
                    <Line type="monotone" dataKey="Student" stroke={PALETTE[0]} strokeWidth={2} dot={{ r: 4 }} connectNulls />
                    <Line type="monotone" dataKey="Class average" stroke={PALETTE[1]} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          {d.bars.length > 0 && (
            <section className="panel">
              <h3>Average by term</h3>
              <div className="chart" ref={barRef} role="img" aria-label="Bar chart of the average percentage in each term, one bar per subject">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={d.bars} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#d5deea" />
                    <XAxis dataKey="group" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v) => `${v}%`} />
                    <Legend />
                    {d.barSubjects.map((s, i) => <Bar key={s} dataKey={s} fill={PALETTE[i % PALETTE.length]} radius={[4, 4, 0, 0]} />)}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          <h3>All exam marks</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Exam</th><th>Class</th><th>Marks</th><th>%</th><th>Grade</th><th>Class avg</th><th>Position</th><th>Remarks</th></tr></thead>
              <tbody>
                {tableRows.map((r) => (
                  <tr key={r.exam_id}>
                    <td>{r.exam_date}</td>
                    <td>{r.title} <span className="tag">{EXAM_TYPES[r.exam_type]}</span>{r.term && <div className="muted small-text">{r.term}</div>}</td>
                    <td>{r.subject} – {r.class_name}</td>
                    <td>{r.absent ? <span className="tag st-late">Absent</span> : <strong>{num(r.marks)} / {num(r.max)}</strong>}</td>
                    <td>{r.pct === null ? '' : `${Math.round(r.pct)}%`}</td>
                    <td>{r.grade && <span className="tag">{r.grade}</span>}</td>
                    <td>{r.avgPct === null ? '' : `${Math.round(r.avgPct)}%`}</td>
                    <td>{r.rank ? `${r.rank} of ${r.class_count}` : ''}</td>
                    <td className="small-text">{r.remarks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
