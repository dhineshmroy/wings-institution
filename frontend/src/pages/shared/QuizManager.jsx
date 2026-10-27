import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import QuizBuilder from './QuizBuilder'
import QuizResults from './QuizResults'

const EMPTY = { title: '', instructions: '', time_limit: '', opens: '', closes: '', attempts: '1', show_answers: true }
const iso = (v) => (v ? new Date(v).toISOString() : null)

// Admin sees every class; a teacher only sees their own (the database decides).
export default function QuizManager() {
  const [classes, setClasses] = useState([])
  const [classId, setClassId] = useState('')
  const [quizzes, setQuizzes] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [panel, setPanel] = useState(null) // { quizId, mode: 'questions' | 'results' }
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('classes').select('id, name, subjects(name)').eq('active', true).order('name').then(({ data }) => setClasses(data || []))
  }, [])

  async function load(id = classId) {
    if (!id) return setQuizzes([])
    const { data, error } = await supabase.from('quizzes').select('*, quiz_questions(count), quiz_attempts(count)')
      .eq('class_id', id).order('created_at', { ascending: false })
    if (error) setError(error.message); else setQuizzes(data)
  }
  useEffect(() => { setPanel(null); load(classId) }, [classId])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const qCount = (z) => z.quiz_questions?.[0]?.count ?? 0
  const aCount = (z) => z.quiz_attempts?.[0]?.count ?? 0

  async function create(e) {
    e.preventDefault(); setError('')
    const { data, error } = await supabase.from('quizzes').insert({
      class_id: classId, title: form.title.trim(), instructions: form.instructions.trim() || null,
      time_limit_minutes: form.time_limit ? Number(form.time_limit) : null,
      available_from: iso(form.opens), closes_at: iso(form.closes),
      attempts_allowed: Number(form.attempts), show_answers: form.show_answers,
    }).select().single()
    if (error) return setError(error.message)
    setForm(EMPTY); await load(); setPanel({ quizId: data.id, mode: 'questions' })
  }

  async function togglePublish(z) {
    setError('')
    if (!z.published && qCount(z) === 0) return setError('Add at least one question before publishing.')
    const { error } = await supabase.from('quizzes').update({ published: !z.published }).eq('id', z.id)
    if (error) setError(error.message); else load()
  }

  async function remove(z) {
    const extra = aCount(z) > 0 ? ` ${aCount(z)} student attempt(s) will be deleted too.` : ''
    if (!window.confirm(`Delete "${z.title}"?${extra}`)) return
    const { error } = await supabase.from('quizzes').delete().eq('id', z.id)
    if (error) setError(error.message); else { setPanel(null); load() }
  }

  const current = panel && quizzes.find((z) => z.id === panel.quizId)

  return (
    <>
      <h2>Quizzes</h2>
      <p className="muted">Build multiple-choice and true/false quizzes. Students are marked automatically the moment they submit.</p>
      <label className="narrow">Class
        <select value={classId} onChange={(e) => { setClassId(e.target.value); setError('') }}>
          <option value="">Choose a class…</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.subjects?.name} – {c.name}</option>)}
        </select>
      </label>
      {error && <p className="error">{error}</p>}

      {classId && (
        <>
          <section className="panel">
            <h3>New quiz</h3>
            <form onSubmit={create}>
              <label>Title <input value={form.title} onChange={set('title')} required /></label>
              <label>Instructions (optional) <textarea rows="2" value={form.instructions} onChange={set('instructions')} /></label>
              <div className="inline-form">
                <label>Time limit (minutes, optional) <input type="number" min="1" value={form.time_limit} onChange={set('time_limit')} /></label>
                <label>Attempts allowed <input type="number" min="1" max="20" value={form.attempts} onChange={set('attempts')} required /></label>
                <label>Opens (optional) <input type="datetime-local" value={form.opens} onChange={set('opens')} /></label>
                <label>Closes (optional) <input type="datetime-local" value={form.closes} onChange={set('closes')} /></label>
              </div>
              <label className="check"><input type="checkbox" checked={form.show_answers} onChange={set('show_answers')} /> Show the correct answers after students submit</label>
              <div><button>Create quiz and add questions</button></div>
            </form>
          </section>

          <div className="table-wrap">
            <table>
              <thead><tr><th>Quiz</th><th>Questions</th><th>Attempts</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {quizzes.map((z) => (
                  <tr key={z.id}>
                    <td>{z.title}{z.time_limit_minutes ? <span className="muted small-text"> · {z.time_limit_minutes} min</span> : ''}</td>
                    <td>{qCount(z)}</td>
                    <td>{aCount(z)}</td>
                    <td><button className="ghost small" onClick={() => togglePublish(z)}>{z.published ? 'Published (unpublish)' : 'Draft (publish)'}</button></td>
                    <td className="actions">
                      <button className="small" onClick={() => setPanel({ quizId: z.id, mode: 'questions' })}>Questions</button>
                      <button className="ghost small" onClick={() => setPanel({ quizId: z.id, mode: 'results' })}>Results</button>
                      <button className="danger small" onClick={() => remove(z)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {quizzes.length === 0 && <p className="empty">No quizzes for this class yet.</p>}
          </div>

          {current && panel.mode === 'questions' && <QuizBuilder key={current.id} quiz={current} locked={aCount(current) > 0} onChanged={() => load()} />}
          {current && panel.mode === 'results' && <QuizResults key={current.id} quiz={current} />}
        </>
      )}
    </>
  )
}
