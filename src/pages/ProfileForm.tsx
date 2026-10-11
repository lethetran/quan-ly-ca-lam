import { Camera, ShieldCheck } from 'lucide-react'
import { useRef, useState } from 'react'
import { updateOwnProfile, uploadImage } from '../lib/api'
import { useSession, useToast } from '../lib/store'
import type { KycStatus } from '../lib/types'
import { Banner } from '../components/ui'

export const KYC_TEXT: Record<KycStatus, { text: string; cls: string }> = {
  unsubmitted: { text: 'Chưa nộp hồ sơ — cần điền đầy đủ để được duyệt', cls: 'border-zinc-300 bg-zinc-50 text-zinc-600' },
  pending: { text: 'Hồ sơ đang chờ Admin 2 duyệt', cls: 'border-amber-300 bg-amber-50 text-amber-900' },
  approved: { text: 'Hồ sơ đã được duyệt — có thể đăng ký ca', cls: 'border-emerald-300 bg-emerald-50 text-emerald-800' },
  rejected: { text: 'Hồ sơ bị từ chối — hãy sửa lại và nộp lại', cls: 'border-red-300 bg-red-50 text-red-800' },
}

/** Bước hoàn thiện hồ sơ bắt buộc cho người đi làm */
export function ProfileForm({ onDone }: { onDone?: () => void }) {
  const { profile, reloadProfile } = useSession()
  const { push } = useToast()
  const [f, setF] = useState({
    full_name: profile?.full_name ?? '',
    cccd: profile?.cccd ?? '',
    phone: profile?.phone ?? '',
    address: profile?.address ?? '',
    bank_name: profile?.bank_name ?? '',
    bank_account: profile?.bank_account ?? '',
  })
  const [front, setFront] = useState<File | null>(null)
  const [back, setBack] = useState<File | null>(null)
  const frontRef = useRef<HTMLInputElement>(null)
  const backRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })

  const submit = async () => {
    if (!profile) return
    if (!f.full_name.trim() || !/^\d{9,12}$/.test(f.cccd.trim()) || !/^\d{9,11}$/.test(f.phone.trim()) || !f.address.trim() || !f.bank_name.trim() || !f.bank_account.trim()) {
      push('Điền đủ: họ tên, CCCD (9-12 số), SĐT, địa chỉ, ngân hàng, số tài khoản', true)
      return
    }
    if (!front || !back) { push('Cần tải lên ảnh CCCD mặt trước VÀ mặt sau', true); return }
    setBusy(true)
    try {
      const frontPath = await uploadImage(profile.id, 'front', front)
      const backPath = await uploadImage(profile.id, 'back', back)
      await updateOwnProfile(profile.id, {
        ...f,
        cccd: f.cccd.trim(),
        phone: f.phone.trim(),
        cccd_front_path: frontPath,
        cccd_back_path: backPath,
        kyc_status: 'pending',
      })
      await reloadProfile()
      push('Đã nộp hồ sơ — chờ Admin 2 duyệt')
      onDone?.()
    } catch (e) {
      push((e as Error).message, true)
    }
    setBusy(false)
  }

  return (
    <div className="space-y-3.5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div><span className="label">Họ và tên *</span><input className="field" value={f.full_name} onChange={set('full_name')} placeholder="NGUYỄN VĂN A" /></div>
        <div><span className="label">Số CCCD *</span><input className="field" value={f.cccd} onChange={set('cccd')} placeholder="12 chữ số" inputMode="numeric" /></div>
        <div><span className="label">Số điện thoại *</span><input className="field" value={f.phone} onChange={set('phone')} inputMode="tel" /></div>
        <div><span className="label">Ngân hàng *</span><input className="field" value={f.bank_name} onChange={set('bank_name')} placeholder="VD: Vietcombank, MB Bank, TPBank…" /></div>
        <div><span className="label">Số tài khoản *</span><input className="field" value={f.bank_account} onChange={set('bank_account')} inputMode="numeric" /></div>
        <div className="sm:col-span-2"><span className="label">Địa chỉ *</span><input className="field" value={f.address} onChange={set('address')} placeholder="Số nhà, đường, phường/xã, tỉnh" /></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <span className="label">Ảnh CCCD mặt trước *</span>
          <button className="btn-ghost w-full" onClick={() => frontRef.current?.click()}>
            <Camera size={15} /> {front ? `Đã chọn: ${front.name.slice(0, 24)}` : 'Chụp / chọn ảnh mặt trước'}
          </button>
          <input ref={frontRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => setFront(e.target.files?.[0] ?? null)} />
        </div>
        <div>
          <span className="label">Ảnh CCCD mặt sau *</span>
          <button className="btn-ghost w-full" onClick={() => backRef.current?.click()}>
            <Camera size={15} /> {back ? `Đã chọn: ${back.name.slice(0, 24)}` : 'Chụp / chọn ảnh mặt sau'}
          </button>
          <input ref={backRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => setBack(e.target.files?.[0] ?? null)} />
        </div>
      </div>
      <Banner kind="info">
        <ShieldCheck size={14} className="mr-1 inline" />
        Ảnh CCCD chỉ Admin 2 (duyệt hồ sơ) xem được để xác thực. Thông tin tài khoản ngân hàng dùng để nhận thanh toán ca làm.
      </Banner>
      <button className="btn-primary w-full" disabled={busy} onClick={submit}>
        {busy ? 'Đang nộp…' : 'Nộp hồ sơ chờ duyệt'}
      </button>
    </div>
  )
}

export function KycBanner({ status }: { status: KycStatus }) {
  const t = KYC_TEXT[status]
  return <div className={`rounded-lg border px-4 py-2.5 text-sm font-medium ${t.cls}`}>{t.text}</div>
}
