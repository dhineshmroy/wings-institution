import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { LogIn, Mail } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import AuthLayout from '../components/AuthLayout'
import { homeFor } from '../components/ProtectedRoute'
import { Alert, Field, PasswordField, Spinner } from '../components/ui'

export default function Login() {
  const { signIn, session, profile } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (session && profile) return <Navigate to={homeFor(profile.role)} replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error } = await signIn({ email, password })
    if (error) setError(error.message)
    setBusy(false)
  }

  return (
    <AuthLayout icon={LogIn} title="Welcome back" subtitle="Log in to see classes, marks and updates.">
      <form onSubmit={handleSubmit}>
        <Field label="Email" icon={Mail}>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com" />
        </Field>
        <PasswordField value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="Your password" />
        <div className="auth-row"><Link to="/forgot-password">Forgot your password?</Link></div>
        <Alert>{error}</Alert>
        <button className="btn-block" disabled={busy}>
          {busy ? <><Spinner /> Logging in…</> : <><LogIn size={18} aria-hidden="true" /> Log in</>}
        </button>
      </form>
      <div className="divider">New to Wings Institution?</div>
      <Link className="btn btn-block" to="/signup">Create an account</Link>
    </AuthLayout>
  )
}
