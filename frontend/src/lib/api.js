import { supabase, API_URL } from './supabaseClient'

// Calls the Python backend as the logged-in user. The backend checks they are an admin.
export async function api(path, { method = 'GET', body } = {}) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  let res
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('Could not reach the Wings backend. Is it running (uvicorn main:app --reload) and is VITE_API_URL in frontend/.env correct?')
  }
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(typeof json.detail === 'string' ? json.detail : `Request failed (${res.status})`)
  return json
}
