import { useEffect, useMemo, useState } from 'react'
import type { GameInfo } from '../../domain/gameCatalog'
import { orderTasks, passageText, type OrderTask } from '../../domain/gameRounds'
import { ayahWords, type QuranText } from '../../domain/mushaf'
import { ayahCount, surahName } from '../../domain/quran'
import { toArabicDigits } from '../../lib/format'
import { useFeedback, useFinish, useScore, type GameSetup, type Judgement } from './gameHooks'
import { GameFrame, Progress, ResultView } from './shared'

/** «رتّب الآية»: the student taps the words in order; mistakes decide right / with help / wrong. */
export function OrderGame({ info, setup, quran }: { info: GameInfo; setup: GameSetup; quran: QuranText }) {
  const [round, setRound] = useState(0)
  return <OrderRound key={round} info={info} setup={setup} quran={quran} onAgain={() => setRound((r) => r + 1)} />
}

function OrderRound({ info, setup, quran, onAgain }: { info: GameInfo; setup: GameSetup; quran: QuranText; onAgain: () => void }) {
  const [tasks] = useState<OrderTask[]>(() => orderTasks(quran, setup.surahs, Math.random, Math.min(setup.count, 10)))
  const [i, setI] = useState(0)
  const [placed, setPlaced] = useState<number[]>([])
  const [wrong, setWrong] = useState(0)
  const [shake, setShake] = useState<number>()
  const [saved, setSaved] = useState(false)
  const { score, review, add } = useScore()
  const fb = useFeedback()
  const finish = useFinish(info, setup)
  const t = tasks[i]

  useEffect(() => {
    if (!tasks.length) setup.session?.onDone({ ok: 0, help: 0, bad: 0 }, [])
  }, [tasks.length, setup.session])

  if (!tasks.length) {
    return (
      <GameFrame info={info} setup={setup}>
        <section className="empty card">
          <p>اختار سور من صفحة الألعاب الأول.</p>
        </section>
      </GameFrame>
    )
  }
  if (!t) {
    if (setup.session) return null
    return (
      <GameFrame info={info} setup={setup}>
        <ResultView info={info} setup={setup} score={score} review={review} saved={saved} onAgain={onAgain} />
      </GameFrame>
    )
  }
  const done = placed.length === t.words.length
  const judge: Judgement = wrong === 0 ? 'ok' : wrong <= 2 ? 'help' : 'bad'

  function tap(k: number) {
    if (done || placed.includes(k)) return
    if (t.shuffled[k] === t.words[placed.length]) {
      const next = [...placed, k]
      setPlaced(next)
      setShake(undefined)
      if (next.length === t.words.length) fb.judge(wrong === 0 ? 'ok' : wrong <= 2 ? 'help' : 'bad')
      else fb.tick()
    } else {
      setWrong((n) => n + 1)
      setShake(k)
      fb.wrongTap()
    }
  }

  function next() {
    const r = add(judge, `${surahName(t.s)} ${toArabicDigits(t.a)}`)
    if (i + 1 >= tasks.length) setSaved(finish(r))
    setI(i + 1)
    setPlaced([])
    setWrong(0)
    setShake(undefined)
  }

  return (
    <GameFrame info={info} setup={setup} score={score}>
      {fb.layer}
      <section className="game-card card" aria-label="رتّب الآية">
        <Progress i={i} n={tasks.length} />
        <p className="game-ask">
          رتّب كلمات الآية ({surahName(t.s)} {toArabicDigits(t.a)})
        </p>
        <p className="game-quran play-line" aria-label="الكلمات اللي اترتبت">
          {placed.map((k) => t.shuffled[k]).join(' ') || '…'}
        </p>
        <div className="play-chips">
          {t.shuffled.map((w, k) =>
            placed.includes(k) ? null : (
              <button key={k} type="button" className={shake === k ? 'play-chip is-shake' : 'play-chip'} onClick={() => tap(k)}>
                {w}
              </button>
            ),
          )}
        </div>
      </section>
      {done && (
        <div className="game-next">
          <b>{wrong === 0 ? 'من غير ولا غلطة، برافو!' : `خلصها بـ ${toArabicDigits(wrong)} ${wrong === 1 ? 'غلطة' : 'غلطات'}`}</b>
          <button type="button" className="btn btn-primary" onClick={next}>
            {i + 1 < tasks.length ? 'التالي' : setup.session ? 'اللعبة اللي بعدها' : 'النتيجة'}
          </button>
        </div>
      )}
    </GameFrame>
  )
}

const firstLetter = (w: string) => w.match(/^[ء-يٱ][ً-ٰٕ]*/)?.[0] ?? w[0]

/**
 * «المحو التدريجي»: the teacher erases words little by little while the student recites, or leaves
 * only the first letter of each word. Each «أحسنت» is a star.
 */
