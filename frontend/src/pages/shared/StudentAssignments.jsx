import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { checkFile, openFile, openLink, safeName, MAX_MB } from '../../lib/files'

export default function StudentAssignments() {
  const { profile } = useAuth()
  const [assignments, setAssignments] = useState(null)
  const [subs, setSubs] = useState({})
  const [selectedId, setSelectedId] = useState(null)
  const [text, setText] = useState('')
  const [link, setLink] = useState('')
  const [file, setFile] = useState(null)
  const [fileKey, setFileKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  async function load() {
    const [a, s] = await Promise.all([
      supabase.from('assignments').select('*, classes(name, subjects(name))').order('due_at', { ascending: true, nullsFirst: false }),
      supabase.from('submissions').select('*').eq('student_id', profile.id),
    ])
    if (a.error || s.error) return setError((a.error || s.error).message)
    setAssignments(a.data)
    setSubs(Object.fromEntries(s.data.map((x) => [x.assignment_id, x])))
  }
  useEffect(() => { load() }, [])

  function status(a) {
    const s = subs[a.id]
    if (s?.grade !== null && s?.grade !== undefined) return ['Graded', 'st-present']
    if (s) return ['Submitted', 'st-excused']
    if (a.due_at && new Date(a.due_at) < new Date()) return ['Overdue', 'st-absent']
    return ['To do', '']
  }

  function pick(a) {
    const s = subs[a.id]
    setSelectedId(a.id); setMsg(''); setError(''); setFile(null); setFileKey((k) => k + 1)
    setText(s?.text_answer || ''); setLink(s?.link_url || '')
  }

  async function submit(e) {
    e.preventDefault()
    setError(''); setMsg('')
    const existing = subs[selectedId]
    const fail = (m) => { setBusy(false); setError(m) }
    if (!text.trim() && !link.trim() && !file && !existing?.file_path) return fail('Add an answer, a link or a file before submitting.')
    setBusy(true)

    let filePath = existing?.file_path || null
    let fileName = existing?.file_name || null
    let newPath = null
    if (file) {
      const problem = checkFile(file)
      if (problem) return fail(problem)
      newPath = `${selectedId}/${profile.id}/${Date.now()}-${safeName(file.name)}`
      const up = await supabase.storage.from('submissions').upload(newPath, file)
      if (up.error) return fail(up.error.message)
      filePath = newPath; fileName = file.name
    }

    const fields = { text_answer: text.trim() || null, link_url: link.trim() || null, file_path: filePath, file_name: fileName }
    const res = existing
      ? await supabase.from('submissions').update(fields).eq('id', existing.id)
      : await supabase.from('submissions').insert({ assignment_id: selectedId, student_id: profile.id, ...fields })
    if (res.error) {
      if (newPath) await supabase.storage.from('submissions').remove([newPath])
      return fail(res.error.message)
    }
    if (newPath && existing?.file_path) await supabase.storage.from('submissions').remove([existing.file_path])
    setBusy(false); setFile(null); setFileKey((k) => k + 1); setMsg('Submitted. You can update it until your teacher grades it.')
    load()
  }

  const selected = assignments?.find((a) => a.id === selectedId)
  const sub = selected ? subs[selected.id] : null
  const graded = sub && sub.grade !== null

  return (
    <>
      <h2>Assignments</h2>
      <p className="muted">Homework and projects from your classes.</p>
      {error && !selected && <p className="error">{error}</p>}
      {assignments && assignments.length === 0 && <p className="empty">No assignments yet.</p>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Assignment</th><th>Class</th><th>Due</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {assignments?.map((a) => {
              const [text, cls] = status(a)
              return (
                <tr key={a.id}>
                  <td>{a.title}</td>
                  <td>{a.classes?.subjects?.name} – {a.classes?.name}</td>
                  <td>{a.due_at ? new Date(a.due_at).toLocaleString() : '—'}</td>
                  <td><span className={`tag ${cls}`}>{text}</span></td>
                  <td><button className="ghost small" onClick={() => pick(a)}>Open</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {selected && (
        <section className="panel">
          <h3>{selected.title}</h3>
          <p className="muted">{selected.max_points} points{selected.due_at ? ` · due ${new Date(selected.due_at).toLocaleString()}` : ''}</p>
          {selected.instructions && <p className="answer">{selected.instructions}</p>}

          {graded && (
            <div className="detail">
              <p className="big-pct">{sub.grade} / {selected.max_points}</p>
              {sub.feedback && <p><strong>Teacher feedback:</strong> {sub.feedback}</p>}
            </div>
          )}

          {sub && (
            <p className="muted">
              Your submission ({new Date(sub.submitted_at).toLocaleString()}){' '}
              {sub.file_path && <button className="ghost small" onClick={() => openFile('submissions', sub.file_path)}>Open my file</button>}
            </p>
          )}

          {!graded && (
            <form onSubmit={submit}>
              <label>Your answer <textarea rows="4" value={text} onChange={(e) => setText(e.target.value)} /></label>
              <label>Link (for example an unlisted YouTube video) <input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" /></label>
              <label>File (up to {MAX_MB} MB){sub?.file_path ? ' — choosing a new file replaces your old one' : ''}
                <input key={fileKey} type="file" onChange={(e) => setFile(e.target.files[0] || null)} />
              </label>
              {error && <p className="error">{error}</p>}
              {msg && <p className="ok">{msg}</p>}
              <div><button disabled={busy}>{busy ? 'Submitting…' : sub ? 'Update submission' : 'Submit'}</button></div>
            </form>
          )}
        </section>
      )}
    </>
  )
}
