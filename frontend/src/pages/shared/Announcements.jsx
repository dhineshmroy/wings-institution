import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'

const AUDIENCES = { everyone: 'Everyone', teachers: 'All teachers', students: 'All students', parents: 'All parents', class: 'One class' }

export default function Announcements() {
  const { profile } = useAuth()
  const isTeacher = profile.role === 'teacher'
  const canPost = profile.role === 'admin' || isTeacher
  const [items, setItems] = useState(null)
  const [fresh, setFresh] = useState(new Set())
  const [classes, setClasses] = useState([])
  const [form, setForm] = useState({ title: '', body: '', audience: isTeacher ? 'class' : 'everyone', class_id: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  async function load() {
    const [a, n] = await Promise.all([
      supabase.from('announcements')
        .select('*, classes(name, subjects(name)), author:profiles!announcements_created_by_fkey(full_name)')
        .order('created_at', { ascending: false }).limit(100),
      supabase.from('notifications').select('id, ref_id').eq('kind', 'announcement').is('read_at', null),
    ])
    if (a.error) return setError(a.error.message)
    setItems(a.data)
    setFresh(new Set((n.data || []).map((x) => x.ref_id)))
    if (n.data?.length) {
      await supabase.rpc('mark_notifications_read', { ids: n.data.map((x) => x.id) })
      window.dispatchEvent(new Event('notifications-changed'))
    }
  }
  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!canPost) return
    supabase.from('classes').select('id, name, subjects(name)').eq('active', true).order('name').then(({ data }) => setClasses(data || []))
  }, [canPost])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function post(e) {
    e.preventDefault()
    setError(''); setMsg(''); setBusy(true)
    const { error } = await supabase.from('announcements').insert({
      title: form.title.trim(), body: form.body.trim(), audience: form.audience,
      class_id: form.audience === 'class' ? form.class_id : null,
    })
    setBusy(false)
    if (error) return setError(error.message)
    setForm({ ...form, title: '', body: '' }); setMsg('Announcement posted. Everyone it applies to has been notified.'); load()
  }

  async function remove(a) {
    if (!window.confirm(`Delete "${a.title}"?`)) return
    const { error } = await supabase.from('announcements').delete().eq('id', a.id)
    if (error) setError(error.message); else load()
  }

  const target = (a) => (a.audience === 'class' ? `${a.classes?.subjects?.name} – ${a.classes?.name}` : AUDIENCES[a.audience])

  return (
    <>
      <h2>Announcements</h2>
      <p className="muted">News and circulars from the institute{isTeacher ? ' and your teachers' : ''}.</p>
      {error && <p className="error">{error}</p>}
      {msg && <p className="ok">{msg}</p>}

      {canPost && (
        <section className="panel">
          <h3>New announcement</h3>
          <form onSubmit={post}>
            <label>Title <input value={form.title} onChange={set('title')} required /></label>
            <label>Message <textarea rows="4" value={form.body} onChange={set('body')} required /></label>
            <div className="inline-form">
              {!isTeacher && (
                <label>Send to
                  <select value={form.audience} onChange={set('audience')}>
                    {Object.entries(AUDIENCES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
              )}
              {form.audience === 'class' && (
                <label>Class
                  <select value={form.class_id} onChange={set('class_id')} required>
                    <option value="">Choose…</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.subjects?.name} – {c.name}</option>)}
                  </select>
                </label>
              )}
              <button disabled={busy}>{busy ? 'Posting…' : 'Post announcement'}</button>
            </div>
          </form>
        </section>
      )}

      {items && items.length === 0 && <p className="empty">No announcements yet.</p>}
      {items?.map((a) => (
        <article className="panel" key={a.id}>
          <div className="row-between">
            <h3>{a.title} {fresh.has(a.id) && <span className="tag st-late">New</span>}</h3>
            {(profile.role === 'admin' || a.created_by === profile.id) && <button className="danger small" onClick={() => remove(a)}>Delete</button>}
          </div>
          <p className="muted small-text">{new Date(a.created_at).toLocaleString()} · From {a.author?.full_name || 'Wings Institution'} · To {target(a)}</p>
          <p className="answer">{a.body}</p>
        </article>
      ))}
    </>
  )
}
