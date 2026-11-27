import { describe, expect, it } from 'vitest'
import raw from '../../public/quran.txt?raw'
import { parseQuran } from './mushaf'
import { JUZ_STARTS, SURAH_PAGE, juzOf, pageOfAyah, pageStarts, surahUnits } from './mushafPages'

const q = parseQuran(raw)

describe('mushaf pages', () => {
  it('covers every word exactly once, breaking pages at ayah ends', () => {
    const units = surahUnits(q, 2)
    const starts = pageStarts(units, 600)
    expect(starts[0]).toBe(0)
    expect(starts.length).toBeGreaterThan(40)
    for (let i = 1; i < starts.length; i++) expect(starts[i]).toBeGreaterThan(starts[i - 1])
    const atAyahEnd = starts.slice(1).filter((x) => 'end' in units[x - 1]).length
    expect(atAyahEnd / (starts.length - 1)).toBeGreaterThan(0.9) // only very long ayahs (like 2:282) split
  })

  it('still splits an ayah longer than a page', () => {
    const units = surahUnits(q, 2)
    const starts = pageStarts(units, 60)
    expect(starts.at(-1)!).toBeLessThan(units.length)
    expect(starts.slice(1).some((x) => !('end' in units[x - 1]))).toBe(true)
  })

  it('finds the page of an ayah', () => {
    const units = surahUnits(q, 2)
    const starts = pageStarts(units, 600)
    expect(pageOfAyah(units, starts, 1)).toBe(0)
    const p = pageOfAyah(units, starts, 255)
    expect(units[starts[p]].a).toBeLessThanOrEqual(255)
    expect(units[(starts[p + 1] ?? units.length) - 1].a).toBeGreaterThanOrEqual(255)
  })

  it('knows the juz and Madinah page numbers', () => {
    expect(JUZ_STARTS).toHaveLength(30)
    expect(SURAH_PAGE).toHaveLength(114)
    expect([juzOf(1, 1), juzOf(2, 141), juzOf(2, 142), juzOf(78, 1), juzOf(114, 6)]).toEqual([1, 1, 2, 30, 30])
  })
})
