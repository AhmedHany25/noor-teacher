/** Teacher-made content for the picture, meaning and situation games, each tied to a surah. */
export type PicItem = { id: string; kind: 'pic'; s: number; emoji: string; hint: string }
export type WordItem = { id: string; kind: 'word'; s: number; a?: number; word: string; meaning: string }
export type SituationItem = {
  id: string
  kind: 'situation'
  s: number
  ayahs: number[]
  emoji: string
  situation: string
  right: string
  wrong: string[]
  tafsir?: string
}
export type GameContent = PicItem | WordItem | SituationItem
type WithoutId<T> = T extends unknown ? Omit<T, 'id'> : never
export type GameContentInput = WithoutId<GameContent>
export type ContentKind = GameContent['kind']

export const CONTENT_KIND_TEXT: Record<ContentKind, string> = { pic: 'الصور', word: 'معاني الكلمات', situation: 'المواقف' }

/** Items of one kind, optionally only for some surahs. */
export function contentFor<K extends ContentKind>(items: GameContent[], kind: K, surahs?: number[]): Extract<GameContent, { kind: K }>[] {
  return items.filter((x): x is Extract<GameContent, { kind: K }> => x.kind === kind && (!surahs?.length || surahs.includes(x.s)))
}

/** Surahs that have content of a kind, in mushaf order. */
export function surahsWith(items: GameContent[], kind: ContentKind): number[] {
  return [...new Set(items.filter((x) => x.kind === kind).map((x) => x.s))].sort((a, b) => a - b)
}
