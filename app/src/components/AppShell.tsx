import type { ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router'
import { useNotifications, useProfile } from '../data/data'
import { toArabicDigits } from '../lib/format'
import {
  AcademyIcon,
  BellIcon,
  ChecklistIcon,
  CircleIcon,
  MoreIcon,
  ReportIcon,
  SettingsIcon,
  StudentsIcon,
  SunIcon,
} from './icons'

type Item = { to: string; label: string; icon: ReactNode; mobile: boolean; rail: boolean }

/** Five items fit the phone's bottom bar; the rest live under «المزيد». The desktop rail shows everything. */
const ITEMS: Item[] = [
  { to: '/', label: 'اليوم', icon: <SunIcon />, mobile: true, rail: true },
  { to: '/attendance', label: 'الحضور', icon: <ChecklistIcon />, mobile: true, rail: true },
  { to: '/students', label: 'الطلاب', icon: <StudentsIcon />, mobile: true, rail: true },
  { to: '/groups', label: 'الحلقات', icon: <CircleIcon />, mobile: false, rail: true },
  { to: '/academies', label: 'المستحقات', icon: <AcademyIcon />, mobile: true, rail: true },
  { to: '/reports', label: 'التقارير', icon: <ReportIcon />, mobile: false, rail: true },
  { to: '/settings', label: 'الإعدادات', icon: <SettingsIcon />, mobile: false, rail: true },
  { to: '/more', label: 'المزيد', icon: <MoreIcon />, mobile: true, rail: false },
]

export function Bell() {
  const { items } = useNotifications()
  const { profile } = useProfile()
  const unread = items.filter((n) => n.at > (profile.notifySeenAt ?? 0)).length
  return (
    <NavLink to="/notifications" className="bell" aria-label={unread ? `الإشعارات، ${toArabicDigits(unread)} جديدة` : 'الإشعارات'}>
      <BellIcon />
      {unread > 0 && <span className="bell-count">{toArabicDigits(unread > 9 ? 9 : unread)}{unread > 9 ? '+' : ''}</span>}
    </NavLink>
  )
}

export function AppShell() {
  return (
    <div className="shell">
      <nav className="nav" aria-label="التنقل الرئيسي">
        <div className="nav-brand">
          <img src="/pwa-64x64.png" alt="" />
          نور القرآن
        </div>
        {ITEMS.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === '/'}
            className={['nav-link', !l.mobile && 'rail-only', !l.rail && 'mobile-only'].filter(Boolean).join(' ')}
          >
            {l.icon}
            <span>{l.label}</span>
          </NavLink>
        ))}
      </nav>
      <main className="shell-main">
        <Bell />
        <Outlet />
      </main>
    </div>
  )
}
