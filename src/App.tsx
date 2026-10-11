import { useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
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

function Shell() {
  const { ready, profile } = useSession()
  if (!ready) return <div className="flex min-h-screen items-center justify-center"><Spinner /></div>
  if (!profile) return <Login />
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <SessionProvider>
        <ConfigNotice />
        <HashRouter>
          <Shell />
        </HashRouter>
      </SessionProvider>
    </ToastProvider>
  )
}
