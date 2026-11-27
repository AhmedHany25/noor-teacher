/// <reference lib="webworker" />
// The app's service worker: offline app shell + reminders pushed by the sender (FCM).
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (string | { url: string; revision: string | null })[] }

// New versions take over at once (the app reloads its data from Firestore anyway).
self.skipWaiting()
clientsClaim()

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Every page of the app is the same index.html, except Firebase's reserved /__/ paths
// (the Google sign-in handler lives at /__/auth/handler and must come from the network).
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/__\//] }))

type Payload = { title?: string; body?: string; url?: string; tag?: string }

self.addEventListener('push', (event) => {
  let p: Payload = {}
  try {
    const json = event.data?.json() as { data?: Payload; notification?: Payload } | undefined
    p = { ...json?.notification, ...json?.data }
  } catch {
    p = { body: event.data?.text() }
  }
  event.waitUntil(
    self.registration.showNotification(p.title || 'نور القرآن', {
      body: p.body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      lang: 'ar',
      dir: 'rtl',
      tag: p.tag,
      data: { url: p.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data as { url?: string } | undefined)?.url || '/'
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin)
      if (open) {
        await open.focus()
        await open.navigate(url)
      } else {
        await self.clients.openWindow(url)
      }
    })(),
  )
})
