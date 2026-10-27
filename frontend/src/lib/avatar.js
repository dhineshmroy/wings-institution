import { supabase } from './supabaseClient'

const SIZE = 256

// Crops the middle square of the picture and shrinks it to a small JPEG (about 20-40 KB).
export async function resizeToBlob(file, size = SIZE) {
  let bitmap
  try { bitmap = await createImageBitmap(file) }
  catch { throw new Error('That picture could not be read. Please use a JPG or PNG photo.') }
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size
  canvas.getContext('2d').drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size)
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
  if (!blob) throw new Error('That picture could not be prepared.')
  return blob
}

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(blob)
})
const dataUrlToBlob = async (url) => (await fetch(url)).blob()

// Uploads a photo for a person (yourself, or your child as a parent) and removes their old one.
export async function uploadAvatar(userId, file, oldPath = null) {
  const blob = await resizeToBlob(file)
  const path = `${userId}/${Date.now()}.jpg`
  const up = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg' })
  if (up.error) throw new Error(up.error.message)
  const { error } = await supabase.rpc('set_avatar', { p_user: userId, p_path: path })
  if (error) throw new Error(error.message)
  if (oldPath) await supabase.storage.from('avatars').remove([oldPath])
  cache.delete(oldPath)
  return path
}

export async function removeAvatar(userId, oldPath) {
  const { error } = await supabase.rpc('set_avatar', { p_user: userId, p_path: null })
  if (error) throw new Error(error.message)
  if (oldPath) await supabase.storage.from('avatars').remove([oldPath])
  cache.delete(oldPath)
}

// ---- a photo chosen on the sign-up page when nobody is logged in yet (email still to be confirmed) ----
const pendingKey = (email) => `wings_pending_avatar:${String(email).toLowerCase()}`

export async function stashPendingAvatar(email, file) {
  const blob = await resizeToBlob(file)
  localStorage.setItem(pendingKey(email), await blobToDataUrl(blob))
}

// Called after a person logs in for the first time. Returns true if a photo was uploaded.
export async function applyPendingAvatar(userId, email) {
  try {
    const key = pendingKey(email || '')
    const url = localStorage.getItem(key)
    if (!url) return false
    const blob = await dataUrlToBlob(url)
    await uploadAvatar(userId, blob)
    localStorage.removeItem(key)
    return true
  } catch { return false }
}

// ---- temporary links to private photos, remembered for 50 minutes ----
const cache = new Map()
export function avatarUrl(path) {
  if (!path) return Promise.resolve(null)
  const hit = cache.get(path)
  if (hit && hit.exp > Date.now()) return hit.promise
  const promise = supabase.storage.from('avatars').createSignedUrl(path, 3600).then(({ data }) => data?.signedUrl || null)
  cache.set(path, { promise, exp: Date.now() + 50 * 60 * 1000 })
  return promise
}
