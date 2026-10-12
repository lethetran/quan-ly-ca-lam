import { CalendarRange, ClipboardCheck, MailCheck, ShieldCheck, Wallet } from 'lucide-react'
import { useState } from 'react'
import { ProfileForm, KycBanner } from './ProfileForm'
import { useSession, useToast } from '../lib/store'
import { PASSWORD_HINT, passwordOk } from '../lib/util'

/** Bắt buộc hoàn thiện hồ sơ ngay sau khi tạo tài khoản (người đi làm) */
export function Onboarding() {
  const { profile, signOut } = useSession()
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-display text-2xl font-bold uppercase">
          Quản Lý <span className="text-accent">Ca Làm</span>
        </div>
        <button className="btn-ghost !py-1.5 text-xs" onClick={signOut}>Đăng xuất</button>
      </div>
      <div className="card p-6">
        <h1 className="text-2xl font-bold">Hoàn thiện hồ sơ để bắt đầu</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Điền đầy đủ thông tin và 2 mặt CCCD. <b>Admin 2 duyệt xong</b> là bạn đăng ký ca được ngay.
        </p>
        {profile && <div className="mt-3"><KycBanner status={profile.kyc_status} note={profile.kyc_note} /></div>}
        <div className="mt-4"><ProfileForm /></div>
      </div>
    </div>
  )
}

function ConfirmEmailScreen({ email, onBack }: { email: string; onBack: () => void }) {
  return (
    <div className="mx-auto max-w-md py-12">
      <div className="card p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent"><MailCheck size={24} /></div>
        <h1 className="mt-3 text-xl font-bold">Kiểm tra email để xác thực</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          Đã gửi thư xác thực đến <b>{email}</b>. Mở thư và bấm nút xác nhận để kích hoạt tài khoản
          (kiểm tra cả mục <b>Spam/Quảng cáo</b> nếu không thấy trong 1–2 phút).
        </p>
        <button className="btn-primary mt-4 w-full" onClick={onBack}>← Về trang đăng nhập</button>
      </div>
    </div>
  )
}

export default function Login() {
  // Trang này chỉ hiện khi CHƯA đăng nhập — Shell chặn mọi phiên khác để không còn vòng lặp nút chết
  const { signIn, signUp } = useSession()
  const { push } = useToast()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [login, setLogin] = useState('')
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmTo, setConfirmTo] = useState<string | null>(null)

  const submit = async () => {
    if (!login.trim() || !pw) { push('Nhập tài khoản và mật khẩu', true); return }
    setBusy(true)
    try {
      if (mode === 'login') {
        await signIn(login, pw)
        push('Đăng nhập thành công')
      } else {
        if (!passwordOk(pw)) { push('Mật khẩu phải ' + PASSWORD_HINT, true); setBusy(false); return }
        // Đăng ký PHẢI dùng email thật (nhận thư xác thực) — chặn domain giả
        if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(login.trim()) || login.trim().toLowerCase().endsWith('@nhanvien.local')) {
          push('Đăng ký cần EMAIL THẬT để nhận thư xác thực (ví dụ ten@gmail.com)', true)
          setBusy(false)
          return
        }
        const { needsConfirmation } = await signUp(login, pw)
        if (needsConfirmation) { setConfirmTo(login.trim()); setBusy(false); return }
        push('Tạo tài khoản thành công — điền hồ sơ để bắt đầu')
      }
    } catch (e) {
      push((e as Error).message, true)
    }
    setBusy(false)
  }

  if (confirmTo) {
    return (
      <div className="min-h-screen bg-paper">
        <ConfirmEmailScreen email={confirmTo} onBack={() => { setConfirmTo(null); setMode('login') }} />
      </div>
    )
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
                <span className="label">{mode === 'register' ? 'Email thật (để nhận thư xác thực)' : 'Tài khoản (email hoặc số điện thoại / tên đăng nhập)'}</span>
                <input
                  className="field"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  placeholder={mode === 'register' ? 'vd: ten@gmail.com' : 'vd: 0901234567 hoặc admin@example.com'}
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
                  placeholder={mode === 'register' ? 'Tối thiểu 8 ký tự, có chữ và số' : '••••••••'}
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
