const KEY = 'wings_theme'

export function initTheme() {
  let theme = 'light'
  try {
    theme = localStorage.getItem(KEY) || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  } catch { /* storage can be blocked */ }
  document.documentElement.dataset.theme = theme
}

export const currentTheme = () => document.documentElement.dataset.theme || 'light'

export function toggleTheme() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark'
  document.documentElement.dataset.theme = next
  try { localStorage.setItem(KEY, next) } catch { /* ignore */ }
  return next
}
