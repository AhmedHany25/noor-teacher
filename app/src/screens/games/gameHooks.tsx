import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { useData, useGameContent, useGroups, useProfile, useSessions, useStudents } from '../../data/data'
import { DEFAULT_GAME_CONTENT } from '../../domain/gameDefaults'
import { findLessonTarget, noteWrite } from '../../domain/lessonTarget'
import type { GameResult } from '../../domain/notes'
import type { Student } from '../../domain/student'
import { useClock } from '../../lib/clock'

export type Judgement = 'ok' | 'help' | 'bad'
export const JUDGE_TEXT: Record<Judgement, string> = { ok: 'صح', help: 'بمساعدة', bad: 'خطأ' }

/** The choices made on the games screen, carried in the link: student, surahs, how many, who answers. */
export type GameSetup = { student?: Student; surahs: number[]; count: number; mode: 'judge' | 'tap'; query: string }

export function useGameSetup(): GameSetup {
  const [params] = useSearchParams()
  const { items: students } = useStudents()
  const student = students.find((s) => s.id === params.get('student'))
  const surahs = (params.get('s') ?? '')
    .split(',')
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 114)
  const count = Math.min(30, Math.max(3, Number(params.get('n')) || 10))
  const mode = params.get('mode') === 'tap' ? 'tap' : 'judge'
  return { student, surahs, count, mode, query: params.toString() }
}

/** Score kept during a game. */
export function useScore() {
  const [score, setScore] = useState({ ok: 0, help: 0, bad: 0 })
  const [review, setReview] = useState<string[]>([])
  const add = (j: Judgement, place?: string) => {
    setScore((s) => ({ ...s, [j]: s[j] + 1 }))
    if (j !== 'ok' && place) setReview((r) => (r.includes(place) ? r : [...r, place]))
  }
  return { score, review, add }
}

/** A short chime and a burst of stars for a right answer. */
export function useCelebrate(): { celebrate: () => void; layer: ReactNode } {
  const [burst, setBurst] = useState(0)
  const audio = useRef<AudioContext | null>(null)
  function celebrate() {
    setBurst((b) => b + 1)
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctx) return
      const c = (audio.current ??= new Ctx())
      const t = c.currentTime
      ;[523, 659, 784].forEach((f, k) => {
        const o = c.createOscillator()
        const g = c.createGain()
        o.type = 'sine'
        o.frequency.value = f
        g.gain.setValueAtTime(0.0001, t + k * 0.12)
        g.gain.exponentialRampToValueAtTime(0.12, t + k * 0.12 + 0.02)
        g.gain.exponentialRampToValueAtTime(0.0001, t + k * 0.12 + 0.6)
        o.connect(g)
        g.connect(c.destination)
        o.start(t + k * 0.12)
        o.stop(t + k * 0.12 + 0.65)
      })
    } catch {
      // no sound on this device
    }
  }
  const layer = burst ? (
    <div className="celebrate" key={burst} aria-hidden="true">
      {Array.from({ length: 12 }, (_, i) => (
        <span key={i} style={{ ['--i' as string]: i }}>
          ★
        </span>
      ))}
    </div>
  ) : null
  return { celebrate, layer }
}

/** Saves a finished game in the student's lesson today (recording them present if needed). */
export function useSaveResult(setup: GameSetup) {
  const { repos, notify } = useData()
  const { today } = useClock()
  const { items: groups } = useGroups()
  const { items: sessions } = useSessions()
  const target = useMemo(
    () => (setup.student ? findLessonTarget({ studentId: setup.student.id, groups, sessions, today, allowPast: false }) : undefined),
    [setup.student, groups, sessions, today],
  )
  function save(result: Omit<GameResult, 'at'>): boolean {
    const st = setup.student
    if (!st || !target) return false
    const note = target.session?.notes?.[st.id] ?? {}
    const write = noteWrite(target, st.id, { ...note, games: [...(note.games ?? []), { ...result, at: Date.now() }] }, groups, Date.now())
    if (!write) return false
    if (write.kind === 'patch') repos.sessions.patch(write.id, write.fields)
    else repos.sessions.put(write.id, write.value)
    notify(write.recordedPresent ? `اتسجلت النتيجة واتسجل حضور ${st.name}` : 'اتسجلت النتيجة في حصة النهارده')
    return true
  }
  return { canSave: !!(setup.student && target), save }
}


/** Loads the ready-made content once (later deletions stay deleted). */
export function useSeedGameContent() {
  const { repos } = useData()
  const { profile, loading } = useProfile()
  const { items, loading: l2 } = useGameContent()
  useEffect(() => {
    if (loading || l2 || profile.gameSeeded) return
    if (!items.length) for (const x of DEFAULT_GAME_CONTENT) repos.gameContent.create(x)
    repos.profile.patch({ gameSeeded: true })
  }, [loading, l2, profile.gameSeeded, items.length, repos])
}

