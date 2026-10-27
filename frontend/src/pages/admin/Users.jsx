import { useEffect, useState } from 'react'
import { Check, Copy, GraduationCap, KeyRound, Mail, Phone, ShieldCheck, Trash2, User, UserPlus, Users as UsersIcon } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../lib/api'
import Avatar from '../../components/Avatar'
import RegisterStudent from './RegisterStudent'
import DeletePersonDialog from './DeletePersonDialog'
import { Alert, EmptyState, Field, FormCard, PageHeader, SearchBox, Spinner, Switch } from '../../components/ui'

const ROLES = ['student', 'parent', 'teacher', 'admin']
const ROLE_NAMES = { all: 'Everyone', student: 'Students', parent: 'Parents', teacher: 'Teachers', admin: 'Admins' }
const STATUS = { pending: ['Waiting for approval', 'st-late'], active: ['Active', 'st-present'], inactive: ['Deactivated', 'st-absent'] }
const EMPTY = { full_name: '', email: '', phone: '', role: 'teacher', password: '' }

function Credentials({ created, onClose }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(`Email: ${created.email}\nPassword: ${created.password}`)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    } catch { /* the browser may block copying */ }
  }
  return (
    <div className="creds">
      <div className="row-between">
        <strong>Login created</strong>
        <button className="ghost small" onClick={copy}>{copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copied' : 'Copy'}</button>
      </div>
      <p className="small-text muted" style={{ margin: 0 }}>Give these details to the person. The password is shown only now. They can change it under My profile.</p>
      <div className="creds-row"><span>Email</span><code>{created.email}</code></div>
      <div className="creds-row"><span>Password</span><code>{created.password}</code></div>
      <div><button className="ghost small" onClick={onClose}>Done</button></div>
    </div>
  )
}

function AddPerson({ onCreated, onError, onDone }) {
  const [form, setForm] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault(); onError(''); setBusy(true)
    try {
      const r = await api('/admin/users', { method: 'POST', body: { ...form, password: form.password || null } })
      onCreated(r); setForm(EMPTY); onDone()
    } catch (err) { onError(err.message) }
    setBusy(false)
  }

  return (
    <>
      <p className="muted small-text" style={{ marginTop: 0 }}>Creates the login straight away, with no sign-up needed. Use this for teachers. Needs the backend to be running.</p>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Full name" icon={User}><input value={form.full_name} onChange={set('full_name')} required /></Field>
          <Field label="Email" icon={Mail}><input type="email" value={form.email} onChange={set('email')} required /></Field>
          <Field label="Phone" icon={Phone}><input type="tel" value={form.phone} onChange={set('phone')} /></Field>
          <Field label="Role" icon={ShieldCheck}>
            <select value={form.role} onChange={set('role')}>
              <option value="teacher">Teacher</option><option value="student">Student</option><option value="parent">Parent</option>
            </select>
          </Field>
          <Field label="Password" icon={KeyRound} hint="Leave blank and a safe password is made for you." className="span-2">
            <input value={form.password} onChange={set('password')} minLength={8} placeholder="Optional" />
          </Field>
        </div>
        <div className="form-actions">
          <button disabled={busy}>{busy ? <><Spinner /> Creating…</> : <><UserPlus size={18} aria-hidden="true" /> Create login</>}</button>
        </div>
      </form>
    </>
  )
}

