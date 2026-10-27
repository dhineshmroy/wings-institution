import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { fmtMoney, monthName } from '../lib/money'
import { homeFor } from '../components/ProtectedRoute'

export default function Receipt() {
  const { id } = useParams()
  const { profile } = useAuth()
  const [p, setP] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('payments')
      .select('*, invoice:invoices(period, description, amount, student:profiles!invoices_student_id_fkey(full_name), classes(name, subjects(name)))')
      .eq('id', id).single()
      .then(({ data, error }) => (error ? setError('Receipt not found.') : setP(data)))
  }, [id])

  const back = <Link className="no-print" to={homeFor(profile.role) + (profile.role === 'admin' ? '/payments' : '/fees')}>← Back</Link>

  if (error) return <div className="center-note">{error} {back}</div>
  if (!p) return <div className="center-note">Loading…</div>
  if (p.status !== 'approved') return <div className="center-note">A receipt is issued once the payment is approved. {back}</div>

  return (
    <div className="receipt-page">
      <p className="no-print">{back} <button className="small" onClick={() => window.print()}>Print or save as PDF</button></p>
      <article className="receipt">
        <img src="/logo/wings-logo-horizontal.svg" alt="Wings Institution" height="56" />
        <p className="muted">Payment receipt</p>
        <table className="receipt-table">
          <tbody>
            <tr><th>Receipt no.</th><td>{p.receipt_no}</td></tr>
            <tr><th>Date paid</th><td>{p.paid_on}</td></tr>
            <tr><th>Received for</th><td>{p.invoice?.student?.full_name}</td></tr>
            <tr><th>Class</th><td>{p.invoice?.classes?.subjects?.name} – {p.invoice?.classes?.name}</td></tr>
            <tr><th>Fees for</th><td>{p.invoice?.period && monthName(p.invoice.period)}</td></tr>
            <tr><th>Method</th><td>{p.method.replace('_', ' ')}{p.reference ? ` (ref: ${p.reference})` : ''}</td></tr>
            <tr><th>Amount received</th><td><strong>{fmtMoney(p.amount)}</strong></td></tr>
          </tbody>
        </table>
        <p className="muted small-text">Thank you. This is a computer-generated receipt.</p>
      </article>
    </div>
  )
}
