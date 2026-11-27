import { initializeApp } from 'firebase/app'
import {
  GoogleAuthProvider,
  browserPopupRedirectResolver,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'
import type { AuthApi } from '../auth/auth'

const PROJECT = 'noor-alquran-teacher'

// The Firebase web config is public by design; access is enforced by firestore.rules.
// On the deployed site the auth handler is served from the same domain, which keeps
// sign-in working in browsers that block third-party storage (Safari, installed PWAs).
const authDomain = location.hostname.endsWith('.web.app') ? location.hostname : `${PROJECT}.firebaseapp.com`

export const app = initializeApp({
  apiKey: 'AIzaSyDS3ibJQUwKUPY6u_azj9qi-aK9TCb9HrM',
  authDomain,
  projectId: PROJECT,
  storageBucket: `${PROJECT}.firebasestorage.app`,
  messagingSenderId: '824538361419',
  appId: '1:824538361419:web:6c6df0c87d4187b79367ce',
})

export const auth = getAuth(app)
auth.languageCode = 'ar'

/** Firestore with an on-device cache: reads and writes work offline and sync when back online. */
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})

const google = new GoogleAuthProvider()
google.setCustomParameters({ prompt: 'select_account' })

export const firebaseAuthApi: AuthApi = {
  onChange: (cb) =>
    onAuthStateChanged(auth, (u) =>
      cb(u ? { uid: u.uid, name: u.displayName ?? u.email ?? '', email: u.email, photoUrl: u.photoURL } : null),
    ),
  signIn: async () => {
    try {
      await signInWithPopup(auth, google, browserPopupRedirectResolver)
    } catch (e) {
      const code = (e as { code?: string }).code
      // Popups are blocked in some installed-app and mobile contexts; fall back to a full-page redirect.
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        await signInWithRedirect(auth, google, browserPopupRedirectResolver)
        return
      }
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return
      throw e
    }
  },
  signOut: () => signOut(auth),
}
