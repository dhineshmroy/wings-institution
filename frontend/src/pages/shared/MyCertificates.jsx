import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'

// A student sees their own certificates; a parent sees their children's (the database decides).
export default function MyCertificates() {
  const { profile } = useAuth()
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('certificates')
      .select('*, student:profiles!certificates_student_id_fkey(full_name), classes(name, subjects(name))')
      .order('issued_on', { ascending: false })
      .then(({ data, error }) => (error ? setError(error.message) : setItems(data)))
  }, [])

  return (
    <>
      <h2>Certificates</h2>
      <p className="muted">Certificates awarded by Wings Institution. Open one to print it or save it as a PDF.</p>
      {error && <p className="error">{error}</p>}
      {items && items.length === 0 && <p className="empty">No certificates yet.</p>}
      <div className="cards">
        {items?.map((c) => (
          <section className="panel" key={c.id}>
            <h3>{c.title}</h3>
            {profile.role === 'parent' && <p>{c.student?.full_name}</p>}
            <p className="muted small-text">{c.classes ? `${c.classes.subjects?.name} – ${c.classes.name} · ` : ''}{c.issued_on} · {c.certificate_no}</p>
            <Link to={`/certificate/${c.id}`}>Open certificate</Link>
          </section>
        ))}
      </div>
    </>
  )
}
