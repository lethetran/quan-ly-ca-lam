import { Check, ShieldCheck, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import WorkerCard from '../components/WorkerCard'
import { Badge, Empty, Spinner } from '../components/ui'
import { adminUpdateProfile, audit, listAudit, listProfiles, notify } from '../lib/api'
import { useSession, useToast } from '../lib/store'
import type { AuditLog, Profile, Registration, Role } from '../lib/types'
import { ROLE_LABEL } from '../lib/types'
import { fmtDT, shortAccount } from '../lib/util'
import { signedUrls } from '../lib/api'

/* ============ ADMIN 2: DUYỆT HỒ SƠ CCCD ============ */
export function Kyc() {
  const { profile } = useSession()
  const { push } = useToast()
  const [profiles, setProfiles] = useState<Profile[] | null>(null)
  const [regs, setRegs] = useState<Registration[]>([])
  const [sel, setSel] = useState<Profile | null>(null)
  const [imgs, setImgs] = useState<{ front?: string; back?: string }>({})
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const pp = await listProfiles()
        if (alive) setProfiles(pp)
      } catch (e) { console.error(e); if (alive) setProfiles([]) }
    })()
    return () => { alive = false }
  }, [tick])

  useEffect(() => {
    if (!sel) { setImgs({}); return }
    ;(async () => {
      try {
        const paths = [sel.cccd_front_path, sel.cccd_back_path].filter(Boolean) as string[]
        const urls = await signedUrls(paths)
        setImgs({ front: sel.cccd_front_path ? urls[sel.cccd_front_path] : undefined, back: sel.cccd_back_path ? urls[sel.cccd_back_path] : undefined })
      } catch (e) { console.error(e) }
    })()
  }, [sel])

  if (!profiles || !profile) return <Spinner />
  const reload = () => setTick((t) => t + 1)
  const queue = profiles.filter((p) => p.kyc_status === 'pending')
  const done = profiles.filter((p) => p.kyc_status === 'approved' || p.kyc_status === 'rejected')

  const decide = async (p: Profile, ok: boolean) => {
    try {
      await adminUpdateProfile(p.id, { kyc_status: ok ? 'approved' : 'rejected', kyc_note: ok ? null : 'Ảnh CCCD không hợp lệ — vui lòng chụp lại rõ nét, đủ 2 mặt' })
      await notify([p.id], ok ? 'kyc_approved' : 'kyc_rejected',
        ok ? 'Hồ sơ đã được duyệt ✓' : 'Hồ sơ bị từ chối',
        ok ? 'Ảnh CCCD của bạn đã được duyệt. Giờ bạn có thể đăng ký ca làm!' : 'Hồ sơ CCCD chưa hợp lệ. Hãy vào "Hồ sơ" để nộp lại ảnh rõ nét hơn.')
      await audit(profile.id, profile.full_name || profile.username, ok ? 'kyc_approve' : 'kyc_reject', `${ok ? 'Duyệt' : 'Từ chối'} hồ sơ ${p.full_name || p.username}`)
      push(ok ? 'Đã duyệt hồ sơ' : 'Đã từ chối hồ sơ')
      setSel(null)
      reload()
    } catch (e) { push((e as Error).message, true) }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Duyệt hồ sơ CCCD</h1>
        <p className="text-sm text-zinc-500">Chỉ khi được duyệt, người làm mới có thể đăng ký ca.</p>
      </div>

      <h2 className="font-display text-lg font-bold uppercase text-zinc-600">Chờ duyệt ({queue.length})</h2>
      {queue.length === 0 ? <Empty msg="Không có hồ sơ nào chờ duyệt." /> : (
        <div className="space-y-2">
          {queue.map((p) => (
            <div key={p.id} className="card flex flex-wrap items-center gap-x-5 gap-y-2 p-4">
              <div className="min-w-44">
                <div className="font-display text-lg font-bold leading-6">{p.full_name || '(chưa tên)'}</div>
                <div className="text-xs text-zinc-500">{p.phone || '—'} · {shortAccount(p.username)}</div>
              </div>
              <div className="text-sm text-zinc-600">CCCD: {p.cccd || '—'}</div>
              <div className="ml-auto flex gap-2">
                <button className="btn-ghost" onClick={() => setSel(p)}>Xem ảnh CCCD</button>
                <button className="btn-primary" onClick={() => decide(p, true)}><Check size={15} /> Duyệt</button>
                <button className="btn-danger" onClick={() => decide(p, false)}><X size={15} /> Từ chối</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="font-display text-lg font-bold uppercase text-zinc-600">Đã xử lý ({done.length})</h2>
      <div className="card overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead><tr><th className="th">Người</th><th className="th">CCCD</th><th className="th">Trạng thái</th></tr></thead>
          <tbody>
            {done.map((p) => (
              <tr key={p.id}>
                <td className="td">{p.full_name || '(chưa tên)'} <span className="text-xs text-zinc-400">· {shortAccount(p.username)}</span></td>
                <td className="td">{p.cccd || '—'}</td>
                <td className="td">
                  <Badge className={p.kyc_status === 'approved' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-red-300 bg-red-50 text-red-700'}>
                    {p.kyc_status === 'approved' ? 'Đã duyệt' : 'Bị từ chối'}
                  </Badge>
                </td>
              </tr>
            ))}
            {done.length === 0 && <tr><td className="td text-center text-zinc-400" colSpan={3}>Chưa có hồ sơ nào được xử lý</td></tr>}
          </tbody>
        </table>
      </div>

      {sel && (
        <WorkerProfileModal p={sel} imgs={imgs} onClose={() => setSel(null)} onDecide={decide} />
      )}
    </div>
  )
}

function WorkerProfileModal({
  p, imgs, onClose, onDecide,
}: {
  p: Profile
  imgs: { front?: string; back?: string }
  onClose: () => void
  onDecide: (p: Profile, ok: boolean) => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={onClose}>
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold">{p.full_name || '(chưa tên)'}</h3>
            <p className="text-sm text-zinc-500">CCCD {p.cccd} · {p.phone}</p>
            <p className="text-sm text-zinc-500">Địa chỉ: {p.address || '—'}</p>
            <p className="text-sm text-zinc-500">Ngân hàng: {p.bank_name || '—'} · STK: {p.bank_account || '—'}</p>
          </div>
          <button className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100" onClick={onClose}>✕</button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <div className="label">Mặt trước</div>
            {imgs.front ? <img src={imgs.front} alt="CCCD mặt trước" className="w-full rounded-lg border border-zinc-200" /> : <div className="h-40 rounded-lg bg-zinc-100" />}
          </div>
          <div>
            <div className="label">Mặt sau</div>
            {imgs.back ? <img src={imgs.back} alt="CCCD mặt sau" className="w-full rounded-lg border border-zinc-200" /> : <div className="h-40 rounded-lg bg-zinc-100" />}
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button className="btn-primary flex-1" onClick={() => onDecide(p, true)}><ShieldCheck size={15} /> Duyệt hồ sơ</button>
          <button className="btn-danger flex-1" onClick={() => onDecide(p, false)}>Từ chối</button>
        </div>
      </div>
    </div>
  )
}

/* ============ ADMIN: QUẢN LÝ NGƯỜI DÙNG & VAI TRÒ ============ */
const ROLES: Role[] = ['worker', 'recruiter', 'owner', 'admin2', 'admin']

export function Users() {
  const { profile } = useSession()
  const { push } = useToast()
  const [profiles, setProfiles] = useState<Profile[] | null>(null)
  const [q, setQ] = useState('')
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let alive = true
    ;(async () => {
      try { const pp = await listProfiles(); if (alive) setProfiles(pp) } catch (e) { console.error(e); if (alive) setProfiles([]) }
    })()
    return () => { alive = false }
  }, [tick])
  if (!profiles || !profile) return <Spinner />
  const reload = () => setTick((t) => t + 1)
  const filtered = profiles.filter((p) =>
    (p.full_name ?? '').toLowerCase().includes(q.toLowerCase()) ||
    p.username.toLowerCase().includes(q.toLowerCase()) ||
    (p.phone ?? '').includes(q))

  const setRole = async (p: Profile, role: Role) => {
    if (p.id === profile.id) { push('Không thể tự đổi vai trò của mình', true); return }
    if (!confirm(`Đặt vai trò "${ROLE_LABEL[role]}" cho ${p.full_name || p.username}?`)) return
    try {
      await adminUpdateProfile(p.id, { role })
      await audit(profile.id, profile.full_name || profile.username, 'set_role', `${p.username}: ${p.role} → ${role}`)
      await notify([p.id], 'role_changed', 'Vai trò của bạn đã thay đổi', `Quản trị viên đã đặt vai trò của bạn thành: ${ROLE_LABEL[role]}.`)
      push('Đã cập nhật vai trò')
      reload()
    } catch (e) { push((e as Error).message, true) }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Quản lý người dùng</h1>
        <p className="text-sm text-zinc-500">
          Mọi tài khoản mới mặc định là <b>Người đi làm</b>. Hãy đổi vai trò cho cộng sự: Tuyển dụng, Chủ, Duyệt hồ sơ.
          Tài khoản <b>admin@example.com</b> tự động là Quản trị cao nhất.
        </p>
      </div>
      <input className="field max-w-sm" placeholder="Tìm theo tên, tài khoản, SĐT…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="card overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead><tr><th className="th">Người</th><th className="th">Tài khoản</th><th className="th">Email</th><th className="th">SĐT</th><th className="th">Hồ sơ</th><th className="th">Vai trò</th></tr></thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                <td className="td font-semibold">{p.full_name || '(chưa tên)'}</td>
                <td className="td text-zinc-500">{shortAccount(p.username)}</td>
                <td className="td text-zinc-500">{p.email || '—'}</td>
                <td className="td">{p.phone || '—'}</td>
                <td className="td">
                  <Badge className={
                    p.kyc_status === 'approved' ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : p.kyc_status === 'pending' ? 'border-amber-300 bg-amber-50 text-amber-800'
                    : p.kyc_status === 'rejected' ? 'border-red-300 bg-red-50 text-red-700'
                    : 'border-zinc-300 bg-zinc-50 text-zinc-500'
                  }>
                    {p.kyc_status === 'approved' ? 'Đã duyệt' : p.kyc_status === 'pending' ? 'Chờ duyệt' : p.kyc_status === 'rejected' ? 'Từ chối' : 'Chưa nộp'}
                  </Badge>
                </td>
                <td className="td">
                  {p.id === profile.id ? (
                    <Badge className="border-ink bg-ink text-paper">{ROLE_LABEL[p.role]}</Badge>
                  ) : (
                    <select className="field !py-1" value={p.role} onChange={(e) => setRole(p, e.target.value as Role)}>
                      {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                    </select>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td className="td text-center text-zinc-400" colSpan={6}>Không tìm thấy ai</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ============ ADMIN: NHẬT KÝ ============ */
export function Audit() {
  const [logs, setLogs] = useState<AuditLog[] | null>(null)
  useEffect(() => {
    let alive = true
    listAudit().then((l) => alive && setLogs(l)).catch(() => alive && setLogs([]))
    return () => { alive = false }
  }, [])
  if (!logs) return <Spinner />
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Nhật ký hệ thống</h1>
        <p className="text-sm text-zinc-500">200 thao tác gần nhất — dùng để xử lý tranh chấp.</p>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead><tr><th className="th">Thời gian</th><th className="th">Người thực hiện</th><th className="th">Thao tác</th><th className="th">Chi tiết</th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="td whitespace-nowrap text-zinc-500">{fmtDT(l.created_at)}</td>
                <td className="td">{l.actor_name || '—'}</td>
                <td className="td"><Badge className="border-zinc-300 bg-zinc-100 text-zinc-600">{l.action}</Badge></td>
                <td className="td text-zinc-600">{l.detail}</td>
              </tr>
            ))}
            {logs.length === 0 && <tr><td className="td text-center text-zinc-400" colSpan={4}>Chưa có thao tác nào</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
