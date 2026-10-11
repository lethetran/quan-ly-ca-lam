import { Bell, CalendarDays, ClipboardCheck, ClipboardList, FileSpreadsheet, LayoutDashboard, LogOut, Menu, ShieldCheck, UserCog, Users, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { listNotifs } from '../lib/api'
import { useSession } from '../lib/store'
import type { Role } from '../lib/types'
import { ROLE_LABEL } from '../lib/types'

type NavItem = { to: string; label: string; icon: typeof CalendarDays; roles: Role[] }

const NAV: NavItem[] = [
  { to: '/shifts', label: 'Lịch ca & đăng ký', icon: CalendarDays, roles: ['worker'] },
  { to: '/my', label: 'Ca của tôi', icon: ClipboardList, roles: ['worker'] },
  { to: '/stats', label: 'Thống kê của tôi', icon: FileSpreadsheet, roles: ['worker'] },
  { to: '/approve', label: 'Duyệt ca (từ chủ)', icon: ClipboardCheck, roles: ['recruiter'] },
  { to: '/reconcile', label: 'Đối soát công', icon: FileSpreadsheet, roles: ['recruiter'] },
  { to: '/dashboard', label: 'Bảng điều khiển', icon: LayoutDashboard, roles: ['recruiter'] },
  { to: '/create', label: 'Tạo ca làm', icon: CalendarDays, roles: ['owner'] },
  { to: '/my-shifts', label: 'Ca của công ty', icon: ClipboardList, roles: ['owner'] },
  { to: '/owner-stats', label: 'Chi phí & thống kê', icon: FileSpreadsheet, roles: ['owner'] },
  { to: '/kyc', label: 'Duyệt hồ sơ CCCD', icon: ShieldCheck, roles: ['admin2'] },
  { to: '/users', label: 'Quản lý người dùng', icon: UserCog, roles: ['admin'] },
  { to: '/audit', label: 'Nhật ký hệ thống', icon: FileSpreadsheet, roles: ['admin'] },
  { to: '/guide', label: 'Hướng dẫn sử dụng', icon: LayoutDashboard, roles: ['worker', 'recruiter', 'owner', 'admin2', 'admin'] },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const { profile, email, signOut } = useSession()
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const loc = useLocation()

  const items = NAV.filter((n) => profile && n.roles.includes(profile.role))

  useEffect(() => setOpen(false), [loc.pathname])
  useEffect(() => {
    const current = items.find((n) => loc.pathname.startsWith(n.to))
    document.title = current ? `${current.label} · Quản Lý Ca Làm` : 'Quản Lý Ca Làm'
  }, [loc.pathname])
  useEffect(() => {
    if (!profile) return
    let alive = true
    const load = async () => {
      try {
        const ns = await listNotifs(profile.id)
        if (alive) setUnread(ns.filter((n) => !n.read).length)
      } catch { /* bỏ qua lỗi poll */ }
    }
    load()
    const t = setInterval(load, 30000)
    return () => { alive = false; clearInterval(t) }
  }, [profile])

  const side = (
    <div className="flex h-full w-64 flex-col bg-ink text-paper">
      <div className="border-b border-zinc-800 px-5 py-4">
        <div className="font-display text-xl font-bold uppercase leading-6 tracking-wide">
          Quản Lý <span className="text-accent">Ca Làm</span>
        </div>
        <div className="mt-0.5 text-[11px] uppercase tracking-widest text-zinc-500">Phân ca · Đối soát · Thanh toán</div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
        {items.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive ? 'bg-accent text-white' : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
              }`
            }
          >
            <n.icon size={16} />
            {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-zinc-800 px-4 py-3 text-xs text-zinc-400">
        <div className="font-semibold text-zinc-200">{profile?.full_name || email}</div>
        <div className="mt-0.5">{profile ? ROLE_LABEL[profile.role] : '—'}</div>
        <button onClick={signOut} className="mt-2.5 flex items-center gap-1.5 rounded-md border border-zinc-700 px-2.5 py-1.5 font-semibold text-zinc-300 hover:bg-zinc-800">
          <LogOut size={13} /> Đăng xuất
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen lg:block">{side}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full shadow-2xl">{side}</div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-zinc-200 bg-paper/95 px-4 py-2.5 backdrop-blur lg:px-8">
          <button className="rounded-lg p-2 hover:bg-zinc-200 lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="min-w-0 flex-1 truncate font-display text-base font-bold uppercase tracking-wide text-zinc-500">
            {items.find((n) => loc.pathname.startsWith(n.to))?.label ?? 'Hệ thống quản lý ca làm'}
          </div>
          <Link to="/notifications" className="relative rounded-lg p-2 hover:bg-zinc-200" aria-label="Thông báo">
            <Bell size={19} />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </Link>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 lg:px-8">{children}</main>
      </div>
    </div>
  )
}
