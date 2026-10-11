import { CalendarRange, ClipboardCheck, ShieldCheck, Wallet } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ProfileForm } from './ProfileForm'
import { KycBanner } from './ProfileForm'
import { useSession, useToast } from '../lib/store'

export default function Login() {
  const { profile, userId, signIn, signUp } = useSession()
  const { push } = useToast()
  const nav = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [login, setLogin] = useState('')
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)

  // Đã đăng nhập: hiện trạng thái hồ sơ / nút vào hệ thống
  if (userId) {
    const blocked = profile?.role === 'worker' && profile.kyc_status !== 'approved'
    return (
      <div className="mx-auto max-w-xl py-10">
        <div className="card p-6">
          <h1 className="text-2xl font-bold">Chào bạn!</h1>
          <p className="mt-1 text-sm text-zinc-500">Tài khoản <b>{login}</b> đã đăng nhập.</p>
          {profile?.role === 'worker' && (
            <div className="mt-4"><KycBanner status={profile.kyc_status} note={profile.kyc_note} /></div>
          )}
          {blocked && profile?.kyc_status !== 'pending' && (
            <div className="mt-4 border-t border-zinc-200 pt-4">
              <h2 className="mb-3 font-display text-lg font-bold uppercase">Khai báo hồ sơ CCCD</h2>
              <ProfileForm />
            </div>
          )}
          <button className="btn-primary mt-5 w-full" onClick={() => nav('/')}>
            {blocked && profile?.kyc_status !== 'approved' ? 'Vào hệ thống (chưa đăng ký ca được)' : 'Vào hệ thống'}
          </button>
        </div>
      </div>
    )
  }

  const submit = async () => {
    if (!login.trim() || !pw) { push('Nhập tài khoản và mật khẩu', true); return }
    setBusy(true)
    try {
      if (mode === 'login') {
        await signIn(login, pw)
        push('Đăng nhập thành công')
      } else {
        if (pw.length < 6) { push('Mật khẩu tối thiểu 6 ký tự', true); setBusy(false); return }
        await signUp(login, pw)
        push('Tạo tài khoản thành công — hãy điền hồ sơ')
      }
    } catch (e) {
      push((e as Error).message, true)
    }
    setBusy(false)
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      {/* Cột thương hiệu */}
      <div className="relative hidden flex-col justify-between bg-ink p-10 text-paper lg:flex">
        <div className="flex items-center gap-2 font-display text-2xl font-bold uppercase tracking-wide">
          Quản Lý <span className="text-accent">Ca Làm</span>
        </div>
        <div className="max-w-md">
          <h1 className="font-display text-5xl font-bold uppercase leading-[1.05]">
            Phân ca.<br />Đối soát.<br /><span className="text-accent">Thanh toán.</span>
          </h1>
          <p className="mt-4 text-zinc-400">
            Một hệ thống, ba bên: người đi làm đăng ký ca, tuyển dụng duyệt và đối soát, chủ tạo ca và thanh toán.
          </p>
          <div className="mt-8 space-y-3 text-sm">
            <div className="flex items-center gap-3 text-zinc-300"><CalendarRange className="text-accent" size={18} /> Lịch ca tháng, đăng ký và duyệt trong vài chạm</div>
            <div className="flex items-center gap-3 text-zinc-300"><ClipboardCheck className="text-accent" size={18} /> Bảng đối soát kiểu Excel: đủ ca, nửa ca, vắng, tiền từng người</div>
            <div className="flex items-center gap-3 text-zinc-300"><Wallet className="text-accent" size={18} /> Kèm số tài khoản ngân hàng để chuyển khoản nhanh</div>
            <div className="flex items-center gap-3 text-zinc-300"><ShieldCheck className="text-accent" size={18} /> Ảnh CCCD được duyệt bởi Admin 2 trước khi đi làm</div>
          </div>
        </div>
        <div className="text-xs uppercase tracking-widest text-zinc-600">Hệ thống nội bộ · {new Date().getFullYear()}</div>
      </div>

      {/* Cột form */}
      <div className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-2 font-display text-2xl font-bold uppercase lg:hidden">
            Quản Lý <span className="text-accent">Ca Làm</span>
          </div>
          <div className="card p-6">
            <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-zinc-100 p-1">
              <button
                className={`rounded-md py-2 text-sm font-bold transition ${mode === 'login' ? 'bg-white shadow' : 'text-zinc-500'}`}
                onClick={() => setMode('login')}
              >
                Đăng nhập
              </button>
              <button
                className={`rounded-md py-2 text-sm font-bold transition ${mode === 'register' ? 'bg-white shadow' : 'text-zinc-500'}`}
                onClick={() => setMode('register')}
              >
                Tạo tài khoản
              </button>
            </div>
            <div className="space-y-3.5">
              <div>
                <span className="label">Tài khoản (email hoặc số điện thoại / tên đăng nhập)</span>
                <input
                  className="field"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  placeholder="vd: 0901234567 hoặc admin@example.com"
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                />
              </div>
              <div>
                <span className="label">Mật khẩu</span>
                <input
                  className="field"
                  type="password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  placeholder={mode === 'register' ? 'Tối thiểu 6 ký tự' : '••••••••'}
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                />
              </div>
              <button className="btn-primary w-full" disabled={busy} onClick={submit}>
                {busy ? 'Đang xử lý…' : mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
              </button>
              {mode === 'register' && (
                <p className="text-xs leading-5 text-zinc-500">
                  Sau khi tạo tài khoản, bạn cần <b>khai báo hồ sơ</b> (họ tên, CCCD, SĐT, địa chỉ, ảnh CCCD 2 mặt, số tài khoản ngân hàng)
                  và chờ <b>Admin 2 duyệt</b> thì mới đăng ký ca được.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
