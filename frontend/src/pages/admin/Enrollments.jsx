import { useEffect, useState } from 'react'
import { GraduationCap, Layers, Trash2, UserPlus } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useProfiles, label } from '../../lib/useProfiles'
import Avatar from '../../components/Avatar'
import RemoveFromClassDialog from './RemoveFromClassDialog'
import { Alert, EmptyState, Field, FormCard, PageHeader } from '../../components/ui'

export default function Enrollments() {
  const profiles = useProfiles()
  const students = profiles.filter((p) => p.role === 'student')
  const [classes, setClasses] = useState([])
  const [classId, setClassId] = useState('')
  const [enrolled, setEnrolled] = useState([])
  const [studentId, setStudentId] = useState('')
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [removing, setRemoving] = useState(null)

  useEffect(() => {
    supabase.from('classes').select('id, name, capacity, subjects(name)').eq('active', true).order('name')
      .then(({ data }) => setClasses(data || []))
  }, [])

  async function loadEnrolled(id) {
    if (!id) return setEnrolled([])
    const { data, error } = await supabase.from('enrollments').select('id, student_id, enrolled_at').eq('class_id', id)
    if (error) setError(error.message); else setEnrolled(data)
  }
  useEffect(() => { loadEnrolled(classId) }, [classId])

  async function add(e) {
    e.preventDefault()
    setError('')
    const { error } = await supabase.from('enrollments').insert({ class_id: classId, student_id: studentId })
    if (error) return setError(error.code === '23505' ? 'That student is already in this class.' : error.message)
    setStudentId(''); loadEnrolled(classId)
  }

  const selected = classes.find((c) => c.id === classId)
  const enrolledIds = new Set(enrolled.map((e) => e.student_id))
  const available = students.filter((s) => !enrolledIds.has(s.id))
  const byId = Object.fromEntries(profiles.map((p) => [p.id, p]))
  const cap = selected?.capacity
  const pct = cap ? Math.min(100, Math.round((enrolled.length / cap) * 100)) : null

  return (
    <>
      <PageHeader icon={UserPlus} title="Enrollments" subtitle="Choose a class, then add or remove its students." />

      <FormCard icon={Layers} title="Choose a class">
        <Field label="Class" icon={Layers} className="narrow-field">
          <select value={classId} onChange={(e) => { setClassId(e.target.value); setError('') }}>
            <option value="">Choose a class…</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.subjects?.name} – {c.name}</option>)}
          </select>
        </Field>
      </FormCard>

      <Alert>{error}</Alert>
      <Alert type="ok">{msg}</Alert>

      {!classId && <EmptyState icon={GraduationCap} title="Pick a class to begin" text="You will see who is in it and can add more students." />}

      {classId && (
        <>
          <section className="panel">
            <div className="row-between">
              <h3>{selected?.subjects?.name} – {selected?.name}</h3>
              <strong>{enrolled.length}{cap ? ` of ${cap}` : ''} student{enrolled.length === 1 ? '' : 's'}</strong>
            </div>
            {pct !== null && <div className={`progress ${pct >= 100 ? 'full' : pct >= 80 ? 'near' : ''}`} style={{ marginTop: '0.75rem' }} role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100"><i style={{ width: `${pct}%` }} /></div>}
            {pct !== null && pct >= 100 && <p className="small-text muted" style={{ margin: '0.5rem 0 0' }}>This class is full.</p>}
          </section>

          <FormCard icon={UserPlus} title="Add a student to this class">
            <form onSubmit={add}>
              <div className="form-grid">
                <Field label="Student" icon={GraduationCap}>
                  <select value={studentId} onChange={(e) => setStudentId(e.target.value)} required>
                    <option value="">Choose a student…</option>
                    {available.map((s) => <option key={s.id} value={s.id}>{label(s)}{s.email ? ` (${s.email})` : ''}</option>)}
                  </select>
                </Field>
              </div>
              <div className="form-actions"><button><UserPlus size={18} aria-hidden="true" /> Enroll</button></div>
            </form>
          </FormCard>

          {enrolled.length === 0
            ? <EmptyState icon={GraduationCap} title="No students in this class yet" text="Use the form above to add the first one." />
            : (
              <div className="roster">
                {enrolled.map((e) => {
                  const s = byId[e.student_id]
                  return (
                    <div className="roster-card" key={e.id}>
                      <span className="person">
                        <Avatar path={s?.avatar_path} name={s?.full_name} size={42} />
                        <span className="person-text"><strong>{label(s)}</strong><small>Joined {new Date(e.enrolled_at).toLocaleDateString()}</small></span>
                      </span>
                      <button className="danger small" onClick={() => setRemoving({ id: e.student_id, name: label(s) })} aria-label={`Remove ${label(s)}`}><Trash2 size={15} aria-hidden="true" /></button>
                    </div>
                  )
                })}
              </div>
            )}
        </>
      )}
      {removing && (
        <RemoveFromClassDialog classId={classId} classLabel={`${selected?.subjects?.name} – ${selected?.name}`} student={removing}
          onClose={() => setRemoving(null)} onDone={(m) => { setRemoving(null); setMsg(m); loadEnrolled(classId) }} />
      )}
    </>
  )
}
