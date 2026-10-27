import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Missing Supabase settings. Check frontend/.env')
}

export const supabase = createClient(url, key)
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
