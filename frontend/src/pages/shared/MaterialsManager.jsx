import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { checkFile, openFile, openLink, safeName, MAX_MB } from '../../lib/files'

const EMPTY = { title: '', description: '', kind: 'file', url: '' }

// Admin sees every class; a teacher only sees their own (the database decides).
export default function MaterialsManager() {
  const [classes, setClasses] = useState([])
  const [classId, setClassId] = useState('')
  const [items, setItems] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [file, setFile] = useState(null)
  const [fileKey, setFileKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('classes').select('id, name, subjects(name)').eq('active', true).order('name')
      .then(({ data }) => setClasses(data || []))
  }, [])

  async function load(id = classId) {
    if (!id) return setItems([])
    const { data, error } = await supabase.from('materials').select('*').eq('class_id', id).order('created_at', { ascending: false })
    if (error) setError(error.message); else setItems(data)
  }
  useEffect(() => { load(classId) }, [classId])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function add(e) {
    e.preventDefault()
    setError('')
    const fail = (m) => { setBusy(false); setError(m) }
    setBusy(true)
    let path = null, name = null
    if (form.kind === 'file') {
      if (!file) return fail('Choose a file to upload.')
      const problem = checkFile(file)
      if (problem) return fail(problem)
      path = `${classId}/${crypto.randomUUID()}-${safeName(file.name)}`
      const up = await supabase.storage.from('materials').upload(path, file)
      if (up.error) return fail(up.error.message)
      name = file.name
    }
    const { error } = await supabase.from('materials').insert({
      class_id: classId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      kind: form.kind,
      url: form.kind === 'link' ? form.url.trim() : null,
      file_path: path,
      file_name: name,
    })
    if (error) {
      if (path) await supabase.storage.from('materials').remove([path])
      return fail(error.message)
    }
    setForm(EMPTY); setFile(null); setFileKey(fileKey + 1); setBusy(false); load()
  }

  async function remove(m) {
    if (!window.confirm(`Delete "${m.title}"?`)) return
    const { error } = await supabase.from('materials').delete().eq('id', m.id)
    if (error) return setError(error.message)
    if (m.file_path) await supabase.storage.from('materials').remove([m.file_path])
    load()
  }

  return (
    <>
      <h2>Learning materials</h2>
      <p className="muted">Upload notes, PDFs and slides, or add links to lesson videos (YouTube, Google Drive and so on). Students in the class can open them.</p>
      <label className="narrow">Class
        <select value={classId} onChange={(e) => { setClassId(e.target.value); setError('') }}>
          <option value="">Choose a class…</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.subjects?.name} – {c.name}</option>)}
        </select>
      </label>
      {error && <p className="error">{error}</p>}

      {classId && (
        <>
          <section className="panel">
            <h3>Add material</h3>
            <form className="inline-form" onSubmit={add}>
              <label>Title <input value={form.title} onChange={set('title')} required /></label>
              <label>Type
                <select value={form.kind} onChange={set('kind')}>
                  <option value="file">File upload</option>
                  <option value="link">Link (video or website)</option>
                </select>
              </label>
              {form.kind === 'file'
                ? <label>File (up to {MAX_MB} MB) <input key={fileKey} type="file" onChange={(e) => setFile(e.target.files[0] || null)} /></label>
                : <label>Link <input type="url" value={form.url} onChange={set('url')} placeholder="https://" required /></label>}
              <label>Description (optional) <input value={form.description} onChange={set('description')} /></label>
              <button disabled={busy}>{busy ? 'Uploading…' : 'Add material'}</button>
            </form>
          </section>

          <div className="table-wrap">
            <table>
              <thead><tr><th>Title</th><th>Type</th><th>Added</th><th></th></tr></thead>
              <tbody>
                {items.map((m) => (
                  <tr key={m.id}>
                    <td>{m.title}{m.description && <div className="muted small-text">{m.description}</div>}</td>
                    <td><span className="tag">{m.kind === 'file' ? 'File' : 'Link'}</span></td>
                    <td>{new Date(m.created_at).toLocaleDateString()}</td>
                    <td>
                      <button className="ghost small" onClick={() => (m.kind === 'file' ? openFile('materials', m.file_path) : openLink(m.url))}>Open</button>{' '}
                      <button className="danger small" onClick={() => remove(m)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 && <p className="empty">Nothing uploaded for this class yet.</p>}
          </div>
        </>
      )}
    </>
  )
}
