import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../lib/api'
import { uploadAvatar } from '../../lib/avatar'
import { Mail } from 'lucide-react'
import Avatar from '../../components/Avatar'
import { Field } from '../../components/ui'

// Where a child's e-mail updates go (children without their own e-mail use the parent's address).
function ContactEmail({ kid, onSaved, onMessage, onError }) {
  const [value, setValue] = useState(kid.contact_email || '')
  const [busy, setBusy] = useState(false)
  async function save(e) {
    e.preventDefault(); onError(''); onMessage(''); setBusy(true)
    const { error } = await supabase.rpc('set_contact_email', { p_user: kid.id, p_email: value.trim() || null })
    setBusy(false)
    if (error) return onError(error.message)
    onMessage(value.trim() ? `Updates for ${kid.full_name} will be emailed to ${value.trim()}.` : `No email address is set for ${kid.full_name} now.`)
    onSaved()
  }
  return (
    <form onSubmit={save} className="contact-form">
      <Field label="Email for their updates" icon={Mail} hint="Arrivals, marks and fee messages about this child are sent here.">
        <input type="email" value={value} onChange={(e) => setValue(e.target.value)} placeholder="parent@example.com" />
      </Field>
      <div><button className="ghost small" disabled={busy}>Save email</button></div>
    </form>
  )
}

// Parents register their own children here, even children who have no email address.
export default function MyChildren() {
  const { profile } = useAuth()
  const [kids, setKids] = useState(null)
  const [name, setName] = useState('')
  const [photo, setPhoto] = useState(null)
  const [fileKey, setFileKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [pwFor, setPwFor] = useState(null)
  const [pw, setPw] = useState('')
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  async function load() {
    const { data, error } = await supabase.from('parent_students')
      .select('student:profiles!parent_students_student_id_fkey(id, full_name, email, avatar_path, contact_email, login_only)').eq('parent_id', profile.id)
    if (error) setError(error.message); else setKids(data.map((l) => l.student).filter(Boolean))
  }
  useEffect(() => { load() }, [])

  async function add(e) {
    e.preventDefault(); setError(''); setMsg(''); setBusy(true)
    try {
      const child = await api('/parent/children', { method: 'POST', body: { full_name: name.trim() } })
      let note = `${name.trim()} was added.`
      if (photo) {
        try { await uploadAvatar(child.id, photo) } catch (err) { note += ` (The photo could not be saved: ${err.message})` }
      }
      setMsg(`${note} The institute has been told, and will enroll your child in the right class.`)
      setName(''); setPhoto(null); setFileKey((k) => k + 1); load()
    } catch (err) { setError(err.message) }
    setBusy(false)
  }

  async function changePhoto(kid, file) {
    if (!file) return
    setError(''); setMsg('')
    try { await uploadAvatar(kid.id, file, kid.avatar_path); setMsg('Photo updated.'); load() }
    catch (err) { setError(err.message) }
  }

  async function savePassword(e) {
    e.preventDefault(); setError(''); setMsg('')
    try {
      await api(`/parent/children/${pwFor.id}/password`, { method: 'POST', body: { password: pw } })
      setMsg(`A login password was set for ${pwFor.full_name}. Their login name is ${pwFor.email}.`)
      setPwFor(null); setPw('')
    } catch (err) { setError(err.message) }
  }

  return (
    <>
      <h2>Add a child</h2>
      <p className="muted">Register each of your children here. They do not need an email address or a phone. You will receive all of their updates, in the app and by email to your address, and every child appears on your dashboard.</p>
      {error && <p className="error">{error}</p>}
      {msg && <p className="ok">{msg}</p>}

      <section className="panel narrow-panel">
        <h3>Register a child</h3>
        <form onSubmit={add}>
          <label>Child's full name <input value={name} onChange={(e) => setName(e.target.value)} required /></label>
          <label>Photo (optional) <input key={fileKey} type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files[0] || null)} /></label>
          <div><button disabled={busy}>{busy ? 'Adding…' : 'Add child'}</button></div>
        </form>
        <p className="muted small-text">Needs the backend to be running. Several children are fine: just add them one after another.</p>
      </section>

      <h3>My children</h3>
      {kids && kids.length === 0 && <p className="empty">No children are linked to your account yet.</p>}
      <div className="cards">
        {kids?.map((k) => (
          <section className="panel" key={k.id}>
            <div className="who-cell"><Avatar path={k.avatar_path} name={k.full_name} size={56} /><h3>{k.full_name || 'Student'}</h3></div>
            <label className="file-label small-text">Change photo
              <input type="file" accept="image/*" onChange={(e) => { changePhoto(k, e.target.files[0]); e.target.value = '' }} />
            </label>
            <p className="small-text muted">Login name: {k.email}</p>
            {k.login_only && <ContactEmail kid={k} onSaved={load} onMessage={setMsg} onError={setError} />}
            <button className="ghost small" onClick={() => { setPwFor(k); setPw(''); setError(''); setMsg('') }}>Set a login password</button>
          </section>
        ))}
      </div>

      {pwFor && (
        <section className="panel narrow-panel">
          <h3>Login for {pwFor.full_name}</h3>
          <p className="muted small-text">Only for an older child who will log in on their own. Choose a password, then give them the login name <strong>{pwFor.email}</strong>.</p>
          <form onSubmit={savePassword}>
            <label>New password (8 or more characters) <input value={pw} onChange={(e) => setPw(e.target.value)} minLength={8} required /></label>
            <div><button>Save password</button> <button type="button" className="ghost" onClick={() => setPwFor(null)}>Cancel</button></div>
          </form>
        </section>
      )}
    </>
  )
}
