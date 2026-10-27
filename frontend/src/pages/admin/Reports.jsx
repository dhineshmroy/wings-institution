import { useEffect, useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { supabase } from '../../lib/supabaseClient'
import { downloadCSV, fetchAll } from '../../lib/csv'
import { addDays, parseISODate, toISODate, todayISO } from '../../lib/dates'
import { fmtMoney, monthName } from '../../lib/money'
import { attendanceRate, show } from '../../lib/stats'

const approvedSum = (payments) => (payments || []).filter((p) => p.status === 'approved').reduce((s, p) => s + Number(p.amount), 0)
const cls = (c) => (c ? `${c.subjects?.name} – ${c.name}` : '')

function useReport(load, deps) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    setData(null); setError('')
    load().then(setData).catch((e) => setError(e.message || String(e)))
  }, deps)
  return [data, error]
}

// ------------------------------------------------------------------ income
function Income() {
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(thisYear)
  const [rows, error] = useReport(() => fetchAll((f, t) =>
    supabase.from('payments')
      .select('amount, method, paid_on, reference, receipt_no, invoice:invoices(period, student:profiles!invoices_student_id_fkey(full_name), classes(name, subjects(name)))')
      .eq('status', 'approved').gte('paid_on', `${year}-01-01`).lte('paid_on', `${year}-12-31`).order('paid_on').range(f, t)), [year])

  const months = Array.from({ length: 12 }, (_, i) => ({ month: new Date(year, i, 1).toLocaleDateString(undefined, { month: 'short' }), Income: 0 }))
  const byMethod = {}
  rows?.forEach((r) => {
    months[Number(r.paid_on.slice(5, 7)) - 1].Income += Number(r.amount)
    byMethod[r.method] = (byMethod[r.method] || 0) + Number(r.amount)
  })
  const total = rows?.reduce((s, r) => s + Number(r.amount), 0) || 0

  const csv = () => downloadCSV(`income-${year}.csv`,
    ['Date', 'Receipt', 'Student', 'Class', 'Billing month', 'Method', 'Reference', 'Amount'],
    rows.map((r) => [r.paid_on, r.receipt_no, r.invoice?.student?.full_name, cls(r.invoice?.classes), r.invoice?.period?.slice(0, 7), r.method, r.reference, r.amount]))

  return (
    <>
      <div className="inline-form">
        <label>Year
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[0, 1, 2, 3].map((i) => <option key={i} value={thisYear - i}>{thisYear - i}</option>)}
          </select>
        </label>
        {rows && <button className="ghost" onClick={csv}>Download CSV</button>}
      </div>
      {error && <p className="error">{error}</p>}
      {!rows && !error && <p className="muted">Loading…</p>}
      {rows && (
        <>
          <div className="stats">
            <div className="stat panel"><strong>{fmtMoney(total)}</strong>Collected in {year}</div>
            <div className="stat panel"><strong>{rows.length}</strong>Payments</div>
            {Object.entries(byMethod).map(([m, v]) => <div className="stat panel" key={m}><strong>{fmtMoney(v)}</strong>{m.replace('_', ' ')}</div>)}
          </div>
          <section className="panel">
            <h3>Income by month</h3>
            <div className="chart" role="img" aria-label="Bar chart of income for each month">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={months} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d5deea" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} width={70} />
                  <Tooltip formatter={(v) => fmtMoney(v)} />
                  <Bar dataKey="Income" fill="#2f6fed" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Month</th><th>Income</th></tr></thead>
              <tbody>{months.map((m) => <tr key={m.month}><td>{m.month}</td><td>{fmtMoney(m.Income)}</td></tr>)}</tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}

// ------------------------------------------------------------------ unpaid fees
const BUCKETS = [['Not yet due', (d) => d <= 0], ['1–30 days overdue', (d) => d >= 1 && d <= 30], ['31–60 days overdue', (d) => d >= 31 && d <= 60], ['Over 60 days overdue', (d) => d > 60]]

function Unpaid() {
  const [rows, error] = useReport(async () => {
    const all = await fetchAll((f, t) =>
      supabase.from('invoices')
        .select('id, amount, due_date, period, status, student:profiles!invoices_student_id_fkey(full_name, phone), classes(name, subjects(name)), payments(amount, status)')
        .in('status', ['unpaid', 'pending']).order('due_date').range(f, t))
    const today = parseISODate(todayISO())
    return all.map((i) => ({ ...i, balance: Number(i.amount) - approvedSum(i.payments), daysOver: Math.floor((today - parseISODate(i.due_date)) / 86400000) }))
      .filter((i) => i.balance > 0).sort((a, b) => b.daysOver - a.daysOver)
  }, [])

  const total = rows?.reduce((s, r) => s + r.balance, 0) || 0
  const overdue = rows?.filter((r) => r.daysOver > 0).reduce((s, r) => s + r.balance, 0) || 0
  const csv = () => downloadCSV('unpaid-fees.csv', ['Student', 'Phone', 'Class', 'Billing month', 'Due date', 'Days overdue', 'Invoice', 'Balance', 'Status'],
    rows.map((r) => [r.student?.full_name, r.student?.phone, cls(r.classes), r.period.slice(0, 7), r.due_date, Math.max(0, r.daysOver), r.amount, r.balance, r.status === 'pending' ? 'slip waiting for approval' : 'unpaid']))

  return (
    <>
      {rows && <p><button className="ghost" onClick={csv}>Download CSV</button></p>}
      {error && <p className="error">{error}</p>}
      {!rows && !error && <p className="muted">Loading…</p>}
      {rows && (
        <>
          <div className="stats">
            <div className="stat panel"><strong>{fmtMoney(total)}</strong>Outstanding</div>
            <div className="stat panel alert"><strong>{fmtMoney(overdue)}</strong>Overdue</div>
            <div className="stat panel"><strong>{new Set(rows.map((r) => r.student?.full_name)).size}</strong>Students owing</div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Age of debt</th><th>Invoices</th><th>Amount</th></tr></thead>
              <tbody>
                {BUCKETS.map(([name, test]) => {
                  const list = rows.filter((r) => test(r.daysOver))
                  return <tr key={name}><td>{name}</td><td>{list.length}</td><td>{fmtMoney(list.reduce((s, r) => s + r.balance, 0))}</td></tr>
                })}
              </tbody>
            </table>
          </div>
          <h3>Who owes</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Student</th><th>Phone</th><th>Class</th><th>Month</th><th>Due</th><th>Balance</th><th></th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.student?.full_name}</td><td>{r.student?.phone || '—'}</td><td>{cls(r.classes)}</td>
                    <td>{monthName(r.period)}</td><td>{r.due_date}</td><td>{fmtMoney(r.balance)}</td>
                    <td>{r.daysOver > 0 ? <span className="tag st-absent">{r.daysOver} days overdue</span> : r.status === 'pending' ? <span className="tag st-late">slip waiting</span> : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <p className="empty">Nothing is owed. Well done!</p>}
          </div>
        </>
      )}
    </>
  )
}

// ------------------------------------------------------------------ enrollment
function Enrollment() {
  const [data, error] = useReport(async () => {
    const [c, t] = await Promise.all([
      supabase.from('classes').select('id, name, capacity, active, teacher_id, subjects(name), enrollments(count)').order('name'),
      supabase.from('profiles').select('id, full_name').eq('role', 'teacher'),
    ])
    if (c.error || t.error) throw (c.error || t.error)
    const teachers = Object.fromEntries(t.data.map((x) => [x.id, x.full_name]))
    return c.data.map((x) => ({ ...x, count: x.enrollments?.[0]?.count ?? 0, teacher: teachers[x.teacher_id] || '—' }))
      .sort((a, b) => `${a.subjects?.name}${a.name}`.localeCompare(`${b.subjects?.name}${b.name}`))
  }, [])

  const bySubject = {}
  data?.filter((c) => c.active).forEach((c) => { bySubject[c.subjects?.name] = (bySubject[c.subjects?.name] || 0) + c.count })
  const csv = () => downloadCSV('enrollment.csv', ['Subject', 'Class', 'Teacher', 'Students', 'Capacity', 'Active'],
    data.map((c) => [c.subjects?.name, c.name, c.teacher, c.count, c.capacity ?? '', c.active ? 'yes' : 'no']))

  return (
    <>
      {data && <p><button className="ghost" onClick={csv}>Download CSV</button></p>}
      {error && <p className="error">{error}</p>}
      {!data && !error && <p className="muted">Loading…</p>}
      {data && (
        <>
          <div className="stats">
            {Object.entries(bySubject).map(([s, n]) => <div className="stat panel" key={s}><strong>{n}</strong>{s} enrollments</div>)}
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Subject</th><th>Class</th><th>Teacher</th><th>Students</th><th>Capacity</th><th>Full</th></tr></thead>
              <tbody>
                {data.map((c) => (
                  <tr key={c.id}>
                    <td>{c.subjects?.name}</td><td>{c.name}{!c.active && <span className="tag">inactive</span>}</td><td>{c.teacher}</td>
                    <td>{c.count}</td><td>{c.capacity ?? '—'}</td><td>{c.capacity ? `${Math.round((c.count / c.capacity) * 100)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}

// ------------------------------------------------------------------ attendance by class
function AttendanceByClass() {
  const [days, setDays] = useState('90')
  const [data, error] = useReport(async () => {
    const from = days === 'all' ? '1970-01-01' : toISODate(addDays(new Date(), -Number(days)))
    const [c, rows] = await Promise.all([
      supabase.from('classes').select('id, name, subjects(name)').order('name'),
      fetchAll((f, t) => supabase.from('attendance').select('status, session:sessions!inner(class_id, session_date)').gte('session.session_date', from).range(f, t)),
    ])
    if (c.error) throw c.error
    return c.data.map((k) => {
      const mine = rows.filter((r) => r.session.class_id === k.id)
      const n = (s) => mine.filter((r) => r.status === s).length
      return { id: k.id, name: cls(k), present: n('present'), late: n('late'), absent: n('absent'), excused: n('excused'), rate: attendanceRate(mine), total: mine.length }
    }).filter((k) => k.total > 0).sort((a, b) => a.name.localeCompare(b.name))
  }, [days])

  const csv = () => downloadCSV(`attendance-last-${days}-days.csv`, ['Class', 'Present', 'Late', 'Absent', 'Excused', 'Attendance %'],
    data.map((k) => [k.name, k.present, k.late, k.absent, k.excused, k.rate === null ? '' : Math.round(k.rate)]))

  return (
    <>
      <div className="inline-form">
        <label>Period
          <select value={days} onChange={(e) => setDays(e.target.value)}>
            <option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last year</option><option value="all">All time</option>
          </select>
        </label>
        {data && <button className="ghost" onClick={csv}>Download CSV</button>}
      </div>
      {error && <p className="error">{error}</p>}
      {!data && !error && <p className="muted">Loading…</p>}
      {data && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Class</th><th>Present</th><th>Late</th><th>Absent</th><th>Excused</th><th>Attendance</th></tr></thead>
            <tbody>
              {data.map((k) => (
                <tr key={k.id}><td>{k.name}</td><td>{k.present}</td><td>{k.late}</td><td>{k.absent}</td><td>{k.excused}</td>
                  <td><strong>{show(k.rate)}</strong> {k.rate !== null && k.rate < 75 && <span className="tag st-absent">low</span>}</td></tr>
              ))}
            </tbody>
          </table>
          {data.length === 0 && <p className="empty">No attendance recorded in this period.</p>}
        </div>
      )}
    </>
  )
}

const REPORTS = { income: ['Income', Income], unpaid: ['Unpaid fees', Unpaid], enrollment: ['Enrollment', Enrollment], attendance: ['Attendance by class', AttendanceByClass] }

export default function Reports() {
  const [which, setWhich] = useState('income')
  const Current = REPORTS[which][1]
  return (
    <>
      <h2>Reports</h2>
      <p className="muted">Numbers for running the institute. Each report has a CSV download that opens in Excel.</p>
      <div className="subtabs" role="tablist">
        {Object.entries(REPORTS).map(([k, [name]]) => (
          <button key={k} role="tab" aria-selected={k === which} className={k === which ? 'on' : ''} onClick={() => setWhich(k)}>{name}</button>
        ))}
      </div>
      <Current key={which} />
    </>
  )
}
