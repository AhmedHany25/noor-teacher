/** Every game in the games section, grouped as the teacher sees them. */
import type { ContentKind } from './gameContent'
import { QUIZ_ORDER, QUIZ_TYPES, type QuizType } from './quiz'

export type GameId = QuizType | 'order' | 'erase' | 'pic' | 'match' | 'situation'

export type GameInfo = {
  id: GameId
  title: string
  icon: string
  hint: string
  /** Teacher content it needs; otherwise it works from the Quran text for any surah. */
  needs?: ContentKind
  /** The student can tap an answer (else the teacher judges what the student says). */
  choice: boolean
}

export const GAME_GROUPS: { title: string; hint: string; games: GameInfo[] }[] = [
  {
    title: 'أسئلة الحفظ',
    hint: 'من نص المصحف، شغالة على أي سورة',
    games: QUIZ_ORDER.map((id) => ({ id, ...QUIZ_TYPES[id] })),
  },
  {
    title: 'ألعاب الآيات',
    hint: 'شغالة على أي سورة',
    games: [
      { id: 'order', title: 'رتّب الآية', icon: '🧱', hint: 'كلمات الآية متلخبطة', choice: true },
      { id: 'erase', title: 'المحو التدريجي', icon: '🫧', hint: 'تمحي كلمات والطالب يكمّل من حفظه', choice: false },
    ],
  },
  {
    title: 'ألعاب المعاني',
    hint: 'محتواها من «محتوى الألعاب»',
    games: [
      { id: 'pic', title: 'اختر السورة من الصورة', icon: '🖼️', hint: 'صورة وتلميح، وأنهي سورة؟', needs: 'pic', choice: true },
      { id: 'match', title: 'مطابقة الكلمات بمعانيها', icon: '🔗', hint: 'وصّل كل كلمة بمعناها', needs: 'word', choice: true },
      { id: 'situation', title: 'موقف وآية', icon: '🌙', hint: 'موقف من الحياة ودرسه من القرآن', needs: 'situation', choice: true },
    ],
  },
]

export const ALL_GAMES: GameInfo[] = GAME_GROUPS.flatMap((g) => g.games)

export const gameInfo = (id: string): GameInfo | undefined => ALL_GAMES.find((g) => g.id === id)
