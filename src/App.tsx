import { useEffect } from 'react'
import { HashRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { Spinner, Banner } from './components/ui'
import { SessionProvider, ToastProvider, useSession } from './lib/store'
import Login, { Onboarding } from './pages/Login'
import { WorkerMyShifts, WorkerShifts, WorkerStats } from './pages/Worker'
import { ApproveShifts, Reconcile, ReconcileList, RecruiterDashboard, ShiftPeople } from './pages/Recruiter'
import { CreateShift, OwnerShifts, OwnerStats } from './pages/Owner'
import { Audit, Kyc, Users } from './pages/Admin'
import { Guide, MyProfile, Notifications } from './pages/Shared'
import type { Role } from './lib/types'
import React from 'react'

// Chặn lỗi render ngoài mong muốn — người dùng luôn thấy màn hình phục hồi, không trắng trang
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null }
  static getDerivedStateFromError(err: Error) { return { err } }
  render() {
    if (this.state.err) {
      return (
        <div className="mx-auto max-w-lg p-6">
          <div className="card p-6 text-center">
            <h1 className="text-xl font-bold">Có lỗi không mong muốn</h1>
            <p className="mt-2 text-sm text-zinc-500">Trang gặp sự cố tạm thời. Tải lại là dùng tiếp bình thường — dữ liệu của bạn không mất.</p>
            <div className="mt-4 flex justify-center gap-2">
              <button className="btn-primary" onClick={() => location.reload()}>Tải lại trang</button>
              <button className="btn-ghost" onClick={() => { this.setState({ err: null }); location.hash = '#/' }}>Về trang chính</button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function NotFound() {
  const { profile } = useSession()
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <div className="font-display text-6xl font-bold text-zinc-300">404</div>
      <h1 className="mt-2 text-xl font-bold">Không có trang này</h1>
      <p className="mt-1 text-sm text-zinc-500">Đường dẫn sai hoặc trang đã bị đổi tên.</p>
      <Link className="btn-primary mt-4 inline-flex" to={profile ? '/' : '/guide'}>Về trang chính</Link>
    </div>
  )
}

function homeFor(role: Role): string {
  switch (role) {
    case 'worker': return '/shifts'
    case 'recruiter': return '/dashboard'
    case 'owner': return '/my-shifts'
    case 'admin2': return '/kyc'
    case 'admin': return '/users'
  }
}

function Guard({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { profile, ready } = useSession()
  if (!ready) return <Spinner />
  if (!profile) return <Navigate to="/login" replace />
  if (!roles.includes(profile.role)) return <Navigate to={homeFor(profile.role)} replace />
  return <>{children}</>
}

function ConfigNotice() {
  const ok = !!import.meta.env.VITE_SUPABASE_URL && !String(import.meta.env.VITE_SUPABASE_URL).includes('placeholder')
  if (ok) return null
  return (
    <div className="p-6">
      <Banner kind="warn">
        Chưa cấu hình Supabase: hãy copy <code>.env.example</code> thành <code>.env</code>, điền
        <code> VITE_SUPABASE_URL</code> và <code>VITE_SUPABASE_ANON_KEY</code> rồi chạy lại <code>npm run dev</code>.
      </Banner>
    </div>
  )
}

// Đã đăng nhập nhưng chưa tạo được hồ sơ: màn hình khôi phục (không quay về đăng nhập để tránh vòng lặp nút chết)
function ProfileRecover({ onRetry, onSignOut }: { onRetry: () => void; onSignOut: () => void }) {
  useEffect(() => {
    const t = setTimeout(onRetry, 2500) // tự thử lại 1 lần (đề phòng race lúc tạo hồ sơ)
    return () => clearTimeout(t)
  }, [onRetry])
  return (
    <div className="mx-auto max-w-md p-6">
      <div className="card p-6 text-center">
        <h1 className="text-xl font-bold">Chưa tải được hồ sơ của bạn</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Tài khoản đã đăng nhập nhưng hệ thống chưa tạo xong hồ sơ. Bấm <b>Thử lại</b> — nếu vẫn lỗi, đăng xuất rồi đăng nhập lại.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <button className="btn-primary" onClick={onRetry}>Thử lại</button>
          <button className="btn-ghost" onClick={onSignOut}>Đăng xuất</button>
        </div>
      </div>
    </div>
  )
}

function Shell() {
  const { ready, profile, userId, profileFailed, reloadProfile, signOut } = useSession()
  if (!ready) return <div className="flex min-h-screen items-center justify-center"><Spinner /></div>
  if (!userId) return <Login />
  if (!profile) {
    if (profileFailed) return <ProfileRecover onRetry={reloadProfile} onSignOut={signOut} />
    return <div className="flex min-h-screen items-center justify-center"><Spinner /></div>
  }
  // Người đi làm chưa nộp / bị từ chối hồ sơ: bắt sang bước điền hồ sơ ngay
  if (profile.role === 'worker' && (profile.kyc_status === 'unsubmitted' || profile.kyc_status === 'rejected')) {
    return <Onboarding />
  }
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to={homeFor(profile.role)} replace />} />
        {/* Worker */}
        <Route path="/shifts" element={<Guard roles={['worker']}><WorkerShifts /></Guard>} />
        <Route path="/my" element={<Guard roles={['worker']}><WorkerMyShifts /></Guard>} />
        <Route path="/stats" element={<Guard roles={['worker']}><WorkerStats /></Guard>} />
        {/* Recruiter */}
        <Route path="/approve" element={<Guard roles={['recruiter', 'admin']}><ApproveShifts /></Guard>} />
        <Route path="/recruiter/shift/:id" element={<Guard roles={['recruiter', 'admin']}><ShiftPeople /></Guard>} />
        <Route path="/reconcile" element={<Guard roles={['recruiter', 'admin']}><ReconcileList /></Guard>} />
        <Route path="/recruiter/reconcile/:id" element={<Guard roles={['recruiter', 'admin']}><Reconcile /></Guard>} />
        <Route path="/dashboard" element={<Guard roles={['recruiter', 'admin']}><RecruiterDashboard /></Guard>} />
        {/* Owner */}
        <Route path="/create" element={<Guard roles={['owner', 'admin']}><CreateShift /></Guard>} />
        <Route path="/my-shifts" element={<Guard roles={['owner', 'admin']}><OwnerShifts /></Guard>} />
        <Route path="/owner-stats" element={<Guard roles={['owner', 'admin']}><OwnerStats /></Guard>} />
        {/* Admin2 & Admin */}
        <Route path="/kyc" element={<Guard roles={['admin2', 'admin']}><Kyc /></Guard>} />
        <Route path="/users" element={<Guard roles={['admin']}><Users /></Guard>} />
        <Route path="/audit" element={<Guard roles={['admin']}><Audit /></Guard>} />
        {/* Chung */}
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/profile" element={<MyProfile />} />
        <Route path="/guide" element={<Guide />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <SessionProvider>
          <ConfigNotice />
          <HashRouter>
            <Shell />
          </HashRouter>
        </SessionProvider>
      </ToastProvider>
    </ErrorBoundary>
  )
}
