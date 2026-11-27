import { app } from './firebase'
import { pushSupported } from './pushSupport'

/** Public key of the project's Web Push certificate (Firebase console → Cloud Messaging). Safe to ship. */
export const VAPID_KEY: string = import.meta.env.VITE_VAPID_KEY ?? ''

/**
 * Asks for permission and returns this browser's push token, using the app's own service worker.
 * Throws with an Arabic message the screen can show.
 */
export async function enablePush(): Promise<string> {
  if (!pushSupported()) throw new Error('المتصفح ده مش بيدعم الإشعارات.')
  if (!VAPID_KEY) throw new Error('الإشعارات لسه محتاجة خطوة إعداد في المشروع.')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('الإشعارات مقفولة. افتحها من إعدادات المتصفح للموقع ده.')
  const { getMessaging, getToken, isSupported } = await import('firebase/messaging')
  if (!(await isSupported())) throw new Error('المتصفح ده مش بيدعم الإشعارات.')
  const registration = await navigator.serviceWorker.ready
  return getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration })
}

