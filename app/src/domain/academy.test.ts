import { describe, expect, it } from 'vitest'
import { sortAcademies, validateAcademy, type Academy, type AcademyInput } from './academy'

const ok: AcademyInput = { name: 'الفرقان', currency: 'ريال', payMode: 'session', rate: 40, archived: false }

describe('validateAcademy', () => {
  it('accepts a valid academy', () => {
    expect(validateAcademy(ok)).toEqual({})
  })

  it('requires a name and rejects duplicates', () => {
    expect(validateAcademy({ ...ok, name: ' ' }).name).toBeDefined()
    const existing: Academy = { ...ok, id: 'a1' }
    expect(validateAcademy({ ...ok, name: 'الفرقان ' }, [existing]).name).toBe('فيه أكاديمية بنفس الاسم.')
  })

  it('rejects a negative or missing rate', () => {
    expect(validateAcademy({ ...ok, rate: -1 }).rate).toBeDefined()
    expect(validateAcademy({ ...ok, rate: Number.NaN }).rate).toBeDefined()
  })
})

describe('sortAcademies', () => {
  it('puts archived academies last and sorts by name', () => {
    const list: Academy[] = [
      { ...ok, id: '1', name: 'نور', archived: true },
      { ...ok, id: '2', name: 'هدى' },
      { ...ok, id: '3', name: 'إقرأ' },
    ]
    expect(sortAcademies(list).map((a) => a.name)).toEqual(['إقرأ', 'هدى', 'نور'])
  })
})
