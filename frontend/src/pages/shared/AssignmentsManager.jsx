import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import GradeSubmissions from './GradeSubmissions'

const EMPTY = { title: '', instructions: '', due_at: '', max_points: '100' }

// Admin sees every class; a teacher only sees their own (the database decides).
export default function AssignmentsManager() {
  const [classes, setClasses] = useState([])
  const [classId, setClassId] = useState('')
  const [items, setItems] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [grading, setGrading] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('classes').select('id, name, subjects(name)').eq('active', true).order('name')
      .then(({ data }) => setClasses(data || []))
  }, [])

  async function load(id = classId) {
    if (!id) return setItems([])
    const { data, error } = await supabase.from('assignments').select('*, submissions(count)')
      .eq('class_id', id).order('created_at', { ascending: false })
    if (error) setError(error.message); else setItems(data)
  }
  useEffect(() => { setGrading(null); load(classId) }, [classId])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function add(e) {
    e.preventDefault()
    setError('')
    const { error } = await supabase.from('assignments').insert({
      class_id: classId,
      title: form.title.trim(),
      instructions: form.instructions.trim() || null,
      due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
      max_points: Number(form.max_points),
    })
    if (error) return setError(error.message)
    setForm(EMPTY); load()
  }

  async function remove(a) {
    if (!window.confirm(`Delete "${a.title}"? All submissions and grades for it will be deleted too.`)) return
    const { error } = await supabase.from('assignments').delete().eq('id', a.id)
    if (error) return setError(error.message)
    if (grading?.id === a.id) setGrading(null)
    load()
  }

  return (
    <>
      <h2>Assignments</h2>
      <p className="muted">Create homework or projects, then grade what students submit. For dance, students can submit a practice video link or file.</p>
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
            <h3>New assignment</h3>
            <form onSubmit={add}>
              <label>Title <input value={form.title} onChange={set('title')} required /></label>
              <label>Instructions <textarea rows="4" value={form.instructions} onChange={set('instructions')} /></label>
              <div className="inline-form">
                <label>Due date and time (optional) <input type="datetime-local" value={form.due_at} onChange={set('due_at')} /></label>
                <label>Total points <input type="number" min="1" step="0.5" value={form.max_points} onChange={set('max_points')} required /></label>
                <button>Create assignment</button>
              </div>
            </form>
          </section>

          <div className="table-wrap">
            <table>
              <thead><tr><th>Title</th><th>Due</th><th>Points</th><th>Submitted</th><th></th></tr></thead>
              <tbody>
                {items.map((a) => (
                  <tr key={a.id}>
                    <td>{a.title}</td>
                    <td>{a.due_at ? new Date(a.due_at).toLocaleString() : 'No due date'}</td>
                    <td>{a.max_points}</td>
                    <td>{a.submissions?.[0]?.count ?? 0}</td>
                    <td>
                      <button className="small" onClick={() => setGrading(a)}>View & grade</button>{' '}
                      <button className="danger small" onClick={() => remove(a)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 && <p className="empty">No assignments for this class yet.</p>}
          </div>

          {grading && <GradeSubmissions key={grading.id} assignment={grading} onChanged={() => load()} />}
        </>
      )}
    </>
  )
}
