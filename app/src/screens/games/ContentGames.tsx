import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import type { GameInfo } from '../../domain/gameCatalog'
import { contentFor, surahsWith, type GameContent } from '../../domain/gameContent'
import { matchRounds, picQuestions, situationQuestions, type MatchRound, type PicQuestion, type SituationQuestion } from '../../domain/gameRounds'
import { ayahText, type QuranText } from '../../domain/mushaf'
import { surahName } from '../../domain/quran'
import { toArabicDigits } from '../../lib/format'
import { useFeedback, useFinish, useScore, type GameSetup, type Judgement } from './gameHooks'
import { GameFrame, JudgeBar, Progress, ResultView } from './shared'

function NoContent({ info, setup }: { info: GameInfo; setup: GameSetup }) {
  return (
    <GameFrame info={info} setup={setup}>
      <section className="empty card">
        <p>مفيش محتوى للعبة دي في السور المختارة.</p>
        <Link to="/games/content" className="btn btn-primary empty-cta">
          أضف محتوى
        </Link>
      </section>
    </GameFrame>
  )
}

/** Shared flow: items one by one, the score, and the end (saved; the next game takes over in a series). */
function useRound<T>(info: GameInfo, setup: GameSetup, make: () => T[]) {
  const [items] = useState<T[]>(make)
  const [i, setI] = useState(0)
  const [saved, setSaved] = useState(false)
  const s = useScore()
  const finish = useFinish(info, setup)
  useEffect(() => {
    if (!items.length) setup.session?.onDone({ ok: 0, help: 0, bad: 0 }, [])
  }, [items.length, setup.session])
  /** Record answers for this item and move on. */
  function advance(answers: { j: Judgement; place: string }[]) {
    let r = { score: s.score, review: s.review }
    for (const a of answers) r = s.add(a.j, a.place)
    if (i + 1 >= items.length) setSaved(finish(r))
    setI(i + 1)
  }
  return { items, i, score: s.score, review: s.review, saved, advance, over: i >= items.length && items.length > 0 }
}

const nextLabel = (i: number, n: number, setup: GameSetup) => (i + 1 < n ? 'التالي' : setup.session ? 'اللعبة اللي بعدها' : 'النتيجة')

export function PicGame(props: { info: GameInfo; setup: GameSetup; content: GameContent[] }) {
  const [round, setRound] = useState(0)
  return <PicRound key={round} {...props} onAgain={() => setRound((r) => r + 1)} />
}

function PicRound({ info, setup, content, onAgain }: { info: GameInfo; setup: GameSetup; content: GameContent[]; onAgain: () => void }) {
  const r = useRound<PicQuestion>(info, setup, () => picQuestions(contentFor(content, 'pic', setup.surahs), surahsWith(content, 'pic'), Math.random, setup.count))
  const [picked, setPicked] = useState<string>()
  const [hint, setHint] = useState(false)
  const [shown, setShown] = useState(false)
  const fb = useFeedback()
  const tap = setup.mode === 'tap'
  if (!r.items.length) return <NoContent info={info} setup={setup} />
  if (r.over) return setup.session ? null : <ResultAgain info={info} setup={setup} r={r} onAgain={onAgain} />
  const x = r.items[r.i]

  function next(j: Judgement) {
    if (!tap) fb.judge(j)
    r.advance([{ j, place: `سورة ${surahName(x.item.s)}` }])
    setPicked(undefined)
    setHint(false)
    setShown(false)
  }

  return (
    <GameFrame info={info} setup={setup} score={r.score}>
      {fb.layer}
      <section className="game-card card" aria-label="الصورة">
        <Progress i={r.i} n={r.items.length} />
        <p className="pic-emoji" aria-hidden="true">
          {x.item.emoji}
        </p>
        {hint ? (
          <p className="game-plain pic-hint">{x.item.hint}</p>
        ) : (
          <button type="button" className="link-btn" onClick={() => setHint(true)}>
            تلميح
          </button>
        )}
        <p className="game-ask">أنهي سورة؟</p>
        {(tap || shown) && (
          <div className="game-options">
            {x.options.map((o) => {
              const state = !(picked || shown) ? '' : o === x.answer ? ' is-right' : o === picked ? ' is-wrong' : ''
              return (
                <button
                  key={o}
                  type="button"
                  className={`game-option${state}`}
                  disabled={!tap || !!picked}
                  onClick={() => {
                    setPicked(o)
                    if (o === x.answer) fb.ok()
                    else fb.bad()
                  }}
                >
                  {o}
                </button>
              )
            })}
          </div>
        )}
        {!tap && !shown && (
          <button type="button" className="btn btn-quiet game-reveal" onClick={() => setShown(true)}>
            اعرض الاختيارات
          </button>
        )}
      </section>
      {tap ? (
        picked && (
          <div className="game-next">
            <b>{picked === x.answer ? 'صح، برافو!' : `الإجابة: ${x.answer}`}</b>
            <button type="button" className="btn btn-primary" onClick={() => next(picked === x.answer ? 'ok' : 'bad')}>
              {nextLabel(r.i, r.items.length, setup)}
            </button>
          </div>
        )
      ) : (
        <JudgeBar onJudge={next} />
      )}
    </GameFrame>
  )
}

