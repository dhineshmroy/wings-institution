import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { parseCSV } from '../../lib/csv'
import { num } from '../../lib/grades'

export default function ExamMarksEntry({ exam, onSaved }) {
  const [roster, setRoster] = useState([])
  const [existing, setExisting] = useState({})
  const [vals, setVals] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  async function load() {
    const [r, m] = await Promise.all([
      supabase.from('enrollments').select('student_id, student:profiles!enrollments_student_id_fkey(full_name, email)').eq('class_id', exam.class_id),
      supabase.from('exam_marks').select('id, student_id, marks, absent, remarks').eq('exam_id', exam.id),
    ])
    if (r.error || m.error) return setError((r.error || m.error).message)
    const ex = Object.fromEntries(m.data.map((x) => [x.student_id, x]))
    setRoster(r.data.sort((a, b) => (a.student?.full_name || '').localeCompare(b.student?.full_name || '')))
    setExisting(ex)
    setVals(Object.fromEntries(r.data.map((s) => [s.student_id, {
      marks: ex[s.student_id]?.marks != null ? num(ex[s.student_id].marks) : '',
      absent: !!ex[s.student_id]?.absent,
      remarks: ex[s.student_id]?.remarks || '',
    }])))
  }
  useEffect(() => { load() }, [exam.id])

  const set = (id, patch) => setVals({ ...vals, [id]: { ...vals[id], ...patch } })

  function fromCSV(e) {
    setError(''); setMsg('')
    const f = e.target.files[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      const t = parseCSV(String(reader.result))
      const head = (t[0] || []).map((h) => h.trim().toLowerCase())
      const ei = head.indexOf('email'), mi = head.indexOf('marks')
      if (ei < 0 || mi < 0) return setError('The first row of the file must have the columns "email" and "marks".')
      const byEmail = Object.fromEntries(roster.map((r) => [(r.student?.email || '').toLowerCase(), r.student_id]))
      const next = { ...vals }
      let hit = 0; const missed = []
      t.slice(1).forEach((row) => {
        const id = byEmail[(row[ei] || '').trim().toLowerCase()]
        if (!id) return missed.push(row[ei] || '(blank)')
        const v = (row[mi] || '').trim()
        next[id] = /^ab/i.test(v) ? { ...next[id], absent: true, marks: '' } : { ...next[id], absent: false, marks: v }
        hit++
      })
      setVals(next)
      setMsg(`${hit} marks filled in from the file. Check them below, then press Save.${missed.length ? ` ${missed.length} email(s) were not in this class: ${missed.slice(0, 5).join(', ')}${missed.length > 5 ? '…' : ''}` : ''}`)
    }
    reader.readAsText(f)
    e.target.value = ''
  }

  async function save() {
    setError(''); setMsg('')
    const max = Number(exam.max_marks)
    const rows = [], remove = []
    for (const r of roster) {
      const v = vals[r.student_id]
      const has = v.absent || v.marks !== ''
      if (!has) { if (existing[r.student_id]) remove.push(existing[r.student_id].id); continue }
      if (!v.absent) {
        const n = Number(v.marks)
        if (Number.isNaN(n) || n < 0 || n > max) return setError(`${r.student?.full_name}: marks must be a number from 0 to ${num(max)}.`)
      }
      rows.push({ exam_id: exam.id, student_id: r.student_id, marks: v.absent ? null : Number(v.marks), absent: v.absent, remarks: v.remarks.trim() || null })
    }
    setBusy(true)
    if (rows.length) {
      const { error } = await supabase.from('exam_marks').upsert(rows, { onConflict: 'exam_id,student_id' })
      if (error) { setBusy(false); return setError(error.message) }
    }
    if (remove.length) {
      const { error } = await supabase.from('exam_marks').delete().in('id', remove)
      if (error) { setBusy(false); return setError(error.message) }
    }
    setBusy(false)
    setMsg(`${rows.length} mark${rows.length === 1 ? '' : 's'} saved. Students and parents are notified of every new or changed mark.`)
    load(); onSaved?.()
  }

  const entered = roster.filter((r) => vals[r.student_id]?.absent || vals[r.student_id]?.marks !== '').length

  return (
    <section className="panel">
      <h3>Enter marks: {exam.title}</h3>
      <p className="muted">Out of {num(exam.max_marks)}. Leave a student blank if there is no result yet. Saving sends a notification to the student and parents.</p>
      <p className="muted small-text">{entered} of {roster.length} students have a result.</p>
      <label className="narrow">Fill from a CSV file (columns: email, marks. Write "absent" for absent students.)
        <input type="file" accept=".csv,text/csv" onChange={fromCSV} />
      </label>
      {error && <p className="error">{error}</p>}
      {msg && <p className="ok">{msg}</p>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Student</th><th>Marks</th><th>Absent</th><th>Remarks (optional)</th></tr></thead>
          <tbody>
            {roster.map((r) => {
              const v = vals[r.student_id] || {}
              return (
                <tr key={r.student_id}>
                  <td>{r.student?.full_name || 'Student'}</td>
                  <td><input className="marks-input" type="number" min="0" max={exam.max_marks} step="0.01" value={v.marks ?? ''} disabled={v.absent}
                    onChange={(e) => set(r.student_id, { marks: e.target.value })} aria-label={`Marks for ${r.student?.full_name}`} /></td>
                  <td><input type="checkbox" checked={!!v.absent} onChange={(e) => set(r.student_id, { absent: e.target.checked, marks: e.target.checked ? '' : v.marks })} aria-label={`${r.student?.full_name} was absent`} /></td>
                  <td><input value={v.remarks ?? ''} onChange={(e) => set(r.student_id, { remarks: e.target.value })} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {roster.length === 0 && <p className="empty">No students are enrolled in this class.</p>}
      </div>
      {roster.length > 0 && <p><button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save marks'}</button></p>}
    </section>
  )
}
