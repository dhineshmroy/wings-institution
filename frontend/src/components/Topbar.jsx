import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, LogOut, Menu, Moon, Sun } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { currentTheme, toggleTheme } from '../lib/theme'
import Avatar from './Avatar'
import BrandMark from './BrandMark'

const TITLES = { admin: 'Administration', teacher: 'Teacher portal', student: 'Student portal', parent: 'Parent portal' }

export default function Topbar({ onMenu }) {
  const { profile, signOut } = useAuth()
  const [unread, setUnread] = useState(0)
  const [theme, setTheme] = useState(currentTheme())

  useEffect(() => {
    async function count() {
      const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null)
      setUnread(count || 0)
    }
    count()
    const timer = setInterval(count, 60000)
    window.addEventListener('notifications-changed', count)
    return () => { clearInterval(timer); window.removeEventListener('notifications-changed', count) }
  }, [])

  const name = profile?.full_name || profile?.email || 'User'

  return (
    <header className="topbar">
      <button className="icon-btn menu-btn" onClick={onMenu} aria-label="Open the menu"><Menu size={22} /></button>
      <span className="topbar-logo"><BrandMark size={46} variant={theme === 'dark' ? 'light' : 'color'} title="Wings Institution" /></span>
      <span className="topbar-title">{TITLES[profile?.role] || 'Wings Institution'}</span>
      <div className="topbar-right">
        <button className="icon-btn" onClick={() => setTheme(toggleTheme())} aria-label={theme === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme'} title="Light or dark">
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <Link className="icon-btn bell" to={`/${profile?.role}/notifications`} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} title="Notifications">
          <Bell size={20} />
          {unread > 0 && <span className="badge">{unread > 99 ? '99+' : unread}</span>}
        </Link>
        <Link className="who" to={`/${profile?.role}/profile`} title="My profile">
          <Avatar path={profile?.avatar_path} name={profile?.full_name} size={32} />
          <span className="who-text"><strong>{name}</strong><em className="role-badge">{profile?.role}</em></span>
        </Link>
        <button className="icon-btn" onClick={signOut} aria-label="Log out" title="Log out"><LogOut size={20} /></button>
      </div>
    </header>
  )
}
