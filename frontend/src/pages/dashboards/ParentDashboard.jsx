import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Baby } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import Avatar from '../../components/Avatar'
import { DashHead } from '../../components/dash'
import { Alert, EmptyState } from '../../components/ui'
import StudentDash from './StudentDash'

export default function ParentDashboard() {
  const { profile } = useAuth()
  const [kids, setKids] = useState(null)
  const [sel, setSel] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('parent_students').select('student:profiles!parent_students_student_id_fkey(id, full_name, avatar_path)').eq('parent_id', profile.id)
      .then(({ data, error }) => {
        if (error) return setError(error.message)
        const k = data.map((l) => l.student).filter(Boolean)
        setKids(k); if (k[0]) setSel(k[0].id)
      })
  }, [profile.id])

  return (
    <>
      <DashHead subtitle="How each of your children is doing." />
      <Alert>{error}</Alert>
      {kids && kids.length === 0 && (
        <EmptyState icon={Baby} title="No children linked yet" text="Add your child to see their classes, marks, attendance and fees here.">
          <Link className="btn" to="/parent/children">Add a child</Link>
        </EmptyState>
      )}
      {kids && kids.length > 1 && (
        <div className="chips" role="group" aria-label="Choose a child" style={{ marginBottom: '1rem' }}>
          {kids.map((k) => (
            <button key={k.id} className={`chip-btn ${sel === k.id ? 'on' : ''}`} onClick={() => setSel(k.id)}>
              <Avatar path={k.avatar_path} name={k.full_name} size={22} /> {(k.full_name || 'Child').split(' ')[0]}
            </button>
          ))}
        </div>
      )}
      {sel && <StudentDash key={sel} studentId={sel} role="parent" />}
    </>
  )
}
