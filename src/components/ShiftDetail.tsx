import { useEffect, useState } from 'react'
import { fetchRoster, notify, registerShift, updateRegistration } from '../lib/api'
import { useSession, useToast } from '../lib/store'
import type { Profile, Registration, Shift } from '../lib/types'
import { SHIFT_STATUS_COLOR, SHIFT_STATUS_LABEL } from '../lib/types'
import { effStatus, fmtD, fmtDT, fmtT, money, regOpen, shiftTimes } from '../lib/util'
import { Badge, Modal } from './ui'
import { ShiftZaloShare } from './ZaloShare'

export default function ShiftDetail({
  shift,
  regs: allRegs,
  profiles,
  onClose,
  onChanged,
}: {
  shift: Shift | null
  regs: Registration[]
  profiles: Profile[]
  onClose: () => void
  onChanged?: () => void
}) {
  const { profile: me } = useSession()
  const { push } = useToast()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [roster, setRoster] = useState<{ worker_id: string; full_name: string | null; reg_status: string }[]>([])

  useEffect(() => { setNote('') }, [shift?.id])
  useEffect(() => {
    if (!shift) return
    setRoster([])
    let alive = true
    fetchRoster(shift.id)
      .then((rows) => { if (alive) setRoster(rows) })
      .catch(() => {})
    return () => { alive = false }
  }, [shift?.id])
  if (!shift || !me) return null

  // chỉ xét đăng ký thuộc đúng ca này
  const regs = allRegs.filter((r) => r.shift_id === shift.id)
  const { hours } = shiftTimes(shift)
  const eff = effStatus(shift)
  const activeCount = roster.length
  const remaining = Math.max(0, shift.capacity - activeCount)
  const open = regOpen(shift)
  const myReg = regs.find((r) => r.worker_id === me.id && r.status !== 'removed')
  const nameOf = (id: string) => profiles.find((p) => p.id === id)?.full_name || roster.find((r) => r.worker_id === id)?.full_name || 'Người làm'
  const canRegister = me.role === 'worker' && open && !myReg && remaining > 0 && me.kyc_status === 'approved'
  const canCancel =
    me.role === 'worker' && myReg && open
    && (myReg.status === 'pending' || (myReg.status === 'approved' && Date.now() < shiftTimes(shift).start.getTime()))

  const doRegister = async () => {
    setBusy(true)
    try {
      await registerShift(shift.id, me.id, note)
      push('Đã gửi đăng ký — chờ tuyển dụng duyệt')
      setNote('')
      onChanged?.()
    } catch (e) { push((e as Error).message, true) }
    setBusy(false)
  }

  const doCancel = async () => {
    if (!myReg || !confirm('Hủy đăng ký ca này?')) return
    setBusy(true)
    try {
      await updateRegistration(myReg.id, { status: 'cancelled' })
      // báo người phụ trách ca biết có người hủy chỗ
      const owner = shift.approved_by ?? shift.created_by
      await notify([owner], 'reg_cancelled', 'Người làm vừa hủy chỗ', `${me.full_name || 'Một người làm'} đã hủy đăng ký ca "${shift.title}" (${fmtD(shift.work_date)}). Kiểm tra danh sách ca để duyệt người thay.`, shift.id)
      push('Đã hủy đăng ký')
      onChanged?.()
    } catch (e) { push((e as Error).message, true) }
    setBusy(false)
  }

  return (
    <Modal open={!!shift} onClose={onClose} title={shift.title} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={SHIFT_STATUS_COLOR[eff.status]}>{SHIFT_STATUS_LABEL[eff.status]}</Badge>
          {eff.status === 'ongoing' && eff.ended && <Badge className="border-zinc-300 bg-zinc-100 text-zinc-600">Đã kết thúc — chờ đối soát</Badge>}
          {!open && eff.status === 'recruiting' && <Badge className="border-amber-300 bg-amber-50 text-amber-800">Hết hạn đăng ký</Badge>}
          {remaining === 0 && eff.status === 'recruiting' && <Badge className="border-amber-300 bg-amber-50 text-amber-800">Đã đủ người</Badge>}
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-xl border border-zinc-200 p-3.5 text-sm sm:grid-cols-3">
          <div><div className="text-[11px] font-bold uppercase text-zinc-400">Thời gian</div><div className="font-semibold">{fmtD(shift.work_date)}</div><div>{fmtT(shift.start_time)} → {fmtT(shift.end_time)}</div></div>
          <div><div className="text-[11px] font-bold uppercase text-zinc-400">Số giờ / đơn giá</div><div className="font-semibold">{hours} giờ</div><div>{money(shift.rate)}/giờ</div></div>
          <div><div className="text-[11px] font-bold uppercase text-zinc-400">Nhận được/ca</div><div className="font-semibold text-accent">{money(shift.rate * hours)}</div><div className="text-xs text-zinc-400">trước khi chấm công</div></div>
          <div><div className="text-[11px] font-bold uppercase text-zinc-400">Địa điểm</div><div className="font-semibold">{shift.location}</div></div>
          <div><div className="text-[11px] font-bold uppercase text-zinc-400">Số lượng</div><div className="font-semibold">{activeCount}/{shift.capacity} người</div><div className="text-xs text-zinc-400">còn trống {remaining}</div></div>
          <div><div className="text-[11px] font-bold uppercase text-zinc-400">Hạn đăng ký</div><div className="font-semibold">{shift.reg_deadline ? fmtDT(shift.reg_deadline) : 'Đến giờ bắt đầu'}</div></div>
          {(shift.contact_name || shift.contact_phone) && (
            <div className="col-span-2 sm:col-span-3"><div className="text-[11px] font-bold uppercase text-zinc-400">Người liên hệ tại chỗ</div><div className="font-semibold">{shift.contact_name || '—'} {shift.contact_phone ? '· ' + shift.contact_phone : ''}</div></div>
          )}
          {shift.note && <div className="col-span-2 rounded-lg bg-amber-50 p-2.5 text-sm text-amber-900 sm:col-span-3"><b>Lưu ý:</b> {shift.note}</div>}
        </div>

        {['recruiter', 'owner', 'admin'].includes(me.role) && (
          <div className="flex justify-end"><ShiftZaloShare shift={shift} regs={regs} /></div>
        )}

        {/* Khu vực người đi làm */}
        {me.role === 'worker' && (
          <div className="rounded-xl border border-zinc-200 p-3.5">
            {myReg ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm">
                  Bạn đã đăng ký ca này — trạng thái:{' '}
                  <b>{myReg.status === 'pending' ? 'Chờ duyệt' : myReg.status === 'approved' ? 'Đã được duyệt ✓' : myReg.status === 'rejected' ? 'Bị từ chối' : 'Đã hủy'}</b>
                </div>
                {canCancel && <button className="btn-danger" disabled={busy} onClick={doCancel}>Hủy đăng ký</button>}
              </div>
            ) : canRegister ? (
              <div className="space-y-2.5">
                <div className="font-semibold">Đăng ký ca này</div>
                <input className="field" placeholder="Ghi chú cho tuyển dụng (không bắt buộc)" value={note} onChange={(e) => setNote(e.target.value)} />
                <button className="btn-primary w-full" disabled={busy} onClick={doRegister}>Gửi đăng ký</button>
              </div>
            ) : (
              <div className="text-sm text-zinc-500">
                {!open
                  ? 'Ca này đã hết hạn đăng ký hoặc không ở trạng thái tuyển.'
                  : remaining === 0
                    ? 'Ca đã đủ số lượng.'
                    : me.kyc_status !== 'approved'
                      ? 'Hồ sơ CCCD của bạn chưa được Admin 2 duyệt — không thể đăng ký ca. Vào "Hồ sơ" để nộp/kiểm tra.'
                      : 'Bạn không thể đăng ký ca này.'}
              </div>
            )}
          </div>
        )}

        {/* Danh sách người trong ca */}
        <div>
          <div className="label">Người trong ca ({activeCount})</div>
          {activeCount === 0 ? (
            <div className="text-sm text-zinc-400">Chưa có ai đăng ký.</div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {roster.map((r) => (
                <Badge key={r.worker_id} className={r.reg_status === 'approved' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-amber-300 bg-amber-50 text-amber-800'}>
                  {r.full_name || 'Người làm'}{r.reg_status === 'pending' ? ' (chờ)' : ''}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