/** The result screen with «العب تاني» wired to restart this game. */
function ResultAgain({ info, setup, r, onAgain }: { info: GameInfo; setup: GameSetup; r: { score: { ok: number; help: number; bad: number }; review: string[]; saved: boolean }; onAgain: () => void }) {
  return (
    <GameFrame info={info} setup={setup}>
      <ResultView info={info} setup={setup} score={r.score} review={r.review} saved={r.saved} onAgain={onAgain} />
    </GameFrame>
  )
}

export function MatchGame(props: { info: GameInfo; setup: GameSetup; content: GameContent[] }) {
  const [round, setRound] = useState(0)
  return <MatchRoundView key={round} {...props} onAgain={() => setRound((r) => r + 1)} />
}

function MatchRoundView({ info, setup, content, onAgain }: { info: GameInfo; setup: GameSetup; content: GameContent[]; onAgain: () => void }) {
  const r = useRound<MatchRound>(info, setup, () => matchRounds(contentFor(content, 'word', setup.surahs), Math.random, Math.max(1, Math.ceil(setup.count / 4))))
  const [sel, setSel] = useState<string>()
  const [done, setDone] = useState<string[]>([])
  const [missed, setMissed] = useState<string[]>([])
  const [flash, setFlash] = useState<string>()
  const fb = useFeedback()
  if (!r.items.length) return <NoContent info={info} setup={setup} />
  if (r.over) return setup.session ? null : <ResultAgain info={info} setup={setup} r={r} onAgain={onAgain} />
  const x = r.items[r.i]
  const finished = done.length === x.pairs.length

  function pickMeaning(id: string) {
    if (!sel || done.includes(id)) return
    if (id === sel) {
      const next = [...done, id]
      setDone(next)
      setSel(undefined)
      if (next.length === x.pairs.length) {
        if (missed.length) fb.help()
        else fb.ok()
      } else fb.tick()
    } else {
      setMissed((m) => (m.includes(sel) ? m : [...m, sel]))
      setFlash(id)
      fb.wrongTap()
      setTimeout(() => setFlash(undefined), 500)
    }
  }

  function next() {
    // Each word counts once: right the first time, or missed.
    r.advance(x.pairs.map((p) => ({ j: missed.includes(p.id) ? 'bad' : 'ok', place: `${p.word} (${surahName(p.s)}${p.a ? ` ${toArabicDigits(p.a)}` : ''})` })))
    setDone([])
    setMissed([])
    setSel(undefined)
  }

  return (
    <GameFrame info={info} setup={setup} score={r.score}>
      {fb.layer}
      <section className="game-card card" aria-label="المطابقة">
        <Progress i={r.i} n={r.items.length} />
        <p className="game-ask">اختار الكلمة وبعدين معناها</p>
        <div className="match-grid">
          <div className="match-col">
            {x.pairs.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`match-word${done.includes(p.id) ? ' is-done' : ''}${sel === p.id ? ' is-sel' : ''}`}
                disabled={done.includes(p.id)}
                onClick={() => setSel(p.id)}
              >
                {p.word}
              </button>
            ))}
          </div>
          <div className="match-col">
            {x.meanings.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`match-meaning${done.includes(p.id) ? ' is-done' : ''}${flash === p.id ? ' is-wrong' : ''}`}
                disabled={done.includes(p.id)}
                onClick={() => pickMeaning(p.id)}
              >
                {p.meaning}
              </button>
            ))}
          </div>
        </div>
      </section>
      {finished && (
        <div className="game-next">
          <b>{missed.length ? `خلصها بـ ${toArabicDigits(missed.length)} غلط` : 'كلها صح، برافو!'}</b>
          <button type="button" className="btn btn-primary" onClick={next}>
            {nextLabel(r.i, r.items.length, setup)}
          </button>
        </div>
      )}
    </GameFrame>
  )
}

