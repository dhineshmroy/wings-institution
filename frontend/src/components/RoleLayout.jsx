import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Award, Baby, BarChart3, BookOpen, Calendar, CalendarDays, CalendarX, Circle, ClipboardCheck, ClipboardList, CreditCard,
  FileText, FolderOpen, GraduationCap, HelpCircle, Layers, LayoutDashboard, LineChart, Link2, Megaphone, MessageCircle,
  Mail, Star, TrendingUp, Upload, UserCheck, UserPlus, Users, Wallet,
} from 'lucide-react'
import Topbar from './Topbar'

const ICONS = {
  home: LayoutDashboard, users: Users, import: Upload, subjects: BookOpen, classes: Layers, enrollments: UserPlus,
  links: Link2, timetable: CalendarDays, schedule: CalendarDays, checkin: UserCheck, attendance: ClipboardCheck,
  materials: FolderOpen, assignments: FileText, quizzes: HelpCircle, performance: LineChart, exams: GraduationCap,
  progress: TrendingUp, certificates: Award, fees: Wallet, payments: CreditCard, reports: BarChart3,
  announcements: Megaphone, messages: MessageCircle, calendar: Calendar, grades: Star, absence: CalendarX,
  child: Baby, overview: ClipboardList, emaillog: Mail,
}

// links: [{ to, text, icon, group?, end? }]. Links without a group sit at the top.
export default function RoleLayout({ links }) {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => setOpen(false), [pathname])

  const groups = []
  links.forEach((l) => {
    const name = l.group || ''
    let g = groups.find((x) => x.name === name)
    if (!g) { g = { name, items: [] }; groups.push(g) }
    g.items.push(l)
  })

  return (
    <div className={`app ${open ? 'menu-open' : ''}`}>
      <aside className="sidebar" aria-label="Main navigation">
        <div className="brand">
          <img className="brand-logo" src="/logo/wings-logo-horizontal-light.svg" alt="Wings Institution" />
        </div>
        <nav>
          {groups.map((g) => (
            <div className="nav-group" key={g.name || 'top'}>
              {g.name && <p className="nav-title">{g.name}</p>}
              {g.items.map((l) => {
                const Icon = ICONS[l.icon] || Circle
                return (
                  <NavLink key={l.to} to={l.to} end={l.end} className="nav-link">
                    <Icon size={18} aria-hidden="true" />
                    <span>{l.text}</span>
                  </NavLink>
                )
              })}
            </div>
          ))}
        </nav>
      </aside>
      {open && <button className="scrim" aria-label="Close menu" onClick={() => setOpen(false)} />}
      <div className="main-col">
        <Topbar onMenu={() => setOpen(true)} />
        <main className="content wide">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
