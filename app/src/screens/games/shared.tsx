import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { PageHeader } from '../../components/PageHeader'
import type { GameInfo } from '../../domain/gameCatalog'
import { toArabicDigits } from '../../lib/format'
import { JUDGE_TEXT, type GameSetup, type Judgement } from './gameHooks'

/** The teacher's three buttons after the student answers aloud. */
export function JudgeBar({ onJudge }: { onJudge: (j: Judgement) => void }) {
  return (
    <div className="judge-bar" role="group" aria-label="تقييم الإجابة">
      {(Object.keys(JUDGE_TEXT) as Judgement[]).map((j) => (
        <button key={j} type="button" className={`judge judge-${j}`} onClick={() => onJudge(j)}>
          {JUDGE_TEXT[j]}
        </button>
      ))}
    </div>
  )
}

export function Progress({ i, n }: { i: number; n: number }) {
  return (
    <div className="game-progress">
      <span>
        {toArabicDigits(Math.min(i + 1, n))} من {toArabicDigits(n)}
      </span>
      <div className="day-bar" aria-hidden="true">
        <span style={{ width: `${Math.round((i / Math.max(1, n)) * 100)}%` }} />
      </div>
    </div>
  )
}

/** Page frame for a game: header with the way back to the games list. */
export function GameFrame({ info, setup, children }: { info: GameInfo; setup: GameSetup; children: ReactNode }) {
  return (
    <div className="game-screen">
      <PageHeader
        title={`${info.icon} ${info.title}`}
        subtitle={setup.student ? setup.student.name : undefined}
        action={
          <Link to={`/games?${setup.query}`} className="btn btn-ghost-light">
            الألعاب
          </Link>
        }
      />
      {children}
    </div>
  )
}

/** The end of a game: stars, the score, what to review, and where it was saved. */
export function ResultView({
  info,
  setup,
  score,
  review,
  saved,
  onAgain,
}: {
  info: GameInfo
  setup: GameSetup
  score: { ok: number; help: number; bad: number }
  review: string[]
  saved: boolean
  onAgain: () => void
}) {
  const total = score.ok + score.help + score.bad
  const ratio = total ? (score.ok + score.help * 0.5) / total : 0
  const stars = !total ? 0 : ratio >= 0.9 ? 3 : ratio >= 0.65 ? 2 : 1
  return (
    <section className="game-result card" aria-label="النتيجة">
      <p className="play-stars" aria-label={`${toArabicDigits(stars)} نجوم`}>
        {'★'.repeat(stars)}
        <span>{'★'.repeat(3 - stars)}</span>
      </p>
      <div className="result-counts">
        <span className="rc-ok">
          <b>{toArabicDigits(score.ok)}</b> صح
        </span>
        <span className="rc-help">
          <b>{toArabicDigits(score.help)}</b> بمساعدة
        </span>
        <span className="rc-bad">
          <b>{toArabicDigits(score.bad)}</b> خطأ
        </span>
      </div>
      {review.length > 0 && (
        <div className="result-review">
          <h3>محتاج مراجعة</h3>
          <p>{review.join('، ')}</p>
        </div>
      )}
      <p className="field-hint">
        {saved
          ? `اتسجلت في حصة ${setup.student?.name} النهارده، وهتظهر في تقريرها.`
          : setup.student
            ? `مفيش حصة لـ${setup.student.name} النهارده، فالنتيجة مااتسجلتش.`
            : 'اختار الطالب من صفحة الألعاب عشان النتيجة تتسجل في حصته.'}
      </p>
      <div className="play-again">
        <button type="button" className="btn btn-primary" onClick={onAgain}>
          العب تاني
        </button>
        <Link to={`/games?${setup.query}`} className="btn btn-quiet">
          لعبة تانية
        </Link>
      </div>
      <span className="sr-only">{info.title}</span>
    </section>
  )
}
