import { useEffect, useState } from 'react'
import { AlertCircle, Camera, CheckCircle2, Eye, EyeOff, Info, Lock, Search, X } from 'lucide-react'

// A labelled input with an optional icon inside it.
export function Field({ label, icon: Icon, hint, className = '', children }) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">{label}</span>
      <span className={`field-control ${Icon ? 'has-icon' : ''}`}>
        {Icon && <Icon size={18} className="field-icon" aria-hidden="true" />}
        {children}
      </span>
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

// Password box with a show / hide button.
export function PasswordField({ label = 'Password', value, onChange, autoComplete, required = true, placeholder, hint, minLength, className }) {
  const [show, setShow] = useState(false)
  return (
    <Field label={label} icon={Lock} hint={hint} className={className}>
      <input type={show ? 'text' : 'password'} value={value} onChange={onChange} autoComplete={autoComplete}
        required={required} placeholder={placeholder} minLength={minLength} />
      <button type="button" className="field-eye" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </Field>
  )
}

export function Alert({ type = 'error', children }) {
  if (!children) return null
  const Icon = type === 'ok' ? CheckCircle2 : type === 'error' ? AlertCircle : Info
  return (
    <div className={`alert alert-${type}`} role={type === 'error' ? 'alert' : 'status'}>
      <Icon size={18} aria-hidden="true" />
      <div>{children}</div>
    </div>
  )
}

export const Spinner = () => <span className="spinner" aria-hidden="true" />

export function PageHeader({ icon: Icon, title, subtitle, children }) {
  return (
    <header className="page-head">
      {Icon && <span className="page-icon"><Icon size={24} aria-hidden="true" /></span>}
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </header>
  )
}

// A white card with a coloured icon, a title and a short hint above the form.
export function FormCard({ icon: Icon, title, hint, children }) {
  return (
    <section className="panel form-card">
      <header className="form-card-head">
        {Icon && <span className="form-card-icon"><Icon size={20} aria-hidden="true" /></span>}
        <div>
          <h3>{title}</h3>
          {hint && <p>{hint}</p>}
        </div>
      </header>
      <div className="form-card-body">{children}</div>
    </section>
  )
}

export function EmptyState({ icon: Icon, title, text, children }) {
  return (
    <div className="empty-state">
      {Icon && <span><Icon size={26} aria-hidden="true" /></span>}
      <strong>{title}</strong>
      {text && <p>{text}</p>}
      {children}
    </div>
  )
}

export function SearchBox({ value, onChange, placeholder = 'Search' }) {
  return (
    <div className="search">
      <Search size={18} aria-hidden="true" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </div>
  )
}

export function Switch({ checked, onChange, children }) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" checked={checked} onChange={onChange} />
      <span className="switch-track" />
      {children && <span>{children}</span>}
    </label>
  )
}

// A round photo picker with a live preview.
export function PhotoPick({ file, onChange, title = 'Add a photo', hint = 'Optional. A clear face photo works best.' }) {
  const [preview, setPreview] = useState('')
  useEffect(() => {
    if (!file) return setPreview('')
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  return (
    <label className="photo-pick">
      <input className="sr-only" type="file" accept="image/*" onClick={(e) => { e.target.value = '' }} onChange={(e) => onChange(e.target.files[0] || null)} />
      <span className="photo-circle">{preview ? <img src={preview} alt="" /> : <Camera size={24} aria-hidden="true" />}</span>
      <span><strong>{file ? 'Change photo' : title}</strong><small>{file ? file.name : hint}</small></span>
    </label>
  )
}

// A pop-up window. Click outside it or press Escape to close.
export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="row-between">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
