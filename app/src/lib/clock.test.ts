import { describe, expect, it } from 'vitest'
import { dateInZone, timeInZone } from './clock'

describe('teacher clock', () => {
  // 2026-11-27 22:30 UTC = 2026-11-28 00:30 in Cairo (UTC+2 in winter).
  const instant = new Date(Date.UTC(2026, 10, 27, 22, 30))

  it('reads the date and time on Egyptian time regardless of the device', () => {
    expect(dateInZone(instant, 'Africa/Cairo')).toBe('2026-11-28')
    expect(timeInZone(instant, 'Africa/Cairo')).toBe('00:30')
  })

  it('reads another zone too', () => {
    expect(dateInZone(instant, 'America/New_York')).toBe('2026-11-27')
    expect(timeInZone(instant, 'America/New_York')).toBe('17:30')
  })
})
