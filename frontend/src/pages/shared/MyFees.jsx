import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { checkFile, safeName } from '../../lib/files'
import { todayISO } from '../../lib/dates'
import { fmtMoney, monthName } from '../../lib/money'

const sum = (list, status) => (list || []).filter((p) => p.status === status).reduce((s, p) => s + Number(p.amount), 0)

function MultiSlip({ invoices, onDone }) {
  const due = (i) => Math.max(0, Number(i.amount) - sum(i.payments, 'approved') - sum(i.payments, 'pending'))
  const payable = invoices.filter((i) => i.status !== 'paid' && i.status !== 'cancelled' && due(i) > 0)
  const [picked, setPicked] = useState(new Set())
  const [form, setForm] = useState({ reference: '', paid_on: todayISO() })
  const [file, setFile] = useState(null)
  const [fileKey, setFileKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  if (payable.length < 2) return null

  const chosen = payable.filter((i) => picked.has(i.id))
  const total = chosen.reduce((s, i) => s + due(i), 0)
  const toggle = (id) => { const n = new Set(picked); n.has(id) ? n.delete(id) : n.add(id); setPicked(n) }

  async function submit(e) {
    e.preventDefault(); setError(''); setMsg('')
    if (chosen.length === 0) return setError('Tick the invoices this payment was for.')
    if (!file) return setError('Attach a photo or PDF of your bank slip.')
    const problem = checkFile(file)
    if (problem) return setError(problem)
    setBusy(true)
    const path = `${chosen[0].id}/${crypto.randomUUID()}-${safeName(file.name)}`
    const up = await supabase.storage.from('payment-slips').upload(path, file)
    if (up.error) { setBusy(false); return setError(up.error.message) }
    const { error } = await supabase.from('payments').insert(chosen.map((i) => ({
      invoice_id: i.id, amount: due(i), method: 'bank_transfer', reference: form.reference.trim() || null, paid_on: form.paid_on, slip_path: path,
    })))
    if (error) { await supabase.storage.from('payment-slips').remove([path]); setBusy(false); return setError(error.message) }
    setBusy(false); setPicked(new Set()); setFile(null); setFileKey((k) => k + 1)
    setMsg(`One slip was sent for ${chosen.length} invoices (${fmtMoney(total)}). Receipts appear once the institute approves it.`)
    onDone()
  }

  return (
    <section className="panel">
      <h3>Paid for more than one child or month with a single bank transfer?</h3>
      <p className="muted small-text">Tick the invoices it covered and upload the slip once.</p>
      <form onSubmit={submit}>
        <ul className="plain">
          {payable.map((i) => (
            <li key={i.id} className="row-between">
              <label className="check"><input type="checkbox" checked={picked.has(i.id)} onChange={() => toggle(i.id)} /> {i.student?.full_name} · {i.description}</label>
              <strong>{fmtMoney(due(i))}</strong>
            </li>
          ))}
        </ul>
        <p>Total: <strong>{fmtMoney(total)}</strong></p>
        <div className="inline-form">
          <label>Date paid <input type="date" value={form.paid_on} onChange={(e) => setForm({ ...form, paid_on: e.target.value })} required /></label>
          <label>Bank reference (optional) <input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></label>
          <label>Bank slip (photo or PDF) <input key={fileKey} type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files[0] || null)} /></label>
        </div>
        {error && <p className="error">{error}</p>}
        {msg && <p className="ok">{msg}</p>}
        <div><button disabled={busy}>{busy ? 'Sending…' : 'Send one slip'}</button></div>
      </form>
    </section>
  )
}

