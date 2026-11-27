import { Route, Routes } from 'react-router'
import { AppShell } from './components/AppShell'
import { PlannedScreen } from './screens/PlannedScreen'
import { TodayScreen } from './screens/TodayScreen'

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<TodayScreen />} />
        <Route
          path="students"
          element={<PlannedScreen title="الطلاب" what="إضافة الطلاب وبياناتهم وحالتهم وجهة الدفع لكل طالب." />}
        />
        <Route
          path="groups"
          element={<PlannedScreen title="الحلقات" what="مواعيد الحلقات المتكررة، والإلغاء والنقل والحصص الإضافية." />}
        />
        <Route
          path="academies"
          element={
            <PlannedScreen title="المستحقات" what="الأكاديميات وطرق الحساب، والكشف الشهري، والمبالغ المستلمة والمتبقي." />
          }
        />
        <Route
          path="settings"
          element={<PlannedScreen title="الإعدادات" what="بياناتك، واستيراد بيانات الموقع القديم، والنسخة الاحتياطية." />}
        />
        <Route path="*" element={<PlannedScreen title="الصفحة غير موجودة" what="ارجع إلى «اليوم» من القائمة." />} />
      </Route>
    </Routes>
  )
}
