import { describe, expect, it } from 'vitest'
import { formatDayName, formatGregorian, formatHijri, toArabicDigits } from './format'

// 2026-11-27 is a Friday. Built at local noon so time zones cannot shift the day.
const friday = new Date(2026, 10, 27, 12, 0, 0)

describe('toArabicDigits', () => {
  it('converts Western digits to Arabic-Indic digits', () => {
    expect(toArabicDigits('12:30')).toBe('١٢:٣٠')
  })

  it('accepts numbers', () => {
    expect(toArabicDigits(2026)).toBe('٢٠٢٦')
  })

  it('leaves other characters alone', () => {
    expect(toArabicDigits('حلقة 3')).toBe('حلقة ٣')
  })
})

describe('formatDayName', () => {
  it('returns the Arabic weekday name', () => {
    expect(formatDayName(friday)).toBe('الجمعة')
  })
})

describe('formatGregorian', () => {
  it('shows day and Egyptian month name in Arabic digits', () => {
    const s = formatGregorian(friday)
    expect(s).toContain('٢٧')
    expect(s).toContain('نوفمبر')
    expect(s).not.toMatch(/[0-9]/)
  })
})

describe('formatHijri', () => {
  it('uses the Umm al-Qura calendar with the هـ suffix', () => {
    const s = formatHijri(friday)
    expect(s).toContain('هـ')
    expect(s).not.toContain('نوفمبر')
    expect(s).not.toMatch(/[0-9]/)
  })
})
