import { useEffect, useId, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Award, Bell, Calendar, GraduationCap, HelpCircle, Megaphone, MessageCircle, Rocket, Star, TrendingDown, TrendingUp, UserCheck, UserPlus, UserX, Wallet } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { clamp, niceMax, timeAgo } from '../lib/dash'

export const COLORS = { blue: '#3B72FF', teal: '#14B8A6', gold: '#F5A524', rose: '#E5487A', violet: '#8B6CF0' }
const gid = (id) => String(id).replace(/[^a-zA-Z0-9]/g, '')

// ---------------------------------------------------------------- small charts
export function Spark({ data, color = COLORS.teal }) {
  const id = gid(useId())
  const d = (data || []).map(Number)
  if (d.length < 2) return <div className="spark" />
  const w = 120, h = 38, pad = 3
  const min = Math.min(...d), span = Math.max(...d) - min || 1
  const pts = d.map((v, i) => [pad + (i / (d.length - 1)) * (w - 2 * pad), h - pad - ((v - min) / span) * (h - 2 * pad)])
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('')
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id={`sp${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".35" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={`${line}L${pts[pts.length - 1][0]} ${h}L${pts[0][0]} ${h}Z`} fill={`url(#sp${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function Gauge({ value }) {
  const id = gid(useId())
  const v = clamp(value ?? 0, 0, 100), len = Math.PI * 50
  const ang = Math.PI * (1 - v / 100)
  const nx = 60 + 36 * Math.cos(ang), ny = 60 - 36 * Math.sin(ang)
  return (
    <svg className="gauge" viewBox="0 0 120 72" role="img" aria-label={`${Math.round(v)} percent`}>
      <defs><linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={COLORS.teal} /><stop offset="1" stopColor={COLORS.blue} /></linearGradient></defs>
      <path d="M10 60A50 50 0 0 1 110 60" fill="none" stroke="var(--line)" strokeWidth="10" strokeLinecap="round" />
      <path d="M10 60A50 50 0 0 1 110 60" fill="none" stroke={`url(#g${id})`} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(len * v) / 100} ${len}`} className="gauge-arc" />
      <line x1="60" y1="60" x2={nx} y2={ny} stroke="var(--heading)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="60" cy="60" r="4" fill="var(--heading)" />
    </svg>
  )
}

function Donut({ items, total, label }) {
  const r = 40, c = 2 * Math.PI * r
  const sum = items.reduce((s, i) => s + i.value, 0)
  let used = 0
  return (
    <svg className="donut" viewBox="0 0 120 120" role="img" aria-label={`${total} ${label}`}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--line)" strokeWidth="16" />
      {sum > 0 && items.map((it, i) => {
        if (!it.value) return null
        const len = Math.max(0, (c * it.value) / sum - 2)
        const el = <circle key={i} className="donut-arc" cx="60" cy="60" r={r} fill="none" stroke={it.color} strokeWidth="16" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-used} transform="rotate(-90 60 60)" style={{ '--c': c }} />
        used += (c * it.value) / sum
        return el
      })}
      <text x="60" y="58" textAnchor="middle" className="donut-total">{total}</text>
      <text x="60" y="74" textAnchor="middle" className="donut-label">{label}</text>
    </svg>
  )
}

function smooth(pts) {
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
  }
  return d
}

export function AreaChart({ data, format = (v) => v, color = COLORS.blue }) {
  const id = gid(useId())
  const w = 440, h = 160, L = 10, R = 16, T = 30, B = 26
  if (!data || data.length < 2) return <p className="dnote">Not enough data yet.</p>
  const max = Math.max(...data.map((d) => d.value), 1) * 1.1
  const pts = data.map((d, i) => [L + (i / (data.length - 1)) * (w - L - R), T + (1 - d.value / max) * (h - T - B)])
  const line = smooth(pts), last = pts[pts.length - 1]
  const txt = format(data[data.length - 1].value)
  const bw = Math.max(46, txt.length * 7 + 16), bx = clamp(last[0] - bw / 2, 2, w - bw - 2)
  const labels = data.map((d, i) => [i, d.label]).filter(([i]) => i === 0 || i === data.length - 1 || i === Math.floor((data.length - 1) / 2))
  return (
    <svg className="area" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Trend chart">
      <defs><linearGradient id={`a${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".45" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      {[0, 1, 2].map((i) => <line key={i} x1={L} x2={w - R} y1={T + (i / 2) * (h - T - B)} y2={T + (i / 2) * (h - T - B)} stroke="var(--line)" strokeDasharray="3 4" />)}
      <path d={`${line}L${last[0]} ${h - B}L${pts[0][0]} ${h - B}Z`} fill={`url(#a${id})`} className="area-fill" />
      <path d={line} fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" className="area-line" pathLength="1" />
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={i === pts.length - 1 ? 5 : 2.5} fill={i === pts.length - 1 ? color : 'var(--card)'} stroke={color} strokeWidth="2"><title>{`${data[i].label}: ${format(data[i].value)}`}</title></circle>)}
      <rect x={bx} y={last[1] - 28} width={bw} height="20" rx="6" fill="var(--heading)" />
      <text x={bx + bw / 2} y={last[1] - 14} textAnchor="middle" className="area-tip">{txt}</text>
      {labels.map(([i, l]) => <text key={i} x={pts[i][0]} y={h - 6} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'} className="axis">{l}</text>)}
    </svg>
  )
}

export function Bars({ data, format = (v) => v, max: fixedMax }) {
  if (!data || data.length === 0) return <p className="dnote">Not enough data yet.</p>
  const max = fixedMax || niceMax(Math.max(...data.map((d) => d.value), 1))
  const ticks = [1, 2 / 3, 1 / 3, 0].map((t) => t * max)
  return (
    <div className="bars">
      <div className="bars-axis">{ticks.map((t, i) => <span key={i}>{format(t)}</span>)}</div>
      <div className="bars-plot">
        {data.map((d, i) => (
          <div className="bar-col" key={i} title={`${d.label}: ${format(d.value)}`}>
            <i className={i === data.length - 1 ? 'now' : ''} style={{ '--h': `${clamp((d.value / max) * 100, d.value > 0 ? 3 : 0, 100)}%`, '--i': i }} />
            <span>{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- cards
export function DashHead({ subtitle }) {
  const { profile } = useAuth()
  const first = (profile?.full_name || '').trim().split(/\s+/)[0] || 'there'
  const h = new Date().getHours()
  const date = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
  return (
    <header className="dash-head">
      <div>
        <h2>{h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'}, {first}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <span className="date-chip"><Calendar size={16} aria-hidden="true" /> {date}</span>
    </header>
  )
}

export function Kpi({ label, value, change, changeLabel = 'vs last period', sub, spark, color, alert, small }) {
  const up = change != null && change >= 0
  return (
    <section className={`kpi ${alert ? 'alert' : ''}`}>
      <span className="kpi-label">{label}</span>
      <strong className={`kpi-value ${small ? 'sm' : ''}`}>{value}</strong>
      {change != null && <span className={`kpi-delta ${up ? 'up' : 'down'}`}>{up ? <TrendingUp size={14} aria-hidden="true" /> : <TrendingDown size={14} aria-hidden="true" />} {Math.abs(change).toFixed(1)}% <em>{changeLabel}</em></span>}
      {change == null && sub && <span className="kpi-sub">{sub}</span>}
      {spark && <Spark data={spark} color={color} />}
    </section>
  )
}

export function GaugeKpi({ label, value, goal, sub }) {
  return (
    <section className="kpi gauge-kpi">
      <div>
        <span className="kpi-label">{label}</span>
        <strong className="kpi-value">{value == null ? '–' : `${Math.round(value)}%`}</strong>
        <span className="kpi-sub">{sub || (goal ? `Goal: ${goal}%` : '')}</span>
      </div>
      <Gauge value={value} />
    </section>
  )
}

export function DonutCard({ title, total, label, items, className = '', note }) {
  return (
    <section className={`dcard ${className}`}>
      <header className="dcard-head"><h3>{title}</h3></header>
      <div className="donut-wrap">
        <Donut items={items} total={total} label={label} />
        <ul className="donut-legend">
          {items.map((it) => <li key={it.name}><i style={{ background: it.color }} /><span>{it.name}</span><strong>{it.display ?? it.value}</strong></li>)}
        </ul>
      </div>
      {note && <p className="dnote">{note}</p>}
    </section>
  )
}

export function MiniCard({ icon: Icon, label, value, change, sub, tone = 'blue' }) {
  return (
    <section className="dcard mini">
      <span className={`mini-icon tone-${tone}`}><Icon size={20} aria-hidden="true" /></span>
      <span className="mini-label">{label}</span>
      <strong className="mini-value">{value}{change != null && <em className={change >= 0 ? 'up' : 'down'}>{change >= 0 ? '+' : '−'}{Math.abs(change).toFixed(0)}%</em>}</strong>
      {sub && <span className="mini-sub">{sub}</span>}
    </section>
  )
}

export function ChartCard({ title, headline, subtitle, className = '', children, action }) {
  return (
    <section className={`dcard ${className}`}>
      <header className="dcard-head">
        <div><h3>{title}</h3>{subtitle && <span className="dsub">{subtitle}</span>}{headline && <strong className="dhead">{headline}</strong>}</div>
        {action}
      </header>
      {children}
    </section>
  )
}

// ---------------------------------------------------------------- right-hand column
const ICONS = {
  announcement: Megaphone, attendance: UserCheck, absence: UserX, absence_notice: UserX, fee_invoice: Wallet, fee_due: Wallet, fee_overdue: Wallet,
  payment: Wallet, grade: Star, exam: GraduationCap, quiz: HelpCircle, message: MessageCircle, event: Calendar, certificate: Award,
  signup: UserPlus, child_added: UserPlus, account: UserPlus, family: UserPlus, submission: Star,
}

export function NotificationsPanel() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState(null)
  useEffect(() => {
    supabase.from('notifications').select('id, kind, title, body, link, created_at, read_at').order('created_at', { ascending: false }).limit(5)
      .then(({ data }) => setItems(data || []))
  }, [])
  return (
    <section className="dcard side-card">
      <header className="dcard-head"><h3>Notifications</h3><Link className="dlink" to={`/${profile.role}/notifications`}>View all</Link></header>
      {items && items.length === 0 && <p className="dnote">Nothing new. Updates will show up here.</p>}
      <ul className="feed">
        {items?.map((n) => {
          const Icon = ICONS[n.kind] || Bell
          return (
            <li key={n.id}>
              <button className={`feed-btn ${n.read_at ? '' : 'unread'}`} onClick={() => (n.link ? navigate(n.link) : null)}>
                <span className="feed-icon"><Icon size={16} aria-hidden="true" /></span>
                <span className="feed-text"><strong>{n.title}</strong><small>{timeAgo(n.created_at)}</small></span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function ActivityPanel({ title = 'Activities', items }) {
  return (
    <section className="dcard side-card">
      <header className="dcard-head"><h3>{title}</h3></header>
      {(!items || items.length === 0) && <p className="dnote">Nothing to show yet.</p>}
      <ul className="timeline">
        {(items || []).map((a, i) => (
          <li key={i}>
            <span className={`tl-dot tone-${a.tone || 'blue'}`}>{a.icon ? <a.icon size={13} aria-hidden="true" /> : null}</span>
            <span className="feed-text"><strong>{a.text}</strong><small>{a.when}</small></span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function CtaCard({ title, text, to, label }) {
  return (
    <section className="cta">
      <Rocket size={26} aria-hidden="true" />
      <h3>{title}</h3>
      <p>{text}</p>
      <Link className="cta-btn" to={to}>{label}</Link>
    </section>
  )
}
