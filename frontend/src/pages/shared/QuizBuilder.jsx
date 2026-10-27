import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

const blank = () => [0, 1, 2, 3].map(() => ({ text: '', correct: false }))
const keyOf = (o) => (Array.isArray(o.quiz_answer_key) ? o.quiz_answer_key[0]?.is_correct : o.quiz_answer_key?.is_correct)

export default function QuizBuilder({ quiz, locked, onChanged }) {
  const [questions, setQuestions] = useState([])
  const [prompt, setPrompt] = useState('')
  const [kind, setKind] = useState('single')
  const [points, setPoints] = useState('1')
  const [options, setOptions] = useState(blank())
  const [tf, setTf] = useState('True')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    const { data, error } = await supabase.from('quiz_questions')
      .select('*, quiz_options(id, position, text, quiz_answer_key(is_correct))')
      .eq('quiz_id', quiz.id).order('position')
    if (error) setError(error.message); else setQuestions(data)
  }
  useEffect(() => { load() }, [quiz.id])

  const setOpt = (i, patch) => setOptions(options.map((o, j) => (j === i ? { ...o, ...patch } : o)))
  const pickSingle = (i) => setOptions(options.map((o, j) => ({ ...o, correct: j === i })))

  async function add(e) {
    e.preventDefault()
    setError(''); setBusy(true)
    const list = kind === 'truefalse'
      ? [{ text: 'True', correct: tf === 'True' }, { text: 'False', correct: tf === 'False' }]
      : options.filter((o) => o.text.trim()).map((o) => ({ text: o.text.trim(), correct: o.correct }))
    const { error } = await supabase.rpc('add_quiz_question', {
      p_quiz: quiz.id, p_prompt: prompt, p_kind: kind === 'multiple' ? 'multiple' : 'single',
      p_points: Number(points), p_options: list,
    })
    setBusy(false)
    if (error) return setError(error.message)
    setPrompt(''); setOptions(blank()); load(); onChanged?.()
  }

  async function remove(q) {
    if (!window.confirm('Delete this question?')) return
    const { error } = await supabase.rpc('delete_quiz_question', { p_question: q.id })
    if (error) setError(error.message); else { load(); onChanged?.() }
  }

  const total = questions.reduce((s, q) => s + Number(q.points), 0)

  return (
    <section className="panel">
      <h3>Questions: {quiz.title}</h3>
      <p className="muted">{questions.length} question{questions.length === 1 ? '' : 's'} · {total} points in total</p>
      {locked && <p className="error">Students have already attempted this quiz, so its questions are locked. To change them, make a new quiz.</p>}
      {error && <p className="error">{error}</p>}

      {questions.map((q, i) => (
        <div className="question-row" key={q.id}>
          <div className="row-between">
            <strong>{i + 1}. {q.prompt} <span className="muted small-text">({q.points} pt{Number(q.points) === 1 ? '' : 's'}{q.kind === 'multiple' ? ', multiple answers' : ''})</span></strong>
            {!locked && <button className="danger small" onClick={() => remove(q)}>Delete</button>}
          </div>
          <ul className="plain">
            {[...q.quiz_options].sort((a, b) => a.position - b.position).map((o) => (
              <li key={o.id}>{keyOf(o) ? '✓ ' : '○ '}{o.text}</li>
            ))}
          </ul>
        </div>
      ))}

      {!locked && (
        <form onSubmit={add} className="detail">
          <h3>Add a question</h3>
          <label>Question <textarea rows="2" value={prompt} onChange={(e) => setPrompt(e.target.value)} required /></label>
          <div className="inline-form">
            <label>Type
              <select value={kind} onChange={(e) => { setKind(e.target.value); setOptions(options.map((o) => ({ ...o, correct: false }))) }}>
                <option value="single">One correct answer</option>
                <option value="multiple">Several correct answers</option>
                <option value="truefalse">True or false</option>
              </select>
            </label>
            <label>Points <input type="number" min="0.5" step="0.5" value={points} onChange={(e) => setPoints(e.target.value)} required /></label>
          </div>

          {kind === 'truefalse' ? (
            <label>The correct answer is
              <select value={tf} onChange={(e) => setTf(e.target.value)}><option>True</option><option>False</option></select>
            </label>
          ) : (
            <>
              <p className="muted small-text">Type the answer options and tick the correct {kind === 'multiple' ? 'ones' : 'one'}. Blank options are ignored.</p>
              {options.map((o, i) => (
                <div className="opt-edit" key={i}>
                  <input
                    type={kind === 'multiple' ? 'checkbox' : 'radio'} name="correct" checked={o.correct}
                    onChange={(e) => (kind === 'multiple' ? setOpt(i, { correct: e.target.checked }) : pickSingle(i))}
                    aria-label={`Option ${i + 1} is correct`}
                  />
                  <input value={o.text} onChange={(e) => setOpt(i, { text: e.target.value })} placeholder={`Option ${i + 1}`} />
                </div>
              ))}
              <p><button type="button" className="ghost small" onClick={() => setOptions([...options, { text: '', correct: false }])}>Add another option</button></p>
            </>
          )}
          <div><button disabled={busy}>{busy ? 'Saving…' : 'Add question'}</button></div>
        </form>
      )}
    </section>
  )
}
