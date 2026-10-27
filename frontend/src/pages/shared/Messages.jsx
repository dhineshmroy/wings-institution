import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'

const refresh = () => window.dispatchEvent(new Event('notifications-changed'))
const roleLabel = (r) => (r ? r.charAt(0).toUpperCase() + r.slice(1) : '')

export default function Messages() {
  const { profile } = useAuth()
  const [convos, setConvos] = useState([])
  const [contacts, setContacts] = useState([])
  const [activeId, setActiveId] = useState('')
  const [thread, setThread] = useState([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef(null)

  async function loadConvos() {
    const { data, error } = await supabase.rpc('my_conversations')
    if (error) setError(error.message); else setConvos(data || [])
  }

  async function loadThread(id) {
    const { data, error } = await supabase.from('messages').select('*')
      .or(`and(sender_id.eq.${profile.id},recipient_id.eq.${id}),and(sender_id.eq.${id},recipient_id.eq.${profile.id})`)
      .order('created_at', { ascending: true }).limit(300)
    if (error) return setError(error.message)
    setThread(data)
    if (data.some((m) => m.recipient_id === profile.id && !m.read_at)) {
      await supabase.rpc('mark_messages_read', { p_other: id })
      refresh(); loadConvos()
    }
  }

  useEffect(() => {
    loadConvos()
    supabase.rpc('message_contacts').then(({ data }) => setContacts(data || []))
  }, [])

  useEffect(() => {
    if (!activeId) return setThread([])
    loadThread(activeId)
    const t = setInterval(() => { loadThread(activeId); loadConvos() }, 10000)
    return () => clearInterval(t)
  }, [activeId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: 'end' }) }, [thread.length])

  async function send(e) {
    e.preventDefault()
    if (!text.trim()) return
    setError(''); setBusy(true)
    const { error } = await supabase.from('messages').insert({ recipient_id: activeId, body: text.trim() })
    setBusy(false)
    if (error) return setError(error.message)
    setText(''); loadThread(activeId); loadConvos()
  }

  const active = convos.find((c) => c.other_id === activeId)
    || (contacts.find((c) => c.id === activeId) && { other_name: contacts.find((c) => c.id === activeId).full_name, other_role: contacts.find((c) => c.id === activeId).role })

  return (
    <>
      <h2>Messages</h2>
      <p className="muted">Private messages between teachers, parents, students and the institute office.</p>
      {error && <p className="error">{error}</p>}

      <div className={`messages ${activeId ? 'has-active' : ''}`}>
        <aside className="msg-list panel">
          <label>Start a new conversation
            <select value="" onChange={(e) => e.target.value && setActiveId(e.target.value)}>
              <option value="">Choose a person…</option>
              {contacts.map((c) => <option key={c.id} value={c.id}>{c.full_name || 'Unnamed'} ({roleLabel(c.role)}){c.detail ? ` – ${c.detail}` : ''}</option>)}
            </select>
          </label>
          <ul className="plain">
            {convos.map((c) => (
              <li key={c.other_id}>
                <button className={`note-btn ${c.other_id === activeId ? 'current' : ''}`} onClick={() => setActiveId(c.other_id)}>
                  <strong>{c.other_name || 'Unnamed'} <span className="muted small-text">{roleLabel(c.other_role)}</span> {c.unread > 0 && <span className="badge">{c.unread}</span>}</strong>
                  {c.other_detail && <span className="muted small-text clip">{c.other_detail}</span>}
                  <span className="muted small-text clip">{c.last_body}</span>
                </button>
              </li>
            ))}
            {convos.length === 0 && <li className="muted small-text">No conversations yet.</li>}
          </ul>
        </aside>

        <section className="msg-thread panel">
          {!activeId && <p className="empty">Choose a conversation or start a new one.</p>}
          {activeId && (
            <>
              <div className="row-between">
                <h3>{active?.other_name || 'Conversation'} <span className="muted small-text">{roleLabel(active?.other_role)}</span></h3>
                <button className="ghost small only-mobile" onClick={() => setActiveId('')}>Back</button>
              </div>
              <div className="thread" aria-live="polite">
                {thread.map((m) => (
                  <div key={m.id} className={`bubble ${m.sender_id === profile.id ? 'mine' : 'theirs'}`}>
                    <p>{m.body}</p>
                    <span className="small-text">{new Date(m.created_at).toLocaleString()}</span>
                  </div>
                ))}
                {thread.length === 0 && <p className="empty">No messages yet. Say hello.</p>}
                <div ref={bottomRef} />
              </div>
              <form onSubmit={send} className="composer">
                <textarea rows="2" value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message…" maxLength={2000} />
                <button disabled={busy || !text.trim()}>{busy ? 'Sending…' : 'Send'}</button>
              </form>
            </>
          )}
        </section>
      </div>
    </>
  )
}
