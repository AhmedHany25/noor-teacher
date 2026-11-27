import { createContext, useContext, useEffect, useState } from 'react'

export type Clock = { now: Date; timeZone: string }

export const deviceTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Cairo'

export const ClockContext = createContext<{ fixed?: Date; timeZone: string }>({ timeZone: deviceTimeZone() })

/** The current time, refreshed every 30 seconds (or a fixed time in tests), and the teacher's time zone. */
export function useClock(): Clock {
  const { fixed, timeZone } = useContext(ClockContext)
  const [now, setNow] = useState(() => fixed ?? new Date())
  useEffect(() => {
    if (fixed) return
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [fixed])
  return { now: fixed ?? now, timeZone }
}

/** "HH:mm" on the device clock. */
export function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
