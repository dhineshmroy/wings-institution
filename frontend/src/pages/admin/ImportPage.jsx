import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { api } from '../../lib/api'
import { downloadCSV, parseCSV } from '../../lib/csv'

const HEADERS = ['student_name', 'student_email', 'student_phone', 'parent_name', 'parent_email', 'parent_phone', 'class']
const EXAMPLE = [
  ['Nethmi Perera', '', '0771234567', 'Kamal Perera', 'kamal@example.com', '0712345678', 'ICT – Grade 10 Evening'],
  ['Sanduni Perera', '', '', 'Kamal Perera', 'kamal@example.com', '', 'Dance – Beginner Saturday; ICT – Grade 10 Evening'],
]
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const norm = (s) => s.toLowerCase().replace(/[–—-]/g, '-').replace(/\s+/g, ' ').trim()

export default function ImportPage() {
  const [classes, setClasses] = useState([])
  const [rows, setRows] = useState(null)
  const [fileName, setFileName] = useState('')
  const [progress, setProgress] = useState(null)
  const [results, setResults] = useState([])
  const [created, setCreated] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('classes').select('id, name, subjects(name)').order('name').then(({ data }) => setClasses(data || []))
  }, [])

  function matchClass(label) {
    const n = norm(label)
    const full = classes.filter((c) => norm(`${c.subjects?.name} - ${c.name}`) === n)
    if (full.length === 1) return { id: full[0].id }
    const byName = classes.filter((c) => norm(c.name) === n)
    if (byName.length === 1) return { id: byName[0].id }
    return { error: byName.length > 1 ? `"${label}" matches more than one class. Use "Subject – Class".` : `Class "${label}" was not found` }
  }

  function readFile(e) {
    setError(''); setResults([]); setCreated([]); setProgress(null)
    const f = e.target.files[0]
    if (!f) return
    setFileName(f.name)
    const reader = new FileReader()
    reader.onload = () => {
      const table = parseCSV(String(reader.result))
      if (table.length < 2) { setRows(null); return setError('The file has no data rows.') }
      const head = table[0].map((h) => h.trim().toLowerCase())
      if (!head.includes('student_name')) { setRows(null); return setError('The first row must contain the column names (at least "student_name"). Download the template to see them.') }
      const get = (r, k) => (r[head.indexOf(k)] || '').trim()
      setRows(table.slice(1).map((r, i) => {
        const labels = get(r, 'class').split(';').map((x) => x.trim()).filter(Boolean)
        const matched = labels.map(matchClass)
        const problems = []
        const warnings = []
        if (!get(r, 'student_name')) problems.push('Student name is missing')
        if (get(r, 'student_email') && !EMAIL.test(get(r, 'student_email'))) problems.push('Student email looks wrong')
        if (get(r, 'parent_email') && !EMAIL.test(get(r, 'parent_email'))) problems.push('Parent email looks wrong')
        if ((get(r, 'parent_name') || get(r, 'parent_phone')) && !get(r, 'parent_email')) warnings.push('No parent email, so no parent account')
        matched.forEach((m) => m.error && problems.push(m.error))
        return {
          n: i + 2, problems, warnings,
          data: {
            student_name: get(r, 'student_name'), student_email: get(r, 'student_email') || null, student_phone: get(r, 'student_phone') || null,
            parent_name: get(r, 'parent_name') || null, parent_email: get(r, 'parent_email') || null, parent_phone: get(r, 'parent_phone') || null,
            class_ids: matched.filter((m) => m.id).map((m) => m.id),
          },
        }
      }))
    }
    reader.readAsText(f)
  }

  const good = rows?.filter((r) => r.problems.length === 0) || []
  const bad = rows?.filter((r) => r.problems.length > 0) || []

  async function run() {
    if (!window.confirm(`Import ${good.length} student${good.length === 1 ? '' : 's'}? Accounts will be created now.`)) return
    setError(''); setResults([]); setCreated([])
    const allResults = [], allCreated = []
    try {
      for (let i = 0; i < good.length; i += 20) {
        setProgress(`Importing ${Math.min(i + 20, good.length)} of ${good.length}…`)
        const out = await api('/admin/import', { method: 'POST', body: { rows: good.slice(i, i + 20).map((r) => r.data) } })
        allResults.push(...out.results); allCreated.push(...out.created)
        setResults([...allResults]); setCreated([...allCreated])
      }
      setProgress('Finished.')
    } catch (e) {
      setError(`${e.message} (${allResults.length} rows were done before this stopped. Check the results, then upload the rest again. Rows that already exist are skipped safely.)`)
      setProgress(null)
    }
  }

  const credentials = () => downloadCSV('new-accounts.csv', ['role', 'name', 'email', 'temporary password'], created.map((c) => [c.role, c.name, c.email, c.password]))

  return (
    <>
      <h2>Import students and parents</h2>
      <p className="muted">Upload a spreadsheet (saved as CSV) to create many students, their parents and their class enrollments at once.</p>

      <section className="panel">
        <h3>1. Prepare the file</h3>
        <p>Columns: <code>{HEADERS.join(', ')}</code></p>
        <ul className="plain small-text">
          <li><strong>student_name</strong> is required. Everything else is optional.</li>
          <li><strong>student_email</strong> can be empty for children without an email. The student then logs in with a made-up address, which you can hand out from the download in step 3.</li>
          <li><strong>parent_email</strong> creates the parent account and links it to the child. Brothers and sisters with the same parent email share one parent account.</li>
          <li><strong>class</strong> is written like <em>ICT – Grade 10 Evening</em> (Subject – Class). Use <em>;</em> between several classes. The classes must already exist.</li>
          <li>Running the same file again is safe. People who already exist are re-used, not duplicated.</li>
        </ul>
        <button className="ghost small" onClick={() => downloadCSV('wings-import-template.csv', HEADERS, EXAMPLE)}>Download the template</button>
      </section>

      <section className="panel">
        <h3>2. Check the file</h3>
        <label>Choose your CSV file <input type="file" accept=".csv,text/csv" onChange={readFile} /></label>
        {error && <p className="error">{error}</p>}
        {rows && (
          <>
            <p><strong>{fileName}</strong>: {rows.length} rows. <span className="ok">{good.length} ready</span>{bad.length > 0 && <>, <span className="error">{bad.length} with problems (they will be skipped)</span></>}.</p>
            {bad.length > 0 && (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Row</th><th>Student</th><th>Problem</th></tr></thead>
                  <tbody>{bad.map((r) => <tr key={r.n}><td>{r.n}</td><td>{r.data.student_name || '—'}</td><td>{r.problems.join('; ')}</td></tr>)}</tbody>
                </table>
              </div>
            )}
            {good.some((r) => r.warnings.length) && <p className="muted small-text">Notes: {good.filter((r) => r.warnings.length).length} rows have no parent email, so only the student will be created.</p>}
            {good.length > 0 && <p><button onClick={run} disabled={progress && progress !== 'Finished.'}>Import {good.length} student{good.length === 1 ? '' : 's'}</button></p>}
          </>
        )}
      </section>

      {(progress || results.length > 0) && (
        <section className="panel">
          <h3>3. Results</h3>
          {progress && <p className="muted">{progress}</p>}
          {created.length > 0 && (
            <p>
              <strong>{created.length}</strong> new login{created.length === 1 ? '' : 's'} created.{' '}
              <button className="small" onClick={credentials}>Download logins and temporary passwords</button>
              <span className="muted small-text"> Keep this file private, and delete it once the passwords are handed out. Parents with a real email can also use "Forgot password" on the login page.</span>
            </p>
          )}
          <div className="table-wrap">
            <table>
              <thead><tr><th>Student</th><th>Result</th></tr></thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i}>
                    <td>{r.name}</td>
                    <td><span className={`tag ${r.status === 'ok' ? 'st-present' : r.status === 'warning' ? 'st-late' : 'st-absent'}`}>{r.status}</span> {r.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  )
}
