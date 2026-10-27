import { MARK } from './markPaths'

const COLORS = {
  light: { 0: '#FFFFFF', 1: '#B7CDFF', 2: '#7FA5FF', 3: '#4F7DFF', px: '#B7CDFF', orb: '#FFB020' }, // for dark backgrounds
  color: { 0: '#0A2342', 1: '#1B5BFF', 2: '#6E9BFF', 3: '#B7CDFF', px: '#1B5BFF', orb: '#FFB020' }, // for light backgrounds
}

// The Wings mark (two wings and a rising sun). `size` is the width in pixels.
export default function BrandMark({ size = 48, variant = 'light', pixels = false, title }) {
  const m = pixels ? MARK.full : MARK.compact
  const [, , w, h] = m.viewBox
  const cols = COLORS[variant] || COLORS.light
  return (
    <svg viewBox={m.viewBox.join(' ')} width={size} height={Math.round((size * h) / w)}
      role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : 'true'}>
      {m.shapes.map((s, i) => <path key={i} d={s.d} fill={cols[s.role]} fillRule="evenodd" />)}
    </svg>
  )
}
