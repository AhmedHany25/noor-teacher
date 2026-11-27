import { useMemo } from 'react'
import { Route, Routes } from 'react-router'
import { useAuth } from './auth/auth'
import { AppShell } from './components/AppShell'
import { DataProvider } from './data/DataProvider'
import type { Repos } from './data/repos'
import { ClockContext, deviceTimeZone } from './lib/clock'
import { AcademiesScreen } from './screens/academies/AcademiesScreen'
import { AcademyFormScreen } from './screens/academies/AcademyFormScreen'
import { PaymentFormScreen } from './screens/academies/PaymentFormScreen'
import { GroupFormScreen } from './screens/groups/GroupFormScreen'
import { GroupsScreen } from './screens/groups/GroupsScreen'
import { LessonScreen } from './screens/lessons/LessonScreen'
import { ReviewScreen } from './screens/lessons/ReviewScreen'
import { PlannedScreen } from './screens/PlannedScreen'
import { SettingsScreen } from './screens/settings/SettingsScreen'
import { SignInScreen } from './screens/SignInScreen'
import { StudentFormScreen } from './screens/students/StudentFormScreen'
import { StudentsScreen } from './screens/students/StudentsScreen'
import { TodayScreen } from './screens/TodayScreen'

type AppProps = {
  makeRepos: (uid: string) => Repos
  /** Fixed time for tests; the live clock is used when omitted. */
  now?: Date
  timeZone?: string
}

export function App({ makeRepos, now, timeZone }: AppProps) {
  const auth = useAuth()
  const clock = useMemo(() => ({ fixed: now, timeZone: timeZone ?? deviceTimeZone() }), [now, timeZone])

  if (auth.status === 'loading') {
    return (
      <div className="splash" role="status" aria-label="جارٍ التحميل">
        <img src="/pwa-192x192.png" alt="" />
      </div>
    )
  }

  if (auth.status === 'signedOut') return <SignInScreen />

  return (
    <ClockContext.Provider value={clock}>
      <SignedInApp uid={auth.user.uid} makeRepos={makeRepos} />
    </ClockContext.Provider>
  )
}

function SignedInApp({ uid, makeRepos }: { uid: string; makeRepos: (uid: string) => Repos }) {
  const repos = useMemo(() => makeRepos(uid), [uid, makeRepos])

  return (
    <DataProvider repos={repos}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<TodayScreen />} />
          <Route path="students" element={<StudentsScreen />} />
          <Route path="students/new" element={<StudentFormScreen />} />
          <Route path="students/:id" element={<StudentFormScreen />} />
          <Route path="groups" element={<GroupsScreen />} />
          <Route path="groups/new" element={<GroupFormScreen />} />
          <Route path="groups/:id" element={<GroupFormScreen />} />
          <Route path="lessons/:groupId/:date" element={<LessonScreen />} />
          <Route path="review" element={<ReviewScreen />} />
          <Route path="academies" element={<AcademiesScreen />} />
          <Route path="academies/new" element={<AcademyFormScreen />} />
          <Route path="academies/:id" element={<AcademyFormScreen />} />
          <Route path="payments/new" element={<PaymentFormScreen />} />
          <Route path="settings" element={<SettingsScreen />} />
          <Route path="*" element={<PlannedScreen title="الصفحة غير موجودة" what="ارجع إلى «اليوم» من القائمة." />} />
        </Route>
      </Routes>
    </DataProvider>
  )
}
