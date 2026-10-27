import { useEffect, useState } from 'react'
import { BookOpen, Hash, Layers, Plus, Presentation, Tag, Trash2, Users, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useProfiles, label } from '../../lib/useProfiles'
import { Alert, EmptyState, Field, FormCard, PageHeader, Switch } from '../../components/ui'

const EMPTY = { subject_id: '', name: '', level: '', teacher_id: '', capacity: '', monthly_fee: '' }

export default function Classes() {
  const profiles = useProfiles()
  const teachers = profiles.filter((p) => p.role === 'teacher')
  const [subjects, setSubjects] = useState([])
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')

  async function load() {
    const [s, c] = await Promise.all([
      supabase.from('subjects').select('id, name').eq('active', true).order('name'),
      supabase.from('classes').select('*, subjects(name)').order('created_at', { ascending: false }),
    ])
    if (s.error || c.error) return setError((s.error || c.error).message)
    setSubjects(s.data); setRows(c.data)
  }
  useEffect(() => { load() }, [])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function add(e) {
    e.preventDefault()
    setError('')
    const { error } = await supabase.from('classes').insert({
      subject_id: form.subject_id,
      name: form.name.trim(),
      level: form.level.trim() || null,
      teacher_id: form.teacher_id || null,
      capacity: form.capacity ? Number(form.capacity) : null,
      monthly_fee: form.monthly_fee ? Number(form.monthly_fee) : 0,
    })
    if (error) return setError(error.message)
    setForm(EMPTY); load()
  }

  async function update(id, patch) {
    setError('')
    const { error } = await supabase.from('classes').update(patch).eq('id', id)
    if (error) setError(error.message); else load()
  }

  async function remove(c) {
    if (!window.confirm(`Delete class "${c.name}"? Its enrollments will be removed too.`)) return
    const { error } = await supabase.from('classes').delete().eq('id', c.id)
    if (error) setError(error.message); else load()
  }

  return (
    <>
      <PageHeader icon={Layers} title="Classes" subtitle={'A class is a group of students learning one subject with one teacher, for example "ICT – Grade 10 Evening".'} />

      {teachers.length === 0 && (
        <Alert type="warn">No teachers yet. <Link to="/admin/users">Go to Users</Link> and add a teacher first.</Alert>
      )}

      <FormCard icon={Plus} title="Add a class">
        <form onSubmit={add}>
          <div className="form-grid">
            <Field label="Subject" icon={BookOpen}>
              <select value={form.subject_id} onChange={set('subject_id')} required>
                <option value="">Choose a subject…</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Class name" icon={Layers}><input value={form.name} onChange={set('name')} required placeholder="Grade 10 Evening" /></Field>
            <Field label="Level (optional)" icon={Tag}><input value={form.level} onChange={set('level')} placeholder="Beginner" /></Field>
            <Field label="Teacher" icon={Presentation}>
              <select value={form.teacher_id} onChange={set('teacher_id')}>
                <option value="">Assign later</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{label(t)}</option>)}
              </select>
            </Field>
            <Field label="Max students (optional)" icon={Users}><input type="number" min="1" value={form.capacity} onChange={set('capacity')} /></Field>
            <Field label="Monthly fee (Rs.)" icon={Wallet}><input type="number" min="0" step="1" value={form.monthly_fee} onChange={set('monthly_fee')} /></Field>
          </div>
          <div className="form-actions"><button><Plus size={18} aria-hidden="true" /> Add class</button></div>
        </form>
      </FormCard>

      <Alert>{error}</Alert>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Class</th><th>Subject</th><th>Teacher</th><th>Max</th><th>Monthly fee</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td><span className="person-text"><strong>{c.name}</strong><small>{c.level || 'No level set'}</small></span></td>
                <td><span className="tag ev-event">{c.subjects?.name}</span></td>
                <td>
                  <select value={c.teacher_id || ''} onChange={(e) => update(c.id, { teacher_id: e.target.value || null })} aria-label={`Teacher for ${c.name}`}>
                    <option value="">Not assigned</option>
                    {teachers.map((t) => <option key={t.id} value={t.id}>{label(t)}</option>)}
                  </select>
                </td>
                <td>{c.capacity || '—'}</td>
                <td>
                  <span className="fee-box"><span>Rs.</span>
                    <input className="fee-input" type="number" min="0" step="1" defaultValue={c.monthly_fee} key={`${c.id}:${c.monthly_fee}`} aria-label={`Monthly fee for ${c.name}`}
                      onBlur={(e) => Number(e.target.value) !== Number(c.monthly_fee) && update(c.id, { monthly_fee: Number(e.target.value) || 0 })} />
                  </span>
                </td>
                <td><Switch checked={c.active} onChange={() => update(c.id, { active: !c.active })}>{c.active ? 'Active' : 'Inactive'}</Switch></td>
                <td><button className="danger small" onClick={() => remove(c)} aria-label={`Delete ${c.name}`}><Trash2 size={15} aria-hidden="true" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <EmptyState icon={Layers} title="No classes yet" text="Add your first class above." />}
      </div>
    </>
  )
}
