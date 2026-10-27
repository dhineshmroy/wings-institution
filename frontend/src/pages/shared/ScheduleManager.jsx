import { useEffect, useState } from 'react'
import { CalendarDays, CalendarPlus, Clock, Layers, Link2, MapPin, Plus, Trash2, Video, X } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { WEEKDAYS, addDays, fmtDate, fmtTime, isoWeekday, toISODate, todayISO } from '../../lib/dates'
import { Alert, EmptyState, Field, FormCard, PageHeader } from '../../components/ui'

const EMPTY_SLOT = { weekday: '1', start_time: '', end_time: '', location: '', meeting_url: '' }
const EMPTY_EXTRA = { session_date: '', start_time: '', end_time: '', location: '', meeting_url: '' }

// Admin sees every class; a teacher only sees their own (the database decides).
export default function ScheduleManager() {
  const [classes, setClasses] = useState([])
  const [classId, setClassId] = useState('')
  const [slots, setSlots] = useState([])
  const [sessions, setSessions] = useState([])
  const [slot, setSlot] = useState(EMPTY_SLOT)
  const [extra, setExtra] = useState(EMPTY_EXTRA)
  const [weeks, setWeeks] = useState('4')
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    supabase.from('classes').select('id, name, subjects(name)').eq('active', true).order('name')
      .then(({ data }) => setClasses(data || []))
  }, [])

  async function load(id = classId) {
    if (!id) { setSlots([]); setSessions([]); return }
    const [a, b] = await Promise.all([
      supabase.from('class_schedules').select('*').eq('class_id', id).order('weekday').order('start_time'),
      supabase.from('sessions').select('*').eq('class_id', id).gte('session_date', todayISO())
        .order('session_date').order('start_time').limit(100),
    ])
    if (a.error || b.error) return setError((a.error || b.error).message)
    setSlots(a.data); setSessions(b.data)
  }
  useEffect(() => { load(classId) }, [classId])

  const reset = () => { setError(''); setMsg('') }
  const setS = (k) => (e) => setSlot({ ...slot, [k]: e.target.value })
  const setE = (k) => (e) => setExtra({ ...extra, [k]: e.target.value })

  async function addSlot(e) {
    e.preventDefault(); reset()
    const { error } = await supabase.from('class_schedules').insert({
      class_id: classId, weekday: Number(slot.weekday),
      start_time: slot.start_time, end_time: slot.end_time, location: slot.location.trim() || null,
      meeting_url: slot.meeting_url.trim() || null,
    })
    if (error) return setError(error.message)
    setSlot(EMPTY_SLOT); load()
  }

  async function removeSlot(id) {
    reset()
    const { error } = await supabase.from('class_schedules').delete().eq('id', id)
    if (error) setError(error.message); else load()
  }

  async function generate() {
    reset()
    if (slots.length === 0) return setError('Add at least one weekly time slot first.')
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const rows = []
    for (let i = 0; i < Number(weeks) * 7; i++) {
      const d = addDays(start, i)
      slots.filter((s) => s.weekday === isoWeekday(d)).forEach((s) =>
        rows.push({ class_id: classId, session_date: toISODate(d), start_time: s.start_time, end_time: s.end_time, location: s.location, meeting_url: s.meeting_url }))
    }
    const { error } = await supabase.from('sessions')
      .upsert(rows, { onConflict: 'class_id,session_date,start_time', ignoreDuplicates: true })
    if (error) return setError(error.message)
    setMsg(`Sessions are ready for the next ${weeks} weeks. Existing ones were kept as they were.`)
    load()
  }

  async function addExtra(e) {
    e.preventDefault(); reset()
    const { error } = await supabase.from('sessions').insert({
      class_id: classId, session_date: extra.session_date,
      start_time: extra.start_time, end_time: extra.end_time, location: extra.location.trim() || null,
      meeting_url: extra.meeting_url.trim() || null,
    })
    if (error) return setError(error.code === '23505' ? 'A session already exists at that date and time.' : error.message)
    setExtra(EMPTY_EXTRA); load()
  }

  async function changeLink(s) {
    const v = window.prompt('Online class link for this session (leave empty to remove it)', s.meeting_url || '')
    if (v === null) return
    reset()
    const { error } = await supabase.from('sessions').update({ meeting_url: v.trim() || null }).eq('id', s.id)
    if (error) setError(error.message); else load()
  }

  async function updateAllLinks() {
    const v = window.prompt('New online class link for ALL upcoming sessions and weekly slots of this class (leave empty to remove it)', '')
    if (v === null) return
    reset()
    const link = v.trim() || null
    const a = await supabase.from('class_schedules').update({ meeting_url: link }).eq('class_id', classId)
    const b = await supabase.from('sessions').update({ meeting_url: link }).eq('class_id', classId).gte('session_date', todayISO())
    if (a.error || b.error) return setError((a.error || b.error).message)
    setMsg('Online link updated for this class.'); load()
  }

  async function setStatus(s, status) {
    reset()
    const { error } = await supabase.from('sessions').update({ status }).eq('id', s.id)
    if (error) setError(error.message); else load()
  }

  async function removeSession(s) {
    if (!window.confirm('Delete this session and any attendance recorded for it?')) return
    reset()
    const { error } = await supabase.from('sessions').delete().eq('id', s.id)
    if (error) setError(error.message); else load()
  }

  return (
    <>
      <PageHeader icon={CalendarDays} title="Schedule" subtitle="Set the weekly time slots for a class, then generate dated sessions. Attendance is recorded against those sessions." />

      <FormCard icon={Layers} title="Choose a class">
        <Field label="Class" icon={Layers} className="narrow-field">
          <select value={classId} onChange={(e) => { setClassId(e.target.value); reset() }}>
            <option value="">Choose a class…</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.subjects?.name} – {c.name}</option>)}
          </select>
        </Field>
      </FormCard>

      <Alert>{error}</Alert>
      <Alert type="ok">{msg}</Alert>

      {!classId && <EmptyState icon={CalendarDays} title="Pick a class to plan its week" text="You will set its weekly time slots and create the dated sessions here." />}

      {classId && (
        <>
          <FormCard icon={Clock} title="Weekly time slots" hint="The repeating timetable for this class.">
            <form onSubmit={addSlot}>
              <div className="form-grid">
                <Field label="Day" icon={CalendarDays}>
                  <select value={slot.weekday} onChange={setS('weekday')}>
                    {WEEKDAYS.slice(1).map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
                  </select>
                </Field>
                <Field label="Starts" icon={Clock}><input type="time" value={slot.start_time} onChange={setS('start_time')} required /></Field>
                <Field label="Ends" icon={Clock}><input type="time" value={slot.end_time} onChange={setS('end_time')} required /></Field>
                <Field label="Room" icon={MapPin}><input value={slot.location} onChange={setS('location')} placeholder="Room 2" /></Field>
                <Field label="Online class link (Zoom, Meet…)" icon={Video} className="span-2"><input type="url" value={slot.meeting_url} onChange={setS('meeting_url')} placeholder="https://" /></Field>
              </div>
              <div className="form-actions"><button><Plus size={18} aria-hidden="true" /> Add time slot</button></div>
            </form>

            <div className="week" aria-label="Weekly timetable">
              {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                const list = slots.filter((s) => s.weekday === d)
                return (
                  <div className={`week-day ${list.length ? 'has' : ''}`} key={d}>
                    <h4>{WEEKDAYS[d].slice(0, 3)}</h4>
                    {list.map((s) => (
                      <div className="slot-chip" key={s.id}>
                        <strong>{fmtTime(s.start_time)} – {fmtTime(s.end_time)}</strong>
                        {s.location && <span>{s.location}</span>}
                        {s.meeting_url && <span className="tag" style={{ margin: 0, width: 'fit-content' }}>Online</span>}
                        <button className="slot-x" onClick={() => removeSlot(s.id)} aria-label={`Remove ${WEEKDAYS[d]} ${fmtTime(s.start_time)}`}><X size={14} aria-hidden="true" /></button>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
            {slots.length === 0 && <p className="muted small-text" style={{ margin: 0 }}>No weekly slots yet. Add the first one above.</p>}
          </FormCard>

          <FormCard icon={CalendarPlus} title="Create the dated sessions" hint="Turns the weekly slots into real classes you can mark attendance for.">
            <div className="form-grid">
              <Field label="Create sessions for the next" icon={CalendarDays}>
                <select value={weeks} onChange={(e) => setWeeks(e.target.value)}>
                  <option value="4">4 weeks</option><option value="8">8 weeks</option><option value="12">12 weeks</option>
                </select>
              </Field>
            </div>
            <div className="form-actions" style={{ marginTop: '1rem' }}>
              <button onClick={generate}><CalendarPlus size={18} aria-hidden="true" /> Generate sessions</button>
              <button className="ghost" onClick={updateAllLinks}><Link2 size={18} aria-hidden="true" /> Change the online link for the whole class</button>
            </div>
          </FormCard>

          <FormCard icon={Plus} title="Add a one-off session" hint="For a make-up or extra class.">
            <form onSubmit={addExtra}>
              <div className="form-grid">
                <Field label="Date" icon={CalendarDays}><input type="date" value={extra.session_date} onChange={setE('session_date')} required /></Field>
                <Field label="Starts" icon={Clock}><input type="time" value={extra.start_time} onChange={setE('start_time')} required /></Field>
                <Field label="Ends" icon={Clock}><input type="time" value={extra.end_time} onChange={setE('end_time')} required /></Field>
                <Field label="Room" icon={MapPin}><input value={extra.location} onChange={setE('location')} /></Field>
                <Field label="Online class link" icon={Video} className="span-2"><input type="url" value={extra.meeting_url} onChange={setE('meeting_url')} placeholder="https://" /></Field>
              </div>
              <div className="form-actions"><button><Plus size={18} aria-hidden="true" /> Add session</button></div>
            </form>
          </FormCard>

          <h3>Upcoming sessions</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Time</th><th>Where</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td><strong>{fmtDate(s.session_date)}</strong></td>
                    <td>{fmtTime(s.start_time)} – {fmtTime(s.end_time)}</td>
                    <td>{s.location || '—'}{s.meeting_url && <span className="tag">Online</span>}</td>
                    <td>
                      {s.status === 'cancelled' ? <span className="tag st-absent">Cancelled</span>
                        : s.status === 'held' ? <span className="tag st-present">Held</span>
                        : <span className="tag st-excused">Scheduled</span>}
                    </td>
                    <td className="actions">
                      <button className="ghost small" onClick={() => changeLink(s)}><Video size={15} aria-hidden="true" /> Link</button>
                      <button className="ghost small" onClick={() => setStatus(s, s.status === 'cancelled' ? 'scheduled' : 'cancelled')}>{s.status === 'cancelled' ? 'Restore' : 'Cancel class'}</button>
                      <button className="danger small" onClick={() => removeSession(s)} aria-label="Delete this session"><Trash2 size={15} aria-hidden="true" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sessions.length === 0 && <EmptyState icon={CalendarDays} title="No upcoming sessions" text="Add weekly slots, then press Generate sessions." />}
          </div>
        </>
      )}
    </>
  )
}
