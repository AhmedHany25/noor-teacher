import { describe, expect, it } from 'vitest'
import {
  filterStudents,
  normalizeArabic,
  validateStudent,
  whatsappNumber,
  type Student,
  type StudentInput,
} from './student'

describe('whatsappNumber', () => {
  it('turns an Egyptian local number into international form using the default country', () => {
    expect(whatsappNumber('01012345678', undefined, 'Africa/Cairo')).toBe('201012345678')
  })

  it("uses the student's own country when set", () => {
    expect(whatsappNumber('0501234567', 'Asia/Riyadh', 'Africa/Cairo')).toBe('966501234567')
  })

  it('keeps numbers that start with + or 00 as they are', () => {
    expect(whatsappNumber('+971 50 123 4567', 'Africa/Cairo', 'Africa/Cairo')).toBe('971501234567')
    expect(whatsappNumber('00965 9123 4567', undefined, 'Africa/Cairo')).toBe('96591234567')
  })

  it('accepts Arabic-Indic digits and separators', () => {
    expect(whatsappNumber('٠١٠-١٢٣٤-٥٦٧٨', undefined, 'Africa/Cairo')).toBe('201012345678')
  })

  it('does not add the country code twice', () => {
    expect(whatsappNumber('201012345678', undefined, 'Africa/Cairo')).toBe('201012345678')
  })

  it('returns null for empty or too-short input', () => {
    expect(whatsappNumber('', undefined, 'Africa/Cairo')).toBeNull()
    expect(whatsappNumber('123', undefined, 'Africa/Cairo')).toBeNull()
  })
})

describe('normalizeArabic', () => {
  it('ignores hamza forms, taa marbuta, alef maqsura, tashkeel and case', () => {
    expect(normalizeArabic('أَحْمَد')).toBe(normalizeArabic('احمد'))
    expect(normalizeArabic('فاطمة')).toBe(normalizeArabic('فاطمه'))
    expect(normalizeArabic('مصطفى')).toBe(normalizeArabic('مصطفي'))
    expect(normalizeArabic('Omar')).toBe('omar')
  })
})

const s = (over: Partial<Student>): Student => ({
  id: over.id ?? over.name ?? 'x',
  name: 'x',
  academyId: null,
  status: 'active',
  createdAt: 0,
  ...over,
})

describe('filterStudents', () => {
  const list = [
    s({ name: 'يوسف أحمد' }),
    s({ name: 'إبراهيم', status: 'paused' }),
    s({ name: 'آدم', status: 'left' }),
    s({ name: 'أمينة' }),
  ]

  it('keeps only the requested status, sorted by Arabic name', () => {
    expect(filterStudents(list, { status: 'active', query: '' }).map((x) => x.name)).toEqual(['أمينة', 'يوسف أحمد'])
  })

  it('searches across hamza variants within the status', () => {
    expect(filterStudents(list, { status: 'paused', query: 'ابراهيم' }).map((x) => x.name)).toEqual(['إبراهيم'])
  })

  it('matches part of a name', () => {
    expect(filterStudents(list, { status: 'active', query: 'احمد' }).map((x) => x.name)).toEqual(['يوسف أحمد'])
  })
})

describe('validateStudent', () => {
  const ok: StudentInput = { name: 'يوسف', academyId: null, status: 'active' }

  it('accepts a minimal valid student', () => {
    expect(validateStudent(ok)).toEqual({})
  })

  it('requires a name', () => {
    expect(validateStudent({ ...ok, name: '   ' }).name).toBeDefined()
  })

  it('rejects a phone number that cannot be used on WhatsApp', () => {
    expect(validateStudent({ ...ok, guardianPhone: '12' }).guardianPhone).toBeDefined()
  })

  it('rejects a negative or non-numeric rate and a silly age', () => {
    expect(validateStudent({ ...ok, rate: -5 }).rate).toBeDefined()
    expect(validateStudent({ ...ok, age: 0 }).age).toBeDefined()
    expect(validateStudent({ ...ok, age: 120 }).age).toBeDefined()
  })
})
