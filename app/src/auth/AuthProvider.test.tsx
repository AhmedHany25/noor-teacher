import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { useAuth, type AuthApi, type AuthUser } from './auth'
import { AuthProvider } from './AuthProvider'

function fakeApi() {
  let listener: ((u: AuthUser | null) => void) | null = null
  const api: AuthApi = {
    onChange: (cb) => {
      listener = cb
      return () => {
        listener = null
      }
    },
    signIn: vi.fn(async () => {}),
    signOut: vi.fn(async () => {}),
  }
  return { api, emit: (u: AuthUser | null) => act(() => listener?.(u)) }
}

function Probe() {
  const auth = useAuth()
  return (
    <div>
      <span data-testid="status">{auth.status}</span>
      {auth.status === 'signedIn' && <span data-testid="name">{auth.user.name}</span>}
      <button onClick={() => void auth.signIn()}>in</button>
      <button onClick={() => void auth.signOut()}>out</button>
    </div>
  )
}

describe('AuthProvider', () => {
  it('starts in loading until the first auth event', () => {
    const { api } = fakeApi()
    render(<AuthProvider api={api}><Probe /></AuthProvider>)
    expect(screen.getByTestId('status')).toHaveTextContent('loading')
  })

  it('becomes signedOut when no user is reported', () => {
    const { api, emit } = fakeApi()
    render(<AuthProvider api={api}><Probe /></AuthProvider>)
    emit(null)
    expect(screen.getByTestId('status')).toHaveTextContent('signedOut')
  })

  it('becomes signedIn with the user when one is reported', () => {
    const { api, emit } = fakeApi()
    render(<AuthProvider api={api}><Probe /></AuthProvider>)
    emit({ uid: 'u1', name: 'أحمد', email: 'a@example.com', photoUrl: null })
    expect(screen.getByTestId('status')).toHaveTextContent('signedIn')
    expect(screen.getByTestId('name')).toHaveTextContent('أحمد')
  })

  it('forwards sign in and sign out to the api', async () => {
    const { api } = fakeApi()
    render(<AuthProvider api={api}><Probe /></AuthProvider>)
    await userEvent.click(screen.getByRole('button', { name: 'in' }))
    await userEvent.click(screen.getByRole('button', { name: 'out' }))
    expect(api.signIn).toHaveBeenCalledOnce()
    expect(api.signOut).toHaveBeenCalledOnce()
  })
})
