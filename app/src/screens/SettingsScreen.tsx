import { useAuth } from '../auth/auth'

export function SettingsScreen() {
  const auth = useAuth()
  if (auth.status !== 'signedIn') return null
  const { user } = auth

  return (
    <>
      <h1 className="screen-title">الإعدادات</h1>
      <section className="account" aria-label="الحساب">
        {user.photoUrl && <img className="account-photo" src={user.photoUrl} alt="" referrerPolicy="no-referrer" />}
        <div className="account-text">
          <strong>{user.name}</strong>
          {user.email && <span>{user.email}</span>}
        </div>
        <button className="btn btn-quiet" onClick={() => void auth.signOut()}>
          تسجيل الخروج
        </button>
      </section>
      <section className="empty">
        <p>استيراد بيانات الموقع القديم والنسخة الاحتياطية.</p>
        <span className="soon">قيد البناء</span>
      </section>
    </>
  )
}
