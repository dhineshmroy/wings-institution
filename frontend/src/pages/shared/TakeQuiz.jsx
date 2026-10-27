import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import AttemptReview from './AttemptReview'

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export default function TakeQuiz({ quiz, onExit }) {
  const [attempt, setAttempt] = useState(null)
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [deadline, setDeadline] = useState(null)
  const [left, setLeft] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const answersRef = useRef({})
  const attemptRef = useRef(null)
  const doneRef = useRef(false)

  useEffect(() => {
    async function begin() {
      const { data: a, error } = await supabase.rpc('start_quiz_attempt', { p_quiz: quiz.id })
      if (error) return setError(error.message)
      attemptRef.current = a
      setAttempt(a)
      const { data: qs, error: e2 } = await supabase.rpc('get_attempt_questions', { p_attempt: a.id })
      if (e2) return setError(e2.message)
      setQuestions(qs)
      if (quiz.time_limit_minutes) setDeadline(new Date(a.started_at).getTime() + quiz.time_limit_minutes * 60000)
    }
    begin()
  }, [])

  useEffect(() => {
    if (!deadline) return
    const tick = () => {
      const s = Math.max(0, Math.round((deadline - Date.now()) / 1000))
      setLeft(s)
      if (s === 0 && !doneRef.current) submit(true)
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [deadline])

  function choose(q, optionId) {
    const current = answersRef.current[q.id] || []
    const next = q.kind === 'single'
      ? [optionId]
      : current.includes(optionId) ? current.filter((x) => x !== optionId) : [...current, optionId]
    answersRef.current = { ...answersRef.current, [q.id]: next }
    setAnswers(answersRef.current)
  }

  async function submit(auto = false) {
    if (doneRef.current) return
    if (!auto) {
      const unanswered = questions.filter((q) => !(answersRef.current[q.id]?.length)).length
      if (unanswered && !window.confirm(`${unanswered} question${unanswered === 1 ? ' is' : 's are'} unanswered. Submit anyway?`)) return
    }
    doneRef.current = true
    setBusy(true)
    const { data, error } = await supabase.rpc('submit_quiz_attempt', { p_attempt: attemptRef.current.id, p_answers: answersRef.current })
    setBusy(false)
    if (error) { doneRef.current = false; return setError(error.message) }
    setResult(data)
  }

  if (result) {
    return (
      <section className="panel">
        <h2>{quiz.title}: finished</h2>
        <p className="big-pct">{result.score} / {result.max_score}</p>
        {result.over_time && <p className="error">This attempt was submitted after the time limit. Your teacher can see this.</p>}
        {quiz.show_answers ? <AttemptReview attemptId={attempt.id} /> : <p className="muted">Your teacher has chosen not to show the correct answers.</p>}
        <p><button onClick={onExit}>Back to quizzes</button></p>
      </section>
    )
  }

  if (!attempt) {
    return (
      <section className="panel">
        {error ? <p className="error">{error}</p> : <p className="muted">Starting the quiz…</p>}
        <button className="ghost" onClick={onExit}>Back to quizzes</button>
      </section>
    )
  }

  return (
    <section>
      <div className="quiz-head">
        <h2>{quiz.title}</h2>
        {left !== null && <span className={`timer ${left < 60 ? 'low' : ''}`} aria-live="off">Time left {mmss(left)}</span>}
      </div>
      {quiz.instructions && <p className="answer">{quiz.instructions}</p>}
      {questions.map((q, i) => (
        <section className="panel question" key={q.id}>
          <h3>{i + 1}. {q.prompt} <span className="muted small-text">({q.points} point{Number(q.points) === 1 ? '' : 's'})</span></h3>
          {q.kind === 'multiple' && <p className="muted small-text">Choose all that apply</p>}
          <div className="options">
            {q.options.map((o) => (
              <label className="check opt-row" key={o.id}>
                <input
                  type={q.kind === 'single' ? 'radio' : 'checkbox'}
                  name={q.id}
                  checked={(answers[q.id] || []).includes(o.id)}
                  onChange={() => choose(q, o.id)}
                />
                {o.text}
              </label>
            ))}
          </div>
        </section>
      ))}
      {error && <p className="error">{error}</p>}
      <p><button disabled={busy} onClick={() => submit(false)}>{busy ? 'Submitting…' : 'Submit quiz'}</button></p>
    </section>
  )
}
