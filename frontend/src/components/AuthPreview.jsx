import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

// The dashboard beside the sign-in form. It shows REAL totals from the institute (no names), unless the admin
// switches that off, in which case (or while loading) it shows example numbers.
const TEAL = '#3CCFBF', GOLD = '#FFB020', ROSE = '#FF7A9C', AZURE = '#7FA5FF'

function seeded(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646 } }
const rnd = seeded(11)
const SAMPLE_POINTS = Array.from({ length: 28 }, () => {
  const x = 52 + rnd() * 46
  return [Math.round(x), Math.round(Math.max(34, Math.min(98, 0.95 * x - 8 + (rnd() - 0.5) * 20)))]
})

function regression(pts) {
  const n = pts.length
  const mx = pts.reduce((a, p) => a + p[0], 0) / n, my = pts.reduce((a, p) => a + p[1], 0) / n
  let sxy = 0, sxx = 0, syy = 0
  pts.forEach(([x, y]) => { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2 })
  if (!sxx || !syy) return null
  const slope = sxy / sxx
  return { slope, intercept: my - slope * mx, r: sxy / Math.sqrt(sxx * syy) }
}

const SAMPLE = {
  students: 138,
  pace: { total: 100, on_pace: 74, slipping: 18, behind: 8 },
  categories: [{ name: 'Coding', courses: 8 }, { name: 'Digital skills', courses: 6 }, { name: 'Classical', courses: 7 }, { name: 'Modern', courses: 5 }, { name: 'Creative', courses: 3 }],
  risk: { total: 9, low_attendance: 4, low_marks: 3, fees_overdue: 2 },
  weeks: [58, 64, 66, 61, 73, 79, 77, 85].map((p, i) => ({ start: null, participation: p, hours: [3.1, 3.4, 3.3, 3.9, 4.3, 4.1, 4.7, 5.2][i] })),
  points: SAMPLE_POINTS,
  correlation: regression(SAMPLE_POINTS).r,
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

function Donut({ pace }) {
  const r = 38, c = 2 * Math.PI * r
  const total = pace.total
  const parts = [[pace.on_pace, TEAL], [pace.slipping, GOLD], [pace.behind, ROSE]]
  let used = 0
  const pct = total ? Math.round((pace.on_pace / total) * 100) : null
  return (
    <svg viewBox="0 0 100 100" className="pv-donut" role="img" aria-label={total ? `${pct} percent of learners are on pace` : 'No data yet'}>
      <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="12" />
      {total > 0 && parts.map(([count, col], i) => {
        if (!count) return null
        const len = Math.max(0, (c * count) / total - 2)
        const el = (
          <circle key={i} className="pv-arc" cx="50" cy="50" r={r} fill="none" stroke={col} strokeWidth="12"
            strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-used} transform="rotate(-90 50 50)" style={{ '--c': c }} />
        )
        used += (c * count) / total
        return el
      })}
      <text x="50" y="52" textAnchor="middle" className="pv-big">{pct === null ? '–' : `${pct}%`}</text>
      <text x="50" y="65" textAnchor="middle" className="pv-tiny">on pace</text>
    </svg>
  )
}

function Area({ hours }) {
  const w = 240, h = 86
  const max = Math.max(1, ...hours) * 1.12
  const pts = hours.map((v, i) => [8 + (i / Math.max(1, hours.length - 1)) * (w - 18), h - 10 - (v / max) * (h - 26)])
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('')
  const first = pts[0]
  const last = pts[pts.length - 1]
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="pv-area" role="img" aria-label="Hours in class per learner, week by week">
      <defs>
        <linearGradient id="pvfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={AZURE} stopOpacity="0.55" /><stop offset="1" stopColor={AZURE} stopOpacity="0" /></linearGradient>
      </defs>
      <path className="pv-fade" d={`${line}L${last[0]} ${h}L${first[0]} ${h}Z`} fill="url(#pvfill)" />
      <path className="pv-line" pathLength="1" d={line} fill="none" stroke={GOLD} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle className="pv-fade" cx={last[0]} cy={last[1]} r="4.5" fill={GOLD} stroke="#0a2342" strokeWidth="2" />
    </svg>
  )
}

function Scatter({ points, correlation }) {
  if (points.length < 3) {
    return <p className="pv-empty">Not enough data yet. This appears when at least 3 students have both attendance and marks recorded.</p>
  }
  const fit = regression(points)
  const X = (v) => 34 + ((clamp(v, 40, 100) - 40) / 60) * 262
  const Y = (v) => 108 - ((clamp(v, 20, 100) - 20) / 80) * 96
  const [x1, x2] = [42, 99]
  const r = correlation ?? fit?.r
  return (
    <>
      <svg viewBox="0 0 310 124" className="pv-scatter" role="img" aria-label="Scatter plot of attendance against average grade">
        {[40, 60, 80, 100].map((g) => <line key={g} x1="34" x2="296" y1={Y(g)} y2={Y(g)} stroke="rgba(255,255,255,0.09)" />)}
        {[40, 60, 80, 100].map((g) => <text key={g} x="26" y={Y(g) + 3} textAnchor="end" className="pv-axis">{g}</text>)}
        {[50, 70, 90].map((g) => <text key={g} x={X(g)} y="122" textAnchor="middle" className="pv-axis">{g}%</text>)}
        {points.map(([x, y], i) => <circle key={i} className="pv-dot" style={{ '--i': Math.min(i, 30) }} cx={X(x)} cy={Y(y)} r="3.4" fill={i % 3 === 0 ? TEAL : AZURE} fillOpacity="0.9" />)}
        {fit && <line className="pv-line" pathLength="1" x1={X(x1)} y1={Y(fit.slope * x1 + fit.intercept)} x2={X(x2)} y2={Y(fit.slope * x2 + fit.intercept)} stroke={GOLD} strokeWidth="2" strokeDasharray="1" strokeLinecap="round" />}
      </svg>
      <p className="pv-note">Attendance (across) against average grade (up).{r != null && <> Correlation <strong>r = {Number(r).toFixed(2)}</strong></>}</p>
    </>
  )
}

