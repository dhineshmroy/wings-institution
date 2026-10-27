import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { GraduationCap, Megaphone, UserCheck, UserPlus, Wallet } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { fetchAll } from '../../lib/csv'
import { addDays, toISODate, todayISO } from '../../lib/dates'
import { fmtMoney } from '../../lib/money'
import { compact, delta, overallRate, rate, sum, timeAgo, weekList, weekOf, weeklyRates } from '../../lib/dash'
import { ActivityPanel, AreaChart, Bars, ChartCard, COLORS, CtaCard, DashHead, DonutCard, GaugeKpi, Kpi, MiniCard, NotificationsPanel } from '../../components/dash'
import { Alert } from '../../components/ui'

const must = (r) => { if (r.error) throw r.error; return r.data }

async function load() {
  const today = todayISO()
  const since = toISODate(addDays(new Date(), -60))
  const since120 = toISODate(addDays(new Date(), -120))
  const [students, enrolls, classes, teachers, pays, att, inv, pending, recPays, recEnr, recProf, anns] = await Promise.all([
    fetchAll((f, t) => supabase.from('profiles').select('id, created_at, status').eq('role', 'student').order('id').range(f, t)),
    fetchAll((f, t) => supabase.from('enrollments').select('class_id, student_id, classes(name, subjects(name))').order('id').range(f, t)),
    supabase.from('classes').select('id, name, capacity, monthly_fee, teacher_id, subjects(name)').eq('active', true),
    supabase.from('profiles').select('id, full_name').eq('role', 'teacher'),
    fetchAll((f, t) => supabase.from('payments').select('amount, paid_on').eq('status', 'approved').gte('paid_on', since120).order('id').range(f, t)),
    fetchAll((f, t) => supabase.from('attendance').select('status, session:sessions!inner(class_id, session_date)').gte('session.session_date', since).order('id').range(f, t)),
    fetchAll((f, t) => supabase.from('invoices').select('amount, due_date, status, payments(amount, status)').in('status', ['unpaid', 'pending']).order('id').range(f, t)),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('payments').select('amount, reviewed_at, invoice:invoices(student:profiles!invoices_student_id_fkey(full_name))').eq('status', 'approved').order('reviewed_at', { ascending: false }).limit(5),
    supabase.from('enrollments').select('enrolled_at, student:profiles!enrollments_student_id_fkey(full_name), classes(name, subjects(name))').order('enrolled_at', { ascending: false }).limit(5),
    supabase.from('profiles').select('full_name, role, created_at').order('created_at', { ascending: false }).limit(5),
    supabase.from('announcements').select('title, created_at').order('created_at', { ascending: false }).limit(3),
  ])
  const classRows0 = must(classes), teacherRows = must(teachers), recPayRows = must(recPays), recEnrRows = must(recEnr), recProfRows = must(recProf), annRows = must(anns)
  if (pending.error) throw pending.error

  const weeks8 = weekList(8), weeks12 = weekList(12)
  const active = students.filter((s) => s.status === 'active')
  const c7 = toISODate(addDays(new Date(), -7)), c14 = toISODate(addDays(new Date(), -14)), c30 = toISODate(addDays(new Date(), -30))
  const dayOf = (s) => s.created_at.slice(0, 10)
  const new7 = students.filter((s) => dayOf(s) >= c7).length
  const prev7 = students.filter((s) => dayOf(s) >= c14 && dayOf(s) < c7).length

  const feeWeeks = weeks12.map((w) => sum(pays.filter((p) => weekOf(p.paid_on) === w).map((p) => p.amount)))
  const thisM = today.slice(0, 7)
  const pm = new Date(); pm.setDate(1); pm.setMonth(pm.getMonth() - 1)
  const prevM = toISODate(pm).slice(0, 7)
  const feesThis = sum(pays.filter((p) => p.paid_on.slice(0, 7) === thisM).map((p) => p.amount))
  const feesPrev = sum(pays.filter((p) => p.paid_on.slice(0, 7) === prevM).map((p) => p.amount))

  const att30 = att.filter((r) => r.session.session_date >= c30)
  const bal = (i) => Math.max(0, Number(i.amount) - sum((i.payments || []).filter((p) => p.status === 'approved').map((p) => p.amount)))
  const outstanding = sum(inv.map(bal))
  const overdue = sum(inv.filter((i) => i.status === 'unpaid' && i.due_date < today).map(bal))

  const bySubject = {}
  enrolls.forEach((e) => { const n = e.classes?.subjects?.name || 'Other'; bySubject[n] = (bySubject[n] || 0) + 1 })
  const palette = [COLORS.blue, COLORS.teal, COLORS.gold, COLORS.rose]
  const sorted = Object.entries(bySubject).sort((a, b) => b[1] - a[1])
  const donut = sorted.slice(0, 4).map(([name, value], i) => ({ name, value, color: palette[i] }))
  if (sorted.length > 4) donut.push({ name: 'Other', value: sum(sorted.slice(4).map((x) => x[1])), color: COLORS.violet })

  const teacherName = Object.fromEntries(teacherRows.map((t) => [t.id, t.full_name]))
  const classRows = classRows0.map((c) => {
    const mine = att30.filter((r) => r.session.class_id === c.id)
    return {
      ...c, students: enrolls.filter((e) => e.class_id === c.id).length, teacher: teacherName[c.teacher_id] || 'No teacher yet',
      rate: rate(mine.filter((r) => ['present', 'late'].includes(r.status)).length, mine.filter((r) => ['present', 'late', 'absent'].includes(r.status)).length),
    }
  }).sort((a, b) => b.students - a.students).slice(0, 6)

  const acts = [
    ...recEnrRows.map((e) => ({ at: e.enrolled_at, icon: GraduationCap, tone: 'blue', text: `${e.student?.full_name || 'A student'} joined ${e.classes?.subjects?.name} – ${e.classes?.name}` })),
    ...recPayRows.map((p) => ({ at: p.reviewed_at, icon: Wallet, tone: 'teal', text: `${fmtMoney(p.amount)} received from ${p.invoice?.student?.full_name || 'a family'}` })),
    ...recProfRows.map((p) => ({ at: p.created_at, icon: UserPlus, tone: 'gold', text: `${p.full_name || 'Someone'} registered as ${p.role}` })),
    ...annRows.map((a) => ({ at: a.created_at, icon: Megaphone, tone: 'rose', text: `Announcement: ${a.title}` })),
  ].filter((a) => a.at).sort((x, y) => new Date(y.at) - new Date(x.at)).slice(0, 6).map((a) => ({ ...a, when: timeAgo(a.at) }))

  return {
    students: active.length, newPerWeek: weeks8.map((w) => students.filter((s) => weekOf(s.created_at) === w).length), new7, prev7,
    feeWeeks, feesThis, feesPrev, rate30: overallRate(att30), weekRates: weeklyRates(att, weeks8), weeks8, weeks12,
    outstanding, overdue, donut, enrolledStudents: new Set(enrolls.map((e) => e.student_id)).size, classRows, pending: pending.count || 0, acts,
  }
}

