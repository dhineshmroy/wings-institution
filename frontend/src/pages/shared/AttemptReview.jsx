import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function AttemptReview({ attemptId }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.rpc('get_attempt_review', { p_attempt: attemptId })
      .then(({ data, error }) => (error ? setError(error.message) : setData(data)))
  }, [attemptId])

  if (error) return <p className="error">{error}</p>
  if (!data) return <p className="muted">Loading review…</p>

  return (
    <div>
      <p className="big-pct">{data.score} / {data.max_score}</p>
      {data.questions.map((q, i) => {
        const sel = new Set(q.selected)
        const cor = new Set(q.correct)
        const right = sel.size === cor.size && [...cor].every((x) => sel.has(x))
        return (
          <section className="panel question" key={q.id}>
            <h3>{i + 1}. {q.prompt} <span className={`tag ${right ? 'st-present' : 'st-absent'}`}>{right ? `Correct (+${q.points})` : 'Not correct'}</span></h3>
            {q.kind === 'multiple' && <p className="muted small-text">Choose all that apply</p>}
            <ul className="plain">
              {q.options.map((o) => (
                <li key={o.id} className={`opt ${cor.has(o.id) ? 'is-correct' : ''} ${sel.has(o.id) && !cor.has(o.id) ? 'is-wrong' : ''}`}>
                  {o.text}
                  {cor.has(o.id) && <span className="tag st-present">Correct answer</span>}
                  {sel.has(o.id) && <span className="tag">Your answer</span>}
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
