import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { show } from '../../lib/stats'

const keyOf = (o) => (Array.isArray(o.quiz_answer_key) ? o.quiz_answer_key[0]?.is_correct : o.quiz_answer_key?.is_correct)

export default function QuizResults({ quiz }) {
  const [attempts, setAttempts] = useState(null)
  const [questions, setQuestions] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const [a, q] = await Promise.all([
        supabase.from('quiz_attempts').select('*, student:profiles!quiz_attempts_student_id_fkey(full_name)')
          .eq('quiz_id', quiz.id).eq('status', 'submitted').order('submitted_at', { ascending: false }),
        supabase.from('quiz_questions').select('id, prompt, position, quiz_options(id, quiz_answer_key(is_correct))')
          .eq('quiz_id', quiz.id).order('position'),
      ])
      if (a.error || q.error) return setError((a.error || q.error).message)
      setAttempts(a.data); setQuestions(q.data)
    }
    load()
  }, [quiz.id])

  if (error) return <p className="error">{error}</p>
  if (!attempts) return <p className="muted">Loading…</p>

  // attempt number per student (oldest = 1)
  const order = {}
  ;[...attempts].sort((a, b) => a.submitted_at.localeCompare(b.submitted_at)).forEach((a) => {
    order[a.student_id] = (order[a.student_id] || 0) + 1
    a._n = order[a.student_id]
  })

  const correctRate = (q) => {
    const cor = new Set(q.quiz_options.filter(keyOf).map((o) => o.id))
    const withAnswers = attempts.filter((a) => a.answers)
    if (!withAnswers.length) return null
    const right = withAnswers.filter((a) => {
      const sel = new Set(a.answers[q.id] || [])
      return sel.size === cor.size && [...cor].every((x) => sel.has(x))
    }).length
    return (right / withAnswers.length) * 100
  }

  return (
    <section className="panel">
      <h3>Results: {quiz.title}</h3>
      {attempts.length === 0 && <p className="empty">No one has submitted this quiz yet.</p>}
      {attempts.length > 0 && (
        <>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Student</th><th>Attempt</th><th>Score</th><th>%</th><th>Submitted</th></tr></thead>
              <tbody>
                {attempts.map((a) => (
                  <tr key={a.id}>
                    <td>{a.student?.full_name || 'Student'}</td>
                    <td>{a._n}</td>
                    <td>{a.score} / {a.max_score}</td>
                    <td>{a.max_score > 0 ? show((a.score / a.max_score) * 100) : '—'}</td>
                    <td>{new Date(a.submitted_at).toLocaleString()} {a.over_time && <span className="tag st-late">Over time</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3>Which questions were hardest?</h3>
          <p className="muted small-text">The share of attempts that got each question fully right.</p>
          <ul className="plain">
            {questions.map((q, i) => (
              <li key={q.id} className="row-between"><span>{i + 1}. {q.prompt}</span><strong>{show(correctRate(q))}</strong></li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
