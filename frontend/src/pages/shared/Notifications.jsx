import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'

const refresh = () => window.dispatchEvent(new Event('notifications-changed'))

export default function Notifications() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState(null)
  const [emailOn, setEmailOn] = useState(profile.email_notifications !== false)
  const [error, setError] = useState('')

  async function load() {
    const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(100)
    if (error) setError(error.message); else setItems(data)
  }
  useEffect(() => { load() }, [])

  async function openItem(n) {
    if (!n.read_at) { await supabase.rpc('mark_notifications_read', { ids: [n.id] }); refresh() }
    if (n.link) navigate(n.link); else load()
  }

  async function markAll() {
    await supabase.rpc('mark_notifications_read'); refresh(); load()
  }

  async function toggleEmail(e) {
    const value = e.target.checked
    setEmailOn(value)
    const { error } = await supabase.from('profiles').update({ email_notifications: value }).eq('id', profile.id)
    if (error) { setError(error.message); setEmailOn(!value) }
  }

  const unread = items?.filter((n) => !n.read_at).length || 0

  return (
    <>
      <h2>Notifications</h2>
      <p className="muted">Absences, fees, grades and announcements that concern you.</p>
      <div className="row-between">
        <label className="check"><input type="checkbox" checked={emailOn} onChange={toggleEmail} /> Also send these to my email</label>
        {unread > 0 && <button className="ghost small" onClick={markAll}>Mark all as read</button>}
      </div>
      {error && <p className="error">{error}</p>}
      {items && items.length === 0 && <p className="empty">You have no notifications yet.</p>}
      <ul className="plain notes">
        {items?.map((n) => (
          <li key={n.id} className={n.read_at ? '' : 'unread'}>
            <button className="note-btn" onClick={() => openItem(n)}>
              <strong>{n.title}</strong>
              {n.body && <span className="muted small-text">{n.body}</span>}
              <span className="muted small-text">{new Date(n.created_at).toLocaleString()}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
