import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { PageHeader } from '../../components/PageHeader'
import { useData, useGameContent } from '../../data/data'
import { CONTENT_KIND_TEXT, contentFor, surahsWith, type ContentKind, type GameContent, type GameContentInput } from '../../domain/gameContent'
import { ayahCount, surahName } from '../../domain/quran'
import { SURAHS } from '../../domain/surahs'
import { toArabicDigits } from '../../lib/format'
import { useSeedGameContent } from './gameHooks'

type Draft = Record<string, string>

const EMPTY: Record<ContentKind, Draft> = {
  pic: { s: '', emoji: '', hint: '' },
  word: { s: '', a: '', word: '', meaning: '' },
  situation: { s: '', ayahs: '', emoji: '', situation: '', right: '', wrong1: '', wrong2: '', tafsir: '' },
}

function draftOf(x: GameContent): Draft {
  if (x.kind === 'pic') return { s: String(x.s), emoji: x.emoji, hint: x.hint }
  if (x.kind === 'word') return { s: String(x.s), a: x.a ? String(x.a) : '', word: x.word, meaning: x.meaning }
  return {
    s: String(x.s),
    ayahs: x.ayahs.join('، '),
    emoji: x.emoji,
    situation: x.situation,
    right: x.right,
    wrong1: x.wrong[0] ?? '',
    wrong2: x.wrong[1] ?? '',
    tafsir: x.tafsir ?? '',
  }
}

const numbers = (t: string) =>
  t
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .split(/[^0-9]+/)
    .map(Number)
    .filter((n) => n > 0)

/** The item from a draft, or an error message. */
function inputOf(kind: ContentKind, d: Draft): GameContentInput | string {
  const s = Number(d.s)
  if (!s) return 'اختار السورة.'
  if (kind === 'pic') {
    if (!d.emoji.trim() || !d.hint.trim()) return 'اكتب الإيموجي والتلميح.'
    return { kind, s, emoji: d.emoji.trim(), hint: d.hint.trim() }
  }
  if (kind === 'word') {
    if (!d.word.trim() || !d.meaning.trim()) return 'اكتب الكلمة ومعناها.'
    const a = Number(numbers(d.a)[0]) || undefined
    if (a && a > ayahCount(s)) return `${surahName(s)} فيها ${toArabicDigits(ayahCount(s))} آية.`
    return { kind, s, ...(a ? { a } : {}), word: d.word.trim(), meaning: d.meaning.trim() }
  }
  const ayahs = numbers(d.ayahs).filter((a) => a <= ayahCount(s))
  if (!ayahs.length) return 'اكتب رقم آية واحدة على الأقل.'
  if (!d.situation.trim() || !d.right.trim() || !d.wrong1.trim()) return 'اكتب الموقف والدرس الصح واختيار غلط واحد على الأقل.'
  return {
    kind,
    s,
    ayahs,
    emoji: d.emoji.trim() || '🌙',
    situation: d.situation.trim(),
    right: d.right.trim(),
    wrong: [d.wrong1.trim(), d.wrong2.trim()].filter(Boolean),
    ...(d.tafsir.trim() ? { tafsir: d.tafsir.trim() } : {}),
  }
}

