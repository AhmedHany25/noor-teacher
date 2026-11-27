import type { ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router'
import { AcademyIcon, CircleIcon, SettingsIcon, StudentsIcon, SunIcon } from './icons'

const LINKS: { to: string; label: string; icon: ReactNode }[] = [
  { to: '/', label: 'اليوم', icon: <SunIcon /> },
  { to: '/students', label: 'الطلاب', icon: <StudentsIcon /> },
  { to: '/groups', label: 'الحلقات', icon: <CircleIcon /> },
  { to: '/academies', label: 'المستحقات', icon: <AcademyIcon /> },
  { to: '/settings', label: 'الإعدادات', icon: <SettingsIcon /> },
]

export function AppShell() {
  return (
    <div className="shell">
      <nav className="nav" aria-label="التنقل الرئيسي">
        <div className="nav-brand">
          <img src="/pwa-64x64.png" alt="" />
          نور القرآن
        </div>
        {LINKS.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.to === '/'} className="nav-link">
            {l.icon}
            <span>{l.label}</span>
          </NavLink>
        ))}
      </nav>
      <main className="shell-main">
        <Outlet />
      </main>
    </div>
  )
}
