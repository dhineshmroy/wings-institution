import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { addDays, fmtDate, fmtTime, toISODate, todayISO } from '../../lib/dates'

const KINDS = { event: 'Event', recital: 'Recital', exam: 'Exam', holiday: 'Holiday', meeting: 'Meeting' }
const AUDIENCES = { everyone: 'Everyone', teachers: 'All teachers', students: 'All students', parents: 'All parents', class: 'One class' }
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const timeOf = (iso) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

export default function CalendarPage() {
  const { profile } = useAuth()
  const isTeacher = profile.role === 'teacher'
  const canPost = profile.role === 'admin' || isTeacher
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [events, setEvents] = useState([])
  const [sessions, setSessions] = useState([])
  const [selected, setSelected] = useState(todayISO())
  const [classes, setClasses] = useState([])
  const [form, setForm] = useState({ title: '', kind: 'event', starts: '', ends: '', location: '', description: '', audience: isTeacher ? 'class' : 'everyone', class_id: '' })
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  const offset = (cursor.getDay() + 6) % 7 // Monday first
  const gridStart = addDays(cursor, -offset)
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))

  async function load() {
    setError('')
    const from = gridStart, to = addDays(gridStart, 42)
    const [e, s] = await Promise.all([
      supabase.from('events').select('*, classes(name, subjects(name))').gte('starts_at', from.toISOString()).lt('starts_at', to.toISOString()).order('starts_at'),
      profile.role === 'admin' ? Promise.resolve({ data: [] })
        : supabase.from('sessions').select('id, session_date, start_time, end_time, classes(name, subjects(name))')
            .gte('session_date', toISODate(from)).lt('session_date', toISODate(to)).neq('status', 'cancelled').order('start_time'),
    ])
    if (e.error || s.error) return setError((e.error || s.error).message)
    setEvents(e.data); setSessions(s.data)
  }
  useEffect(() => { load() }, [cursor])

  useEffect(() => {
    if (!canPost) return
    supabase.from('classes').select('id, name, subjects(name)').eq('active', true).order('name').then(({ data }) => setClasses(data || []))
  }, [canPost])

  const eventsOn = (key) => events.filter((e) => toISODate(new Date(e.starts_at)) === key)
  const sessionsOn = (key) => sessions.filter((s) => s.session_date === key)
  const move = (n) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1))
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function post(e) {
    e.preventDefault(); setError(''); setMsg('')
    const { error } = await supabase.from('events').insert({
      title: form.title.trim(), kind: form.kind, description: form.description.trim() || null,
      starts_at: new Date(form.starts).toISOString(), ends_at: form.ends ? new Date(form.ends).toISOString() : null,
      location: form.location.trim() || null, audience: form.audience, class_id: form.audience === 'class' ? form.class_id : null,
    })
    if (error) return setError(error.message)
    setMsg('Event added. The people it applies to have been notified.')
    setForm({ ...form, title: '', description: '', location: '' })
    setSelected(toISODate(new Date(form.starts))); load()
  }

  async function remove(ev) {
    if (!window.confirm(`Delete "${ev.title}"?`)) return
    const { error } = await supabase.from('events').delete().eq('id', ev.id)
    if (error) setError(error.message); else load()
  }

  const chosenEvents = eventsOn(selected)
  const chosenSessions = sessionsOn(selected)
  const monthEvents = events.filter((e) => new Date(e.starts_at).getMonth() === cursor.getMonth())

  return (
    <>
      <h2>Calendar</h2>
      <p className="muted">Holidays, recitals, exams and meetings{profile.role === 'admin' ? '' : ', with your own classes'}.</p>
      {error && <p className="error">{error}</p>}
      {msg && <p className="ok">{msg}</p>}

      <div className="cal-head">
        <button className="ghost small" onClick={() => move(-1)} aria-label="Previous month">‹</button>
        <h3>{cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3>
        <button className="ghost small" onClick={() => move(1)} aria-label="Next month">›</button>
        <button className="ghost small" onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); setSelected(todayISO()) }}>Today</button>
      </div>

      <div className="cal-grid">
        {DOW.map((d) => <div className="cal-dow" key={d}>{d}</div>)}
        {days.map((d) => {
          const key = toISODate(d)
          const ev = eventsOn(key)
          const ss = sessionsOn(key)
          return (
            <button key={key} onClick={() => setSelected(key)}
              className={`cal-cell ${d.getMonth() !== cursor.getMonth() ? 'other' : ''} ${key === todayISO() ? 'today' : ''} ${key === selected ? 'chosen' : ''}`}
              aria-label={`${fmtDate(key)}: ${ev.length} events, ${ss.length} classes`}>
              <span className="cal-num">{d.getDate()}</span>
              {ev.slice(0, 2).map((e) => <span key={e.id} className={`chip ev-${e.kind}`}>{e.title}</span>)}
              {ev.length > 2 && <span className="chip more">+{ev.length - 2} more</span>}
              {ss.length > 0 && <span className="chip cls">{ss.length} class{ss.length === 1 ? '' : 'es'}</span>}
            </button>
          )
        })}
      </div>

      <section className="panel">
        <h3>{fmtDate(selected)}</h3>
        {chosenEvents.length === 0 && chosenSessions.length === 0 && <p className="empty">Nothing scheduled.</p>}
        <ul className="plain">
          {chosenEvents.map((e) => (
            <li key={e.id}>
              <div className="row-between">
                <span><span className={`tag ev-${e.kind}`}>{KINDS[e.kind]}</span> <strong>{e.title}</strong> · {timeOf(e.starts_at)}{e.ends_at ? ` – ${timeOf(e.ends_at)}` : ''}{e.location ? ` · ${e.location}` : ''}</span>
                {(profile.role === 'admin' || e.created_by === profile.id) && <button className="danger small" onClick={() => remove(e)}>Delete</button>}
              </div>
              {e.description && <div className="muted small-text">{e.description}</div>}
              <div className="muted small-text">For: {e.audience === 'class' ? `${e.classes?.subjects?.name} – ${e.classes?.name}` : AUDIENCES[e.audience]}</div>
            </li>
          ))}
          {chosenSessions.map((s) => (
            <li key={s.id}><span className="tag ev-class">Class</span> {fmtTime(s.start_time)} – {fmtTime(s.end_time)} · {s.classes?.subjects?.name} – {s.classes?.name}</li>
          ))}
        </ul>
      </section>

      {monthEvents.length > 0 && (
        <section className="panel">
          <h3>This month</h3>
          <ul className="plain">
            {monthEvents.map((e) => (
              <li key={e.id}><span className={`tag ev-${e.kind}`}>{KINDS[e.kind]}</span> {new Date(e.starts_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · <strong>{e.title}</strong></li>
            ))}
          </ul>
        </section>
      )}

      {canPost && (
        <section className="panel">
          <h3>Add an event</h3>
          <form onSubmit={post}>
            <div className="inline-form">
              <label>Title <input value={form.title} onChange={set('title')} required /></label>
              <label>Type <select value={form.kind} onChange={set('kind')}>{Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label>Starts <input type="datetime-local" value={form.starts} onChange={set('starts')} required /></label>
              <label>Ends (optional) <input type="datetime-local" value={form.ends} onChange={set('ends')} /></label>
            </div>
            <div className="inline-form">
              <label>Place (optional) <input value={form.location} onChange={set('location')} /></label>
              {!isTeacher && (
                <label>Who is it for
                  <select value={form.audience} onChange={set('audience')}>{Object.entries(AUDIENCES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                </label>
              )}
              {form.audience === 'class' && (
                <label>Class
                  <select value={form.class_id} onChange={set('class_id')} required>
                    <option value="">Choose…</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.subjects?.name} – {c.name}</option>)}
                  </select>
                </label>
              )}
            </div>
            <label>Details (optional) <textarea rows="2" value={form.description} onChange={set('description')} /></label>
            <div><button>Add event</button></div>
          </form>
        </section>
      )}
    </>
  )
}