export default function Users() {
  const { profile } = useAuth()
  const [rows, setRows] = useState([])
  const [filter, setFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('student')
  const [requireApproval, setRequireApproval] = useState(true)
  const [publicDash, setPublicDash] = useState(true)
  const [deleting, setDeleting] = useState(null)
  const [created, setCreated] = useState(null)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  async function load() {
    const [u, s, p] = await Promise.all([
      supabase.from('profiles').select('*, parent_invites(parent_name, parent_email, parent_phone)').order('created_at', { ascending: false }),
      supabase.from('app_settings').select('value').eq('key', 'require_signup_approval').maybeSingle(),
      supabase.from('app_settings').select('value').eq('key', 'public_dashboard').maybeSingle(),
    ])
    if (u.error) return setError(u.error.message)
    setRows(u.data)
    if (s.data) setRequireApproval(s.data.value === 'true')
    if (p.data) setPublicDash(p.data.value !== 'false')
  }
  useEffect(() => { load() }, [])

  const reset = () => { setError(''); setMsg('') }

  async function changeRole(user, role) {
    if (role === user.role) return
    if (role === 'admin' && !window.confirm(`Give admin access to ${user.full_name || user.email}?`)) return
    reset()
    const { error } = await supabase.from('profiles').update({ role }).eq('id', user.id)
    if (error) setError(error.message); else { setMsg('Role updated.'); load() }
  }

  async function setStatus(user, status) {
    const who = user.full_name || user.email
    if (status === 'inactive' && !window.confirm(`Deactivate ${who}? They will no longer be able to log in. Their records are kept.`)) return
    reset()
    const { error } = await supabase.from('profiles').update({ status }).eq('id', user.id)
    if (error) return setError(error.message)
    let note = status === 'active' ? `${who} is now active.` : `${who} was deactivated.`
    if (user.status !== 'pending' || status === 'inactive') {
      try { await api(`/admin/users/${user.id}/ban`, { method: 'POST', body: { banned: status === 'inactive' } }) }
      catch (e) { note += ` (The login itself could not be ${status === 'inactive' ? 'blocked' : 'unblocked'}: ${e.message})` }
    }
    setMsg(note); load()
  }

  async function toggleApproval(e) {
    const value = e.target.checked
    setRequireApproval(value); reset()
    const { error } = await supabase.from('app_settings').update({ value: String(value) }).eq('key', 'require_signup_approval')
    if (error) { setError(error.message); setRequireApproval(!value) }
  }

  async function togglePublicDash(e) {
    const value = e.target.checked
    setPublicDash(value); reset()
    const { error } = await supabase.from('app_settings').upsert({ key: 'public_dashboard', value: String(value) })
    if (error) { setError(error.message); setPublicDash(!value) }
  }

  async function createParentFrom(inv) {
    reset(); setCreated(null)
    try {
      const r = await api('/admin/users', { method: 'POST', body: { full_name: inv.parent_name || inv.parent_email, email: inv.parent_email, phone: inv.parent_phone || null, role: 'parent', password: null } })
      setCreated(r); setMsg('Parent login created. It is linked to every child who named this parent.'); load()
    } catch (e) { setError(e.message) }
  }

  const pending = rows.filter((r) => r.status === 'pending').length
  const parentEmails = new Set(rows.filter((r) => r.role === 'parent').map((r) => (r.email || '').toLowerCase()))
  const count = (r) => (r === 'all' ? rows.length : rows.filter((x) => x.role === r).length)
  const shown = rows.filter((r) =>
    (filter === 'all' || r.role === filter) && (statusFilter === 'all' || r.status === statusFilter) &&
    `${r.full_name} ${r.email} ${r.phone || ''}`.toLowerCase().includes(q.toLowerCase()))

  return (
    <>
      <PageHeader icon={UsersIcon} title="Users" subtitle="Approve sign-ups, add people, and manage who can log in." />

      {pending > 0 && (
        <Alert type="warn">
          <strong>{pending}</strong> {pending === 1 ? 'person is' : 'people are'} waiting for approval.
          <button className="small" onClick={() => { setStatusFilter('pending'); setFilter('all') }}>Show them</button>
        </Alert>
      )}
      <Alert>{error}</Alert>
      <Alert type="ok">{msg}</Alert>
      {created && <Credentials created={created} onClose={() => setCreated(null)} />}

      <FormCard icon={UserPlus} title="Add people" hint="Register a student with their parent's details, or create a login for a teacher.">
        <div className="seg" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'student'} className={`seg-btn ${tab === 'student' ? 'on' : ''}`} onClick={() => setTab('student')}>Register a student</button>
          <button type="button" role="tab" aria-selected={tab === 'person'} className={`seg-btn ${tab === 'person' ? 'on' : ''}`} onClick={() => setTab('person')}>Add a teacher or parent</button>
        </div>
        {tab === 'student'
          ? <RegisterStudent onDone={load} />
          : <AddPerson onCreated={(r) => { setCreated(r); setMsg('') }} onError={setError} onDone={load} />}
      </FormCard>

      <section className="panel setting-card">
        <div>
          <h3>Approve new sign-ups</h3>
          <p className="muted small-text">When this is on, people who register themselves must be approved by you before they can use the app.</p>
        </div>
        <Switch checked={requireApproval} onChange={toggleApproval}>{requireApproval ? 'On' : 'Off'}</Switch>
      </section>

      <section className="panel setting-card">
        <div>
          <h3>Live numbers on the sign-in page</h3>
          <p className="muted small-text">Shows totals from your real data (such as attendance and marks, with no names) beside the sign-in form. When this is off, the page shows example numbers instead.</p>
        </div>
        <Switch checked={publicDash} onChange={togglePublicDash}>{publicDash ? 'Live data' : 'Example data'}</Switch>
      </section>

      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Search by name, email or phone" />
        <div className="chips" role="group" aria-label="Filter by role">
          {['all', ...ROLES].map((r) => (
            <button key={r} type="button" className={`chip-btn ${filter === r ? 'on' : ''}`} onClick={() => setFilter(r)}>
              {ROLE_NAMES[r]} <span className="count">{count(r)}</span>
            </button>
          ))}
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
          <option value="all">Any status</option><option value="pending">Waiting for approval</option><option value="active">Active</option><option value="inactive">Deactivated</option>
        </select>
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Person</th><th>Contact</th><th>Joined</th><th>Status</th><th>Role</th><th></th></tr></thead>
          <tbody>
            {shown.map((u) => {
              const self = u.id === profile.id
              const [label, cls] = STATUS[u.status] || STATUS.active
              return (
                <tr key={u.id}>
                  <td>
                    <span className="person">
                      <Avatar path={u.avatar_path} name={u.full_name} size={40} />
                      <span className="person-text">
                        <strong>{u.full_name || 'No name'}{self && <span className="tag">You</span>}</strong>
                        {u.parent_invites?.map((i) => <small key={i.parent_email}>Parent: {i.parent_name || '—'} · {i.parent_email}{i.parent_phone ? ` · ${i.parent_phone}` : ''}</small>)}
                      </span>
                    </span>
                  </td>
                  <td><span className="person-text"><span>{u.email}</span><small>{u.phone || 'No phone'}</small></span></td>
                  <td>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td><span className={`tag ${cls}`}>{label}</span></td>
                  <td>
                    <select value={u.role} disabled={self} onChange={(e) => changeRole(u, e.target.value)} title={self ? 'You cannot change your own role' : ''} aria-label={`Role of ${u.full_name || u.email}`}>
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td className="actions">
                    {u.status === 'pending' && <button className="small" onClick={() => setStatus(u, 'active')}>Approve</button>}
                    {u.status === 'pending' && <button className="danger small" onClick={() => setStatus(u, 'inactive')}>Reject</button>}
                    {u.status === 'active' && !self && <button className="danger small" onClick={() => setStatus(u, 'inactive')}>Deactivate</button>}
                    {u.status === 'inactive' && <button className="ghost small" onClick={() => setStatus(u, 'active')}>Reactivate</button>}
                    {!self && u.role !== 'admin' && <button className="danger small" onClick={() => setDeleting(u)}><Trash2 size={15} aria-hidden="true" /> Delete</button>}
                    {u.parent_invites?.filter((i) => !parentEmails.has(i.parent_email.toLowerCase())).map((i) => (
                      <button key={i.parent_email} className="ghost small" onClick={() => createParentFrom(i)}>Create parent login</button>
                    ))}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {shown.length === 0 && <EmptyState icon={UsersIcon} title="No one matches" text="Try a different search or filter." />}
      </div>
      {deleting && <DeletePersonDialog user={deleting} onClose={() => setDeleting(null)} onDone={(m) => { setDeleting(null); setMsg(m); load() }} />}
    </>
  )
}