export default function AdminDashboard() {
  const [d, setD] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { load().then(setD).catch((e) => setError(e.message || String(e))) }, [])

  return (
    <>
      <DashHead subtitle="Here is how Wings Institution is doing." />
      <Alert>{error}</Alert>
      {!d && !error && <p className="dnote">Loading your dashboard…</p>}
      {d && (
        <div className="dash">
          <div className="dash-main">
            <Kpi label="Active students" value={d.students} change={delta(d.new7, d.prev7)} changeLabel="new vs last week" sub={`${d.new7} new this week`} spark={d.newPerWeek} color={COLORS.blue} />
            <Kpi label="Fees collected" value={fmtMoney(d.feesThis)} change={delta(d.feesThis, d.feesPrev)} changeLabel="vs last month" sub="this month" spark={d.feeWeeks.slice(-8)} color={COLORS.teal} />
            <GaugeKpi label="Attendance, last 30 days" value={d.rate30} goal={90} />
            <Kpi label="Fees still to collect" value={fmtMoney(d.outstanding)} sub={d.overdue > 0 ? `${fmtMoney(d.overdue)} overdue` : 'Nothing overdue'} alert={d.overdue > 0} />

            <DonutCard className="span6 tall" title="Classes overview" total={d.enrolledStudents} label="students enrolled" items={d.donut.length ? d.donut : [{ name: 'No enrollments yet', value: 0, color: COLORS.blue }]}
              note={d.donut.length ? null : 'Enroll students in classes to see this chart.'} />
            <MiniCard icon={UserPlus} tone="blue" label="New students (7 days)" value={d.new7} change={delta(d.new7, d.prev7)} sub="vs the week before" />
            <MiniCard icon={UserCheck} tone="gold" label="Waiting for approval" value={d.pending} sub={d.pending ? 'Open Users to review' : 'All caught up'} />
            <ChartCard className="span6" title="Fees collected" subtitle="Per week, last 12 weeks" headline={fmtMoney(d.feesThis)}>
              <AreaChart data={d.weeks12.map((w, i) => ({ label: w.slice(5), value: d.feeWeeks[i] }))} format={(v) => `Rs. ${compact(v)}`} />
            </ChartCard>

            <ChartCard className="span6" title="Classes" action={<Link className="dlink" to="/admin/classes">Manage</Link>}>
              {d.classRows.length === 0 ? <p className="dnote">No classes yet.</p> : (
                <table className="dtable">
                  <thead><tr><th>Class</th><th>Students</th><th>Attendance</th><th>Fee</th></tr></thead>
                  <tbody>
                    {d.classRows.map((c) => (
                      <tr key={c.id}>
                        <td><span className="person-text"><strong>{c.subjects?.name} – {c.name}</strong><small>{c.teacher}</small></span></td>
                        <td>{c.students}{c.capacity ? ` / ${c.capacity}` : ''}</td>
                        <td>{c.rate == null ? '–' : `${Math.round(c.rate)}%`}</td>
                        <td>{fmtMoney(c.monthly_fee)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </ChartCard>
            <ChartCard className="span6" title="Attendance by week" subtitle="Present or late, last 8 weeks">
              <Bars data={d.weeks8.map((w, i) => ({ label: `${w.slice(8)}/${w.slice(5, 7)}`, value: Math.round(d.weekRates[i] ?? 0) }))} format={(v) => `${Math.round(v)}%`} max={100} />
            </ChartCard>
          </div>

          <aside className="dash-side">
            <NotificationsPanel />
            <ActivityPanel title="Activities" items={d.acts} />
            <CtaCard title="Keep families informed" text="Better communication, happier parents." to="/admin/announcements" label="Post an announcement" />
          </aside>
        </div>
      )}
    </>
  )
}
