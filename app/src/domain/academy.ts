import { toArabicDigits } from '../lib/format'
import { PAY_MODE_LABELS, type PayMode } from './student'

export type Academy = {
  id: string
  name: string
  currency: string
  payMode: PayMode
  rate: number
  archived: boolean
  /** Remind each student this many hours before a lesson (some academies require it); empty = off. */
  remindHours?: number
  /** The academy pays after this many lessons; empty = no fixed count (monthly, or whenever). */
  cycleLessons?: number
  /** Start of the current unpaid batch; empty = the day after the last payment. */
  trackFrom?: string
}

export type AcademyInput = Omit<Academy, 'id' | 'trackFrom'>

export const CURRENCIES = ['جنيه', 'ريال', 'درهم', 'دينار', 'دولار', 'يورو']

export type AcademyErrors = Partial<Record<keyof AcademyInput, string>>

export function validateAcademy(a: AcademyInput, others: Academy[] = []): AcademyErrors {
  const e: AcademyErrors = {}
  const name = a.name.trim()
  if (!name) e.name = 'اكتب اسم الأكاديمية.'
  else if (others.some((o) => o.name.trim() === name)) e.name = 'فيه أكاديمية بنفس الاسم.'
  if (!a.currency.trim()) e.currency = 'اختر العملة.'
  if (!(Number.isFinite(a.rate) && a.rate >= 0)) e.rate = 'السعر لازم يكون رقمًا موجبًا.'
  return e
}

/** Sorted for display: active first, then by Arabic name. */
export function sortAcademies(list: Academy[]): Academy[] {
  return [...list].sort((a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name, 'ar'))
}

/** e.g. «٤٠ ريال بالحصة» */
export function rateText(a: Pick<Academy, 'rate' | 'currency' | 'payMode'>): string {
  return `${toArabicDigits(a.rate)} ${a.currency} ${PAY_MODE_LABELS[a.payMode]}`
}
