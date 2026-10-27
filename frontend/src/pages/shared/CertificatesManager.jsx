import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { todayISO } from '../../lib/dates'

// Admin sees every class; a teacher only sees their own (the database decides).
export default function CertificatesManager() {
  const [classes, setClasses] = useState([])
  const [classId, setClassId] = useState('')
  const [roster, setRoster] = useState([])
  const [issued, setIssued] = useState([])
  const [form, setForm] = useState({ student_id: '', title: '', description: '', issued_on: todayISO() })
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    supabase.from('classes').select('id, name, subjects(name)').eq('active', true).order('name').then(({ data }) => setClasses(data || []))
  }, [])

  async function load(id = classId) {
    if (!id) { setRoster([]); setIssued([]); return }
    const [r, c] = await Promise.all([
      supabase.from('enrollments').select('student_id, student:profiles!enrollments_student_id_fkey(full_name)').eq('class_id', id),
      supabase.from('certificates').select('*, student:profiles!certificates_student_id_fkey(full_name)').eq('class_id', id).order('created_at', { ascending: false }),
    ])
    if (r.error || c.error) return setError((r.error || c.error).message)
    setRoster(r.data.sort((a, b) => (a.student?.full_name || '').localeCompare(b.student?.full_name || '')))
    setIssued(c.data)
  }

  useEffect(() => {
    const cls = classes.find((c) => c.id === classId)
    setForm((f) => ({ ...f, student_id: '', title: cls ? `Certificate of Completion: ${cls.subjects?.name}` : '' }))
    setMsg(''); setError(''); load(classId)
  }, [classId])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function issue(e) {
    e.preventDefault(); setError(''); setMsg('')
    const cls = classes.find((c) => c.id === classId)
    const { error } = await supabase.from('certificates').insert({
      student_id: form.student_id, class_id: classId, title: form.title.trim(),
      description: form.description.trim() || `has successfully completed ${cls?.subjects?.name} – ${cls?.name} at Wings Institution.`,
      issued_on: form.issued_on,
    })
    if (error) return setError(error.message)
    setMsg('Certificate issued. The student and parents have been notified.')
    setForm({ ...form, student_id: '', description: '' }); load()
  }

  async function revoke(c) {
    if (!window.confirm(`Delete the certificate "${c.title}" for ${c.student?.full_name}?`)) return
    const { error } = await supabase.from('certificates').delete().eq('id', c.id)
    if (error) setError(error.message); else load()
  }

  const base = window.location.pathname.split('/')[1]

  return (
    <>
      <h2>Certificates</h2>
      <p className="muted">Award a certificate for completing a course, passing a dance grade or any achievement. Students and parents can print it.</p>
      <label className="narrow">Class
        <select value={classId} onChange={(e) => setClassId(e.target.value)}>
          <option value="">Choose a class…</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.subjects?.name} – {c.name}</option>)}
        </select>
      </label>
      {error && <p className="error">{error}</p>}
      {msg && <p className="ok">{msg}</p>}

      {classId && (
        <>
          <section className="panel">
            <h3>Issue a certificate</h3>
            <form onSubmit={issue}>
              <div className="inline-form">
                <label>Student
                  <select value={form.student_id} onChange={set('student_id')} required>
                    <option value="">Choose…</option>
                    {roster.map((r) => <option key={r.student_id} value={r.student_id}>{r.student?.full_name || 'Student'}</option>)}
                  </select>
                </label>
                <label>Date <input type="date" value={form.issued_on} onChange={set('issued_on')} required /></label>
              </div>
              <label>Certificate title <input value={form.title} onChange={set('title')} required /></label>
              <label>Wording (optional) <textarea rows="2" value={form.description} onChange={set('description')} placeholder="has successfully completed … with distinction." /></label>
              <div><button>Issue certificate</button></div>
            </form>
          </section>

          <div className="table-wrap">
            <table>
              <thead><tr><th>Student</th><th>Certificate</th><th>Number</th><th>Date</th><th></th></tr></thead>
              <tbody>
                {issued.map((c) => (
                  <tr key={c.id}>
                    <td>{c.student?.full_name}</td>
                    <td>{c.title}</td>
                    <td>{c.certificate_no}</td>
                    <td>{c.issued_on}</td>
                    <td className="actions"><Link to={`/certificate/${c.id}`}>View</Link> <button className="danger small" onClick={() => revoke(c)}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {issued.length === 0 && <p className="empty">No certificates issued for this class yet.</p>}
          </div>
        </>
      )}
    </>
  )
}
