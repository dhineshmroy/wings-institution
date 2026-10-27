import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, FileText, UserX } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { fetchAll } from '../../lib/csv'
import { addDays, fmtTime, toISODate, todayISO } from '../../lib/dates'
import { avg, overallRate, rate, shortDate, timeAgo, weekList, weeklyRates } from '../../lib/dash'
import Avatar from '../../components/Avatar'
import { ActivityPanel, AreaChart, Bars, ChartCard, COLORS, CtaCard, DashHead, DonutCard, GaugeKpi, Kpi, MiniCard, NotificationsPanel } from '../../components/dash'
import { Alert } from '../../components/ui'

const must = (r) => { if (r.error) throw r.error; return r.data }

async function load(me) {
  const today = todayISO()
  const since = toISODate(addDays(new Date(), -60)), c30 = toISODate(addDays(new Date(), -30)), end7 = toISODate(addDays(new Date(), 7))
  const [cls, sess, att, ungradedN, ungraded, exams, notices] = await Promise.all([
    supabase.from('classes').select('id, name, subjects(name), enrollments(student_id, student:profiles!enrollments_student_id_fkey(full_name, avatar_path))').eq('teacher_id', me).eq('active', true),
    supabase.from('sessions').select('id, session_date, start_time, end_time, status, classes(name, subjects(name))').gte('session_date', today).lte('session_date', end7).neq('status', 'cancelled').order('session_date').order('start_time'),
    fetchAll((f, t) => supabase.from('attendance').select('status, student_id, session:sessions!inner(class_id, session_date)').gte('session.session_date', since).order('id').range(f, t)),
    supabase.from('submissions').select('id', { count: 'exact', head: true }).is('grade', null),
    supabase.from('submissions').select('submitted_at, student:profiles!submissions_student_id_fkey(full_name), assignment:assignments(title)').is('grade', null).order('submitted_at', { ascending: false }).limit(4),
    supabase.from('exams').select('title, exam_date, max_marks, exam_marks(marks, absent)').order('exam_date', { ascending: false }).limit(8),
    supabase.from('absence_notices').select('created_at, student:profiles!absence_notices_student_id_fkey(full_name), session:sessions(session_date, classes(name))').order('created_at', { ascending: false }).limit(5),
  ])
  const classes = must(cls), sessions = must(sess), ungradedRows = must(ungraded), examRows = must(exams), noticeRows = must(notices)
  if (ungradedN.error) throw ungradedN.error

  const people = new Map()
  classes.forEach((c) => c.enrollments.forEach((e) => people.set(e.student_id, { name: e.student?.full_name || 'Student', avatar: e.student?.avatar_path })))
  const att30 = att.filter((r) => r.session.session_date >= c30)

  const per = {}
  att30.forEach((r) => {
    const p = (per[r.student_id] ||= { good: 0, total: 0, missed: 0 })
    if (r.status === 'present' || r.status === 'late') { p.good++; p.total++ } else if (r.status === 'absent') { p.total++; p.missed++ }
  })
  const attention = Object.entries(per).filter(([id, p]) => p.total >= 2 && people.has(id)).map(([id, p]) => ({ id, ...people.get(id), rate: rate(p.good, p.total), missed: p.missed }))
    .sort((a, b) => a.rate - b.rate).slice(0, 5)

  const examBars = examRows.slice().reverse().map((e) => {
    const m = e.exam_marks.filter((x) => x.marks != null && !x.absent).map((x) => (Number(x.marks) / Number(e.max_marks)) * 100)
    return m.length ? { label: e.title.length > 9 ? `${e.title.slice(0, 8)}…` : e.title, value: Math.round(avg(m)) } : null
  }).filter(Boolean)

  const palette = [COLORS.blue, COLORS.teal, COLORS.gold, COLORS.rose]
  const donut = classes.map((c) => ({ name: `${c.subjects?.name} – ${c.name}`, value: c.enrollments.length })).sort((a, b) => b.value - a.value).slice(0, 4).map((x, i) => ({ ...x, color: palette[i] }))

  const upcoming = sessions.slice(0, 5).map((s) => ({
    icon: Calendar, tone: 'blue', text: `${s.classes?.subjects?.name} – ${s.classes?.name}`,
    when: `${s.session_date === today ? 'Today' : shortDate(s.session_date)}, ${fmtTime(s.start_time)}`,
  }))
  const recent = [
    ...ungradedRows.map((u) => ({ at: u.submitted_at, icon: FileText, tone: 'gold', text: `${u.student?.full_name || 'A student'} submitted ${u.assignment?.title}` })),
    ...noticeRows.map((n) => ({ at: n.created_at, icon: UserX, tone: 'rose', text: `${n.student?.full_name || 'A student'} will miss ${n.session?.classes?.name || 'a class'} on ${shortDate(n.session?.session_date || today)}` })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 5).map((a) => ({ ...a, when: timeAgo(a.at) }))

  const weeks8 = weekList(8)
  return {
    students: people.size, classesToday: sessions.filter((s) => s.session_date === today).length, week: sessions.length,
    rate30: overallRate(att30), weeks8, weekRates: weeklyRates(att, weeks8), toGrade: ungradedN.count || 0,
    donut, attention, examBars, upcoming, recent, notices: noticeRows.filter((n) => (n.session?.session_date || '') >= today).length,
  }
}

export default function TeacherDashboard() {
  const { profile } = useAuth()
  const [d, setD] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { load(profile.id).then(setD).catch((e) => setError(e.message || String(e))) }, [profile.id])

  return (
    <>
      <DashHead subtitle="Your classes and students at a glance." />
      <Alert>{error}</Alert>
      {!d && !error && <p className="dnote">Loading your dashboard…</p>}
      {d && (
        <div className="dash">
          <div className="dash-main">
            <Kpi label="My students" value={d.students} sub={d.students === 1 ? 'in your classes' : 'across your classes'} spark={d.weekRates.map((r) => r ?? 0)} color={COLORS.blue} />
            <Kpi label="Classes today" value={d.classesToday} sub={`${d.week} in the next 7 days`} />
            <GaugeKpi label="Attendance, last 30 days" value={d.rate30} goal={90} />
            <Kpi label="Waiting to be graded" value={d.toGrade} sub={d.toGrade ? 'Open Assignments' : 'All graded'} alert={d.toGrade > 0} />

            <DonutCard className="span6 tall" title="My classes" total={d.students} label="students" items={d.donut.length ? d.donut : [{ name: 'No classes yet', value: 0, color: COLORS.blue }]}
              note={d.donut.length ? null : 'Ask the admin to assign you to a class.'} />
            <MiniCard icon={Calendar} tone="blue" label="Sessions this week" value={d.week} sub="next 7 days" />
            <MiniCard icon={UserX} tone="rose" label="Absence notices" value={d.notices} sub="for upcoming classes" />
            <ChartCard className="span6" title="Attendance trend" subtitle="Present or late, per week" headline={d.rate30 == null ? '–' : `${Math.round(d.rate30)}%`}>
              <AreaChart data={d.weeks8.map((w, i) => ({ label: `${w.slice(8)}/${w.slice(5, 7)}`, value: Math.round(d.weekRates[i] ?? 0) }))} format={(v) => `${Math.round(v)}%`} color={COLORS.teal} />
            </ChartCard>

            <ChartCard className="span6" title="Students needing attention" subtitle="Lowest attendance, last 30 days" action={<Link className="dlink" to="/teacher/progress">Student progress</Link>}>
              {d.attention.length === 0 ? <p className="dnote">Nobody needs attention. Attendance data appears here after classes are marked.</p> : (
                <table className="dtable">
                  <thead><tr><th>Student</th><th>Attendance</th><th>Missed</th></tr></thead>
                  <tbody>
                    {d.attention.map((s) => (
                      <tr key={s.id}>
                        <td><span className="person"><Avatar path={s.avatar} name={s.name} size={32} /><strong>{s.name}</strong></span></td>
                        <td><span className={`tag ${s.rate < 60 ? 'st-absent' : s.rate < 75 ? 'st-late' : 'st-present'}`}>{Math.round(s.rate)}%</span></td>
                        <td>{s.missed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </ChartCard>
            <ChartCard className="span6" title="Average exam marks" subtitle="Your latest exams, class average %">
              <Bars data={d.examBars} format={(v) => `${Math.round(v)}%`} max={100} />
            </ChartCard>
          </div>

          <aside className="dash-side">
            <NotificationsPanel />
            <ActivityPanel title="Coming up" items={d.upcoming} />
            <ActivityPanel title="Recent" items={d.recent} />
            <CtaCard title="Take attendance live" text="Parents are told the moment their child arrives and leaves." to="/teacher/checkin" label="Open check-in" />
          </aside>
        </div>
      )}
    </>
  )
}
