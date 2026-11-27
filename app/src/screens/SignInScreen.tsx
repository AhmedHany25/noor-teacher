import { useState } from 'react'
import { useAuth } from '../auth/auth'

export function SignInScreen() {
  const { signIn } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSignIn() {
    setBusy(true)
    setError('')
    try {
      await signIn()
    } catch {
      setError('تعذّر تسجيل الدخول. تأكد من اتصال الإنترنت ثم حاول مرة أخرى.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="signin">
      <img className="signin-mark" src="/pwa-192x192.png" alt="" />
      <h1 className="signin-title">نور القرآن</h1>
      <p className="signin-lead">طلابك وحلقاتك وحضورهم ومستحقاتك، في مكان واحد ومتزامنة على كل أجهزتك.</p>
      <button className="btn btn-primary signin-btn" onClick={handleSignIn} disabled={busy}>
        {busy ? 'جارٍ تسجيل الدخول…' : 'تسجيل الدخول بحساب جوجل'}
      </button>
      {error && (
        <p className="signin-error" role="alert">
          {error}
        </p>
      )}
    </main>
  )
}
