import { supabase } from './supabaseClient'

export const MAX_MB = 50
export const safeName = (n) => n.replace(/[^a-zA-Z0-9._-]/g, '_')

export function checkFile(file) {
  if (file.size > MAX_MB * 1024 * 1024) {
    return `That file is larger than ${MAX_MB} MB. For long videos, upload to YouTube as "Unlisted" and paste the link instead.`
  }
  return ''
}

// Opens a private file using a temporary link (valid for 1 hour).
export async function openFile(bucket, path) {
  const w = window.open('', '_blank') // open first so the browser does not block the popup
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600)
  if (error || !data) {
    w?.close()
    alert('Could not open the file: ' + (error?.message || 'unknown error'))
    return
  }
  if (w) w.location.href = data.signedUrl
  else window.location.href = data.signedUrl
}

export const openLink = (url) => window.open(url, '_blank', 'noopener')
