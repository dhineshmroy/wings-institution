import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

// Loads all profiles (admin only: other roles will only get their own rows).
export function useProfiles() {
  const [profiles, setProfiles] = useState([])
  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, full_name, email, phone, role, avatar_path')
      .order('full_name')
      .then(({ data }) => setProfiles(data || []))
  }, [])
  return profiles
}

export const label = (p) => (p ? p.full_name || p.email || p.id.slice(0, 8) : '—')
