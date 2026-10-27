import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { homeFor } from '../components/ProtectedRoute'

export default function Certificate() {
  const { id } = useParams()
  const { profile } = useAuth()
  const [c, setC] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('certificates')
      .select('*, student:profiles!certificates_student_id_fkey(full_name), classes(name, subjects(name))')
      .eq('id', id).single()
      .then(({ data, error }) => (error ? setError('Certificate not found.') : setC(data)))
  }, [id])

  const back = <Link className="no-print" to={`${homeFor(profile.role)}/certificates`}>← Back</Link>
  if (error) return <div className="center-note">{error} {back}</div>
  if (!c) return <div className="center-note">Loading…</div>

  return (
    <div className="certificate-page">
      <style>{'@media print { @page { size: A4 landscape; margin: 8mm; } }'}</style>
      <p className="no-print">{back} <button className="small" onClick={() => window.print()}>Print or save as PDF</button></p>
      <article className="certificate">
        <div className="cert-inner">
          <img src="/logo/wings-logo-horizontal.svg" alt="Wings Institution" height="64" />
          <h1>{c.title}</h1>
          <p className="cert-line">is proudly presented to</p>
          <p className="cert-name">{c.student?.full_name || 'Student'}</p>
          <p className="cert-desc">{c.description}</p>
          <div className="cert-foot">
            <div><span>{c.issued_on}</span>Date</div>
            <div><span>{c.certificate_no}</span>Certificate number</div>
            <div><span>&nbsp;</span>Authorised signature</div>
          </div>
        </div>
      </article>
    </div>
  )
}
