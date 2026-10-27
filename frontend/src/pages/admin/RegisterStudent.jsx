import { useEffect, useState } from 'react'
import { GraduationCap, Layers, Mail, Phone, User, UserPlus, Users } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { api } from '../../lib/api'
import { uploadAvatar } from '../../lib/avatar'
import { Alert, Field, PhotoPick, Spinner } from '../../components/ui'

const EMPTY = { student_name: '', student_email: '', student_phone: '', parent_name: '', parent_email: '', parent_phone: '', class_id: '' }

// Register a student at the front desk. Only the parent's contact details are really needed.
export default function RegisterStudent({ onDone }) {
  const [classes, setClasses] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [photo, setPhoto] = useState(null)
  const [busy, setBusy] = useState(false)
  const [out, setOut] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('classes').select('id, name, subjects(name)').eq('active', true).order('name').then(({ data }) => setClasses(data || []))
  }, [])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault(); setError(''); setOut(null); setBusy(true)
    try {
      const r = await api('/admin/import', {
        method: 'POST',
        body: { rows: [{
          student_name: form.student_name.trim(), student_email: form.student_email.trim() || null, student_phone: form.student_phone.trim() || null,
          parent_name: form.parent_name.trim() || null, parent_email: form.parent_email.trim() || null, parent_phone: form.parent_phone.trim() || null,
          class_ids: form.class_id ? [form.class_id] : [],
        }] },
      })
      const res = r.results[0]
      if (res.status === 'error') throw new Error(res.message)
      let photoNote = ''
      if (photo && res.student_id) {
        try { await uploadAvatar(res.student_id, photo) } catch (err) { photoNote = ` The photo could not be saved: ${err.message}` }
      }
      setOut({ ...res, created: r.created, photoNote })
      // keep the parent's details so a brother or sister is quick to add
      setForm({ ...EMPTY, parent_name: form.parent_name, parent_email: form.parent_email, parent_phone: form.parent_phone })
      setPhoto(null)
      onDone?.()
    } catch (err) { setError(err.message) }
    setBusy(false)
  }

  return (
    <>
      <p className="muted small-text" style={{ marginTop: 0 }}>
        Children usually have no email or phone, so only the parent's details matter. If the parent already exists, the child is linked to them. A child without an email address gets their updates by email at the parent's address.
        To add a brother or sister, keep the parent's details and just type the next child's name.
      </p>
      <form onSubmit={submit}>
        <div className="form-section">
          <p className="form-section-title"><GraduationCap size={18} aria-hidden="true" /> Student</p>
          <div className="form-grid">
            <Field label="Full name" icon={User}><input value={form.student_name} onChange={set('student_name')} required /></Field>
            <Field label="Email (optional)" icon={Mail}><input type="email" value={form.student_email} onChange={set('student_email')} /></Field>
            <Field label="Class (optional)" icon={Layers}>
              <select value={form.class_id} onChange={set('class_id')}>
                <option value="">Enroll later</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.subjects?.name} – {c.name}</option>)}
              </select>
            </Field>
            <div><PhotoPick file={photo} onChange={setPhoto} title="Add the student's photo" hint="Optional" /></div>
          </div>
        </div>

        <div className="form-section">
          <p className="form-section-title"><Users size={18} aria-hidden="true" /> Parent or guardian</p>
          <div className="form-grid">
            <Field label="Name" icon={User}><input value={form.parent_name} onChange={set('parent_name')} required /></Field>
            <Field label="Mobile number" icon={Phone}><input type="tel" value={form.parent_phone} onChange={set('parent_phone')} required /></Field>
            <Field label="Email" icon={Mail} className="span-2"><input type="email" value={form.parent_email} onChange={set('parent_email')} required /></Field>
          </div>
        </div>

        <div className="form-actions">
          <button disabled={busy}>{busy ? <><Spinner /> Registering…</> : <><UserPlus size={18} aria-hidden="true" /> Register student</>}</button>
        </div>
      </form>

      <Alert>{error}</Alert>
      {out && (
        <div className="creds">
          <strong>{out.name}: {out.message}.{out.photoNote}</strong>
          {out.created.length > 0 && (
            <>
              <p className="small-text muted" style={{ margin: 0 }}>New logins were created. Give these to the family (the parent can also use "Forgot password" with their own email). Shown once.</p>
              {out.created.map((c, i) => (
                <div className="creds-row" key={i}><span>{c.role}: {c.email}</span><code>{c.password}</code></div>
              ))}
            </>
          )}
        </div>
      )}
    </>
  )
}
