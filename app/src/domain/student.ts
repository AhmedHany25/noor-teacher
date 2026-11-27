import { COUNTRIES, countryOf } from './countries'

export type PayMode = 'session' | 'hour' | 'month'
export type StudentStatus = 'active' | 'paused' | 'left'

export type Student = {
  id: string
  name: string
  guardianPhone?: string
  timeZone?: string // empty = same as the teacher
  academyId: string | null // null = private student
  payMode?: PayMode // overrides the academy's mode
  rate?: number // overrides the academy's rate
  level?: string
  age?: number
  notes?: string
  status: StudentStatus
  createdAt: number
}

/** The editable part of a student (what the form produces). */
export type StudentInput = Omit<Student, 'id' | 'createdAt'>

export const STATUS_LABELS: Record<StudentStatus, string> = {
  active: 'نشط',
  paused: 'موقوف',
  left: 'انقطع',
}

export const PAY_MODE_LABELS: Record<PayMode, string> = {
  session: 'بالحصة',
  hour: 'بالساعة',
  month: 'بالشهر',
}

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩'
const PERSIAN = '۰۱۲۳۴۵۶۷۸۹'

function westernDigits(s: string): string {
  return s.replace(/[٠-٩۰-۹]/g, (c) => String(ARABIC_INDIC.indexOf(c) >= 0 ? ARABIC_INDIC.indexOf(c) : PERSIAN.indexOf(c)))
}

/**
 * Builds the number wa.me expects (digits only, with country code), or null if unusable.
 * Local numbers (leading 0) get the dial code of the student's country, else the teacher's.
 */
export function whatsappNumber(raw: string, studentTz: string | undefined, teacherTz: string): string | null {
  const s = westernDigits(raw.trim())
  if (!s) return null
  const hasPlus = s.startsWith('+')
  let digits = s.replace(/\D/g, '')
  if (hasPlus) return digits.length >= 8 ? digits : null
  if (digits.startsWith('00')) {
    digits = digits.slice(2)
    return digits.length >= 8 ? digits : null
  }
  const dial = (countryOf(studentTz) ?? countryOf(teacherTz))?.dialCode ?? ''
  if (digits.startsWith('0')) digits = dial + digits.slice(1)
  else if (dial && !digits.startsWith(dial) && !COUNTRIES.some((c) => digits.startsWith(c.dialCode) && digits.length >= 11))
    digits = dial + digits
  return digits.length >= 8 ? digits : null
}

/** Folds the spelling differences people make when typing Arabic names, for search. */
export function normalizeArabic(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ً-ْٰـ]/g, '') // tashkeel, dagger alef, tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim()
}

export function filterStudents(list: Student[], f: { status: StudentStatus; query: string }): Student[] {
  const q = normalizeArabic(f.query)
  return list
    .filter((s) => s.status === f.status && (!q || normalizeArabic(s.name).includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'))
}

export type StudentErrors = Partial<Record<keyof StudentInput, string>>

export function validateStudent(input: StudentInput): StudentErrors {
  const e: StudentErrors = {}
  if (!input.name.trim()) e.name = 'اكتب اسم الطالب.'
  if (input.guardianPhone?.trim() && !whatsappNumber(input.guardianPhone, input.timeZone, 'Africa/Cairo'))
    e.guardianPhone = 'الرقم قصير. اكتبه كاملًا، مثل 01012345678.'
  if (input.rate !== undefined && !(Number.isFinite(input.rate) && input.rate >= 0)) e.rate = 'السعر لازم يكون رقمًا موجبًا.'
  if (input.age !== undefined && !(Number.isInteger(input.age) && input.age >= 3 && input.age <= 99))
    e.age = 'العمر بين ٣ و٩٩ سنة.'
  return e
}
