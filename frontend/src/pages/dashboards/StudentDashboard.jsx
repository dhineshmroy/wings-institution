import { useAuth } from '../../context/AuthContext'
import { DashHead } from '../../components/dash'
import StudentDash from './StudentDash'

export default function StudentDashboard() {
  const { profile } = useAuth()
  return (
    <>
      <DashHead subtitle="Your progress and what is coming up." />
      <StudentDash studentId={profile.id} role="student" />
    </>
  )
}
