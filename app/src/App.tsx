import { useMemo } from 'react'
import { Route, Routes } from 'react-router'
import { useAuth } from './auth/auth'
import { AppShell } from './components/AppShell'
import { DataProvider } from './data/DataProvider'
import type { Repos } from './data/repos'
import { ClockContext, TEACHER_TZ } from './lib/clock'
import { AcademiesScreen } from './screens/academies/AcademiesScreen'
import { AcademyFormScreen } from './screens/academies/AcademyFormScreen'
import { PaymentFormScreen } from './screens/academies/PaymentFormScreen'
import { GroupFormScreen } from './screens/groups/GroupFormScreen'
import { GroupsScreen } from './screens/groups/GroupsScreen'
import { AttendanceScreen } from './screens/lessons/AttendanceScreen'
import { LessonScreen } from './screens/lessons/LessonScreen'
import { ReviewScreen } from './screens/lessons/ReviewScreen'
import { MoreScreen } from './screens/MoreScreen'
import { NotificationsScreen } from './screens/NotificationsScreen'
import { PlannedScreen } from './screens/PlannedScreen'
import { SettingsScreen } from './screens/settings/SettingsScreen'
import { SignInScreen } from './screens/SignInScreen'
import { AcademyStatements } from './screens/reports/AcademyStatements'
import { AttendanceReport } from './screens/reports/AttendanceReport'
import { MySummary } from './screens/reports/MySummary'
import { ReportsHub } from './screens/reports/ReportsHub'
import { ReportsScreen } from './screens/students/ReportsScreen'
import { StudentFormScreen } from './screens/students/StudentFormScreen'
import { StudentProfileScreen } from './screens/students/StudentProfileScreen'
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
  const clock = useMemo(() => ({ fixed: now, timeZone: timeZone ?? TEACHER_TZ }), [now, timeZone])

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
          <Route path="students/:id" element={<StudentProfileScreen />} />
          <Route path="students/:id/edit" element={<StudentFormScreen />} />
          <Route path="reports" element={<ReportsHub />} />
          <Route path="reports/parents" element={<ReportsScreen />} />
          <Route path="reports/academies" element={<AcademyStatements />} />
          <Route path="reports/attendance" element={<AttendanceReport />} />
          <Route path="reports/summary" element={<MySummary />} />
          <Route path="groups" element={<GroupsScreen />} />
          <Route path="groups/new" element={<GroupFormScreen />} />
          <Route path="groups/:id" element={<GroupFormScreen />} />
          <Route path="lessons/:groupId/:date" element={<LessonScreen />} />
          <Route path="review" element={<ReviewScreen />} />
          <Route path="attendance" element={<AttendanceScreen />} />
          <Route path="academies" element={<AcademiesScreen />} />
          <Route path="academies/new" element={<AcademyFormScreen />} />
          <Route path="academies/:id" element={<AcademyFormScreen />} />
          <Route path="payments/new" element={<PaymentFormScreen />} />
          <Route path="settings" element={<SettingsScreen />} />
          <Route path="more" element={<MoreScreen />} />
          <Route path="notifications" element={<NotificationsScreen />} />
          <Route path="*" element={<PlannedScreen title="الصفحة غير موجودة" what="ارجع إلى «اليوم» من القائمة." />} />
        </Route>
      </Routes>
    </DataProvider>
  )
}
