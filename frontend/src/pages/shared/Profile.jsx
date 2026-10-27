import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import Avatar from '../../components/Avatar'
import { removeAvatar, uploadAvatar } from '../../lib/avatar'

export default function Profile() {
  const { profile, session, reloadProfile, updatePassword } = useAuth()
  const [name, setName] = useState(profile.full_name || '')
  const [phone, setPhone] = useState(profile.phone || '')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [pwMsg, setPwMsg] = useState('')
  const [pwError, setPwError] = useState('')
  const [photoMsg, setPhotoMsg] = useState('')
  const [photoError, setPhotoError] = useState('')
  const [photoBusy, setPhotoBusy] = useState(false)

  async function changePhoto(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    setPhotoMsg(''); setPhotoError(''); setPhotoBusy(true)
    try { await uploadAvatar(profile.id, file, profile.avatar_path); await reloadProfile(); setPhotoMsg('Your photo was updated.') }
    catch (err) { setPhotoError(err.message) }
    setPhotoBusy(false)
  }

  async function dropPhoto() {
    setPhotoMsg(''); setPhotoError(''); setPhotoBusy(true)
    try { await removeAvatar(profile.id, profile.avatar_path); await reloadProfile(); setPhotoMsg('Your photo was removed.') }
    catch (err) { setPhotoError(err.message) }
    setPhotoBusy(false)
  }

  async function save(e) {
    e.preventDefault(); setMsg(''); setError('')
    const { error } = await supabase.from('profiles').update({ full_name: name.trim(), phone: phone.trim() || null }).eq('id', profile.id)
    if (error) return setError(error.message)
    await reloadProfile(); setMsg('Your details were saved.')
  }

  async function changePassword(e) {
    e.preventDefault(); setPwMsg(''); setPwError('')
    if (pw.length < 8) return setPwError('The password must be at least 8 characters.')
    if (pw !== pw2) return setPwError('The two passwords do not match.')
    const { error } = await updatePassword(pw)
    if (error) return setPwError(error.message)
    setPw(''); setPw2(''); setPwMsg('Your password was changed.')
  }

  return (
    <>
      <h2>My profile</h2>

      <section className="panel narrow-panel">
        <h3>Photo</h3>
        <div className="photo-row">
          <Avatar path={profile.avatar_path} name={profile.full_name} size={96} />
          <div>
            <label className="file-label">Choose a new photo
              <input type="file" accept="image/*" onChange={changePhoto} disabled={photoBusy} />
            </label>
            {profile.avatar_path && <p><button type="button" className="ghost small" onClick={dropPhoto} disabled={photoBusy}>Remove photo</button></p>}
            <p className="muted small-text">A clear face photo works best. It is made square and small automatically.</p>
          </div>
        </div>
        {photoBusy && <p className="muted">Saving…</p>}
        {photoError && <p className="error">{photoError}</p>}
        {photoMsg && <p className="ok">{photoMsg}</p>}
      </section>

      <section className="panel narrow-panel">
        <h3>My details</h3>
        <form onSubmit={save}>
          <label>Full name <input value={name} onChange={(e) => setName(e.target.value)} required /></label>
          <label>Phone <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
          <label>Email <input value={profile.email || session?.user?.email || ''} disabled /></label>
          <label>Role <input value={profile.role} disabled /></label>
          {error && <p className="error">{error}</p>}
          {msg && <p className="ok">{msg}</p>}
          <div><button>Save details</button></div>
        </form>
      </section>

      <section className="panel narrow-panel">
        <h3>Change password</h3>
        <form onSubmit={changePassword}>
          <label>New password <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" required /></label>
          <label>Type it again <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" required /></label>
          {pwError && <p className="error">{pwError}</p>}
          {pwMsg && <p className="ok">{pwMsg}</p>}
          <div><button>Change password</button></div>
        </form>
      </section>
    </>
  )
}
