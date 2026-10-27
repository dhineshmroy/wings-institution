import { useState } from 'react'
import { Link } from 'react-router-dom'
import { KeyRound, Mail, Send } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import AuthLayout from '../components/AuthLayout'
import { Alert, Field, Spinner } from '../components/ui'

export default function ForgotPassword() {
  const { sendReset } = useAuth()
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setMsg(''); setBusy(true)
    const { error } = await sendReset(email)
    setBusy(false)
    if (error) setError(error.message)
    else setMsg('If that email is registered, a reset link is on its way. Check your inbox.')
  }

  return (
    <AuthLayout icon={KeyRound} title="Reset your password" subtitle="Enter your email and we will send you a link to choose a new one.">
      <form onSubmit={handleSubmit}>
        <Field label="Email" icon={Mail}>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com" />
        </Field>
        <Alert>{error}</Alert>
        <Alert type="ok">{msg}</Alert>
        <button className="btn-block" disabled={busy}>
          {busy ? <><Spinner /> Sending…</> : <><Send size={18} aria-hidden="true" /> Send reset link</>}
        </button>
      </form>
      <p className="auth-foot-link"><Link to="/login">Back to log in</Link></p>
    </AuthLayout>
  )
}
