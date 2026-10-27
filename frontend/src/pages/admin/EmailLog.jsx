import { useEffect, useState } from 'react'
import { Mail } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { Alert, EmptyState, PageHeader } from '../../components/ui'

function describe(n) {
  const s = n.email_status
  if (!n.emailed_at) return ['Waiting to be sent', 'st-excused', 'waiting']
  if (s === 'sent') return ['Sent', 'st-present', 'sent']
  if (s === 'sent to parent') return ["Sent to the parent's email", 'st-present', 'sent']
  if (s === 'merged') return ["Included in the parent's email", 'st-present', 'sent']
  if (s === 'console') return ['Test mode: not really sent', 'st-late', 'console']
  if (s === 'skipped') return ['Skipped: no email address, or turned off, or no parent email', 'st-late', 'skipped']
  if ((s || '').startsWith('failed')) return [s, 'st-absent', 'failed']
  return [s || 'Unknown', '', 'other']
}

export default function EmailLog() {
  const [rows, setRows] = useState(null)
  const [filter, setFilter] = useState('all')
  const [error, setError] = useState('')

  async function load() {
    const { data, error } = await supabase.from('notifications')
      .select('id, title, created_at, emailed_at, email_status, user:profiles!notifications_user_id_fkey(full_name, email, contact_email, login_only)')
      .order('created_at', { ascending: false }).limit(200)
    if (error) setError(error.message); else setRows(data)
  }
  useEffect(() => { load() }, [])

  const withStatus = (rows || []).map((n) => ({ ...n, d: describe(n) }))
  const count = (k) => withStatus.filter((n) => n.d[2] === k).length
  const shown = withStatus.filter((n) => filter === 'all' || n.d[2] === filter)

  return (
    <>
      <PageHeader icon={Mail} title="Email log" subtitle="The last 200 notifications and what happened to their e-mail copy. Use it to check that parents are receiving their messages.">
        <button className="ghost" onClick={load}>Refresh</button>
      </PageHeader>
      <Alert>{error}</Alert>

      {rows && count('console') > 0 && (
        <Alert type="warn">
          {count('console')} message{count('console') === 1 ? ' was' : 's were'} only printed in the backend window, not sent. Set <code>EMAIL_MODE=smtp</code> in <code>backend/.env</code> and restart the backend.
        </Alert>
      )}
      {rows && count('failed') > 0 && <Alert>{count('failed')} e-mail{count('failed') === 1 ? '' : 's'} failed. The reason is shown in the table.</Alert>}

      <div className="stats">
        <div className="stat panel"><strong>{count('sent')}</strong>Sent</div>
        <div className="stat panel"><strong>{count('waiting')}</strong>Waiting</div>
        <div className="stat panel"><strong>{count('skipped')}</strong>Skipped</div>
        <div className="stat panel alert"><strong>{count('failed')}</strong>Failed</div>
      </div>

      <div className="toolbar">
        <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter by result">
          <option value="all">All results</option><option value="sent">Sent</option><option value="waiting">Waiting</option>
          <option value="skipped">Skipped</option><option value="failed">Failed</option><option value="console">Test mode</option>
        </select>
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr><th>When</th><th>To</th><th>Message</th><th>E-mail result</th></tr></thead>
          <tbody>
            {shown.map((n) => (
              <tr key={n.id}>
                <td>{new Date(n.created_at).toLocaleString()}</td>
                <td><span className="person-text"><strong>{n.user?.full_name || 'No name'}</strong><small>{n.user?.contact_email || (n.user?.login_only ? 'No email address' : n.user?.email) || 'No email address'}</small></span></td>
                <td>{n.title}</td>
                <td><span className={`tag ${n.d[1]}`}>{n.d[0]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows && shown.length === 0 && <EmptyState icon={Mail} title="Nothing here yet" text="Messages appear here as soon as something happens, such as a student arriving." />}
      </div>
    </>
  )
}
