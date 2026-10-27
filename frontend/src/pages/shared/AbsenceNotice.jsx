import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { addDays, fmtDate, fmtTime, toISODate, todayISO } from '../../lib/dates'

// A parent reports that a child will miss classes; a student can report their own absence.
export default function AbsenceNotice() {
  const { profile } = useAuth()
  const isParent = profile.role === 'parent'
  const [children, setChildren] = useState(isParent ? null : [{ id: profile.id, full_name: profile.full_name }])
  const [studentId, setStudentId] = useState(isParent ? '' : profile.id)
  const [sessions, setSessions] = useState([])
  const [notices, setNotices] = useState([])
  const [picked, setPicked] = useState(new Set())
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!isParent) return
    supabase.from('parent_students').select('student:profiles!parent_students_student_id_fkey(id, full_name)').eq('parent_id', profile.id)
      .then(({ data, error }) => {
        if (error) return setError(error.message)
        const kids = data.map((l) => l.student).filter(Boolean)
        setChildren(kids); if (kids[0]) setStudentId(kids[0].id)
      })
  }, [])

  async function load() {
    if (!studentId) return
    const enr = await supabase.from('enrollments').select('class_id').eq('student_id', studentId)
    if (enr.error) return setError(enr.error.message)
    const ids = enr.data.map((e) => e.class_id)
    const [s, n] = await Promise.all([
      ids.length
        ? supabase.from('sessions').select('id, session_date, start_time, end_time, classes(name, subjects(name))')
            .in('class_id', ids).gte('session_date', todayISO()).lte('session_date', toISODate(addDays(new Date(), 21)))
            .neq('status', 'cancelled').order('session_date').order('start_time')
        : Promise.resolve({ data: [] }),
      supabase.from('absence_notices').select('id, session_id, reason, submitted_by').eq('student_id', studentId),
    ])
    if (s.error || n.error) return setError((s.error || n.error).message)
    setSessions(s.data); setNotices(n.data); setPicked(new Set())
  }
  useEffect(() => { setMsg(''); setError(''); load() }, [studentId])

  const noticeFor = (sid) => notices.find((n) => n.session_id === sid)
  const toggle = (id) => { const next = new Set(picked); next.has(id) ? next.delete(id) : next.add(id); setPicked(next) }

  async function submit(e) {
    e.preventDefault(); setError(''); setMsg('')
    if (picked.size === 0) return setError('Tick at least one class.')
    setBusy(true)
    const { error } = await supabase.from('absence_notices').insert([...picked].map((session_id) => ({ student_id: studentId, session_id, reason: reason.trim() || null })))
    setBusy(false)
    if (error) return setError(error.code === '23505' ? 'One of those classes was already reported.' : error.message)
    setMsg('Thank you. The teacher has been told.'); setReason(''); load()
  }

  async function cancel(n) {
    const { error } = await supabase.from('absence_notices').delete().eq('id', n.id)
    if (error) setError(error.message); else load()
  }

  return (
    <>
      <h2>Report an absence</h2>
      <p className="muted">Let the teacher know in advance when {isParent ? 'your child' : 'you'} cannot come to a class.</p>
      {error && <p className="error">{error}</p>}
      {msg && <p className="ok">{msg}</p>}
      {isParent && children && children.length === 0 && <p className="empty">No children are linked to your account yet.</p>}
      {isParent && children && children.length > 1 && (
        <label className="narrow">Child
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            {children.map((k) => <option key={k.id} value={k.id}>{k.full_name || 'Student'}</option>)}
          </select>
        </label>
      )}

      {studentId && (
        <form onSubmit={submit}>
          <section className="panel">
            <h3>Which classes will be missed?</h3>
            {sessions.length === 0 && <p className="empty">No classes in the next 3 weeks.</p>}
            <ul className="plain">
              {sessions.map((s) => {
                const n = noticeFor(s.id)
                return (
                  <li key={s.id} className="row-between">
                    <label className="check">
                      <input type="checkbox" disabled={!!n} checked={picked.has(s.id)} onChange={() => toggle(s.id)} />
                      <span>{fmtDate(s.session_date)} · {fmtTime(s.start_time)} · {s.classes?.subjects?.name} – {s.classes?.name}</span>
                    </label>
                    {n && (
                      <span>
                        <span className="tag st-excused">Reported</span>
                        {n.submitted_by === profile.id && <button type="button" className="ghost small" onClick={() => cancel(n)}>Undo</button>}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
          <label>Reason (optional) <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. family function, fever" /></label>
          <div><button disabled={busy || sessions.length === 0}>{busy ? 'Sending…' : 'Send notice to the teacher'}</button></div>
        </form>
      )}
    </>
  )
}
