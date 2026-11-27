/**
 * Keeps the installed app on the latest version without losing unsaved typing:
 * - registers the service worker and checks for a new version every 30 minutes and whenever
 *   the app comes back to the foreground;
 * - when a new version takes over, reloads at once if the app is in the background,
 *   otherwise announces it (UPDATE_READY_EVENT) so the screen can offer a «تحديث» button,
 *   and reloads the next time the app goes to the background.
 */
export const UPDATE_READY_EVENT = 'noor:update-ready'

const CHECK_EVERY_MS = 30 * 60 * 1000

export function startUpdates(): void {
  if (!('serviceWorker' in navigator)) return
  const hadController = !!navigator.serviceWorker.controller
  let pending = false

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // The very first install also fires this; there is nothing old to replace then.
    if (!hadController) return
    if (document.visibilityState === 'hidden') {
      location.reload()
      return
    }
    pending = true
    window.dispatchEvent(new Event(UPDATE_READY_EVENT))
  })

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        const check = () => {
          if (navigator.onLine !== false) reg.update().catch(() => {})
        }
        setInterval(check, CHECK_EVERY_MS)
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') check()
          else if (pending) location.reload()
        })
      })
      .catch((e) => console.warn('Service worker registration failed', e))
  })
}
