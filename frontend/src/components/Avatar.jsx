import { useEffect, useState } from 'react'
import { avatarUrl } from '../lib/avatar'

const initials = (name) =>
  (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?'

// A round photo, or the person's initials when there is no photo yet.
export default function Avatar({ path, name, size = 40 }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    let live = true
    setUrl(null)
    avatarUrl(path).then((u) => live && setUrl(u))
    return () => { live = false }
  }, [path])

  const box = { width: size, height: size }
  return url
    ? <img className="avatar" src={url} alt="" style={box} />
    : <span className="avatar initials" style={{ ...box, fontSize: Math.round(size * 0.4) }} aria-hidden="true">{initials(name)}</span>
}
