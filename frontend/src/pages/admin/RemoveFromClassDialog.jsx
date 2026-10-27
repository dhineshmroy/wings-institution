import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { removeFiles } from '../../lib/storageCleanup'
import { Alert, Modal, Spinner } from '../../components/ui'

export default function RemoveFromClassDialog({ classLabel, student, classId, onClose, onDone }) {
  const [mode, setMode] = useState('keep')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function confirm() {
    setBusy(true); setError('')
    const { data, error } = await supabase.rpc('remove_from_class', { p_class: classId, p_student: student.id, p_delete_records: mode === 'delete' })
    if (error) { setBusy(false); return setError(error.message) }
    await removeFiles('submissions', data.files)
    const gone = data.attendance + data.submissions + data.quiz_attempts + data.exam_marks + data.absence_notices
    onDone(mode === 'delete'
      ? `${student.name} was removed from the class and ${gone} record${gone === 1 ? '' : 's'} in it were deleted.`
      : `${student.name} was removed from the class. Their history was kept.`)
  }

  return (
    <Modal title={`Remove ${student.name}?`} onClose={onClose}>
      <p className="muted" style={{ marginTop: '0.5rem' }}>From {classLabel}.</p>
      <div className="choice-list" role="radiogroup">
        <label className={`choice ${mode === 'keep' ? 'on' : ''}`}>
          <input type="radio" name="mode" checked={mode === 'keep'} onChange={() => setMode('keep')} />
          <span><strong>Remove from the class only</strong><small>Their attendance, marks and assignments stay in the system.</small></span>
        </label>
        <label className={`choice ${mode === 'delete' ? 'on' : ''}`}>
          <input type="radio" name="mode" checked={mode === 'delete'} onChange={() => setMode('delete')} />
          <span><strong>Remove and delete their records in this class</strong><small>Deletes their attendance, assignment submissions, quiz attempts and exam marks for this class. Fee invoices are not touched.</small></span>
        </label>
      </div>
      <Alert>{error}</Alert>
      <div className="form-actions" style={{ marginTop: '1rem' }}>
        <button className={mode === 'delete' ? 'danger' : ''} onClick={confirm} disabled={busy}>{busy ? <><Spinner /> Working…</> : mode === 'delete' ? 'Remove and delete records' : 'Remove from class'}</button>
        <button className="ghost" onClick={onClose} disabled={busy}>Cancel</button>
      </div>
    </Modal>
  )
}
