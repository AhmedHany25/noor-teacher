// Push helpers that need no Firebase (cheap to load, safe in tests).

/** This browser can show reminders: service workers, push and notifications are all available. */
export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/** A short name for this device, shown in Settings («Android، Chrome»). */
export function deviceLabel(ua = navigator.userAgent): string {
  const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iPhone' : /Windows/i.test(ua) ? 'Windows' : /Mac/i.test(ua) ? 'Mac' : 'جهاز'
  const browser = /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : ''
  return browser ? `${os}، ${browser}` : os
}

/** Shows a notification from this device right away, to check that it appears. */
export async function testNotification(): Promise<void> {
  const registration = await navigator.serviceWorker.ready
  await registration.showNotification('نور القرآن', {
    body: 'كده الإشعارات شغالة على الجهاز ده.',
    icon: '/pwa-192x192.png',
    lang: 'ar',
    dir: 'rtl',
  })
}
