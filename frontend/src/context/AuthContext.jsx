import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { applyPendingAvatar } from '../lib/avatar'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (error) console.error('Could not load profile:', error.message)
    setProfile(data ?? null)
    // a photo chosen on the sign-up page is saved the first time the person logs in
    if (data && !data.avatar_path) applyPendingAvatar(data.id, data.email).then((saved) => { if (saved) loadProfile(userId) })
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      if (data.session) await loadProfile(data.session.user.id)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (newSession) {
        // defer to avoid calling Supabase inside its own auth callback
        setTimeout(() => loadProfile(newSession.user.id), 0)
      } else {
        setProfile(null)
      }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const value = {
    session,
    profile,
    loading,
    reloadProfile: () => (session ? loadProfile(session.user.id) : null),
    signUp: ({ email, password, fullName, phone, role, parent }) =>
      supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, phone, role, parent_name: parent?.name, parent_email: parent?.email, parent_phone: parent?.phone } },
      }),
    signIn: ({ email, password }) => supabase.auth.signInWithPassword({ email, password }),
    signOut: () => supabase.auth.signOut(),
    sendReset: (email) =>
      supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      }),
    updatePassword: (password) => supabase.auth.updateUser({ password }),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
