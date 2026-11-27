import { useEffect, useState } from 'react'
import { UPDATE_READY_EVENT } from '../lib/updates'

/** A slim bar offering to load the new version that just arrived. */
export function UpdateBanner() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const on = () => setReady(true)
    window.addEventListener(UPDATE_READY_EVENT, on)
    return () => window.removeEventListener(UPDATE_READY_EVENT, on)
  }, [])

  if (!ready) return null
  return (
    <div className="update-bar" role="status">
      <span>فيه نسخة جديدة من التطبيق.</span>
      <button type="button" className="btn btn-gold" onClick={() => location.reload()}>
        تحديث
      </button>
    </div>
  )
}
