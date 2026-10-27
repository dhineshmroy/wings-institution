import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { openFile, openLink } from '../../lib/files'

export default function MaterialsList() {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('materials').select('*, classes(id, name, subjects(name))').order('created_at', { ascending: false })
      .then(({ data, error }) => (error ? setError(error.message) : setItems(data)))
  }, [])

  const groups = {}
  items?.forEach((m) => {
    const key = m.classes?.id
    groups[key] ||= { name: `${m.classes?.subjects?.name} – ${m.classes?.name}`, list: [] }
    groups[key].list.push(m)
  })

  return (
    <>
      <h2>Learning materials</h2>
      <p className="muted">Notes, videos and resources from your teachers.</p>
      {error && <p className="error">{error}</p>}
      {items && items.length === 0 && <p className="empty">Nothing has been shared with you yet.</p>}
      {Object.values(groups).map((g) => (
        <section className="panel" key={g.name}>
          <h3>{g.name}</h3>
          <ul className="plain">
            {g.list.map((m) => (
              <li key={m.id} className="row-between">
                <span>
                  <strong>{m.title}</strong> <span className="tag">{m.kind === 'file' ? 'File' : 'Link'}</span>
                  {m.description && <div className="muted small-text">{m.description}</div>}
                </span>
                <button className="ghost small" onClick={() => (m.kind === 'file' ? openFile('materials', m.file_path) : openLink(m.url))}>Open</button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}
