import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { addDays, fmtDate, fmtTime, toISODate, todayISO } from '../../lib/dates'

const STATUSES = ['present', 'absent', 'late', 'excused']

// Admin sees every class; a teacher only sees their own (the database decides).
export default function AttendanceMarking() {
  const [classes, setClasses] = useState([])
  const [classId, setClassId] = useState('')
  const [sessions, setSessions] = useState([])
  const [sessionId, setSessionId] = useState('')
  const [roster, setRoster] = useState([])
  const [marks, setMarks] = useState({})
  const [topic, setTopic] = useState('')
  const [alreadySaved, setAlreadySaved] = useState(false)
  const [notices, setNotices] = useState({})
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    supabase.from('classes').select('id, name, subjects(name)').eq('active', true).order('name')
      .then(({ data }) => setClasses(data || []))
  }, [])

  async function loadSessions(id) {
    if (!id) return setSessions([])
    const { data, error } = await supabase.from('sessions')
      .select('id, session_date, start_time, end_time, status, topic')
      .eq('class_id', id)
      .gte('session_date', toISODate(addDays(new Date(), -90)))
      .lte('session_date', todayISO())
      .order('session_date', { ascending: false }).order('start_time')
    if (error) setError(error.message); else setSessions(data)
  }
  useEffect(() => { setSessionId(''); loadSessions(classId) }, [classId])

  useEffect(() => {
    if (!sessionId) { setRoster([]); setMarks({}); return }
    const session = sessions.find((s) => s.id === sessionId)
    setTopic(session?.topic || '')
    async function load() {
      const [r, a, n] = await Promise.all([
        supabase.from('enrollments').select('student_id, student:profiles!enrollments_student_id_fkey(full_name)').eq('class_id', classId),
        supabase.from('attendance').select('student_id, status, note').eq('session_id', sessionId),
        supabase.from('absence_notices').select('student_id, reason').eq('session_id', sessionId),
      ])
      if (r.error || a.error) return setError((r.error || a.error).message)
      const existing = Object.fromEntries(a.data.map((x) => [x.student_id, x]))
      const notice = Object.fromEntries((n.data || []).map((x) => [x.student_id, x.reason || '']))
      const init = {}
      r.data.forEach((row) => {
        const warned = notice[row.student_id] !== undefined
        init[row.student_id] = {
          status: existing[row.student_id]?.status || (warned ? 'excused' : 'present'),
          note: existing[row.student_id]?.note || (warned ? `Absence notice: ${notice[row.student_id] || 'no reason given'}` : ''),
        }
      })
      setRoster(r.data.sort((x, y) => (x.student?.full_name || '').localeCompare(y.student?.full_name || '')))
      setMarks(init)
      setNotices(notice)
      setAlreadySaved(a.data.length > 0)
    }
    load()
  }, [sessionId])

  const setMark = (id, patch) => setMarks({ ...marks, [id]: { ...marks[id], ...patch } })
  const markAll = (status) => setMarks(Object.fromEntries(roster.map((r) => [r.student_id, { ...marks[r.student_id], status }])))

  async function save() {
    setError(''); setMsg('')
    const payload = roster.map((r) => ({
      session_id: sessionId, student_id: r.student_id,
      status: marks[r.student_id].status, note: marks[r.student_id].note.trim() || null,
    }))
    const { error } = await supabase.from('attendance').upsert(payload, { onConflict: 'session_id,student_id' })
    if (error) return setError(error.message)
    await supabase.from('sessions').update({ status: 'held', topic: topic.trim() || null }).eq('id', sessionId)
    setMsg('Attendance saved.'); setAlreadySaved(true); loadSessions(classId)
  }

  const session = sessions.find((s) => s.id === sessionId)

  return (
    <>
      <h2>Attendance</h2>
      <p className="muted">Pick a class and a session. Everyone starts as present, so you only need to change the exceptions. Taking attendance live, with arrival and leaving times? Use the <strong>Check-in</strong> page instead.</p>
      <div className="inline-form">
        <label>Class
          <select value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">Choose a class…</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.subjects?.name} – {c.name}</option>)}
          </select>
        </label>
        {classId && (
          <label>Session
            <select value={sessionId} onChange={(e) => { setSessionId(e.target.value); setMsg(''); setError('') }}>
              <option value="">Choose a date…</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {fmtDate(s.session_date)} · {fmtTime(s.start_time)}{s.status === 'held' ? ' ✓' : ''}{s.status === 'cancelled' ? ' (cancelled)' : ''}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {classId && sessions.length === 0 && <p className="empty">No sessions yet for today or earlier. Generate sessions in the Schedule page first.</p>}
      {error && <p className="error">{error}</p>}
      {msg && <p className="ok">{msg}</p>}

      {session?.status === 'cancelled' && <p className="error">This class was cancelled, so attendance can't be recorded.</p>}
      {sessionId && session?.status !== 'cancelled' && (
        <>
          {alreadySaved && <p className="muted">Attendance was already saved for this session. Saving again will update it.</p>}
          <label className="narrow">What was taught (optional)
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Introduction to HTML" />
          </label>
          <p>
            <button className="ghost small" onClick={() => markAll('present')}>Mark all present</button>{' '}
            <button className="ghost small" onClick={() => markAll('absent')}>Mark all absent</button>
          </p>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Student</th><th>Status</th><th>Note</th></tr></thead>
              <tbody>
                {roster.map((r) => (
                  <tr key={r.student_id}>
                    <td>{r.student?.full_name || 'Student'}{notices[r.student_id] !== undefined && <span className="tag st-excused">Absence notice</span>}</td>
                    <td>
                      <select value={marks[r.student_id]?.status} onChange={(e) => setMark(r.student_id, { status: e.target.value })}>
                        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td><input value={marks[r.student_id]?.note || ''} onChange={(e) => setMark(r.student_id, { note: e.target.value })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {roster.length === 0 && <p className="empty">No students are enrolled in this class.</p>}
          </div>
          {roster.length > 0 && <p><button onClick={save}>Save attendance</button></p>}
        </>
      )}
    </>
  )
}
