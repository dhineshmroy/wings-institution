import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { todayISO } from '../../lib/dates'
import { fmtMoney, monthName } from '../../lib/money'
import { label } from '../../lib/useProfiles'

const thisMonth = () => todayISO().slice(0, 7)
const approved = (inv) => (inv.payments || []).filter((p) => p.status === 'approved').reduce((s, p) => s + Number(p.amount), 0)

export default function Fees() {
  const [classes, setClasses] = useState([])
  const [month, setMonth] = useState(thisMonth())
  const [statusFilter, setStatusFilter] = useState('all')
  const [invoices, setInvoices] = useState([])
  const [gen, setGen] = useState({ month: thisMonth(), due: '', classId: '' })
  const [instructions, setInstructions] = useState('')
  const [recording, setRecording] = useState(null)
  const [rec, setRec] = useState({ amount: '', method: 'cash', reference: '', paid_on: todayISO() })
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  async function load() {
    let q = supabase.from('invoices')
      .select('*, student:profiles!invoices_student_id_fkey(full_name, email), classes(name, subjects(name)), payments(amount, status)')
      .order('created_at', { ascending: false }).limit(500)
    if (month) q = q.eq('period', `${month}-01`)
    const { data, error } = await q
    if (error) setError(error.message); else setInvoices(data)
  }
  useEffect(() => { load() }, [month])

  useEffect(() => {
    supabase.from('classes').select('id, name, monthly_fee, subjects(name)').eq('active', true).order('name').then(({ data }) => setClasses(data || []))
    supabase.from('payment_instructions').select('body').eq('id', 1).single().then(({ data }) => setInstructions(data?.body || ''))
  }, [])

  const reset = () => { setError(''); setMsg('') }

  async function generate(e) {
    e.preventDefault(); reset()
    const { data, error } = await supabase.rpc('generate_invoices', {
      p_period: `${gen.month}-01`,
      p_due: gen.due || `${gen.month}-10`,
      p_class: gen.classId || null,
    })
    if (error) return setError(error.message)
    setMsg(`${data} new invoice${data === 1 ? '' : 's'} created for ${monthName(`${gen.month}-01`)}. Existing invoices were kept as they were.`)
    setMonth(gen.month)
    if (gen.month === month) load()
  }

  async function sendReminders() {
    reset()
    const { data, error } = await supabase.rpc('send_fee_reminders')
    if (error) return setError(error.message)
    setMsg(`${data} reminder${data === 1 ? '' : 's'} sent to families with invoices that are due soon or overdue.`)
  }

  async function saveInstructions() {
    reset()
    const { error } = await supabase.from('payment_instructions').update({ body: instructions }).eq('id', 1)
    if (error) setError(error.message); else setMsg('Payment instructions saved.')
  }

  async function editAmount(inv) {
    const v = window.prompt('New invoice amount', inv.amount)
    if (v === null || v.trim() === '' || Number.isNaN(Number(v)) || Number(v) < 0) return
    reset()
    const { error } = await supabase.from('invoices').update({ amount: Number(v) }).eq('id', inv.id)
    if (error) setError(error.message); else load()
  }

  async function setCancelled(inv, cancelled) {
    if (cancelled && !window.confirm('Cancel this invoice?')) return
    reset()
    const { error } = await supabase.from('invoices').update({ status: cancelled ? 'cancelled' : 'unpaid' }).eq('id', inv.id)
    if (error) setError(error.message); else load()
  }

  function startRecording(inv) {
    setRecording(inv)
    setRec({ amount: Math.max(0, Number(inv.amount) - approved(inv)), method: 'cash', reference: '', paid_on: todayISO() })
  }

  async function recordPayment(e) {
    e.preventDefault(); reset()
    const { error } = await supabase.from('payments').insert({
      invoice_id: recording.id, amount: Number(rec.amount), method: rec.method,
      reference: rec.reference.trim() || null, paid_on: rec.paid_on, status: 'approved',
    })
    if (error) return setError(error.message)
    setRecording(null); setMsg('Payment recorded.'); load()
  }

  const live = invoices.filter((i) => i.status !== 'cancelled')
  const billed = live.reduce((s, i) => s + Number(i.amount), 0)
  const collected = live.reduce((s, i) => s + Math.min(approved(i), Number(i.amount)), 0)
  const shown = invoices.filter((i) => statusFilter === 'all' || i.status === statusFilter)
  const today = todayISO()

  return (
    <>
      <h2>Fees</h2>
      <p className="muted">Set each class's monthly fee on the Classes page. Then generate the month's invoices here.</p>
      {error && <p className="error">{error}</p>}
      {msg && <p className="ok">{msg}</p>}

      <section className="panel">
        <h3>Fee reminders</h3>
        <p className="muted">Notifies families about unpaid invoices due within 3 days, and overdue ones (once a week per invoice).</p>
        <button className="ghost" onClick={sendReminders}>Send fee reminders now</button>
      </section>

      <section className="panel">
        <h3>Generate monthly invoices</h3>
        <form className="inline-form" onSubmit={generate}>
          <label>Month <input type="month" value={gen.month} onChange={(e) => setGen({ ...gen, month: e.target.value })} required /></label>
          <label>Due date (default: the 10th) <input type="date" value={gen.due} onChange={(e) => setGen({ ...gen, due: e.target.value })} /></label>
          <label>Class
            <select value={gen.classId} onChange={(e) => setGen({ ...gen, classId: e.target.value })}>
              <option value="">All classes with a fee</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.subjects?.name} – {c.name} ({fmtMoney(c.monthly_fee)})</option>)}
            </select>
          </label>
          <button>Generate invoices</button>
        </form>
      </section>

      <section className="panel">
        <h3>Payment instructions shown to parents and students</h3>
        <textarea rows="5" value={instructions} onChange={(e) => setInstructions(e.target.value)} />
        <p><button className="ghost small" onClick={saveInstructions}>Save instructions</button></p>
      </section>

      <div className="inline-form">
        <label>Month <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label>
        <label>Status
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All</option><option value="unpaid">Unpaid</option><option value="pending">Waiting for approval</option>
            <option value="paid">Paid</option><option value="cancelled">Cancelled</option>
          </select>
        </label>
      </div>
      <div className="stats">
        <div className="stat panel"><strong>{fmtMoney(billed)}</strong>Billed</div>
        <div className="stat panel"><strong>{fmtMoney(collected)}</strong>Collected</div>
        <div className="stat panel"><strong>{fmtMoney(billed - collected)}</strong>Outstanding</div>
      </div>

      {recording && (
        <section className="panel">
          <h3>Record a payment: {label(recording.student)} · {monthName(recording.period)}</h3>
          <form className="inline-form" onSubmit={recordPayment}>
            <label>Amount <input type="number" min="1" step="0.01" value={rec.amount} onChange={(e) => setRec({ ...rec, amount: e.target.value })} required /></label>
            <label>Method
              <select value={rec.method} onChange={(e) => setRec({ ...rec, method: e.target.value })}>
                <option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="online">Online</option>
              </select>
            </label>
            <label>Reference <input value={rec.reference} onChange={(e) => setRec({ ...rec, reference: e.target.value })} /></label>
            <label>Date <input type="date" value={rec.paid_on} onChange={(e) => setRec({ ...rec, paid_on: e.target.value })} required /></label>
            <button>Save payment</button>
            <button type="button" className="ghost" onClick={() => setRecording(null)}>Close</button>
          </form>
        </section>
      )}

      <div className="table-wrap">
        <table>
          <thead><tr><th>Student</th><th>Class</th><th>Month</th><th>Amount</th><th>Paid</th><th>Due</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {shown.map((i) => {
              const overdue = (i.status === 'unpaid' || i.status === 'pending') && i.due_date < today
              const tag = i.status === 'paid' ? ['Paid', 'st-present'] : i.status === 'pending' ? ['Waiting for approval', 'st-late']
                : i.status === 'cancelled' ? ['Cancelled', 'st-excused'] : overdue ? ['Overdue', 'st-absent'] : ['Unpaid', '']
              return (
                <tr key={i.id}>
                  <td>{label(i.student)}</td>
                  <td>{i.classes?.subjects?.name} – {i.classes?.name}</td>
                  <td>{monthName(i.period)}</td>
                  <td>{fmtMoney(i.amount)}</td>
                  <td>{fmtMoney(approved(i))}</td>
                  <td>{i.due_date}</td>
                  <td><span className={`tag ${tag[1]}`}>{tag[0]}</span></td>
                  <td className="actions">
                    {i.status === 'cancelled'
                      ? <button className="ghost small" onClick={() => setCancelled(i, false)}>Restore</button>
                      : <>
                          {i.status !== 'paid' && <button className="small" onClick={() => startRecording(i)}>Record payment</button>}
                          <button className="ghost small" onClick={() => editAmount(i)}>Edit amount</button>
                          <button className="danger small" onClick={() => setCancelled(i, true)}>Cancel</button>
                        </>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {shown.length === 0 && <p className="empty">No invoices for this selection.</p>}
      </div>
    </>
  )
}
