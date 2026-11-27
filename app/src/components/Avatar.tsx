/** First meaningful letter of an Arabic or Latin name ("الحسن" → "ح"). */
function initialOf(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? ''
  const core = first.startsWith('ال') && first.length > 3 ? first.slice(2) : first
  return core.charAt(0) || '؟'
}

/** Stable tint per name, so a student keeps the same colour everywhere. */
function tintOf(name: string): number {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) | 0
  return Math.abs(h) % 6
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={`avatar avatar-${size} tint-${tintOf(name)}`} aria-hidden="true">
      {initialOf(name)}
    </span>
  )
}
