import { Eye, FileDown, ThumbsDown, ThumbsUp, Users2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import WorkerCard from '../components/WorkerCard'
import { Badge, Banner, Empty, Modal, Spinner, StatCard } from '../components/ui'
import { RegStatusBadge, ShiftZaloShare } from '../components/ZaloShare'
import {
  audit, listLabels, listProfiles, listRegistrations, listShifts,
  notify, saveReconcileRows, updateRegistration, updateShift,
} from '../lib/api'
import { useSession, useToast } from '../lib/store'
import type { Attendance, Label, Profile, Registration, Shift } from '../lib/types'
import { ATTENDANCE_LABEL, SHIFT_STATUS_COLOR, SHIFT_STATUS_LABEL } from '../lib/types'
import { downloadCsv, effStatus, fmtD, fmtDT, fmtT, money, monthName, num, shiftTimes, ym } from '../lib/util'

function useBase() {
  const { profile } = useSession()
  const { push } = useToast()
  return { profile, push }
}

/* ============ 1) DUYỆT CA DO CHỦ TẠO ============ */
export function ApproveShifts() {
  const { profile, push } = useBase()
  const [shifts, setShifts] = useState<Shift[] | null>(null)
  const [regs, setRegs] = useState<Registration[]>([])
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [ss, rr] = await Promise.all([listShifts(), listRegistrations()])
        if (alive) { setShifts(ss); setRegs(rr) }
      } catch (e) { console.error(e); if (alive) setShifts([]) }
    })()
    return () => { alive = false }
  }, [tick])
  if (!shifts || !profile) return <Spinner />
  const reload = () => setTick((t) => t + 1)

  const pending = shifts.filter((s) => s.status === 'pending_approval')
  const others = shifts.filter((s) => s.status !== 'pending_approval').sort((a, b) => (b.work_date + b.start_time).localeCompare(a.work_date + a.start_time))

  const approve = async (s: Shift) => {
    try {
      await updateShift(s.id, { status: 'recruiting', approved_by: profile.id })
      const workers = (await listProfiles()).filter((p) => p.role === 'worker').map((p) => p.id)
      const { hours } = shiftTimes(s)
      await notify(workers, 'shift_new', 'Ca làm mới đang tuyển', `${s.title} — ${fmtD(s.work_date)} ${fmtT(s.start_time)}-${fmtT(s.end_time)} · ${money(s.rate)}/giờ · ${s.location}`, s.id)
      await audit(profile.id, profile.full_name || profile.username, 'approve_shift', `Duyệt ca ${s.title} (${s.id})`)
      push('Đã duyệt ca — người đi làm đã nhận thông báo')
      reload()
    } catch (e) { push((e as Error).message, true) }
  }
  const reject = async (s: Shift) => {
    if (!confirm(`Từ chối ca "${s.title}"?`)) return
    try {
      await updateShift(s.id, { status: 'rejected' })
      await notify([s.created_by], 'shift_rejected', 'Ca bị từ chối', `Ca "${s.title}" (${fmtD(s.work_date)}) không được tuyển dụng duyệt.`, s.id)
      await audit(profile.id, profile.full_name || profile.username, 'reject_shift', `Từ chối ca ${s.title}`)
      push('Đã từ chối ca')
      reload()
    } catch (e) { push((e as Error).message, true) }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Duyệt ca từ chủ</h1>
        <p className="text-sm text-zinc-500">Chủ tạo ca sẽ xuất hiện ở đây để bạn duyệt. Duyệt xong ca mới hiện cho người đi làm.</p>
      </div>

      {pending.length === 0 ? <Empty msg="Không có ca nào chờ duyệt." /> : (
        <div className="space-y-2.5">
          {pending.map((s) => {
            const { hours } = shiftTimes(s)
            const n = regs.filter((r) => r.shift_id === s.id).length
            return (
              <div key={s.id} className="card p-4">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <div className="min-w-44">
                    <div className="font-display text-lg font-bold leading-6">{s.title}</div>
                    <div className="text-xs text-zinc-500">{s.location}</div>
                  </div>
                  <div className="text-sm"><div className="font-semibold">{fmtD(s.work_date)}</div><div className="text-zinc-500">{fmtT(s.start_time)}→{fmtT(s.end_time)} · {hours}h</div></div>
                  <div className="text-sm"><div className="font-semibold text-accent">{money(s.rate)}/h</div><div className="text-zinc-500">≈ {money(s.rate * hours)}/ca</div></div>
                  <div className="text-sm text-zinc-600">Cần {s.capacity} người</div>
                  {s.note && <div className="w-full rounded-lg bg-amber-50 px-3 py-1.5 text-sm text-amber-900"><b>Lưu ý:</b> {s.note}</div>}
                  <div className="ml-auto flex gap-2">
                    <button className="btn-primary" onClick={() => approve(s)}><ThumbsUp size={15} /> Duyệt ca</button>
                    <button className="btn-danger" onClick={() => reject(s)}><ThumbsDown size={15} /> Từ chối</button>
                  </div>
                </div>
                {n > 0 && <div className="mt-2 text-xs text-zinc-500">{n} đăng ký gửi sớm (sẽ xử lý sau khi ca được duyệt).</div>}
              </div>
            )
          })}
        </div>
      )}

      <div>
        <h2 className="mb-2 font-display text-lg font-bold uppercase text-zinc-600">Tất cả ca đã xử lý</h2>
        <div className="card overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead><tr><th className="th">Ngày</th><th className="th">Ca</th><th className="th">Trạng thái</th><th className="th">Người</th><th className="th">Quản lý</th></tr></thead>
            <tbody>
              {others.map((s) => {
                const eff = effStatus(s)
                const act = regs.filter((r) => r.shift_id === s.id && (r.status === 'pending' || r.status === 'approved')).length
                return (
                  <tr key={s.id}>
                    <td className="td whitespace-nowrap">{fmtD(s.work_date)} {fmtT(s.start_time)}</td>
                    <td className="td">{s.title}</td>
                    <td className="td"><span className={`badge border ${SHIFT_STATUS_COLOR[eff.status]}`}>{SHIFT_STATUS_LABEL[eff.status]}{eff.status === 'ongoing' && eff.ended ? ' (hết giờ)' : ''}</span></td>
                    <td className="td">{act}/{s.capacity}</td>
                    <td className="td"><ShiftLink id={s.id} label="Duyệt người / Đối soát" /></td>
                  </tr>
                )
              })}
              {others.length === 0 && <tr><td className="td text-center text-zinc-400" colSpan={5}>Chưa có ca nào</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function ShiftLink({ id, label }: { id: string; label: string }) {
  return <a className="font-semibold text-accent underline" href={`#/recruiter/shift/${id}`}>{label}</a>
}

/* ============ 2) DUYỆT NGƯỜI VÀO CA ============ */
export function ShiftPeople() {
  const { id } = useParams()
  const { profile, push } = useBase()
  const nav = useNavigate()
  const [shift, setShift] = useState<Shift | null>(null)
  const [regs, setRegs] = useState<Registration[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [labels, setLabels] = useState<Label[]>([])
  const [selWorker, setSelWorker] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [ss, rr, pp, ll] = await Promise.all([listShifts(), listRegistrations({ shiftId: id }), listProfiles(), listLabels()])
        if (!alive) return
        setShift(ss.find((s) => s.id === id) ?? null)
        setRegs(rr); setProfiles(pp); setLabels(ll)
      } catch (e) { console.error(e) }
      if (alive) setLoading(false)
    })()
    return () => { alive = false }
  }, [id, tick])

  if (loading) return <Spinner />
  if (!shift) return <Empty msg="Không tìm thấy ca. Có thể ca đã bị xóa." />

  const reload = () => setTick((t) => t + 1)
  const nameOf = (wid: string) => profiles.find((p) => p.id === wid)
  const pending = regs.filter((r) => r.status === 'pending')
  const act = regs.filter((r) => r.status === 'pending' || r.status === 'approved')
  const remaining = Math.max(0, shift.capacity - act.length)

  const decide = async (r: Registration, ok: boolean) => {
    if (!profile) return
    try {
      await updateRegistration(r.id, { status: ok ? 'approved' : 'rejected', reviewed_by: profile.id })
      const p = nameOf(r.worker_id)
      await notify([r.worker_id], ok ? 'reg_approved' : 'reg_rejected',
        ok ? 'Đăng ký ca được duyệt ✓' : 'Đăng ký ca bị từ chối',
        ok ? `Bạn đã được duyệt vào ca "${shift.title}" — ${fmtD(shift.work_date)} ${fmtT(shift.start_time)}. Nhớ có mặt đúng giờ!` : `Đăng ký ca "${shift.title}" (${fmtD(shift.work_date)}) của bạn không được duyệt.`,
        shift.id)
      await audit(profile.id, profile.full_name || profile.username, ok ? 'approve_person' : 'reject_person', `${ok ? 'Duyệt' : 'Từ chối'} ${p?.full_name || r.worker_id} vào ca ${shift.title}`)
      push(ok ? 'Đã duyệt' : 'Đã từ chối')
      reload()
    } catch (e) { push((e as Error).message, true) }
  }

  const badCount = (wid: string) => labels.filter((l) => l.worker_id === wid && ['late', 'leave_early', 'no_show', 'cancel_late', 'attitude', 'uniform', 'other_bad'].includes(l.code)).length

  return (
    <div className="space-y-4">
      <button className="btn-ghost !py-1.5 text-xs" onClick={() => nav('/approve')}>← Về danh sách ca</button>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{shift.title}</h1>
          <p className="text-sm text-zinc-500">{fmtD(shift.work_date)} · {fmtT(shift.start_time)}→{fmtT(shift.end_time)} · {shift.location} · {money(shift.rate)}/giờ</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={`border ${SHIFT_STATUS_COLOR[shift.status]}`}>{SHIFT_STATUS_LABEL[shift.status]}</Badge>
          <ShiftZaloShare shift={shift} regs={regs} />
        </div>
      </div>

      {remaining === 0 && <Banner kind="success">Đã đủ {shift.capacity}/{shift.capacity} người cho ca này.</Banner>}

      <div>
        <h2 className="mb-2 font-display text-lg font-bold uppercase text-zinc-600">Chờ duyệt ({pending.length})</h2>
        {pending.length === 0 ? <Empty msg="Không có ai chờ duyệt." /> : (
          <div className="space-y-2">
            {pending.map((r) => {
              const p = nameOf(r.worker_id)
              const bad = badCount(r.worker_id)
              return (
                <div key={r.id} className="card flex flex-wrap items-center gap-x-5 gap-y-2 p-4">
                  <div className="min-w-44">
                    <button className="font-display text-lg font-bold leading-6 hover:text-accent hover:underline" onClick={() => setSelWorker(r.worker_id)}>
                      {p?.full_name || '(chưa tên)'}
                    </button>
                    <div className="text-xs text-zinc-500">{p?.phone || '—'}</div>
                  </div>
                  <div className="text-xs text-zinc-500">
                    <div>{p?.kyc_status === 'approved' ? '✓ Hồ sơ đã duyệt' : '⚠ Hồ sơ chưa duyệt'}</div>
                    <div>Nhãn xấu: <b className={bad > 0 ? 'text-red-600' : ''}>{bad}</b></div>
                  </div>
                  {r.worker_note && <div className="w-full rounded-lg bg-zinc-50 px-3 py-1.5 text-sm text-zinc-600">“{r.worker_note}”</div>}
                  <div className="ml-auto flex gap-2">
                    <button className="btn-ghost !py-1.5 text-xs" onClick={() => setSelWorker(r.worker_id)}><Eye size={13} /> Hồ sơ</button>
                    <button className="btn-primary !py-1.5 text-xs" onClick={() => decide(r, true)} disabled={remaining === 0}>Duyệt</button>
                    <button className="btn-danger !py-1.5 text-xs" onClick={() => decide(r, false)}>Từ chối</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 font-display text-lg font-bold uppercase text-zinc-600">Đã duyệt / đã từ chối</h2>
        <div className="card overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead><tr><th className="th">Người</th><th className="th">Trạng thái</th><th className="th">Trả lương</th><th className="th">Đăng ký lúc</th></tr></thead>
            <tbody>
              {regs.filter((r) => r.status !== 'pending').map((r) => (
                <tr key={r.id}>
                  <td className="td">
                    <button className="font-semibold hover:text-accent hover:underline" onClick={() => setSelWorker(r.worker_id)}>
                      {nameOf(r.worker_id)?.full_name || r.worker_id.slice(0, 8)}
                    </button>
                  </td>
                  <td className="td"><RegStatusBadge status={r.status} /></td>
                  <td className="td">
                    {r.pay_status === 'paid' ? <span className="badge border-emerald-300 bg-emerald-600 text-white">Đã trả</span>
                     : r.pay_status === 'failed' ? <span className="badge border-red-300 bg-red-600 text-white" title={r.pay_fail_note ?? ''}>✗ {r.pay_fail_note || 'Không trả được'}</span>
                     : <span className="text-xs text-zinc-400">—</span>}
                  </td>
                  <td className="td text-zinc-500">{fmtDT(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!selWorker} onClose={() => setSelWorker(null)} title="Hồ sơ người làm" wide>
        {selWorker && <WorkerCard workerId={selWorker} registrations={regs} shiftIdForLabel={shift.id} onChanged={reload} />}
      </Modal>
    </div>
  )
}

/* ============ 3) ĐỐI SOÁT ============ */
export function ReconcileList() {
  const { push } = useBase()
  const [shifts, setShifts] = useState<Shift[] | null>(null)
  const [regs, setRegs] = useState<Registration[]>([])
  const [tick, setTick] = useState(0)
  const { profile } = useSession()
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [ss, rr] = await Promise.all([listShifts(), listRegistrations()])
        if (alive) { setShifts(ss); setRegs(rr) }
      } catch (e) { console.error(e); if (alive) setShifts([]) }
    })()
    return () => { alive = false }
  }, [tick])
  if (!shifts || !profile) return <Spinner />
  const reload = () => setTick((t) => t + 1)

  const startReconcile = async (s: Shift) => {
    try {
      await updateShift(s.id, { status: 'reconciling' })
      await notify([s.created_by], 'reconcile_started', 'Ca đang được đối soát', `Ca "${s.title}" (${fmtD(s.work_date)}) đã chuyển sang giai đoạn đối soát công.`, s.id)
      await audit(profile.id, profile.full_name || profile.username, 'start_reconcile', `Bắt đầu đối soát ca ${s.title}`)
      push('Đã chuyển ca sang Đang đối soát')
      reload()
    } catch (e) { push((e as Error).message, true) }
  }

  const rows = shifts
    .filter((s) => ['reconciling', 'paying', 'paid'].includes(s.status) || (s.status === 'ongoing' && effStatus(s).ended))
    .sort((a, b) => (b.work_date + b.start_time).localeCompare(a.work_date + a.start_time))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Đối soát công</h1>
        <p className="text-sm text-zinc-500">So với bảng ký giấy tại nơi làm: tích ai đi làm, ai nghỉ, rồi ra tiền từng người.</p>
      </div>
      <div className="space-y-2">
        {rows.length === 0 && <Empty msg="Chưa có ca nào kết thúc để đối soát." />}
        {rows.map((s) => {
          const eff = effStatus(s)
          const approved = regs.filter((r) => r.shift_id === s.id && r.status === 'approved')
          const total = approved.reduce((acc, r) => acc + (r.pay ?? 0), 0)
          return (
            <div key={s.id} className="card flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
              <div className="min-w-44">
                <div className="font-display text-lg font-bold leading-6">{s.title}</div>
                <div className="text-xs text-zinc-500">{s.location}</div>
              </div>
              <div className="text-sm"><div className="font-semibold">{fmtD(s.work_date)}</div><div className="text-zinc-500">{fmtT(s.start_time)}→{fmtT(s.end_time)}</div></div>
              <div className="text-sm text-zinc-600"><Users2 size={14} className="mr-1 inline" />{approved.length} người được duyệt</div>
              <div className="text-sm"><div className="font-semibold">{money(total)}</div><div className="text-xs text-zinc-500">tổng công đã chấm</div></div>
              <span className={`badge border ${SHIFT_STATUS_COLOR[eff.status]}`}>{SHIFT_STATUS_LABEL[s.status]}</span>
              <div className="ml-auto flex gap-2">
                {s.status === 'ongoing' && (
                  <button className="btn-dark" onClick={() => startReconcile(s)}>Bắt đầu đối soát</button>
                )}
                <a className="btn-ghost" href={`#/recruiter/reconcile/${s.id}`}>
                  {s.status === 'reconciling' ? 'Mở bảng đối soát' : 'Xem kết quả'}
                </a>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function Reconcile() {
  const { id } = useParams()
  const { profile, push } = useBase()
  const nav = useNavigate()
  const [shift, setShift] = useState<Shift | null>(null)
  const [regs, setRegs] = useState<Registration[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [labels, setLabels] = useState<Label[]>([])
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const [selWorker, setSelWorker] = useState<string | null>(null)
  // bản nháp chỉnh sửa cục bộ
  const [draft, setDraft] = useState<Record<string, { attendance: Attendance; hours: number; pay: number; note: string }>>({})

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [ss, rr, pp, ll] = await Promise.all([listShifts(), listRegistrations({ shiftId: id }), listProfiles(), listLabels()])
        if (!alive) return
        const s = ss.find((x) => x.id === id) ?? null
        setShift(s); setRegs(rr); setProfiles(pp); setLabels(ll)
        if (s) {
          const d: typeof draft = {}
          for (const r of rr.filter((x) => x.status === 'approved')) {
            const { hours } = shiftTimes(s)
            const a: Attendance = r.attendance ?? 'full'
            const h = r.hours ?? (a === 'half' ? Math.round(hours / 2 * 100) / 100 : hours)
            d[r.id] = { attendance: a, hours: h, pay: r.pay ?? Math.round(h * s.rate), note: r.pay_note ?? '' }
          }
          setDraft(d)
        }
      } catch (e) { console.error(e) }
      if (alive) setLoading(false)
    })()
    return () => { alive = false }
  }, [id, tick])

  if (loading || !profile) return <Spinner />
  if (!shift) return <Empty msg="Không tìm thấy ca." />
  const reload = () => setTick((t) => t + 1)
  const editable = shift.status === 'reconciling'
  const { hours: autoHours } = shiftTimes(shift)
  const nameOf = (wid: string) => profiles.find((p) => p.id === wid)
  const rows = regs.filter((r) => r.status === 'approved')
  const total = rows.reduce((acc, r) => acc + (draft[r.id]?.pay ?? r.pay ?? 0), 0)

  const setRow = (rid: string, patch: Partial<{ attendance: Attendance; hours: number; pay: number; note: string }>) => {
    setDraft((d) => {
      const cur = d[rid]
      const next = { ...cur, ...patch }
      if (patch.attendance !== undefined) {
        // đổi chấm công: đặt giá trị MẶC ĐỊNH (nửa ca = 1/2 giờ, vắng = 0) — chỉ là gợi ý
        const base = shiftTimes(shift).hours
        next.hours = patch.attendance === 'full' ? base : patch.attendance === 'half' ? Math.round((base / 2) * 100) / 100 : 0
        next.pay = Math.round(next.hours * shift.rate)
      }
      // đổi số giờ hoặc sửa tiền trực tiếp: KHÔNG đè tiền — tiền là số độc lập
      // (dùng cho ca thỏa thuận riêng, phụ cấp, trừ phí… không bắt buộc theo đơn giá × giờ)
      return { ...d, [rid]: next }
    })
  }

  const save = async (): Promise<boolean> => {
    try {
      await saveReconcileRows(rows.map((r) => ({
        id: r.id,
        shift_id: shift.id,
        worker_id: r.worker_id,
        status: 'approved' as const,
        attendance: draft[r.id].attendance,
        hours: draft[r.id].hours,
        pay: draft[r.id].pay,
        pay_note: draft[r.id].note || null,
        reconciled_by: profile.id,
        reconciled_at: new Date().toISOString(),
      })))
      await audit(profile.id, profile.full_name || profile.username, 'save_reconcile', `Lưu đối soát ca ${shift.title} — tổng ${money(total)}`)
      push('Đã lưu bảng đối soát')
      reload()
      return true
    } catch (e) { push((e as Error).message, true); return false }
  }

  const finish = async () => {
    if (!confirm('Hoàn tất đối soát và chuyển ca sang "Đang thanh toán"? Chủ sẽ nhận thông báo kèm tổng tiền.')) return
    if (!(await save())) return
    try {
      await updateShift(shift.id, { status: 'paying' })
      const totalText = rows.filter((r) => draft[r.id].attendance === 'full' || draft[r.id].attendance === 'half')
        .reduce((acc, r) => acc + draft[r.id].pay, 0)
      await notify([shift.created_by], 'paying', 'Chờ công ty thanh toán', `Ca "${shift.title}" (${fmtD(shift.work_date)}) đã đối soát xong. Tổng cần thanh toán: ${money(totalText)}.`, shift.id)
      await audit(profile.id, profile.full_name || profile.username, 'finish_reconcile', `Hoàn tất đối soát ca ${shift.title} — chờ thanh toán ${money(totalText)}`)
      push('Đã chuyển sang Đang thanh toán — chủ đã nhận thông báo')
      reload()
    } catch (e) { push((e as Error).message, true) }
  }

  const exportCsv = () => {
    downloadCsv(`doi-soat-${shift.title.replace(/[^\w-]+/g, '_')}-${shift.work_date}.csv`, [
      ['STT', 'Họ tên', 'SĐT', 'Ngân hàng', 'STK', 'Chấm công', 'Số giờ', 'Đơn giá', 'Tiền thanh toán', 'Trả lương', 'Ghi chú'],
      ...rows.map((r, i) => {
        const p = nameOf(r.worker_id)
        const d = draft[r.id]
        const paySt = r.pay_status === 'paid' ? 'Đã trả' : r.pay_status === 'failed' ? `Không trả được: ${r.pay_fail_note ?? ''}` : 'Chưa'
        return [i + 1, p?.full_name ?? '', p?.phone ?? '', p?.bank_name ?? '', p?.bank_account ? `'${p.bank_account}` : '', ATTENDANCE_LABEL[d.attendance], d.hours, shift.rate, d.pay, paySt, d.note]
      }),
      ['', '', '', '', '', 'TỔNG', '', '', total, '', ''],
    ])
  }

  return (
    <div className="space-y-4">
      <button className="btn-ghost !py-1.5 text-xs" onClick={() => nav('/reconcile')}>← Về danh sách đối soát</button>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Bảng đối soát — {shift.title}</h1>
          <p className="text-sm text-zinc-500">{fmtD(shift.work_date)} · {fmtT(shift.start_time)}→{fmtT(shift.end_time)} · {shift.location} · Đơn giá {money(shift.rate)}/giờ</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={exportCsv}><FileDown size={15} /> Xuất Excel (CSV)</button>
          {editable && <button className="btn-dark" onClick={save}>Lưu</button>}
          {editable && <button className="btn-primary" onClick={finish}>Hoàn tất → Đang thanh toán</button>}
        </div>
      </div>
      {!editable && <Banner kind="warn">Ca đang ở trạng thái <b>{SHIFT_STATUS_LABEL[shift.status]}</b> — bảng chỉ xem được, không sửa.</Banner>}
      {editable && (
        <Banner kind="info">
          Số giờ và <b>tiền thanh toán đều sửa trực tiếp được</b> — công thức đơn giá × giờ chỉ là gợi ý ban đầu.
          Dùng cho các trường hợp thỏa thuận riêng: làm thêm giờ, phụ cấp, trừ tạm ứng…
        </Banner>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse">
          <thead>
            <tr>
              <th className="th w-10">STT</th>
              <th className="th">Họ tên</th>
              <th className="th">Chấm công</th>
              <th className="th w-24">Số giờ</th>
              <th className="th w-28">Đơn giá</th>
              <th className="th w-32">Tiền thanh toán</th>
              <th className="th">Ghi chú</th>
              <th className="th w-28">Trả lương</th>
              <th className="th w-24">Hồ sơ</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td className="td text-center text-zinc-400" colSpan={9}>Chưa duyệt ai vào ca này.</td></tr>}
            {rows.map((r, i) => {
              const p = nameOf(r.worker_id)
              const d = draft[r.id] ?? { attendance: 'full' as Attendance, hours: autoHours, pay: r.pay ?? Math.round(autoHours * shift.rate), note: '' }
              return (
                <tr key={r.id} className={d.attendance.startsWith('absent') ? 'bg-red-50/60' : ''}>
                  <td className="td text-center text-zinc-400">{i + 1}</td>
                  <td className="td">
                    <button className="font-semibold hover:text-accent hover:underline" onClick={() => setSelWorker(r.worker_id)}>{p?.full_name || r.worker_id.slice(0, 8)}</button>
                    <div className="text-[11px] text-zinc-400">{p?.bank_name} {p?.bank_account ? `· ${p.bank_account}` : ''}</div>
                  </td>
                  <td className="td">
                    <select className="field !py-1" disabled={!editable} value={d.attendance} onChange={(e) => setRow(r.id, { attendance: e.target.value as Attendance })}>
                      {Object.entries(ATTENDANCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                  <td className="td"><input className="field !py-1 text-right" type="number" step="0.5" min="0" disabled={!editable} value={d.hours} onChange={(e) => setRow(r.id, { hours: Number(e.target.value) })} /></td>
                  <td className="td text-right text-zinc-500">{money(shift.rate)}</td>
                  <td className="td"><input className="field !py-1 text-right font-bold" type="number" step="1000" min="0" disabled={!editable} value={d.pay} onChange={(e) => setDraft((dd) => ({ ...dd, [r.id]: { ...d, pay: Number(e.target.value) } }))} /></td>
                  <td className="td"><input className="field !py-1" disabled={!editable} value={d.note} onChange={(e) => setDraft((dd) => ({ ...dd, [r.id]: { ...d, note: e.target.value } }))} placeholder="Lý do vắng, trễ…" /></td>
                  <td className="td">
                    {r.pay_status === 'paid' ? <span className="badge border-emerald-300 bg-emerald-600 text-white">Đã trả</span>
                     : r.pay_status === 'failed' ? <span className="badge border-red-300 bg-red-600 text-white" title={r.pay_fail_note ?? ''}>✗ {r.pay_fail_note || 'Không trả được'}</span>
                     : <span className="text-xs text-zinc-400">—</span>}
                  </td>
                  <td className="td text-center"><button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setSelWorker(r.worker_id)}>Xem</button></td>
                </tr>
              )
            })}
            <tr className="bg-zinc-100 font-bold">
              <td className="td" colSpan={5}>TỔNG CẦN THANH TOÁN</td>
              <td className="td text-right text-accent">{money(total)}</td>
              <td className="td" colSpan={3}></td>
            </tr>
          </tbody>
        </table>
      </div>

      <Modal open={!!selWorker} onClose={() => setSelWorker(null)} title="Hồ sơ người làm" wide>
        {selWorker && <WorkerCard workerId={selWorker} registrations={regs} shiftIdForLabel={shift.id} onChanged={reload} />}
      </Modal>
    </div>
  )
}

/* ============ 4) DASHBOARD TUYỂN DỤNG ============ */
export function RecruiterDashboard() {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [regs, setRegs] = useState<Registration[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(ym(new Date()))
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [ss, rr, pp] = await Promise.all([listShifts(), listRegistrations(), listProfiles()])
        if (alive) { setShifts(ss); setRegs(rr); setProfiles(pp) }
      } catch (e) { console.error(e) }
      if (alive) setLoading(false)
    })()
    return () => { alive = false }
  }, [])
  const inMonth = useMemo(() => shifts.filter((s) => s.work_date.startsWith(month)), [shifts, month])
  if (loading) return <Spinner />

  const byStatus = (st: string) => inMonth.filter((s) => s.status === st).length
  const pendingShifts = shifts.filter((s) => s.status === 'pending_approval').length
  const pendingRegs = regs.filter((r) => r.status === 'pending').length
  const workers = profiles.filter((p) => p.role === 'worker')
  const kycPending = workers.filter((p) => p.kyc_status === 'pending').length
  const attendedInMonth = regs.filter((r) => {
    if (r.status !== 'approved' || !r.attendance) return false
    const s = shifts.find((x) => x.id === r.shift_id)
    return !!s && s.work_date.startsWith(month) && (r.attendance === 'full' || r.attendance === 'half')
  })
  const moneyInMonth = attendedInMonth.reduce((acc, r) => acc + (r.pay ?? 0), 0)

  const bars = ([
    ['pending_approval', 'Chờ duyệt'],
    ['recruiting', 'Đang tuyển'],
    ['ongoing', 'Đang diễn ra'],
    ['reconciling', 'Đang đối soát'],
    ['paying', 'Đang thanh toán'],
    ['paid', 'Đã thanh toán'],
  ] as const).map(([st, label]) => ({ label, n: inMonth.filter((s) => s.status === st).length }))
  const maxBar = Math.max(1, ...bars.map((b) => b.n))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Bảng điều khiển tuyển dụng</h1>
          <p className="text-sm text-zinc-500">Theo dõi số ca, số người, trạng thái theo tháng.</p>
        </div>
        <div><span className="label">Tháng</span><input type="month" className="field" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <QueueCard n={pendingShifts} label="Ca chờ duyệt" to="/approve" accent />
        <QueueCard n={pendingRegs} label="Người chờ duyệt vào ca" to="/approve" />
        <QueueCard n={kycPending} label="Hồ sơ CCCD chờ duyệt" to="/kyc" />
        <StatCard label={`Tiền đối soát ${monthName(month)}`} value={money(moneyInMonth)} sub={`${attendedInMonth.length} lượt đi làm`} accent />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h3 className="mb-3 font-display text-lg font-bold uppercase">Ca theo trạng thái — {monthName(month)}</h3>
          <div className="space-y-2">
            {bars.map((b) => (
              <div key={b.label} className="flex items-center gap-3 text-sm">
                <div className="w-32 shrink-0 text-zinc-500">{b.label}</div>
                <div className="h-5 flex-1 overflow-hidden rounded bg-zinc-100">
                  <div className="h-full rounded bg-ink" style={{ width: `${(b.n / maxBar) * 100}%`, backgroundColor: b.label === 'Chờ duyệt' ? '#a8a29e' : undefined }} />
                </div>
                <div className="w-8 text-right font-bold">{b.n}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs text-zinc-500">
            <div>Tổng ca: <b className="text-ink">{inMonth.length}</b></div>
            <div>Đang tuyển: <b className="text-ink">{byStatus('recruiting')}</b></div>
            <div>Đã thanh toán: <b className="text-ink">{byStatus('paid')}</b></div>
          </div>
        </div>
        <div className="card p-4">
          <h3 className="mb-3 font-display text-lg font-bold uppercase">Người làm tích cực nhất tháng</h3>
          {(() => {
            const per = new Map<string, number>()
            for (const r of attendedInMonth) per.set(r.worker_id, (per.get(r.worker_id) ?? 0) + 1)
            const top = [...per.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
            if (!top.length) return <p className="text-sm text-zinc-400">Chưa có dữ liệu trong tháng này.</p>
            return (
              <ul className="space-y-1.5 text-sm">
                {top.map(([wid, n], i) => (
                  <li key={wid} className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-1.5">
                    <span>{i + 1}. {profiles.find((p) => p.id === wid)?.full_name || wid.slice(0, 8)}</span>
                    <b>{n} buổi</b>
                  </li>
                ))}
              </ul>
            )
          })()}
        </div>
      </div>

      <div className="card overflow-x-auto">
        <div className="border-b border-zinc-200 px-4 py-3 font-display text-lg font-bold uppercase">Ca trong {monthName(month)}</div>
        <table className="w-full border-collapse text-sm">
          <thead><tr><th className="th">Ngày</th><th className="th">Ca</th><th className="th">Trạng thái</th><th className="th">Người</th><th className="th">Tổng tiền đối soát</th><th className="th"></th></tr></thead>
          <tbody>
            {inMonth.sort((a, b) => (b.work_date + b.start_time).localeCompare(a.work_date + a.start_time)).map((s) => {
              const rs = regs.filter((r) => r.shift_id === s.id)
              const act = rs.filter((r) => r.status === 'pending' || r.status === 'approved').length
              const tot = rs.filter((r) => r.status === 'approved').reduce((acc, r) => acc + (r.pay ?? 0), 0)
              return (
                <tr key={s.id}>
                  <td className="td whitespace-nowrap">{fmtD(s.work_date)}</td>
                  <td className="td">{s.title}</td>
                  <td className="td"><span className={`badge border ${SHIFT_STATUS_COLOR[s.status]}`}>{SHIFT_STATUS_LABEL[s.status]}</span></td>
                  <td className="td">{act}/{s.capacity}</td>
                  <td className="td font-semibold">{money(tot)}</td>
                  <td className="td"><ShiftLink id={s.id} label="Mở" /></td>
                </tr>
              )
            })}
            {inMonth.length === 0 && <tr><td className="td text-center text-zinc-400" colSpan={6}>Không có ca trong tháng này</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function QueueCard({ n, label, to, accent }: { n: number; label: string; to: string; accent?: boolean }) {
  return (
    <a href={`#${to}`} className={`card p-4 transition hover:border-accent ${accent ? 'border-l-4 border-l-accent' : ''}`}>
      <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-display text-3xl font-bold">{n}</span>
        {n > 0 && <span className="text-xs font-bold text-accent">cần xử lý →</span>}
      </div>
    </a>
  )
}

