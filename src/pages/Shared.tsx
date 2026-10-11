import { BellRing, CheckCheck, Camera } from 'lucide-react'
import { useEffect, useState } from 'react'
import { KycBanner, ProfileForm } from './ProfileForm'
import { Empty, Spinner } from '../components/ui'
import { listNotifs, markNotifsRead } from '../lib/api'
import { useSession, useToast } from '../lib/store'
import type { Notif } from '../lib/types'
import { fmtDT } from '../lib/util'

export function Notifications() {
  const { profile } = useSession()
  const { push } = useToast()
  const [items, setItems] = useState<Notif[] | null>(null)
  const load = async () => {
    if (!profile) return
    try { setItems(await listNotifs(profile.id)) } catch (e) { console.error(e); setItems([]) }
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [profile?.id])
  if (!profile) return null
  if (!items) return <Spinner />

  const markAll = async () => {
    await markNotifsRead(profile.id)
    push('Đã đọc tất cả')
    load()
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Thông báo</h1>
        <button className="btn-ghost !py-1.5 text-xs" onClick={markAll}><CheckCheck size={14} /> Đọc tất cả</button>
      </div>
      {items.length === 0 && <Empty msg="Chưa có thông báo nào." />}
      <div className="space-y-2">
        {items.map((n) => (
          <div key={n.id} className={`card flex gap-3 p-4 ${n.read ? 'opacity-60' : 'border-l-4 border-l-accent'}`}>
            <BellRing size={17} className="mt-0.5 shrink-0 text-accent" />
            <div className="min-w-0">
              <div className="font-semibold">{n.title}</div>
              {n.body && <div className="mt-0.5 text-sm text-zinc-600">{n.body}</div>}
              <div className="mt-1 text-xs text-zinc-400">{fmtDT(n.created_at)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function MyProfile() {
  const { profile } = useSession()
  if (!profile) return null
  const isWorker = profile.role === 'worker'
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Hồ sơ của tôi</h1>
      {isWorker && <KycBanner status={profile.kyc_status} />}
      <div className="card p-5">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold uppercase"><Camera size={17} className="text-accent" /> Thông tin & ảnh CCCD</h2>
        <ProfileForm />
      </div>
      {!isWorker && (
        <p className="text-sm text-zinc-500">
          Bạn là <b>{profile.role === 'recruiter' ? 'bên tuyển dụng' : profile.role === 'owner' ? 'bên chủ/công ty' : 'quản trị'}</b> — không cần hồ sơ CCCD.
        </p>
      )}
    </div>
  )
}

export function Guide() {
  const { profile } = useSession()
  const role = profile?.role ?? 'worker'
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">Hướng dẫn sử dụng</h1>

      <div className="card p-5">
        <h2 className="font-display text-lg font-bold uppercase text-accent">Người đi làm</h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-6">
          <li>Tạo tài khoản (SĐT hoặc email + mật khẩu) rồi đăng nhập.</li>
          <li>Vào <b>Hồ sơ</b>: điền họ tên, CCCD, SĐT, địa chỉ, <b>ngân hàng + số tài khoản</b>, chụp 2 mặt CCCD → Nộp.</li>
          <li>Chờ <b>Admin 2 duyệt hồ sơ</b> (thông báo sẽ về máy). Duyệt xong mới đăng ký ca được.</li>
          <li>Vào <b>Lịch ca & đăng ký</b>: xem ca đang tuyển (dạng danh sách hoặc lịch tháng), bấm vào ca → <b>Gửi đăng ký</b>.</li>
          <li>Theo dõi <b>Ca của tôi</b>: ca đã duyệt hiện màu xanh trên lịch cá nhân; sau khi đi làm, kết quả chấm công (đủ ca / nửa ca / vắng) và tình trạng thanh toán hiện ngay tại đây.</li>
          <li>Xem <b>Thống kê của tôi</b>: số buổi đi làm, giờ công, tiền theo tháng, kèm nhãn tốt/xấu (bạn nhìn thấy được nhãn xấu của chính mình).</li>
        </ol>
        <p className="mt-2 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-500">Chấm công thực tế là <b>ký giấy tại nơi làm việc</b>; trên web, bên tuyển dụng sẽ tích kết quả sau trong bước đối soát.</p>
      </div>

      <div className="card p-5">
        <h2 className="font-display text-lg font-bold uppercase text-accent">Bên tuyển dụng</h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-6">
          <li><b>Duyệt ca</b>: ca chủ tạo sẽ đến đây trước — bấm Duyệt để phát hành cho người làm (hoặc Từ chối).</li>
          <li><b>Duyệt người</b>: trong mỗi ca, bấm vào tên người đăng ký để xem hồ sơ: số buổi đi làm, buổi vắng, nhãn xấu… rồi quyết định Duyệt/Từ chối.</li>
          <li><b>Đối soát</b>: sau khi ca kết thúc (chấm công ký giấy tại chỗ), mở bảng đối soát kiểu Excel — tích Đủ ca / Nửa ca / Vắng có báo / Vắng không phép, chỉnh số giờ, tiền tự tính theo đơn giá. Bấm <b>Lưu</b> rồi <b>Hoàn tất → Đang thanh toán</b>.</li>
          <li>Xuất Excel (CSV) bảng đối soát để lưu hồ sơ; bảng tổng hợp ở <b>Bảng điều khiển</b> lọc theo tháng.</li>
          <li>Gắn nhãn cho người làm ngay trong màn hình duyệt/đối soát — nhãn hiện cả với người làm.</li>
        </ol>
      </div>

      <div className="card p-5">
        <h2 className="font-display text-lg font-bold uppercase text-accent">Bên chủ / công ty</h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-6">
          <li><b>Tạo ca làm</b>: tên, địa điểm, ngày giờ, <b>đơn giá/giờ</b>, số lượng, hạn đăng ký, người liên hệ, lưu ý.</li>
          <li>Ca chờ <b>tuyển dụng duyệt</b> mới hiện cho người làm. Theo dõi số lượng đăng ký ngay trong danh sách ca.</li>
          <li>Khi ca chuyển sang <b>Đang thanh toán</b>: bấm “Cập nhật đã thanh toán” — hệ thống hiện bảng chuyển khoản kèm số TK ngân hàng từng người; xác nhận xong ca sang <b>Đã thanh toán</b> và người làm nhận thông báo.</li>
          <li>Hủy ca: người đã đăng ký nhận thông báo; dùng nút <b>Báo hủy vào nhóm Zalo</b> để dán lên nhóm.</li>
          <li>Xem <b>Chi phí & thống kê</b> theo tháng, xuất Excel.</li>
        </ol>
      </div>

      {(role === 'admin2' || role === 'admin') && (
        <div className="card p-5">
          <h2 className="font-display text-lg font-bold uppercase text-accent">Admin 2 — duyệt hồ sơ</h2>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-6">
            <li>Mở <b>Duyệt hồ sơ CCCD</b>, xem ảnh 2 mặt + thông tin.</li>
            <li>Duyệt → người đó được đăng ký ca. Từ chối → người đó nộp lại hồ sơ.</li>
          </ol>
        </div>
      )}

      <div className="card p-5">
        <h2 className="font-display text-lg font-bold uppercase text-accent">Vòng đời một ca làm</h2>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs font-bold">
          {['Chờ duyệt ca', 'Đang tuyển', 'Đang diễn ra', 'Đang đối soát', 'Đang thanh toán', 'Đã thanh toán'].map((s, i) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className="rounded border border-zinc-300 bg-zinc-100 px-2 py-1">{s}</span>
              {i < 5 && <span className="text-zinc-400">→</span>}
            </span>
          ))}
        </div>
        <ul className="mt-3 space-y-1 text-sm text-zinc-600">
          <li>• <b>Đang tuyển → Đang diễn ra</b>: tự chuyển đúng giờ bắt đầu ca.</li>
          <li>• <b>Đang đối soát</b>: do tuyển dụng bấm sau khi ca kết thúc.</li>
          <li>• <b>Đang → Đã thanh toán</b>: do chủ/công ty cập nhật.</li>
        </ul>
      </div>
    </div>
  )
}
