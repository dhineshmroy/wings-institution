import { useAuth } from '../context/AuthContext'
import AuthLayout from './AuthLayout'

export default function BlockedAccount({ status }) {
  const { signOut } = useAuth()
  const pending = status === 'pending'
  return (
    <AuthLayout title={pending ? 'Waiting for approval' : 'Account deactivated'}>
      <p>
        {pending
          ? 'Thank you for registering. The institute needs to approve your account before you can use it. You will get a notification when it is ready, so please check back soon.'
          : 'This account has been deactivated. If you think this is a mistake, please contact Wings Institution.'}
      </p>
      <div><button onClick={signOut}>Log out</button></div>
    </AuthLayout>
  )
}
