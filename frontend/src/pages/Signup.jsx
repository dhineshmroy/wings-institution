import { useState } from 'react'
import { Link } from 'react-router-dom'
import { GraduationCap, Mail, MailCheck, Phone, ShieldCheck, User, UserPlus, Users } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import AuthLayout from '../components/AuthLayout'
import { Alert, Field, PasswordField, PhotoPick, Spinner } from '../components/ui'
import { stashPendingAvatar, uploadAvatar } from '../lib/avatar'

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const WORDS = ['', 'Too simple', 'Okay', 'Good', 'Strong']

function strength(pw) {
  if (!pw) return 0
  let s = 0
  if (pw.length >= 8) s++
  if (pw.length >= 12) s++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++
  return Math.max(1, s)
}

export default function Signup() {
  const { signUp } = useAuth()
  const [form, setForm] = useState({ role: 'parent', fullName: '', phone: '', email: '', password: '', parentName: '', parentEmail: '', parentPhone: '' })
  const [photo, setPhoto] = useState(null)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const isStudent = form.role === 'student'
  const score = strength(form.password)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (form.password.length < 8) return setError('Password must be at least 8 characters.')
    if (!form.phone.trim() && !isStudent) return setError('Please enter your mobile number.')
    if (isStudent) {
      if (!form.parentName.trim() || !form.parentPhone.trim()) return setError("Please enter your parent's name and mobile number.")
      if (!EMAIL.test(form.parentEmail.trim())) return setError("Please enter your parent's email address.")
    }
    setBusy(true)
    const { data, error } = await signUp({
      email: form.email.trim(), password: form.password, fullName: form.fullName.trim(), phone: form.phone.trim(), role: form.role,
      parent: isStudent ? { name: form.parentName.trim(), email: form.parentEmail.trim().toLowerCase(), phone: form.parentPhone.trim() } : null,
    })
    if (error) { setBusy(false); return setError(error.message) }
    if (photo) {
      try {
        if (data?.session) await uploadAvatar(data.user.id, photo) // logged in already
        else await stashPendingAvatar(form.email, photo)          // saved on the first login
      } catch { /* the photo is optional */ }
    }
    setBusy(false)
    setDone(true)
  }

  if (done) {
    return (
      <AuthLayout title="Check your email">
        <span className="success-badge"><MailCheck size={32} aria-hidden="true" /></span>
        <p>We sent a confirmation link to <strong>{form.email}</strong>. Open it, then log in.</p>
        <p className="muted">The institute may need to approve your account before you can use it. You will see a message when you log in.</p>
        <Link className="btn btn-block" to="/login">Go to log in</Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout icon={UserPlus} wide title="Create your account" subtitle="Join Wings Institution in a minute.">
      <form onSubmit={handleSubmit}>
        <div className="form-section">
          <p className="form-section-title"><ShieldCheck size={18} aria-hidden="true" /> I am a</p>
          <div className="role-cards" role="radiogroup" aria-label="Account type">
            <button type="button" role="radio" aria-checked={!isStudent} className={`role-card ${!isStudent ? 'on' : ''}`} onClick={() => setForm({ ...form, role: 'parent' })}>
              <span className="role-card-icon"><Users size={20} aria-hidden="true" /></span>
              <strong>Parent</strong>
              <span className="sub">I will add my children, even if they have no email.</span>
            </button>
            <button type="button" role="radio" aria-checked={isStudent} className={`role-card ${isStudent ? 'on' : ''}`} onClick={() => setForm({ ...form, role: 'student' })}>
              <span className="role-card-icon"><GraduationCap size={20} aria-hidden="true" /></span>
              <strong>Student</strong>
              <span className="sub">I have my own email address.</span>
            </button>
          </div>
          {isStudent && <p className="muted small-text" style={{ margin: 0 }}>No email address? Ask your parent to register as a parent and add you under <em>Add a child</em>, or ask the institute.</p>}
        </div>

        <div className="form-section">
          <p className="form-section-title"><User size={18} aria-hidden="true" /> Your details</p>
          <div className="form-grid">
            <Field label="Full name" icon={User} className="span-2"><input value={form.fullName} onChange={set('fullName')} required autoComplete="name" /></Field>
            <Field label={isStudent ? 'Mobile number (optional)' : 'Mobile number'} icon={Phone}><input type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" /></Field>
            <Field label="Email" icon={Mail}><input type="email" value={form.email} onChange={set('email')} required autoComplete="email" /></Field>
            <div className="span-2">
              <PasswordField value={form.password} onChange={set('password')} autoComplete="new-password" placeholder="At least 8 characters" />
              {form.password && (
                <>
                  <div className="pw-meter" data-score={score} aria-hidden="true"><i /><i /><i /><i /></div>
                  <span className="pw-label">Password strength: {WORDS[score]}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {isStudent && (
          <div className="form-section">
            <p className="form-section-title"><Users size={18} aria-hidden="true" /> Your parent or guardian</p>
            <div className="form-grid">
              <Field label="Name" icon={User}><input value={form.parentName} onChange={set('parentName')} required /></Field>
              <Field label="Mobile number" icon={Phone}><input type="tel" value={form.parentPhone} onChange={set('parentPhone')} required /></Field>
              <Field label="Email" icon={Mail} className="span-2" hint="Your parent gets your attendance, marks and fee updates. Brothers and sisters should all use the same parent email.">
                <input type="email" value={form.parentEmail} onChange={set('parentEmail')} required />
              </Field>
            </div>
          </div>
        )}

        <PhotoPick file={photo} onChange={setPhoto} />

        <Alert>{error}</Alert>
        <button className="btn-block" disabled={busy}>
          {busy ? <><Spinner /> Creating your account…</> : <><UserPlus size={18} aria-hidden="true" /> Create account</>}
        </button>
      </form>
      <p className="auth-foot-link">Already registered? <Link to="/login">Log in</Link></p>
    </AuthLayout>
  )
}
