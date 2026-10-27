import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { todayISO } from '../../lib/dates'
import { EXAM_TYPES, num } from '../../lib/grades'
import ExamMarksEntry from './ExamMarksEntry'
import ExamResults from './ExamResults'

const EMPTY = { title: '', exam_type: 'unit', term: '', exam_date: todayISO(), max_marks: '100', pass_marks: '', show_class_stats: true }

// Admin sees every class; a teacher only sees their own (the database decides).
export default function ExamsManager() {
  const [classes, setClasses] = useState([])
  const [classId, setClassId] = useState('')
  const [exams, setExams] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [panel, setPanel] = useState(null) // { id, mode: 'marks' | 'results' }
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('classes').select('id, name, subjects(name)').eq('active', true).order('name').then(({ data }) => setClasses(data || []))
  }, [])

  async function load(id = classId) {
    if (!id) return setExams([])
    const { data, error } = await supabase.from('exams').select('*, exam_marks(count)').eq('class_id', id)
      .order('exam_date', { ascending: false }).order('created_at', { ascending: false })
    if (error) setError(error.message); else setExams(data)
  }
  useEffect(() => { setPanel(null); load(classId) }, [classId])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const cls = classes.find((c) => c.id === classId)
  const classLabel = cls ? `${cls.subjects?.name} – ${cls.name}` : ''
  const marked = (x) => x.exam_marks?.[0]?.count ?? 0

  async function create(e) {
    e.preventDefault(); setError('')
    const { data, error } = await supabase.from('exams').insert({
      class_id: classId, title: form.title.trim(), exam_type: form.exam_type, term: form.term.trim() || null,
      exam_date: form.exam_date, max_marks: Number(form.max_marks),
      pass_marks: form.pass_marks === '' ? null : Number(form.pass_marks), show_class_stats: form.show_class_stats,
    }).select().single()
    if (error) return setError(error.message)
    setForm({ ...EMPTY, exam_type: form.exam_type, term: form.term }); await load(); setPanel({ id: data.id, mode: 'marks' })
  }

  async function remove(x) {
    if (!window.confirm(`Delete "${x.title}"?${marked(x) ? ` ${marked(x)} entered mark(s) will be deleted too.` : ''}`)) return
    const { error } = await supabase.from('exams').delete().eq('id', x.id)
    if (error) setError(error.message); else { setPanel(null); load() }
  }

  const current = panel && exams.find((x) => x.id === panel.id)

  return (
    <>
      <h2>Exams and marks</h2>
      <p className="muted">Create a unit or term exam, then enter the marks. Parents and students are notified as soon as marks are saved.</p>
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
            <h3>New exam</h3>
            <form onSubmit={create}>
              <div className="inline-form">
                <label>Exam title <input value={form.title} onChange={set('title')} placeholder="Unit Test 1" required /></label>
                <label>Type
                  <select value={form.exam_type} onChange={set('exam_type')}>{Object.entries(EXAM_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                </label>
                <label>Term (optional) <input value={form.term} onChange={set('term')} placeholder="Term 1 – 2026" /></label>
                <label>Date <input type="date" value={form.exam_date} onChange={set('exam_date')} required /></label>
                <label>Total marks <input type="number" min="1" step="0.5" value={form.max_marks} onChange={set('max_marks')} required /></label>
                <label>Pass mark (optional) <input type="number" min="0" step="0.5" value={form.pass_marks} onChange={set('pass_marks')} /></label>
              </div>
              <label className="check"><input type="checkbox" checked={form.show_class_stats} onChange={set('show_class_stats')} /> Show students and parents the class average and their position</label>
              <div><button>Create exam and enter marks</button></div>
            </form>
          </section>

          <div className="table-wrap">
            <table>
              <thead><tr><th>Exam</th><th>Type</th><th>Date</th><th>Total</th><th>Marks entered</th><th></th></tr></thead>
              <tbody>
                {exams.map((x) => (
                  <tr key={x.id}>
                    <td>{x.title}{x.term && <span className="muted small-text"> · {x.term}</span>}</td>
                    <td><span className="tag">{EXAM_TYPES[x.exam_type]}</span></td>
                    <td>{x.exam_date}</td><td>{num(x.max_marks)}</td><td>{marked(x)}</td>
                    <td className="actions">
                      <button className="small" onClick={() => setPanel({ id: x.id, mode: 'marks' })}>Enter marks</button>
                      <button className="ghost small" onClick={() => setPanel({ id: x.id, mode: 'results' })}>Results</button>
                      <button className="danger small" onClick={() => remove(x)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {exams.length === 0 && <p className="empty">No exams for this class yet.</p>}
          </div>

          {current && panel.mode === 'marks' && <ExamMarksEntry key={current.id} exam={current} onSaved={() => load()} />}
          {current && panel.mode === 'results' && <ExamResults key={current.id} exam={current} classLabel={classLabel} />}
        </>
      )}
    </>
  )
}
