import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { openFile } from '../../lib/files'
import { fmtMoney, monthName } from '../../lib/money'
import { label } from '../../lib/useProfiles'

const SELECT = '*, invoice:invoices(period, amount, student:profiles!invoices_student_id_fkey(full_name, email), classes(name, subjects(name)))'

export default function Payments() {
  const [pending, setPending] = useState([])
  const [recent, setRecent] = useState([])
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  async function load() {
    const [p, r] = await Promise.all([
      supabase.from('payments').select(SELECT).eq('status', 'pending').order('created_at'),
      supabase.from('payments').select(SELECT).in('status', ['approved', 'rejected']).order('reviewed_at', { ascending: false }).limit(20),
    ])
    if (p.error || r.error) return setError((p.error || r.error).message)
    setPending(p.data); setRecent(r.data)
  }
  useEffect(() => { load() }, [])

  // payments that share one bank slip (a family paying for several children at once) are decided together
  const groups = []
  const bySlip = {}
  pending.forEach((p) => {
    if (!p.slip_path) return groups.push([p])
    if (!bySlip[p.slip_path]) { bySlip[p.slip_path] = []; groups.push(bySlip[p.slip_path]) }
    bySlip[p.slip_path].push(p)
  })

  async function approve(list) {
    setError(''); setMsg('')
    for (const p of list) {
      const { error } = await supabase.from('payments').update({ status: 'approved' }).eq('id', p.id)
      if (error) { setError(error.message); load(); return }
    }
    setMsg(list.length > 1 ? `${list.length} payments approved and receipts issued.` : 'Payment approved and receipt issued.'); load()
  }

  async function reject(list) {
    const reason = window.prompt('Why is this payment being rejected? The family will see this.')
    if (reason === null) return
    setError(''); setMsg('')
    for (const p of list) {
      const { error } = await supabase.from('payments').update({ status: 'rejected', reject_reason: reason.trim() || 'Payment could not be verified' }).eq('id', p.id)
      if (error) { setError(error.message); load(); return }
    }
    setMsg('Payment rejected.'); load()
  }

  const who = (p) => `${label(p.invoice?.student)} · ${p.invoice?.classes?.subjects?.name} – ${p.invoice?.classes?.name} · ${p.invoice?.period ? monthName(p.invoice.period) : ''}`

  return (
    <>
      <h2>Payments to review</h2>
      <p className="muted">Check each bank slip against your bank statement, then approve or reject it. Approving issues the receipt.</p>
      {error && <p className="error">{error}</p>}
      {msg && <p className="ok">{msg}</p>}

      {groups.length === 0 && <p className="empty">Nothing is waiting for approval.</p>}
      {groups.map((list) => {
        const first = list[0]
        const total = list.reduce((s, p) => s + Number(p.amount), 0)
        return (
          <section className="panel" key={first.id}>
            {list.length === 1
              ? <h3>{who(first)}</h3>
              : <h3>One bank slip for {list.length} invoices · {fmtMoney(total)}</h3>}
            <ul className="plain">
              {list.map((p) => (
                <li key={p.id}>{list.length > 1 && <>{who(p)}: </>}Paid <strong>{fmtMoney(p.amount)}</strong> of {fmtMoney(p.invoice?.amount)}</li>
              ))}
            </ul>
            <p className="muted small-text">Paid on {first.paid_on}{first.reference ? ` · Ref: ${first.reference}` : ''}</p>
            <p>
              {first.slip_path && <button className="ghost small" onClick={() => openFile('payment-slips', first.slip_path)}>Open bank slip</button>}{' '}
              <button className="small" onClick={() => approve(list)}>{list.length > 1 ? `Approve all ${list.length}` : 'Approve'}</button>{' '}
              <button className="danger small" onClick={() => reject(list)}>{list.length > 1 ? 'Reject all' : 'Reject'}</button>
            </p>
          </section>
        )
      })}

      <h3>Recent decisions</h3>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Student and invoice</th><th>Amount</th><th>Result</th><th></th></tr></thead>
          <tbody>
            {recent.map((p) => (
              <tr key={p.id}>
                <td>{who(p)}</td>
                <td>{fmtMoney(p.amount)}</td>
                <td>
                  <span className={`tag ${p.status === 'approved' ? 'st-present' : 'st-absent'}`}>{p.status}</span>
                  {p.reject_reason && <div className="muted small-text">{p.reject_reason}</div>}
                </td>
                <td>{p.receipt_no && <Link to={`/receipt/${p.id}`}>{p.receipt_no}</Link>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {recent.length === 0 && <p className="empty">No decisions yet.</p>}
      </div>
    </>
  )
}
