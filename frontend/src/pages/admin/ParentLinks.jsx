import { useEffect, useState } from 'react'
import { GraduationCap, Link2, Trash2, Users } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useProfiles, label } from '../../lib/useProfiles'
import Avatar from '../../components/Avatar'
import { Alert, EmptyState, Field, FormCard, PageHeader } from '../../components/ui'

export default function ParentLinks() {
  const profiles = useProfiles()
  const parents = profiles.filter((p) => p.role === 'parent')
  const students = profiles.filter((p) => p.role === 'student')
  const byId = Object.fromEntries(profiles.map((p) => [p.id, p]))
  const [links, setLinks] = useState([])
  const [parentId, setParentId] = useState('')
  const [studentId, setStudentId] = useState('')
  const [error, setError] = useState('')

  async function load() {
    const { data, error } = await supabase.from('parent_students').select('*').order('created_at', { ascending: false })
    if (error) setError(error.message); else setLinks(data)
  }
  useEffect(() => { load() }, [])

  async function add(e) {
    e.preventDefault()
    setError('')
    const { error } = await supabase.from('parent_students').insert({ parent_id: parentId, student_id: studentId })
    if (error) return setError(error.code === '23505' ? 'That parent is already linked to this student.' : error.message)
    setStudentId(''); load()
  }

  async function remove(id) {
    if (!window.confirm('Remove this link?')) return
    const { error } = await supabase.from('parent_students').delete().eq('id', id)
    if (error) setError(error.message); else load()
  }

  const families = {}
  links.forEach((l) => { (families[l.parent_id] ||= []).push(l) })

  return (
    <>
      <PageHeader icon={Link2} title="Parents and children" subtitle="Link a parent account to each of their children. A parent can have several children." />

      <FormCard icon={Users} title="Link a child to a parent">
        <form onSubmit={add}>
          <div className="form-grid">
            <Field label="Parent" icon={Users}>
              <select value={parentId} onChange={(e) => setParentId(e.target.value)} required>
                <option value="">Choose a parent…</option>
                {parents.map((p) => <option key={p.id} value={p.id}>{label(p)}{p.email ? ` (${p.email})` : ''}</option>)}
              </select>
            </Field>
            <Field label="Child (student)" icon={GraduationCap}>
              <select value={studentId} onChange={(e) => setStudentId(e.target.value)} required>
                <option value="">Choose a child…</option>
                {students.map((s) => <option key={s.id} value={s.id}>{label(s)}{s.email ? ` (${s.email})` : ''}</option>)}
              </select>
            </Field>
          </div>
          <div className="form-actions"><button><Link2 size={18} aria-hidden="true" /> Link them</button></div>
        </form>
      </FormCard>

      <Alert>{error}</Alert>

      {Object.keys(families).length === 0
        ? <EmptyState icon={Link2} title="No families linked yet" text="Choose a parent and a child above. Linked children show up on the parent's dashboard." />
        : (
          <div className="families">
            {Object.entries(families).map(([pid, list]) => {
              const p = byId[pid]
              return (
                <article className="family" key={pid}>
                  <div className="family-head">
                    <Avatar path={p?.avatar_path} name={p?.full_name} size={44} />
                    <div className="person-text">
                      <strong>{label(p)}</strong>
                      <small>{p?.email}{p?.phone ? ` · ${p.phone}` : ''}</small>
                    </div>
                    <span className="tag">{list.length} {list.length === 1 ? 'child' : 'children'}</span>
                  </div>
                  <div className="family-kids">
                    {list.map((l) => {
                      const s = byId[l.student_id]
                      return (
                        <div className="kid" key={l.id}>
                          <span className="person"><Avatar path={s?.avatar_path} name={s?.full_name} size={34} /><strong>{label(s)}</strong></span>
                          <button className="danger small" onClick={() => remove(l.id)} aria-label={`Remove ${label(s)}`}><Trash2 size={15} aria-hidden="true" /> Remove</button>
                        </div>
                      )
                    })}
                  </div>
                </article>
              )
            })}
          </div>
        )}
    </>
  )
}
