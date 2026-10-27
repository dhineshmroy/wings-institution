import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import TakeQuiz from './TakeQuiz'
import AttemptReview from './AttemptReview'

export default function StudentQuizzes() {
  const { profile } = useAuth()
  const [quizzes, setQuizzes] = useState(null)
  const [attempts, setAttempts] = useState([])
  const [taking, setTaking] = useState(null)
  const [reviewing, setReviewing] = useState(null)
  const [error, setError] = useState('')

  async function load() {
    const [q, a] = await Promise.all([
      supabase.from('quizzes').select('*, classes(name, subjects(name))').order('created_at', { ascending: false }),
      supabase.from('quiz_attempts').select('id, quiz_id, status, started_at, submitted_at, score, max_score').eq('student_id', profile.id),
    ])
    if (q.error || a.error) return setError((q.error || a.error).message)
    setQuizzes(q.data); setAttempts(a.data)
  }
  useEffect(() => { load() }, [])

  if (taking) return <TakeQuiz quiz={taking} onExit={() => { setTaking(null); load() }} />

  const now = Date.now()

  function describe(z) {
    const mine = attempts.filter((a) => a.quiz_id === z.id)
    const done = mine.filter((a) => a.status === 'submitted').sort((x, y) => y.submitted_at.localeCompare(x.submitted_at))
    const live = mine.find((a) => a.status === 'in_progress' &&
      (!z.time_limit_minutes || now < new Date(a.started_at).getTime() + z.time_limit_minutes * 60000 + 60000))
    const best = done.reduce((m, a) => (a.max_score > 0 ? Math.max(m, (a.score / a.max_score) * 100) : m), -1)
    const used = mine.length - (live ? 1 : 0)
    const notOpen = z.available_from && now < new Date(z.available_from).getTime()
    const closed = z.closes_at && now > new Date(z.closes_at).getTime()
    const left = z.attempts_allowed - used
    return { done, live, best, notOpen, closed, left }
  }

  return (
    <>
      <h2>Quizzes</h2>
      <p className="muted">Quizzes are marked automatically when you submit.</p>
      {error && <p className="error">{error}</p>}
      {quizzes && quizzes.length === 0 && <p className="empty">No quizzes yet.</p>}

      {reviewing && (
        <section className="panel">
          <h3>Review</h3>
          <AttemptReview attemptId={reviewing} />
          <button className="ghost" onClick={() => setReviewing(null)}>Close review</button>
        </section>
      )}

      <div className="table-wrap">
        <table>
          <thead><tr><th>Quiz</th><th>Class</th><th>Details</th><th>Your best</th><th></th></tr></thead>
          <tbody>
            {quizzes?.map((z) => {
              const d = describe(z)
              const canStart = !d.notOpen && !d.closed && (d.live || d.left > 0)
              return (
                <tr key={z.id}>
                  <td>{z.title}</td>
                  <td>{z.classes?.subjects?.name} – {z.classes?.name}</td>
                  <td className="small-text">
                    {z.time_limit_minutes ? `${z.time_limit_minutes} min · ` : ''}{z.attempts_allowed} attempt{z.attempts_allowed === 1 ? '' : 's'}
                    {d.notOpen && <div>Opens {new Date(z.available_from).toLocaleString()}</div>}
                    {z.closes_at && <div>{d.closed ? 'Closed' : 'Closes'} {new Date(z.closes_at).toLocaleString()}</div>}
                  </td>
                  <td>{d.best >= 0 ? `${Math.round(d.best)}%` : '—'}</td>
                  <td className="actions">
                    {canStart && <button className="small" onClick={() => setTaking(z)}>{d.live ? 'Resume' : d.done.length ? 'Try again' : 'Start'}</button>}
                    {d.done.length > 0 && z.show_answers && <button className="ghost small" onClick={() => setReviewing(d.done[0].id)}>Review</button>}
                    {!canStart && d.done.length === 0 && <span className="muted">{d.notOpen ? 'Not open yet' : d.closed ? 'Closed' : 'No attempts left'}</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
