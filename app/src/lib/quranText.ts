import { useEffect, useState } from 'react'
import { parseQuran, type QuranText } from '../domain/mushaf'

let cache: Promise<QuranText> | undefined

/** Loads public/quran.txt once (the service worker keeps it for offline use). */
export function loadQuran(): Promise<QuranText> {
  cache ??= fetch('/quran.txt')
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status))
      return r.text()
    })
    .then(parseQuran)
    .catch((e: unknown) => {
      cache = undefined // try again next time
      throw e
    })
  return cache
}

/** The Quran text, or undefined while loading; `failed` when it could not be loaded. */
export function useQuran(): { quran?: QuranText; failed: boolean } {
  const [state, setState] = useState<{ quran?: QuranText; failed: boolean }>({ failed: false })
  useEffect(() => {
    let live = true
    loadQuran().then(
      (quran) => live && setState({ quran, failed: false }),
      () => live && setState({ failed: true }),
    )
    return () => {
      live = false
    }
  }, [])
  return state
}