export function EraseGame({ info, setup, quran }: { info: GameInfo; setup: GameSetup; quran: QuranText }) {
  const [s, setS] = useState(setup.surahs[0] ?? 1)
  const n = ayahCount(s)
  const [from, setFrom] = useState(1)
  const [to, setTo] = useState(Math.min(n, 7))
  const words = useMemo(() => {
    const out: { a: number; text: string }[] = []
    for (let a = from; a <= to; a++) for (const w of ayahWords(quran, s, a)) out.push({ a, text: w.text })
    return out
  }, [quran, s, from, to])
  const [hidden, setHidden] = useState<Set<number>>(new Set())
  const [history, setHistory] = useState<Set<number>[]>([])
  const [letters, setLetters] = useState(false)
  const [step, setStep] = useState(3)
  const [stars, setStars] = useState(0)
  const [finished, setFinished] = useState<boolean | null>(null)
  const fb = useFeedback()
  const finish = useFinish(info, setup)

  function change(next: Set<number>) {
    setHistory((h) => [...h, hidden])
    setHidden(next)
  }
  function erase() {
    const visible = words.map((_, i) => i).filter((i) => !hidden.has(i))
    const next = new Set(hidden)
    for (let k = 0; k < step && visible.length; k++) next.add(visible.splice(Math.floor(Math.random() * visible.length), 1)[0])
    change(next)
  }
  function undo() {
    if (!history.length) return
    setHidden(history[history.length - 1])
    setHistory(history.slice(0, -1))
  }
  function toggle(i: number) {
    const next = new Set(hidden)
    if (next.has(i)) next.delete(i)
    else next.add(i)
    change(next)
  }
  function setRange(f: number, t: number, surah = s) {
    setS(surah)
    setFrom(f)
    setTo(t)
    setHidden(new Set())
    setHistory([])
  }

  if (finished !== null) {
    if (setup.session) return null
    return (
      <GameFrame info={info} setup={setup}>
        <ResultView
          info={info}
          setup={setup}
          score={{ ok: stars, help: 0, bad: 0 }}
          review={[]}
          saved={finished}
          onAgain={() => {
            setFinished(null)
            setStars(0)
            setRange(from, to)
          }}
        />
      </GameFrame>
    )
  }

  const pct = words.length ? Math.round((hidden.size / words.length) * 100) : 0
  return (
    <GameFrame info={info} setup={setup}>
      {fb.layer}
      <div className="mushaf-bar card">
        <select aria-label="السورة" value={s} onChange={(e) => setRange(1, Math.min(ayahCount(Number(e.target.value)), 7), Number(e.target.value))}>
          {(setup.surahs.length ? setup.surahs : [s]).map((x) => (
            <option key={x} value={x}>
              {surahName(x)}
            </option>
          ))}
        </select>
        <label className="erase-range">
          من
          <select aria-label="من آية" value={from} onChange={(e) => setRange(Number(e.target.value), Math.max(to, Number(e.target.value)))}>
            {Array.from({ length: n }, (_, i) => (
              <option key={i} value={i + 1}>
                {toArabicDigits(i + 1)}
              </option>
            ))}
          </select>
          إلى
          <select aria-label="إلى آية" value={to} onChange={(e) => setRange(Math.min(from, Number(e.target.value)), Number(e.target.value))}>
            {Array.from({ length: n }, (_, i) => (
              <option key={i} value={i + 1}>
                {toArabicDigits(i + 1)}
              </option>
            ))}
          </select>
        </label>
        <span className="erase-stars">⭐ {toArabicDigits(stars)}</span>
      </div>

      <section className="game-card card" aria-label={passageText(s, from, to)}>
        <div className="game-progress">
          <span>{letters ? 'أوائل الكلمات' : `اتمحى ${toArabicDigits(pct)}٪`}</span>
          <div className="day-bar" aria-hidden="true">
            <span style={{ width: `${letters ? 100 : pct}%` }} />
          </div>
        </div>
        <p className="game-quran erase-text">
          {words.map((w, i) => {
            const isHidden = hidden.has(i)
            const isLast = i + 1 === words.length || words[i + 1].a !== w.a
            return (
              <span key={i}>
                <button type="button" className={isHidden && !letters ? 'ew is-hidden' : 'ew'} onClick={() => toggle(i)}>
                  {letters && !isHidden ? firstLetter(w.text) : w.text}
                </button>
                {isLast && <span className="ayah-no">{toArabicDigits(w.a)}</span>}{' '}
              </span>
            )
          })}
        </p>
      </section>

      <div className="erase-dock">
        <div className="segmented">
          <button type="button" className={letters ? 'segment-btn' : 'segment-btn is-on'} onClick={() => setLetters(false)}>
            المحو
          </button>
          <button type="button" className={letters ? 'segment-btn is-on' : 'segment-btn'} onClick={() => setLetters(true)}>
            أوائل الكلمات
          </button>
        </div>
        {!letters && (
          <>
            <span className="erase-step">
              <button type="button" className="icon-btn" aria-label="كلمات أقل" onClick={() => setStep(Math.max(1, step - 1))}>
                −
              </button>
              {toArabicDigits(step)} كلمات
              <button type="button" className="icon-btn" aria-label="كلمات أكتر" onClick={() => setStep(Math.min(10, step + 1))}>
                +
              </button>
            </span>
            <button type="button" className="btn btn-primary" onClick={erase} disabled={hidden.size === words.length}>
              🫧 امحي
            </button>
          </>
        )}
        <button
          type="button"
          className="btn btn-gold"
          onClick={() => {
            setStars(stars + 1)
            fb.ok()
          }}
        >
          ⭐ أحسنت
        </button>
        <button type="button" className="btn btn-quiet" onClick={undo} disabled={!history.length}>
          ↺ رجّع
        </button>
        <button type="button" className="btn btn-quiet" onClick={() => change(new Set(words.map((_, i) => i)))}>
          امحي الكل
        </button>
        <button type="button" className="btn btn-quiet" onClick={() => change(new Set())}>
          رجّع الكل
        </button>
        <button
          type="button"
          className="btn btn-quiet"
          onClick={() => setFinished(finish({ score: { ok: stars, help: 0, bad: 0 }, review: [] }, [s]))}
        >
          خلّصنا
        </button>
      </div>
    </GameFrame>
  )
}
