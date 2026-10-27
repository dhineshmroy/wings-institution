import { supabase } from './supabaseClient'

// Removes uploaded files (photos, assignment files, bank slips) in small batches.
export async function removeFiles(bucket, paths) {
  const list = (paths || []).filter(Boolean)
  for (let i = 0; i < list.length; i += 50) {
    await supabase.storage.from(bucket).remove(list.slice(i, i + 50))
  }
}