// Student sees their own invoices; a parent sees their children's (the database decides).
export default function MyFees() {
  const { profile } = useAuth()
  const [invoices, setInvoices] = useState(null)
  const [instructions, setInstructions] = useState('')
  const [payingId, setPayingId] = useState(null)
  const [form, setForm] = useState({ amount: '', reference: '', paid_on: todayISO() })
  const [file, setFile] = useState(null)
  const [fileKey, setFileKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  async function load() {
    const [i, p] = await Promise.all([
      supabase.from('invoices')
        .select('*, student:profiles!invoices_student_id_fkey(full_name), classes(name, subjects(name)), payments(id, amount, status, reject_reason, receipt_no, paid_on, created_at)')
        .neq('status', 'cancelled').order('period', { ascending: false }),
      supabase.from('payment_instructions').select('body').eq('id', 1).single(),
    ])
    if (i.error) return setError(i.error.message)
    setInvoices(i.data); setInstructions(p.data?.body || '')
  }
  useEffect(() => { load() }, [])

  const balance = (inv) => Math.max(0, Number(inv.amount) - sum(inv.payments, 'approved'))

  function startPay(inv) {
    setPayingId(inv.id); setError(''); setMsg(''); setFile(null); setFileKey((k) => k + 1)
    setForm({ amount: Math.max(0, balance(inv) - sum(inv.payments, 'pending')) || balance(inv), reference: '', paid_on: todayISO() })
  }

  async function submit(e) {
    e.preventDefault()
    setError(''); setMsg('')
    const fail = (m) => { setBusy(false); setError(m) }
    if (!file) return fail('Attach a photo or PDF of your bank slip.')
    const problem = checkFile(file)
    if (problem) return fail(problem)
    setBusy(true)
    const path = `${payingId}/${crypto.randomUUID()}-${safeName(file.name)}`
    const up = await supabase.storage.from('payment-slips').upload(path, file)
    if (up.error) return fail(up.error.message)
    const { error } = await supabase.from('payments').insert({
      invoice_id: payingId, amount: Number(form.amount), method: 'bank_transfer',
      reference: form.reference.trim() || null, paid_on: form.paid_on, slip_path: path,
    })
    if (error) {
      await supabase.storage.from('payment-slips').remove([path])
      return fail(error.message)
    }
    setBusy(false); setPayingId(null); setMsg('Slip submitted. Your receipt will appear here once the institute approves the payment.')
    load()
  }

  const groups = {}
  invoices?.forEach((i) => { (groups[i.student_id] ||= { name: i.student?.full_name || 'Student', list: [] }).list.push(i) })
  const today = todayISO()

  return (
    <>
      <h2>Fees</h2>
      <p className="muted">Your invoices and payments.</p>
      {instructions && (
        <section className="panel">
          <h3>How to pay</h3>
          <p className="instructions">{instructions}</p>
        </section>
      )}
      {msg && <p className="ok">{msg}</p>}
      {error && !payingId && <p className="error">{error}</p>}
      {invoices && invoices.length === 0 && <p className="empty">No invoices yet.</p>}
      {invoices && invoices.length > 0 && <MultiSlip invoices={invoices} onDone={load} />}

      {Object.values(groups).map((g) => (
        <section key={g.name}>
          {profile.role === 'parent' && <h3>{g.name}</h3>}
          {g.list.map((inv) => {
            const overdue = inv.status !== 'paid' && inv.due_date < today
            const tag = inv.status === 'paid' ? ['Paid', 'st-present'] : inv.status === 'pending' ? ['Waiting for approval', 'st-late']
              : overdue ? ['Overdue', 'st-absent'] : ['Unpaid', '']
            return (
              <div className="panel" key={inv.id}>
                <div className="row-between">
                  <div>
                    <strong>{inv.description}</strong>
                    <div className="muted small-text">Due {inv.due_date}</div>
                  </div>
                  <div className="right"><strong>{fmtMoney(inv.amount)}</strong><br /><span className={`tag ${tag[1]}`}>{tag[0]}</span></div>
                </div>
                {inv.status !== 'paid' && balance(inv) > 0 && <p className="muted">Balance to pay: {fmtMoney(balance(inv))}</p>}

                {inv.payments?.length > 0 && (
                  <ul className="plain">
                    {[...inv.payments].sort((a, b) => b.created_at.localeCompare(a.created_at)).map((p) => (
                      <li key={p.id} className="row-between">
                        <span>
                          {fmtMoney(p.amount)} on {p.paid_on} <span className={`tag ${p.status === 'approved' ? 'st-present' : p.status === 'rejected' ? 'st-absent' : 'st-late'}`}>{p.status === 'pending' ? 'waiting' : p.status}</span>
                          {p.reject_reason && <div className="muted small-text">Reason: {p.reject_reason}</div>}
                        </span>
                        {p.status === 'approved' && <Link to={`/receipt/${p.id}`}>Receipt {p.receipt_no}</Link>}
                      </li>
                    ))}
                  </ul>
                )}

                {inv.status !== 'paid' && payingId !== inv.id && <p><button className="small" onClick={() => startPay(inv)}>Upload bank slip</button></p>}

                {payingId === inv.id && (
                  <form onSubmit={submit} className="detail">
                    <div className="inline-form">
                      <label>Amount you paid <input type="number" min="1" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></label>
                      <label>Date paid <input type="date" value={form.paid_on} onChange={(e) => setForm({ ...form, paid_on: e.target.value })} required /></label>
                      <label>Bank reference (optional) <input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></label>
                    </div>
                    <label>Bank slip (photo or PDF)
                      <input key={fileKey} type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files[0] || null)} />
                    </label>
                    {error && <p className="error">{error}</p>}
                    <div>
                      <button disabled={busy}>{busy ? 'Sending…' : 'Send slip'}</button>{' '}
                      <button type="button" className="ghost" onClick={() => setPayingId(null)}>Cancel</button>
                    </div>
                  </form>
                )}
              </div>
            )
          })}
        </section>
      ))}
    </>
  )
}
