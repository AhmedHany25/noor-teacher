import { describe, expect, it } from 'vitest'
import { ayahCount } from './quran'
import { ayahText, ayahWords, basmala, parseQuran } from './mushaf'
import raw from '../../public/quran.txt?raw'

const q = parseQuran(raw)

describe('Quran text', () => {
  it('has every ayah of every surah', () => {
    expect(q).toHaveLength(114)
    for (let s = 1; s <= 114; s++) expect(q[s - 1]).toHaveLength(ayahCount(s))
  })

  it('keeps al-Fatiha whole and shows other surahs without the basmala in ayah 1', () => {
    expect(ayahWords(q, 1, 1)).toHaveLength(4)
    expect(ayahWords(q, 112, 1)).toHaveLength(4) // قل هو الله أحد
    expect(basmala(q, 112).split(' ')).toHaveLength(4)
    expect(ayahWords(q, 9, 1)[0].text).not.toBe(ayahWords(q, 1, 1)[0].text)
  })

  it('attaches pause marks to the word before them', () => {
    const words = ayahWords(q, 2, 2) // ذلك الكتاب لا ريب ۛ فيه ۛ هدى للمتقين
    expect(words.map((w) => w.marks.trim()).filter(Boolean)).toEqual(['ۛ', 'ۛ'])
    expect(words).toHaveLength(7)
    expect(ayahText(q, 2, 2).split(' ')).toHaveLength(9)
  })
})
