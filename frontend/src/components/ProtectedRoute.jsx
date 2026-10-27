import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import BlockedAccount from './BlockedAccount'

export const homeFor = (role) => `/${role}`

export default function ProtectedRoute({ allowedRoles, children }) {
  const { session, profile, loading } = useAuth()

  if (loading || (session && !profile)) return <div className="center-note">Loading…</div>
  if (!session) return <Navigate to="/login" replace />
  if (profile.status && profile.status !== 'active') return <BlockedAccount status={profile.status} />
  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return <Navigate to={homeFor(profile.role)} replace />
  }
  return children
}
