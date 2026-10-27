import { useEffect, useState } from 'react'
import { BookOpen, FileText, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { Alert, EmptyState, Field, FormCard, PageHeader, Switch } from '../../components/ui'

export default function Subjects() {
  const [rows, setRows] = useState([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')

  async function load() {
    const { data, error } = await supabase.from('subjects').select('*, classes(count)').order('name')
    if (error) setError(error.message); else setRows(data)
  }
  useEffect(() => { load() }, [])

  async function add(e) {
    e.preventDefault()
    setError('')
    const { error } = await supabase.from('subjects').insert({ name: name.trim(), description: description.trim() || null })
    if (error) return setError(error.message)
    setName(''); setDescription(''); load()
  }

  async function toggle(s) {
    const { error } = await supabase.from('subjects').update({ active: !s.active }).eq('id', s.id)
    if (error) setError(error.message); else load()
  }

  async function remove(s) {
    if (!window.confirm(`Delete subject "${s.name}"?`)) return
    const { error } = await supabase.from('subjects').delete().eq('id', s.id)
    if (error) setError(error.code === '23503' ? 'This subject still has classes. Delete or move them first, or mark the subject inactive.' : error.message)
    else load()
  }

  return (
    <>
      <PageHeader icon={BookOpen} title="Subjects" subtitle="ICT and Dance are already added. Add any new subject here and it works everywhere in the app." />

      <FormCard icon={Plus} title="Add a subject">
        <form onSubmit={add}>
          <div className="form-grid">
            <Field label="Subject name" icon={BookOpen}><input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Music" /></Field>
            <Field label="Description (optional)" icon={FileText}><input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A short line about the subject" /></Field>
          </div>
          <div className="form-actions"><button><Plus size={18} aria-hidden="true" /> Add subject</button></div>
        </form>
      </FormCard>

      <Alert>{error}</Alert>

      {rows.length === 0
        ? <EmptyState icon={BookOpen} title="No subjects yet" text="Add your first subject above." />
        : (
          <div className="subject-grid">
            {rows.map((s) => {
              const n = s.classes?.[0]?.count ?? 0
              return (
                <article className={`subject-card ${s.active ? '' : 'off'}`} key={s.id}>
                  <div className="subject-top">
                    <span className="subject-badge" aria-hidden="true">{s.name.slice(0, 1).toUpperCase()}</span>
                    <div><h3>{s.name}</h3><p>{n} {n === 1 ? 'class' : 'classes'}</p></div>
                  </div>
                  <p>{s.description || 'No description yet.'}</p>
                  <div className="subject-foot">
                    <Switch checked={s.active} onChange={() => toggle(s)}>{s.active ? 'Active' : 'Inactive'}</Switch>
                    <button className="danger small" onClick={() => remove(s)}><Trash2 size={15} aria-hidden="true" /> Delete</button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
    </>
  )
}
