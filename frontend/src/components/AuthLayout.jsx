import { Lock } from 'lucide-react'
import AuthPreview from './AuthPreview'

export default function AuthLayout({ title, subtitle, icon: Icon, wide = false, children }) {
  return (
    <div className="auth-page">
      <aside className="auth-brand">
        <svg className="auth-curves" viewBox="0 0 600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <path d="M600 0C420 120 330 330 360 600c20 160 120 250 240 300z" fill="#1b5bff" opacity=".18" />
          <path d="M600 140C470 240 410 420 430 640c10 120 90 200 170 240z" fill="#1b5bff" opacity=".16" />
          <path className="curve-draw slow" pathLength="1" d="M600 60C440 170 350 360 375 620c17 150 115 240 225 290" fill="none" stroke="#ffb020" strokeWidth="3" strokeLinecap="round" opacity=".8" />
          <path className="curve-draw slow" pathLength="1" d="M600 200C490 290 440 440 458 640c8 100 70 170 142 215" fill="none" stroke="#8fb2ff" strokeWidth="2" strokeLinecap="round" opacity=".55" />
        </svg>

        <img className="auth-logo" src="/logo/wings-logo-horizontal-light.svg" alt="Wings Institution" />
        <AuthPreview />
      </aside>

      <main className="auth-form-side">
        <div className="auth-bg" aria-hidden="true">
          <span className="auth-blob b1" />
          <span className="auth-blob b2" />
          <span className="auth-dots" />
          <img className="auth-watermark" src="/logo/wings-mark.svg" alt="" />
          <svg className="auth-swirl" viewBox="0 0 400 800" preserveAspectRatio="none">
            <path d="M400 0C250 140 190 360 220 560c14 110 90 190 180 240" fill="none" stroke="#ffb020" strokeWidth="2" opacity=".35" />
            <path d="M400 90C290 210 250 380 270 560c10 90 70 160 130 200" fill="none" stroke="#1b5bff" strokeWidth="2" opacity=".2" />
          </svg>
        </div>
        <div className={`auth-card ${wide ? 'wide' : ''}`}>
          {Icon && <span className="auth-icon"><Icon size={26} aria-hidden="true" /></span>}
          <h2>{title}</h2>
          {subtitle && <p className="muted">{subtitle}</p>}
          {children}
          <p className="auth-secure"><Lock size={14} aria-hidden="true" /> Your details are private and kept secure.</p>
        </div>
      </main>
    </div>
  )
}
