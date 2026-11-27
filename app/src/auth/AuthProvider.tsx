import { useEffect, useState, type ReactNode } from 'react'
import { AuthContext, type AuthApi, type AuthState } from './auth'

export function AuthProvider({ api, children }: { api: AuthApi; children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  useEffect(
    () => api.onChange((user) => setState(user ? { status: 'signedIn', user } : { status: 'signedOut' })),
    [api],
  )

  return (
    <AuthContext.Provider value={{ ...state, signIn: api.signIn, signOut: api.signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