export default function AuthPreview() {
  const [ov, setOv] = useState(undefined) // undefined = loading, null = unavailable

  useEffect(() => {
    let live = true
    supabase.rpc('public_overview').then(({ data, error }) => { if (live) setOv(error ? null : data) })
    return () => { live = false }
  }, [])

  const real = ov && ov.enabled === true
  const d = real ? ov : SAMPLE
  const loading = ov === undefined
  const pace = d.pace
  const weeks = (d.weeks || []).slice(-8)
  const risk = d.risk
  const maxCourses = Math.max(1, ...(d.categories || []).map((c) => c.courses))
  const hours = weeks.map((w) => Number(w.hours) || 0)
  const anyParticipation = weeks.some((w) => w.participation !== null && w.participation !== undefined)
  const paceTotal = pace.total || 0
  const pctOf = (v) => (paceTotal ? Math.round((v / paceTotal) * 100) : null)
  const legend = [['On pace', pace.on_pace, TEAL], ['Slipping', pace.slipping, GOLD], ['Behind', pace.behind, ROSE]]

  return (
    <div className={`pv ${loading ? 'loading' : ''}`} aria-label={real ? 'Live dashboard' : 'Sample dashboard'}>
      <div className="pv-head">
        <span>Learning overview</span>
        <em className={real ? 'live' : ''}>{loading ? 'Loading…' : real ? 'Live data' : 'Sample data'}</em>
      </div>
      {real && <p className="pv-sub">{d.students > 0 ? `Based on ${d.students} active student${d.students === 1 ? '' : 's'} · last 60 days` : 'No students yet. Numbers appear as students, attendance and marks are added.'}</p>}

      <div className="pv-grid">
        <section className="pv-card s2">
          <h4>Learners on pace</h4>
          <div className="pv-pace">
            <Donut pace={pace} />
            <ul className="pv-legend">
              {legend.map(([n, v, c]) => <li key={n}><i style={{ background: c }} />{n} <strong>{paceTotal ? `${pctOf(v)}%` : '–'}</strong></li>)}
            </ul>
          </div>
          {real && !paceTotal && <p className="pv-empty">Starts when attendance or marks are recorded.</p>}
        </section>

        <section className="pv-card s2">
          <h4>Courses per category</h4>
          {(d.categories || []).length === 0
            ? <p className="pv-empty">No subjects yet.</p>
            : (
              <ul className="pv-bars">
                {d.categories.map((c, i) => (
                  <li key={c.name}><span title={c.name}>{c.name}</span><b><i style={{ '--w': `${(c.courses / maxCourses) * 100}%`, '--i': i }} /></b><em>{c.courses}</em></li>
                ))}
              </ul>
            )}
        </section>

        <section className="pv-card s2 risk">
          <h4>Students at risk</h4>
          <p className="pv-num">{risk.total} <small>of {d.students}</small></p>
          <ul className="pv-risks">
            <li><i style={{ background: ROSE }} />Low attendance<strong>{risk.low_attendance}</strong></li>
            <li><i style={{ background: GOLD }} />Low marks<strong>{risk.low_marks}</strong></li>
            <li><i style={{ background: AZURE }} />Fees overdue<strong>{risk.fees_overdue}</strong></li>
          </ul>
        </section>

        <section className="pv-card s3">
          <h4>Total participation by week</h4>
          <div className="pv-cols">
            {weeks.map((w, i) => {
              const v = w.participation
              return (
                <div key={i} className={`pv-col ${v == null ? 'nodata' : ''} ${i === weeks.length - 1 && v != null ? 'now' : ''}`}
                  style={{ '--h': `${v == null ? 6 : clamp(v, 6, 100)}%`, '--i': i }} title={w.start ? `Week of ${w.start}` : undefined}>
                  <span>{v == null ? '–' : Math.round(v)}</span>
                </div>
              )
            })}
          </div>
          <div className="pv-weeks">{weeks.map((_, i) => <span key={i}>W{i + 1}</span>)}</div>
          {real && !anyParticipation && <p className="pv-empty">Starts when attendance is recorded.</p>}
        </section>

        <section className="pv-card s3">
          <h4>Time spent</h4>
          <p className="pv-num">{(hours[hours.length - 1] ?? 0).toFixed(1)} <small>{real ? 'class hours per learner this week' : 'hours per learner this week'}</small></p>
          <Area hours={hours.length ? hours : [0, 0]} />
          {real && hours.every((x) => x === 0) && <p className="pv-empty">Starts when students attend classes.</p>}
        </section>

        <section className="pv-card s6">
          <h4>Grade correlation</h4>
          <Scatter points={d.points || []} correlation={d.correlation} />
        </section>
      </div>
    </div>
  )
}
