import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Save, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import AuthLayout from '../components/AuthLayout'
import { Alert, PasswordField, Spinner } from '../components/ui'

export default function ResetPassword() {
  const { updatePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    setBusy(true)
    const { error } = await updatePassword(password)
    setBusy(false)
    if (error) setError(error.message)
    else navigate('/')
  }

  return (
    <AuthLayout icon={ShieldCheck} title="Choose a new password" subtitle="Pick something you have not used before.">
      <form onSubmit={handleSubmit}>
        <PasswordField label="New password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="At least 8 characters" />
        <Alert>{error}</Alert>
        <button className="btn-block" disabled={busy}>
          {busy ? <><Spinner /> Saving…</> : <><Save size={18} aria-hidden="true" /> Save new password</>}
        </button>
      </form>
    </AuthLayout>
  )
}
