import { describe, expect, it } from 'vitest'
import { ayahCount, ayahsInRange, guessDirection, nextStart, rangeText, surahName, validRange } from './quran'

describe('surah data', () => {
  it('knows names and ayah counts', () => {
    expect(surahName(1)).toBe('الفاتحة')
    expect(surahName(78)).toBe('النبأ')
    expect(ayahCount(2)).toBe(286)
    expect(ayahCount(114)).toBe(6)
  })
})

describe('rangeText', () => {
  it('writes a range inside one surah', () => {
    expect(rangeText({ from: { s: 78, a: 1 }, to: { s: 78, a: 10 } })).toBe('النبأ ١–١٠')
  })
  it('writes a single ayah', () => {
    expect(rangeText({ from: { s: 1, a: 5 }, to: { s: 1, a: 5 } })).toBe('الفاتحة ٥')
  })
  it('writes a whole surah by name', () => {
    expect(rangeText({ from: { s: 112, a: 1 }, to: { s: 112, a: 4 } })).toBe('الإخلاص كاملة')
  })
  it('writes a range across surahs', () => {
    expect(rangeText({ from: { s: 78, a: 31 }, to: { s: 79, a: 5 } })).toBe('النبأ ٣١ – النازعات ٥')
  })
})

describe('ayahsInRange', () => {
  it('counts inside one surah', () => {
    expect(ayahsInRange({ from: { s: 78, a: 1 }, to: { s: 78, a: 10 } })).toBe(10)
  })
  it('counts forward across surahs', () => {
    // An-Naba 31–40 (10) + An-Nazi'at 1–5 (5)
    expect(ayahsInRange({ from: { s: 78, a: 31 }, to: { s: 79, a: 5 } })).toBe(15)
  })
  it('counts backward across surahs (Juz Amma from the end)', () => {
    // An-Nas 1–6 (6) + Al-Falaq whole (5) + Al-Ikhlas 1–2 (2)
    expect(ayahsInRange({ from: { s: 114, a: 1 }, to: { s: 112, a: 2 } })).toBe(13)
  })
})

describe('validRange', () => {
  it('rejects ayahs outside the surah and a backwards range in one surah', () => {
    expect(validRange({ from: { s: 1, a: 1 }, to: { s: 1, a: 7 } })).toBe(true)
    expect(validRange({ from: { s: 1, a: 1 }, to: { s: 1, a: 8 } })).toBe(false)
    expect(validRange({ from: { s: 78, a: 10 }, to: { s: 78, a: 3 } })).toBe(false)
    expect(validRange({ from: { s: 0, a: 1 }, to: { s: 1, a: 1 } })).toBe(false)
  })
})

describe('next start', () => {
  it('continues with the next ayah in the same surah', () => {
    expect(nextStart({ s: 78, a: 10 }, 'forward')).toEqual({ s: 78, a: 11 })
  })
  it('moves to the next surah forwards, or the previous one when memorising from the end', () => {
    expect(nextStart({ s: 78, a: 40 }, 'forward')).toEqual({ s: 79, a: 1 })
    expect(nextStart({ s: 114, a: 6 }, 'backward')).toEqual({ s: 113, a: 1 })
  })
  it('stops at the ends of the Quran', () => {
    expect(nextStart({ s: 114, a: 6 }, 'forward')).toBeUndefined()
    expect(nextStart({ s: 1, a: 7 }, 'backward')).toBeUndefined()
  })
})

describe('guessDirection', () => {
  it('reads the direction from the last two ranges', () => {
    expect(guessDirection([{ s: 114, a: 1 }, { s: 113, a: 1 }])).toBe('backward')
    expect(guessDirection([{ s: 2, a: 1 }, { s: 2, a: 20 }])).toBe('forward')
  })
  it('assumes Juz Amma is memorised from the end when there is only one range', () => {
    expect(guessDirection([{ s: 110, a: 1 }])).toBe('backward')
    expect(guessDirection([{ s: 18, a: 1 }])).toBe('forward')
  })
})
