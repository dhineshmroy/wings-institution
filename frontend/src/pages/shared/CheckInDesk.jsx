import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import Avatar from '../../components/Avatar'
import { addDays, fmtDate, fmtTime, toISODate, todayISO } from '../../lib/dates'

const clock = (iso) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

// Live roll call. Each tap saves at once, with the exact time, and tells the parents.
// Admin sees every class; a teacher only sees their own (the database decides).
export default function CheckInDesk() {
  const { profile } = useAuth()
  const [classes, setClasses] = useState([])
  const [classId, setClassId] = useState('')
  const [sessions, setSessions] = useState([])
  const [sessionId, setSessionId] = useState('')
  const [roster, setRoster] = useState([])
  const [marks, setMarks] = useState({})
  const [notices, setNotices] = useState({})
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [grace, setGrace] = useState('10')

  useEffect(() => {
    supabase.from('classes').select('id, name, subjects(name)').eq('active', true).order('name').then(({ data }) => setClasses(data || []))
    if (profile.role === 'admin') {
      supabase.from('app_settings').select('value').eq('key', 'late_grace_minutes').maybeSingle().then(({ data }) => data && setGrace(data.value))
    }
  }, [])

  useEffect(() => {
    setSessionId(''); setSessions([])
    if (!classId) return
    supabase.from('sessions').select('id, session_date, start_time, end_time, status')
      .eq('class_id', classId).neq('status', 'cancelled')
      .gte('session_date', toISODate(addDays(new Date(), -7))).lte('session_date', todayISO())
      .order('session_date', { ascending: false }).order('start_time')
      .then(({ data, error }) => {
        if (error) return setError(error.message)
        setSessions(data)
        const today = data.find((s) => s.session_date === todayISO())
        setSessionId((today || data[0])?.id || '')
      })
  }, [classId])

  async function loadMarks() {
    const [a, n] = await Promise.all([
      supabase.from('attendance').select('student_id, status, checked_in_at, checked_out_at').eq('session_id', sessionId),
      supabase.from('absence_notices').select('student_id, reason').eq('session_id', sessionId),
    ])
    if (a.error) return setError(a.error.message)
    setMarks(Object.fromEntries(a.data.map((x) => [x.student_id, x])))
    setNotices(Object.fromEntries((n.data || []).map((x) => [x.student_id, x.reason || 'no reason given'])))
  }

  useEffect(() => {
    setMsg(''); setError('')
    if (!sessionId) { setRoster([]); setMarks({}); return }
    supabase.from('enrollments').select('student_id, student:profiles!enrollments_student_id_fkey(full_name, avatar_path)').eq('class_id', classId)
      .then(({ data, error }) => {
        if (error) return setError(error.message)
        setRoster(data.sort((a, b) => (a.student?.full_name || '').localeCompare(b.student?.full_name || '')))
      })
    loadMarks()
  }, [sessionId])

  async function act(studentId, action) {
    setError(''); setMsg(''); setBusy(studentId)
    const { error } = await supabase.rpc('attendance_action', { p_session: sessionId, p_student: studentId, p_action: action })
    setBusy('')
    if (error) return setError(error.message)
    loadMarks()
  }

  async function bulk(kind) {
    const targets = roster.filter((r) => {
      const m = marks[r.student_id]
      return kind === 'arrive' ? !m && notices[r.student_id] === undefined : m && ['present', 'late'].includes(m.status) && !m.checked_out_at
    })
    if (targets.length === 0) return setMsg(kind === 'arrive' ? 'Everyone is already marked.' : 'Nobody is waiting to leave.')
    const verb = kind === 'arrive' ? 'arrived' : 'left'
    if (!window.confirm(`Mark ${targets.length} student${targets.length === 1 ? '' : 's'} as ${verb} right now? Their parents will be notified.`)) return
    setError(''); setMsg('')
    for (const [i, t] of targets.entries()) {
      setBusy(`bulk ${i + 1}/${targets.length}`)
      const { error } = await supabase.rpc('attendance_action', { p_session: sessionId, p_student: t.student_id, p_action: kind })
      if (error) { setBusy(''); setError(error.message); await loadMarks(); return }
    }
    setBusy(''); setMsg(`${targets.length} marked as ${verb}.`); loadMarks()
  }

  async function saveGrace() {
    setError(''); setMsg('')
    const n = Number(grace)
    if (!Number.isInteger(n) || n < 0 || n > 120) return setError('Enter a whole number of minutes from 0 to 120.')
    const { error } = await supabase.from('app_settings').upsert({ key: 'late_grace_minutes', value: String(n) })
    if (error) setError(error.message); else setMsg(`Students arriving more than ${n} minutes after the start now count as late.`)
  }

  const count = (f) => roster.filter((r) => marks[r.student_id] && f(marks[r.student_id])).length
  const present = count((m) => ['present', 'late'].includes(m.status))
  const left = count((m) => !!m.checked_out_at)
  const absent = count((m) => m.status === 'absent')
  const waiting = roster.length - Object.keys(marks).filter((id) => roster.some((r) => r.student_id === id)).length

  return (
    <>
      <h2>Check-in</h2>
      <p className="muted">Mark each student as they arrive and as they leave. Each tap is saved straight away and their parents are notified with the time and date.</p>

      <div className="inline-form">
        <label>Class
          <select value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">Choose a class…</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.subjects?.name} – {c.name}</option>)}
          </select>
        </label>
        {classId && (
          <label>Class time
            <select value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
              {sessions.length === 0 && <option value="">No classes in the last 7 days</option>}
              {sessions.map((s) => <option key={s.id} value={s.id}>{fmtDate(s.session_date)} · {fmtTime(s.start_time)}{s.session_date === todayISO() ? ' (today)' : ''}</option>)}
            </select>
          </label>
        )}
      </div>

      {profile.role === 'admin' && (
        <p className="muted small-text">
          Counts as late after <input className="marks-input" type="number" min="0" max="120" value={grace} onChange={(e) => setGrace(e.target.value)} aria-label="Minutes after the start when a student counts as late" /> minutes{' '}
          <button className="ghost small" onClick={saveGrace}>Save</button>
        </p>
      )}

      {error && <p className="error">{error}</p>}
      {msg && <p className="ok">{msg}</p>}
      {busy.startsWith('bulk') && <p className="muted">Working… {busy.replace('bulk ', '')}</p>}

      {sessionId && (
        <>
          <div className="stats">
            <div className="stat panel"><strong>{present}</strong>Here now or came</div>
            <div className="stat panel"><strong>{left}</strong>Left</div>
            <div className="stat panel"><strong>{absent}</strong>Absent</div>
            <div className="stat panel"><strong>{waiting}</strong>Not marked yet</div>
          </div>
          <p>
            <button className="ghost small" onClick={() => bulk('arrive')} disabled={!!busy}>Everyone not marked has arrived</button>{' '}
            <button className="ghost small" onClick={() => bulk('leave')} disabled={!!busy}>Everyone here has left</button>
          </p>

          <ul className="plain desk">
            {roster.map((r) => {
              const m = marks[r.student_id]
              const working = busy === r.student_id
              return (
                <li key={r.student_id} className="desk-row">
                  <div>
                    <span className="who-cell"><Avatar path={r.student?.avatar_path} name={r.student?.full_name} size={40} /><strong>{r.student?.full_name || 'Student'}</strong></span>
                    {notices[r.student_id] !== undefined && <span className="tag st-excused">Absence notice: {notices[r.student_id]}</span>}
                    <div className="small-text muted">
                      {!m && 'Not marked yet'}
                      {m && ['present', 'late'].includes(m.status) && (
                        <>
                          <span className={`tag st-${m.status}`}>{m.status === 'late' ? 'Arrived late' : 'Arrived'}</span>
                          {m.checked_in_at ? ` ${clock(m.checked_in_at)}` : ' (time not recorded)'}
                          {m.checked_out_at && <> · <span className="tag st-excused">Left</span> {clock(m.checked_out_at)}</>}
                        </>
                      )}
                      {m && m.status === 'absent' && <span className="tag st-absent">Absent</span>}
                      {m && m.status === 'excused' && <span className="tag st-excused">Excused</span>}
                    </div>
                  </div>
                  <div className="desk-actions">
                    {working && <span className="muted small-text">Saving…</span>}
                    {!working && (!m || ['absent', 'excused'].includes(m.status)) && (
                      <>
                        <button onClick={() => act(r.student_id, 'arrive')}>Arrived</button>
                        {!m && <button className="danger" onClick={() => act(r.student_id, 'absent')}>Absent</button>}
                        {m && <button className="ghost small" onClick={() => act(r.student_id, 'clear')}>Undo</button>}
                      </>
                    )}
                    {!working && m && ['present', 'late'].includes(m.status) && !m.checked_out_at && (
                      <>
                        <button onClick={() => act(r.student_id, 'leave')}>Left</button>
                        <button className="ghost small" onClick={() => act(r.student_id, 'clear')} title="Remove this mark">Undo</button>
                      </>
                    )}
                    {!working && m && m.checked_out_at && (
                      <button className="ghost small" onClick={() => act(r.student_id, 'undo_leave')}>Undo leaving</button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
          {roster.length === 0 && <p className="empty">No students are enrolled in this class.</p>}
        </>
      )}
      {classId && sessions.length === 0 && <p className="empty">There are no classes in the last 7 days. Generate sessions on the Schedule page first.</p>}
    </>
  )
}
