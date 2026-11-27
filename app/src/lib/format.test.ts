import { describe, expect, it } from 'vitest'
import { agoText, formatDayName, formatGregorian, formatHijri, toArabicDigits, untilText } from './format'

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

describe('untilText', () => {
  it('reads naturally in Arabic', () => {
    expect(untilText(0)).toBe('دلوقتي')
    expect(untilText(45)).toBe('٤٥ دقيقة')
    expect(untilText(5)).toBe('٥ دقائق')
    expect(untilText(60)).toBe('ساعة')
    expect(untilText(70)).toBe('ساعة و١٠ دقائق')
    expect(untilText(125)).toBe('ساعتين و٥ دقائق')
    expect(untilText(180)).toBe('٣ ساعات')
  })
})

describe('agoText', () => {
  const now = Date.UTC(2026, 10, 27, 12, 0)
  it('says how long ago in plain Arabic', () => {
    expect(agoText(now - 10_000, now)).toBe('دلوقتي')
    expect(agoText(now - 5 * 60_000, now)).toBe('من ٥ دقائق')
    expect(agoText(now - 2 * 3_600_000, now)).toBe('من ساعتين')
    expect(agoText(now - 30 * 3_600_000, now)).toBe('امبارح')
    expect(agoText(now - 5 * 86_400_000, now)).toBe('٢٢ نوفمبر')
  })
})
