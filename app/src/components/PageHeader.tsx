import type { ReactNode } from 'react'

/** Eight-point star lattice, drawn once and reused as the band's texture. */
function StarPattern() {
  return (
    <svg className="band-pattern" aria-hidden="true" focusable="false">
      <defs>
        <pattern id="noor-stars" width="44" height="44" patternUnits="userSpaceOnUse">
          <path
            d="M22 6l4.2 9.8L36 20l-9.8 4.2L22 34l-4.2-9.8L8 20l9.8-4.2z M22 11l-2.7 6.3L13 20l6.3 2.7L22 29l2.7-6.3L31 20l-6.3-2.7z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#noor-stars)" />
    </svg>
  )
}

/**
 * The emerald band at the top of every screen: star lattice, gold rule underneath.
 * `big` is the Today variant with the day set large in Amiri.
 */
export function PageHeader({
  title,
  subtitle,
  action,
  big = false,
  titleClassName,
}: {
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  big?: boolean
  titleClassName?: string
}) {
  return (
    <header className={big ? 'band band-big' : 'band'}>
      <StarPattern />
      <div className="band-inner">
        <div className="band-text">
          <h1 className={titleClassName ?? (big ? 'band-title-big' : 'band-title')}>{title}</h1>
          {subtitle && <p className="band-sub">{subtitle}</p>}
        </div>
        {action && <div className="band-action">{action}</div>}
      </div>
    </header>
  )
}
