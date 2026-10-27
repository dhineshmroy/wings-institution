import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, CheckCircle2, ClipboardCheck, FileText, GraduationCap, Star } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { fetchAll } from '../../lib/csv'
import { addDays, fmtTime, toISODate, todayISO } from '../../lib/dates'
import { fmtMoney } from '../../lib/money'
import { avg, overallRate, shortDate, sum, timeAgo } from '../../lib/dash'
import { ActivityPanel, AreaChart, Bars, ChartCard, COLORS, CtaCard, DonutCard, GaugeKpi, Kpi, MiniCard, NotificationsPanel } from '../../components/dash'
import { Alert } from '../../components/ui'

const must = (r) => { if (r.error) throw r.error; return r.data }
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

async function load(studentId) {
  const today = todayISO(), c30 = toISODate(addDays(new Date(), -30)), end14 = toISODate(addDays(new Date(), 14))
  const [enr, att, subs, asg, exams, inv] = await Promise.all([
    supabase.from('enrollments').select('class_id').eq('student_id', studentId),
    fetchAll((f, t) => supabase.from('attendance').select('status, session:sessions(session_date)').eq('student_id', studentId).order('id').range(f, t)),
    supabase.from('submissions').select('assignment_id, grade, graded_at, submitted_at').eq('student_id', studentId),
    supabase.from('assignments').select('id, title, due_at, max_points, class_id, classes(name, subjects(name))'),
    supabase.rpc('student_exam_results', { p_student: studentId }),
    supabase.from('invoices').select('amount, due_date, status, payments(amount, status)').eq('student_id', studentId).in('status', ['unpaid', 'pending']),
  ])
  const classIds = must(enr).map((e) => e.class_id)
  const subRows = must(subs), asgRows = must(asg).filter((a) => classIds.includes(a.class_id)), examRows = must(exams) || [], invRows = must(inv)
  const sessions = classIds.length
    ? must(await supabase.from('sessions').select('session_date, start_time, classes(name, subjects(name))').in('class_id', classIds)
        .gte('session_date', today).lte('session_date', end14).neq('status', 'cancelled').order('session_date').order('start_time').limit(8))
    : []

  const attRows = att.filter((r) => r.session)
  const att30 = attRows.filter((r) => r.session.session_date >= c30)
  const present30 = att30.filter((r) => r.status === 'present' || r.status === 'late').length
  const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (5 - i)); return { key: toISODate(d).slice(0, 7), label: MONTHS[d.getMonth()] } })
  const monthBars = months.map((m) => {
    const rows = attRows.filter((r) => r.session.session_date.slice(0, 7) === m.key)
    return { label: m.label, value: Math.round(overallRate(rows) ?? 0) }
  })

  const asgById = Object.fromEntries(asgRows.map((a) => [a.id, a]))
  const subBy = Object.fromEntries(subRows.map((s) => [s.assignment_id, s]))
  const series = [
    ...subRows.filter((s) => s.grade != null && asgById[s.assignment_id]).map((s) => ({ date: (s.graded_at || s.submitted_at).slice(0, 10), pct: (Number(s.grade) / Number(asgById[s.assignment_id].max_points)) * 100 })),
    ...examRows.filter((r) => r.marks != null && !r.absent).map((r) => ({ date: r.exam_date, pct: (Number(r.marks) / Number(r.max_marks)) * 100 })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  let graded = 0, submitted = 0, todo = 0, overdueN = 0
  const deadlines = []
  asgRows.forEach((a) => {
    const s = subBy[a.id]
    if (s && s.grade != null) graded++
    else if (s) submitted++
    else {
      const late = !!(a.due_at && new Date(a.due_at) < new Date())
      if (late) overdueN++; else todo++
      deadlines.push({ ...a, late })
    }
  })
  deadlines.sort((a, b) => (a.due_at || '9').localeCompare(b.due_at || '9'))

  const bal = (i) => Math.max(0, Number(i.amount) - sum((i.payments || []).filter((p) => p.status === 'approved').map((p) => p.amount)))
  const outstanding = sum(invRows.map(bal))
  const overdue = invRows.some((i) => i.status === 'unpaid' && i.due_date < today && bal(i) > 0)

  const comingUp = [
    ...sessions.slice(0, 3).map((s) => ({ at: s.session_date, icon: Calendar, tone: 'blue', text: `${s.classes?.subjects?.name} – ${s.classes?.name}`, when: `${s.session_date === today ? 'Today' : shortDate(s.session_date)}, ${fmtTime(s.start_time)}` })),
    ...deadlines.filter((d) => d.due_at && !d.late).slice(0, 2).map((d) => ({ at: d.due_at.slice(0, 10), icon: FileText, tone: 'gold', text: `${d.title} is due`, when: shortDate(d.due_at) })),
  ].sort((a, b) => a.at.localeCompare(b.at))

  const recent = [
    ...subRows.filter((s) => s.grade != null && asgById[s.assignment_id]).map((s) => ({ at: s.graded_at || s.submitted_at, icon: Star, tone: 'gold', text: `${asgById[s.assignment_id].title}: ${s.grade} / ${asgById[s.assignment_id].max_points}` })),
    ...examRows.filter((r) => r.marks != null).map((r) => ({ at: r.exam_date, icon: GraduationCap, tone: 'blue', text: `${r.title}: ${r.marks} / ${r.max_marks}` })),
    ...attRows.filter((r) => r.status === 'present' || r.status === 'late').map((r) => ({ at: r.session.session_date, icon: CheckCircle2, tone: 'teal', text: 'Attended a class' })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 5).map((a) => ({ ...a, when: timeAgo(a.at) }))

  return {
    rate30: overallRate(att30), present30, monthBars, series, avgGrade: avg(series.map((s) => s.pct)), examCount: examRows.filter((r) => r.marks != null).length,
    examAvg: avg(examRows.filter((r) => r.marks != null && !r.absent).map((r) => (Number(r.marks) / Number(r.max_marks)) * 100)),
    donut: [{ name: 'Graded', value: graded, color: COLORS.teal }, { name: 'Handed in', value: submitted, color: COLORS.blue }, { name: 'To do', value: todo, color: COLORS.gold }, { name: 'Overdue', value: overdueN, color: COLORS.rose }],
    total: asgRows.length, deadlines: deadlines.slice(0, 5), outstanding, overdue, next: sessions[0], comingUp, recent, today,
  }
}

export default function StudentDash({ studentId, role }) {
  const [d, setD] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { setD(null); setError(''); load(studentId).then(setD).catch((e) => setError(e.message || String(e))) }, [studentId])

  if (error) return <Alert>{error}</Alert>
  if (!d) return <p className="dnote">Loading the dashboard…</p>
  const base = `/${role}`
  const last = d.series.slice(-8)

  return (
    <div className="dash">
      <div className="dash-main">
        <GaugeKpi label="Attendance, last 30 days" value={d.rate30} goal={90} />
        <Kpi label="Average grade" value={d.avgGrade == null ? '–' : `${Math.round(d.avgGrade)}%`} sub={d.series.length ? `from ${d.series.length} marked item${d.series.length === 1 ? '' : 's'}` : 'No marks yet'} spark={last.map((s) => s.pct)} color={COLORS.blue} />
        <Kpi label="Fees to pay" value={d.outstanding > 0 ? fmtMoney(d.outstanding) : 'Nothing due'} sub={d.overdue ? 'Some are overdue' : d.outstanding > 0 ? 'See the Fees page' : 'All paid up'} alert={d.overdue} />
        <Kpi label="Next class" small value={d.next ? `${d.next.session_date === d.today ? 'Today' : shortDate(d.next.session_date)}, ${fmtTime(d.next.start_time)}` : 'None planned'} sub={d.next ? `${d.next.classes?.subjects?.name} – ${d.next.classes?.name}` : 'Check the timetable'} />

        <DonutCard className="span6 tall" title="Assignments" total={d.total} label="assignments" items={d.donut}
          note={d.total ? null : 'Assignments from your classes will show up here.'} />
        <MiniCard icon={GraduationCap} tone="blue" label="Exams taken" value={d.examCount} sub={d.examAvg == null ? 'No exam marks yet' : `Average ${Math.round(d.examAvg)}%`} />
        <MiniCard icon={ClipboardCheck} tone="teal" label="Classes attended" value={d.present30} sub="last 30 days" />
        <ChartCard className="span6" title="Marks over time" subtitle="Assignments and exams" headline={d.avgGrade == null ? '–' : `${Math.round(d.avgGrade)}% average`}>
          <AreaChart data={d.series.slice(-10).map((s) => ({ label: shortDate(s.date), value: Math.round(s.pct) }))} format={(v) => `${Math.round(v)}%`} />
        </ChartCard>

        <ChartCard className="span6" title="Upcoming deadlines" action={<Link className="dlink" to={`${base}/assignments`}>All assignments</Link>}>
          {d.deadlines.length === 0 ? <p className="dnote">Nothing waiting to be handed in.</p> : (
            <table className="dtable">
              <thead><tr><th>Assignment</th><th>Due</th><th>Status</th></tr></thead>
              <tbody>
                {d.deadlines.map((a) => (
                  <tr key={a.id}>
                    <td><span className="person-text"><strong>{a.title}</strong><small>{a.classes?.subjects?.name} – {a.classes?.name}</small></span></td>
                    <td>{a.due_at ? shortDate(a.due_at) : '–'}</td>
                    <td><span className={`tag ${a.late ? 'st-absent' : 'st-late'}`}>{a.late ? 'Overdue' : 'To do'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </ChartCard>
        <ChartCard className="span6" title="Attendance by month" subtitle="Present or late, last 6 months">
          <Bars data={d.monthBars} format={(v) => `${Math.round(v)}%`} max={100} />
        </ChartCard>
      </div>

      <aside className="dash-side">
        <NotificationsPanel />
        <ActivityPanel title="Coming up" items={d.comingUp} />
        <ActivityPanel title="Recent" items={d.recent} />
        {role === 'parent'
          ? <CtaCard title="Pay fees online" text="Upload a bank slip and get your receipt." to="/parent/fees" label="Open fees" />
          : <CtaCard title="Keep learning" text="Hand in your work before the deadline." to="/student/assignments" label="Open assignments" />}
      </aside>
    </div>
  )
}
