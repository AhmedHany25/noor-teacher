import { createContext, useContext } from 'react'

export type AuthUser = {
  uid: string
  name: string
  email: string | null
  photoUrl: string | null
}

/** What the app needs from an auth backend. Firebase implements it; tests pass a fake. */
export type AuthApi = {
  onChange: (cb: (user: AuthUser | null) => void) => () => void
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; user: AuthUser }

export type AuthContextValue = AuthState & {
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
