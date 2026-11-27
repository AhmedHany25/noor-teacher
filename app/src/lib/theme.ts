export type Theme = 'auto' | 'light' | 'dark'

/** Per-device preference; index.html reads the same key before the first paint. */
export const THEME_KEY = 'noor-theme'

const THEME_COLORS = { light: '#0A6B54', dark: '#0D1A17' }

export function getTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY)
    return t === 'light' || t === 'dark' ? t : 'auto'
  } catch {
    return 'auto'
  }
}

export function applyTheme(t: Theme) {
  const root = document.documentElement
  if (t === 'auto') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', t)

  // Browser chrome colour: follow the choice, or the system when on auto.
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    const scheme = m.media.includes('dark') ? 'dark' : 'light'
    m.content = THEME_COLORS[t === 'auto' ? scheme : t]
  })
}

export function setTheme(t: Theme) {
  try {
    if (t === 'auto') localStorage.removeItem(THEME_KEY)
    else localStorage.setItem(THEME_KEY, t)
  } catch {
    // Private mode or blocked storage: still apply for this visit.
  }
  applyTheme(t)
}