export function SituationGame(props: { info: GameInfo; setup: GameSetup; quran: QuranText; content: GameContent[] }) {
  const [round, setRound] = useState(0)
  return <SituationRound key={round} {...props} onAgain={() => setRound((r) => r + 1)} />
}

function SituationRound({
  info,
  setup,
  quran,
  content,
  onAgain,
}: {
  info: GameInfo
  setup: GameSetup
  quran: QuranText
  content: GameContent[]
  onAgain: () => void
}) {
  const r = useRound<SituationQuestion>(info, setup, () => situationQuestions(contentFor(content, 'situation', setup.surahs), Math.random, setup.count))
  const [picked, setPicked] = useState<string>()
  const fb = useFeedback()
  if (!r.items.length) return <NoContent info={info} setup={setup} />
  if (r.over) return setup.session ? null : <ResultAgain info={info} setup={setup} r={r} onAgain={onAgain} />
  const x = r.items[r.i]

  function next() {
    r.advance([{ j: picked === x.item.right ? 'ok' : 'bad', place: `${surahName(x.item.s)} ${x.item.ayahs.map(toArabicDigits).join('، ')}` }])
    setPicked(undefined)
  }

  return (
    <GameFrame info={info} setup={setup} score={r.score}>
      {fb.layer}
      <section className="game-card card" aria-label="الموقف">
        <Progress i={r.i} n={r.items.length} />
        <p className="pic-emoji" aria-hidden="true">
          {x.item.emoji}
        </p>
        <p className="game-plain situation-text">{x.item.situation}</p>
        <p className="game-ask">إيه الدرس اللي بنتعلمه من القرآن؟</p>
        <div className="game-options">
          {x.options.map((o) => {
            const state = !picked ? '' : o === x.item.right ? ' is-right' : o === picked ? ' is-wrong' : ''
            return (
              <button
                key={o}
                type="button"
                className={`game-option${state}`}
                disabled={!!picked}
                onClick={() => {
                  setPicked(o)
                  if (o === x.item.right) fb.ok()
                  else fb.bad()
                }}
              >
                {o}
              </button>
            )
          })}
        </div>
        {picked && (
          <div className="situation-ayah">
            <p className="game-quran">
              {x.item.ayahs.map((a) => (
                <span key={a}>
                  {ayahText(quran, x.item.s, a)} <span className="ayah-no">{toArabicDigits(a)}</span>{' '}
                </span>
              ))}
            </p>
            <p className="field-hint">سورة {surahName(x.item.s)}</p>
            {x.item.tafsir && <p className="situation-tafsir">{x.item.tafsir}</p>}
          </div>
        )}
      </section>
      {picked && (
        <div className="game-next">
          <b>{picked === x.item.right ? 'صح، برافو!' : 'الدرس الصح متعلّم عليه بالأخضر'}</b>
          <button type="button" className="btn btn-primary" onClick={next}>
            {nextLabel(r.i, r.items.length, setup)}
          </button>
        </div>
      )}
    </GameFrame>
  )
}
