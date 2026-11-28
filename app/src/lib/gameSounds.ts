/**
 * Small synthesised sounds for the games (no files to download, works offline).
 * Right answers have several cheerful tunes; «بمساعدة» and «خطأ» each have one gentle sound.
 */

const MUTE_KEY = 'noor-games-muted'
let ctx: AudioContext | null = null

export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

export function setMuted(m: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, m ? '1' : '0')
  } catch {
    // remembered for this visit only
  }
}

function audio(): AudioContext | null {
  if (isMuted()) return null
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return null
    ctx ??= new Ctx()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function note(c: AudioContext, freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.12, slideTo?: number) {
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, start)
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, start + dur)
  g.gain.setValueAtTime(0.0001, start)
  g.gain.exponentialRampToValueAtTime(vol, start + 0.015)
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  o.connect(g)
  g.connect(c.destination)
  o.start(start)
  o.stop(start + dur + 0.05)
}

/** A bell: a sine with a soft overtone. */
function bell(c: AudioContext, f: number, s: number, d: number, v = 0.11) {
  note(c, f, s, d, 'sine', v)
  note(c, f * 2.76, s, d * 0.4, 'sine', v * 0.25)
}

function play(fn: (c: AudioContext, t: number) => void) {
  const c = audio()
  if (!c) return
  try {
    fn(c, c.currentTime)
  } catch {
    // ignore sound errors
  }
}

/** The celebration tunes, matched with the animations in the games screen. */
export const CHEERS = {
  stars: () => play((c, t) => [523, 659, 784, 1047].forEach((f, k) => bell(c, f, t + k * 0.11, 0.8))),
  hearts: () => play((c, t) => [392, 523, 659].forEach((f, k) => bell(c, f, t + k * 0.2, 1.1, 0.12))),
  trophy: () => play((c, t) => [523, 523, 523, 784, 659, 784, 1047].forEach((f, k) => note(c, f, t + k * 0.12, 0.4, 'triangle', 0.09))),
  confetti: () =>
    play((c, t) => {
      note(c, 500, t, 0.35, 'triangle', 0.07, 1250)
      ;[1397, 1661, 2093, 1661, 2093].forEach((f, k) => bell(c, f, t + 0.25 + k * 0.08, 0.5, 0.05))
    }),
  medal: () => play((c, t) => [784, 988, 1175, 1568].forEach((f, k) => bell(c, f, t + k * 0.13, 0.9))),
  thumbs: () => play((c, t) => [880, 1319].forEach((f, k) => bell(c, f, t + k * 0.16, 0.9, 0.13))),
}
export type CheerKind = keyof typeof CHEERS

/** «بمساعدة»: two soft notes going up a little — encouraging, not a reward. */
export const helpSound = () =>
  play((c, t) => {
    note(c, 440, t, 0.25, 'sine', 0.1)
    note(c, 494, t + 0.18, 0.35, 'sine', 0.1)
  })

/** «خطأ»: one low, soft tone — never harsh. */
export const wrongSound = () =>
  play((c, t) => {
    note(c, 220, t, 0.35, 'triangle', 0.12, 165)
  })

/** A tiny tick (a matched pair, a word in place). */
export const tickSound = () => play((c, t) => bell(c, 1175, t, 0.25, 0.06))
