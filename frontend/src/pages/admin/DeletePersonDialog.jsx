import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { removeFiles } from '../../lib/storageCleanup'
import { fmtMoney } from '../../lib/money'
import { Alert, Field, Modal, Spinner } from '../../components/ui'

export default function DeletePersonDialog({ user, onClose, onDone }) {
  const [sum, setSum] = useState(null)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const word = (user.full_name || '').trim() || 'DELETE'

  useEffect(() => {
    supabase.rpc('person_data_summary', { p_user: user.id }).then(({ data, error }) => (error ? setError(error.message) : setSum(data)))
  }, [user.id])

  const n = (k) => Number(sum?.[k] || 0)
  const lines = !sum ? [] : [
    [n('enrollments'), 'class enrollments'], [n('attendance'), 'attendance records'], [n('submissions'), 'assignment submissions and grades'],
    [n('quiz_attempts'), 'quiz attempts'], [n('exam_marks'), 'exam marks'], [n('certificates'), 'certificates'],
    [n('invoices'), `fee invoices (${n('payments')} payments, ${fmtMoney(n('paid_total'))} paid, with their receipts)`],
    [n('messages'), 'messages'], [n('parents'), 'links to parents (the parents themselves stay)'],
    [n('children'), 'links to children (the children themselves stay)'], [n('classes_taught'), 'classes they teach (the classes stay, with no teacher)'],
  ].filter(([c]) => c > 0)

  async function confirm() {
    setBusy(true); setError('')
    const { data, error } = await supabase.rpc('delete_person', { p_user: user.id })
    if (error) { setBusy(false); return setError(error.message) }
    await removeFiles('avatars', data.avatars)
    await removeFiles('submissions', data.submissions)
    await removeFiles('payment-slips', data.slips)
    onDone(`${word === 'DELETE' ? 'The person' : word} and all their records were deleted.`)
  }

  const ok = typed.trim().toLowerCase() === word.toLowerCase()

  return (
    <Modal title={`Delete ${user.full_name || user.email}?`} onClose={onClose}>
      <p className="muted" style={{ marginTop: '0.5rem' }}>This permanently deletes the login and everything linked to it. It cannot be undone.</p>
      {!sum && !error && <p className="muted">Counting what will be deleted…</p>}
      {sum && (
        <>
          <p style={{ marginBottom: '0.3rem' }}><strong>Will be deleted for this {sum.role}:</strong></p>
          {lines.length === 0 ? <p className="muted">Only the account and profile (nothing else is linked).</p>
            : <ul className="summary-list">{lines.map(([c, t]) => <li key={t}><strong>{c}</strong> {t}</li>)}</ul>}
          {n('invoices') > 0 && <Alert type="warn">Fee records and receipts are deleted too, so your income reports will change. If this person has only left, <strong>Deactivate</strong> keeps the records and blocks the login.</Alert>}
          <Field label={`To confirm, type: ${word}`}><input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus autoComplete="off" /></Field>
        </>
      )}
      <Alert>{error}</Alert>
      <div className="form-actions" style={{ marginTop: '1rem' }}>
        <button className="danger" disabled={!ok || busy || !sum} onClick={confirm}>{busy ? <><Spinner /> Deleting…</> : <><Trash2 size={16} aria-hidden="true" /> Delete permanently</>}</button>
        <button className="ghost" onClick={onClose} disabled={busy}>Cancel</button>
      </div>
    </Modal>
  )
}
