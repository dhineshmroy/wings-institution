import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { openFile, openLink } from '../../lib/files'

export default function GradeSubmissions({ assignment, onChanged }) {
  const [roster, setRoster] = useState([])
  const [subs, setSubs] = useState({})
  const [openId, setOpenId] = useState(null)
  const [grade, setGrade] = useState('')
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  async function load() {
    const [r, s] = await Promise.all([
      supabase.from('enrollments').select('student_id, student:profiles!enrollments_student_id_fkey(full_name)').eq('class_id', assignment.class_id),
      supabase.from('submissions').select('*').eq('assignment_id', assignment.id),
    ])
    if (r.error || s.error) return setError((r.error || s.error).message)
    setRoster(r.data.sort((a, b) => (a.student?.full_name || '').localeCompare(b.student?.full_name || '')))
    setSubs(Object.fromEntries(s.data.map((x) => [x.student_id, x])))
  }
  useEffect(() => { load() }, [assignment.id])

  function statusOf(sub) {
    if (!sub) return ['Not submitted', 'st-absent']
    if (sub.grade !== null) return [`Graded: ${sub.grade} / ${assignment.max_points}`, 'st-present']
    const late = assignment.due_at && new Date(sub.submitted_at) > new Date(assignment.due_at)
    return [late ? 'Submitted late' : 'Submitted', late ? 'st-late' : 'st-excused']
  }

  function open(studentId) {
    const sub = subs[studentId]
    setOpenId(studentId); setMsg(''); setError('')
    setGrade(sub?.grade ?? ''); setFeedback(sub?.feedback ?? '')
  }

  async function save() {
    setError(''); setMsg('')
    const sub = subs[openId]
    const { error } = await supabase.from('submissions')
      .update({ grade: grade === '' ? null : Number(grade), feedback: feedback.trim() || null })
      .eq('id', sub.id)
    if (error) return setError(error.message)
    setMsg('Grade saved.'); load(); onChanged?.()
  }

  const sub = openId ? subs[openId] : null
  const student = roster.find((r) => r.student_id === openId)

  return (
    <section className="panel">
      <h3>{assignment.title}: submissions</h3>
      {assignment.instructions && <p className="muted">{assignment.instructions}</p>}
      {error && <p className="error">{error}</p>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Student</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {roster.map((r) => {
              const [text, cls] = statusOf(subs[r.student_id])
              return (
                <tr key={r.student_id}>
                  <td>{r.student?.full_name || 'Student'}</td>
                  <td><span className={`tag ${cls}`}>{text}</span></td>
                  <td>{subs[r.student_id] && <button className="ghost small" onClick={() => open(r.student_id)}>Open</button>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {roster.length === 0 && <p className="empty">No students are enrolled in this class.</p>}
      </div>

      {sub && (
        <div className="detail">
          <h3>{student?.student?.full_name || 'Student'}</h3>
          <p className="muted">Submitted {new Date(sub.submitted_at).toLocaleString()}</p>
          {sub.text_answer && <p className="answer">{sub.text_answer}</p>}
          <p>
            {sub.link_url && <button className="ghost small" onClick={() => openLink(sub.link_url)}>Open link</button>}{' '}
            {sub.file_path && <button className="ghost small" onClick={() => openFile('submissions', sub.file_path)}>Open file: {sub.file_name}</button>}
          </p>
          <div className="inline-form">
            <label>Points (out of {assignment.max_points})
              <input type="number" min="0" max={assignment.max_points} step="0.5" value={grade} onChange={(e) => setGrade(e.target.value)} />
            </label>
          </div>
          <label>Feedback for the student
            <textarea rows="3" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
          </label>
          {msg && <p className="ok">{msg}</p>}
          <p><button onClick={save}>Save grade and feedback</button></p>
        </div>
      )}
    </section>
  )
}
