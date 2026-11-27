import { createContext, useContext, useEffect, useState } from 'react'
import { dateInZone, timeInZone } from '../domain/zone'

export { dateInZone, timeInZone }

/** The teacher works on Egyptian time, whatever time zone the device is set to. */
export const TEACHER_TZ = 'Africa/Cairo'

export type Clock = {
  now: Date
  timeZone: string
  /** Today's date in the teacher's time zone, "YYYY-MM-DD". */
  today: string
  /** The current time in the teacher's time zone, "HH:mm". */
  nowTime: string
}

export const ClockContext = createContext<{ fixed?: Date; timeZone: string }>({ timeZone: TEACHER_TZ })

/** Noon of a calendar date on this device, safe to pass to date formatters. */
export function dateOf(iso: string): Date {
  return new Date(`${iso}T12:00:00`)
}

/** The current time (refreshed every 30 seconds, or fixed in tests) on the teacher's clock. */
export function useClock(): Clock {
  const { fixed, timeZone } = useContext(ClockContext)
  const [live, setLive] = useState(() => fixed ?? new Date())
  useEffect(() => {
    if (fixed) return
    const t = setInterval(() => setLive(new Date()), 30_000)
    return () => clearInterval(t)
  }, [fixed])
  const now = fixed ?? live
  return { now, timeZone, today: dateInZone(now, timeZone), nowTime: timeInZone(now, timeZone) }
}
