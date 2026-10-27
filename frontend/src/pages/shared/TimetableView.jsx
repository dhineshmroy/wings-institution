import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { addDays, fmtDate, fmtTime, toISODate, todayISO } from '../../lib/dates'

function inWindow(s) {
  const start = new Date(`${s.session_date}T${s.start_time}`).getTime()
  const end = new Date(`${s.session_date}T${s.end_time}`).getTime()
  const now = Date.now()
  return now >= start - 15 * 60000 && now <= end + 30 * 60000
}

// Works for teacher, student and parent: the database only returns the sessions they are allowed to see.
export default function TimetableView() {
  const [sessions, setSessions] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('sessions')
      .select('id, session_date, start_time, end_time, location, meeting_url, topic, status, classes(name, level, subjects(name))')
      .gte('session_date', todayISO())
      .lte('session_date', toISODate(addDays(new Date(), 28)))
      .order('session_date')
      .order('start_time')
      .then(({ data, error }) => (error ? setError(error.message) : setSessions(data)))
  }, [])

  const days = {}
  sessions?.forEach((s) => { (days[s.session_date] ||= []).push(s) })

  return (
    <>
      <h2>Timetable</h2>
      <p className="muted">Your classes for the next 4 weeks.</p>
      {error && <p className="error">{error}</p>}
      {sessions && sessions.length === 0 && <p className="empty">No upcoming classes. The schedule will appear here once it is set up.</p>}
      {Object.entries(days).map(([date, list]) => (
        <section className="day" key={date}>
          <h3>{fmtDate(date)} {date === todayISO() && <span className="tag">Today</span>}</h3>
          {list.map((s) => (
            <div className={`slot ${s.status === 'cancelled' ? 'cancelled' : ''}`} key={s.id}>
              <span className="time">{fmtTime(s.start_time)} – {fmtTime(s.end_time)}</span>
              <span><strong>{s.classes?.subjects?.name}</strong> – {s.classes?.name}</span>
              {s.location && <span className="muted">{s.location}</span>}
              {s.meeting_url && s.status !== 'cancelled' && (
                <a className={`join ${inWindow(s) ? 'live' : ''}`} href={s.meeting_url} target="_blank" rel="noopener noreferrer">
                  {inWindow(s) ? 'Join now' : 'Online class link'}
                </a>
              )}
              {s.status === 'cancelled' && <span className="tag st-absent">Cancelled</span>}
            </div>
          ))}
        </section>
      ))}
    </>
  )
}