/** Route: /games/content — pictures, word meanings and situations, each tied to a surah. */
export function GameContentScreen() {
  useSeedGameContent()
  const { repos, notify } = useData()
  const { items } = useGameContent()
  const [kind, setKind] = useState<ContentKind>('pic')
  const [filter, setFilter] = useState(0)
  const [editing, setEditing] = useState<{ id?: string; draft: Draft } | null>(null)
  const [error, setError] = useState('')

  const list = contentFor(items, kind, filter ? [filter] : undefined).sort((a, b) => a.s - b.s)
  const surahs = surahsWith(items, kind)

  function save(e: FormEvent) {
    e.preventDefault()
    if (!editing) return
    const x = inputOf(kind, editing.draft)
    if (typeof x === 'string') return setError(x)
    if (editing.id) repos.gameContent.update(editing.id, x)
    else repos.gameContent.create(x)
    notify('اتحفظ')
    setEditing(null)
    setError('')
  }

  function remove(id: string) {
    if (!window.confirm('حذف العنصر ده؟')) return
    repos.gameContent.remove(id)
    notify('اتحذف')
  }

  const d = editing?.draft
  const set = (k: string, v: string) => setEditing((x) => (x ? { ...x, draft: { ...x.draft, [k]: v } } : x))

  return (
    <>
      <PageHeader
        title="محتوى الألعاب"
        subtitle="للألعاب اللي محتاجة تأليف: الصور والمعاني والمواقف"
        action={
          <Link to="/games" className="btn btn-ghost-light">
            الألعاب
          </Link>
        }
      />

      <div className="tabs view-tabs" role="tablist" aria-label="نوع المحتوى">
        {(Object.keys(CONTENT_KIND_TEXT) as ContentKind[]).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            className="tab"
            aria-selected={kind === k}
            onClick={() => {
              setKind(k)
              setFilter(0)
              setEditing(null)
            }}
          >
            {CONTENT_KIND_TEXT[k]} ({toArabicDigits(contentFor(items, k).length)})
          </button>
        ))}
      </div>

      <div className="content-bar card">
        <select aria-label="السورة" value={filter} onChange={(e) => setFilter(Number(e.target.value))}>
          <option value={0}>كل السور ({toArabicDigits(surahs.length)})</option>
          {surahs.map((s) => (
            <option key={s} value={s}>
              {surahName(s)} ({toArabicDigits(contentFor(items, kind, [s]).length)})
            </option>
          ))}
        </select>
        <button type="button" className="btn btn-primary" onClick={() => setEditing({ draft: { ...EMPTY[kind], s: filter ? String(filter) : '' } })}>
          + إضافة
        </button>
      </div>

      {editing && d && (
        <form className="card content-form" onSubmit={save} aria-label={editing.id ? 'تعديل' : 'إضافة'} noValidate>
          <label className="field">
            <span>السورة</span>
            <select value={d.s} onChange={(e) => set('s', e.target.value)}>
              <option value="">اختار…</option>
              {SURAHS.map(([name], i) => (
                <option key={i} value={i + 1}>
                  {toArabicDigits(i + 1)}. {name}
                </option>
              ))}
            </select>
          </label>
          {kind === 'pic' && (
            <>
              <label className="field">
                <span>الإيموجي (الصورة)</span>
                <input value={d.emoji} onChange={(e) => set('emoji', e.target.value)} placeholder="🐘" />
              </label>
              <label className="field">
                <span>التلميح</span>
                <input value={d.hint} onChange={(e) => set('hint', e.target.value)} placeholder="أصحاب الفيل وأبرهة" />
              </label>
            </>
          )}
          {kind === 'word' && (
            <>
              <div className="form-row">
                <label className="field">
                  <span>الكلمة</span>
                  <input className="is-quran" value={d.word} onChange={(e) => set('word', e.target.value)} />
                </label>
                <label className="field">
                  <span>رقم الآية (اختياري)</span>
                  <input inputMode="numeric" value={d.a} onChange={(e) => set('a', e.target.value)} />
                </label>
              </div>
              <label className="field">
                <span>المعنى</span>
                <input value={d.meaning} onChange={(e) => set('meaning', e.target.value)} />
              </label>
            </>
          )}
          {kind === 'situation' && (
            <>
              <div className="form-row">
                <label className="field">
                  <span>أرقام الآيات</span>
                  <input value={d.ayahs} onChange={(e) => set('ayahs', e.target.value)} placeholder="٤، ٦" />
                </label>
                <label className="field">
                  <span>إيموجي المشهد</span>
                  <input value={d.emoji} onChange={(e) => set('emoji', e.target.value)} placeholder="🤲💰" />
                </label>
              </div>
              <label className="field">
                <span>الموقف</span>
                <textarea rows={2} value={d.situation} onChange={(e) => set('situation', e.target.value)} />
              </label>
              <label className="field">
                <span>الدرس الصح</span>
                <input value={d.right} onChange={(e) => set('right', e.target.value)} />
              </label>
              <div className="form-row">
                <label className="field">
                  <span>اختيار غلط</span>
                  <input value={d.wrong1} onChange={(e) => set('wrong1', e.target.value)} />
                </label>
                <label className="field">
                  <span>اختيار غلط تاني</span>
                  <input value={d.wrong2} onChange={(e) => set('wrong2', e.target.value)} />
                </label>
              </div>
              <label className="field">
                <span>التفسير المبسّط (اختياري)</span>
                <textarea rows={2} value={d.tafsir} onChange={(e) => set('tafsir', e.target.value)} />
              </label>
            </>
          )}
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              حفظ
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => setEditing(null)}>
              إلغاء
            </button>
          </div>
        </form>
      )}

      {list.length === 0 ? (
        <section className="empty card">
          <p>مفيش {CONTENT_KIND_TEXT[kind]} {filter ? `لسورة ${surahName(filter)}` : 'لسه'}. دوس «إضافة».</p>
        </section>
      ) : (
        <ul className="content-list card" aria-label={CONTENT_KIND_TEXT[kind]}>
          {list.map((x) => (
            <li key={x.id}>
              <span className="content-main">
                {x.kind === 'pic' && (
                  <>
                    <span className="content-emoji">{x.emoji}</span> {x.hint}
                  </>
                )}
                {x.kind === 'word' && (
                  <>
                    <b className="is-quran">{x.word}</b> = {x.meaning}
                  </>
                )}
                {x.kind === 'situation' && (
                  <>
                    <span className="content-emoji">{x.emoji}</span> {x.situation}
                  </>
                )}
                <small>
                  {surahName(x.s)}
                  {x.kind === 'word' && x.a ? ` ${toArabicDigits(x.a)}` : ''}
                  {x.kind === 'situation' ? ` ${x.ayahs.map(toArabicDigits).join('، ')}` : ''}
                </small>
              </span>
              <span className="content-actions">
                <button type="button" className="link-btn" onClick={() => (setEditing({ id: x.id, draft: draftOf(x) }), setError(''))}>
                  تعديل
                </button>
                <button type="button" className="link-btn" onClick={() => remove(x.id)}>
                  حذف
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
