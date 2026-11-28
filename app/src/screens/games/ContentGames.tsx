import { useState } from 'react'
import { Link } from 'react-router'
import type { GameInfo } from '../../domain/gameCatalog'
import { contentFor, surahsWith, type GameContent } from '../../domain/gameContent'
import { matchRounds, picQuestions, situationQuestions, type MatchRound, type PicQuestion, type SituationQuestion } from '../../domain/gameRounds'
import { ayahText, type QuranText } from '../../domain/mushaf'
import { surahName } from '../../domain/quran'
import { toArabicDigits } from '../../lib/format'
import { useCelebrate, useSaveResult, useScore, type GameSetup, type Judgement } from './gameHooks'
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

/** Shared flow: questions one by one, answer, score, result. */
function useRound<T>(make: () => T[]) {
  const [items] = useState<T[]>(make)
  const [i, setI] = useState(0)
  const [saved, setSaved] = useState(false)
  const s = useScore()
  return { items, i, setI, saved, setSaved, ...s }
}

export function PicGame(props: { info: GameInfo; setup: GameSetup; content: GameContent[] }) {
  const [round, setRound] = useState(0)
  return <PicRound key={round} {...props} onAgain={() => setRound((r) => r + 1)} />
}

function PicRound({ info, setup, content, onAgain }: { info: GameInfo; setup: GameSetup; content: GameContent[]; onAgain: () => void }) {
  const pics = contentFor(content, 'pic', setup.surahs)
  const r = useRound<PicQuestion>(() => picQuestions(pics, surahsWith(content, 'pic'), Math.random, setup.count))
  const [picked, setPicked] = useState<string>()
  const [hint, setHint] = useState(false)
  const [shown, setShown] = useState(false)
  const { celebrate, layer } = useCelebrate()
  const { save } = useSaveResult(setup)
  const tap = setup.mode === 'tap'
  if (!r.items.length) return <NoContent info={info} setup={setup} />
  const x = r.items[r.i]
  if (!x) {
    return (
      <GameFrame info={info} setup={setup}>
        <ResultView info={info} setup={setup} score={r.score} review={r.review} saved={r.saved} onAgain={onAgain} />
      </GameFrame>
    )
  }

  function next(j: Judgement) {
    const place = `سورة ${surahName(x.item.s)}`
    r.add(j, place)
    if (j === 'ok' && !tap) celebrate()
    if (r.i + 1 >= r.items.length) {
      const sc = { ok: r.score.ok + (j === 'ok' ? 1 : 0), help: r.score.help + (j === 'help' ? 1 : 0), bad: r.score.bad + (j === 'bad' ? 1 : 0) }
      r.setSaved(save({ game: info.id, title: info.title, ...sc, surahs: setup.surahs, review: j === 'ok' ? r.review : [...r.review, place] }))
    }
    r.setI(r.i + 1)
    setPicked(undefined)
    setHint(false)
    setShown(false)
  }

  return (
    <GameFrame info={info} setup={setup}>
      {layer}
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
                    if (o === x.answer) celebrate()
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
              {r.i + 1 < r.items.length ? 'التالي' : 'النتيجة'}
            </button>
          </div>
        )
      ) : (
        <JudgeBar onJudge={next} />
      )}
    </GameFrame>
  )
}

export function MatchGame(props: { info: GameInfo; setup: GameSetup; content: GameContent[] }) {
  const [round, setRound] = useState(0)
  return <MatchRoundView key={round} {...props} onAgain={() => setRound((r) => r + 1)} />
}

function MatchRoundView({ info, setup, content, onAgain }: { info: GameInfo; setup: GameSetup; content: GameContent[]; onAgain: () => void }) {
  const words = contentFor(content, 'word', setup.surahs)
  const r = useRound<MatchRound>(() => matchRounds(words, Math.random, Math.max(1, Math.ceil(setup.count / 4))))
  const [sel, setSel] = useState<string>()
  const [done, setDone] = useState<string[]>([])
  const [missed, setMissed] = useState<string[]>([])
  const [flash, setFlash] = useState<string>()
  const { celebrate, layer } = useCelebrate()
  const { save } = useSaveResult(setup)
  if (!r.items.length) return <NoContent info={info} setup={setup} />
  const x = r.items[r.i]
  if (!x) {
    return (
      <GameFrame info={info} setup={setup}>
        <ResultView info={info} setup={setup} score={r.score} review={r.review} saved={r.saved} onAgain={onAgain} />
      </GameFrame>
    )
  }
  const finished = done.length === x.pairs.length

  function pickMeaning(id: string) {
    if (!sel || done.includes(id)) return
    if (id === sel) {
      setDone([...done, id])
      setSel(undefined)
      if (!missed.includes(id)) celebrate()
    } else {
      setMissed((m) => (m.includes(sel) ? m : [...m, sel]))
      setFlash(id)
      setTimeout(() => setFlash(undefined), 500)
    }
  }

  function next() {
    // Each word counts once: right first time, or missed.
    let sc = r.score
    let rev = r.review
    for (const p of x.pairs) {
      const j: Judgement = missed.includes(p.id) ? 'bad' : 'ok'
      const place = `${p.word} (${surahName(p.s)}${p.a ? ` ${toArabicDigits(p.a)}` : ''})`
      r.add(j, place)
      sc = { ...sc, [j]: sc[j] + 1 }
      if (j === 'bad') rev = [...rev, place]
    }
    if (r.i + 1 >= r.items.length) r.setSaved(save({ game: info.id, title: info.title, ...sc, surahs: setup.surahs, review: rev }))
    r.setI(r.i + 1)
    setDone([])
    setMissed([])
    setSel(undefined)
  }

  return (
    <GameFrame info={info} setup={setup}>
      {layer}
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
            {r.i + 1 < r.items.length ? 'التالي' : 'النتيجة'}
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
  const items = contentFor(content, 'situation', setup.surahs)
  const r = useRound<SituationQuestion>(() => situationQuestions(items, Math.random, setup.count))
  const [picked, setPicked] = useState<string>()
  const { celebrate, layer } = useCelebrate()
  const { save } = useSaveResult(setup)
  if (!r.items.length) return <NoContent info={info} setup={setup} />
  const x = r.items[r.i]
  if (!x) {
    return (
      <GameFrame info={info} setup={setup}>
        <ResultView info={info} setup={setup} score={r.score} review={r.review} saved={r.saved} onAgain={onAgain} />
      </GameFrame>
    )
  }

  function next() {
    const j: Judgement = picked === x.item.right ? 'ok' : 'bad'
    const place = `${surahName(x.item.s)} ${x.item.ayahs.map(toArabicDigits).join('، ')}`
    r.add(j, place)
    if (r.i + 1 >= r.items.length) {
      const sc = { ...r.score, [j]: r.score[j] + 1 }
      r.setSaved(save({ game: info.id, title: info.title, ...sc, surahs: setup.surahs, review: j === 'ok' ? r.review : [...r.review, place] }))
    }
    r.setI(r.i + 1)
    setPicked(undefined)
  }

  return (
    <GameFrame info={info} setup={setup}>
      {layer}
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
                  if (o === x.item.right) celebrate()
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
            {r.i + 1 < r.items.length ? 'التالي' : 'النتيجة'}
          </button>
        </div>
      )}
    </GameFrame>
  )
}
