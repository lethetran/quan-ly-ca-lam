import { Banknote, FileDown, Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import ShiftDetail from '../components/ShiftDetail'
import { Badge, Banner, Empty, Modal, Spinner, StatCard } from '../components/ui'
import { AttendanceBadge, CancelZaloShare, ShiftZaloShare } from '../components/ZaloShare'
import { audit, createShift, listProfiles, listRegistrations, listShifts, notify, setPersonPay, updateShift } from '../lib/api'
import { useSession, useToast } from '../lib/store'

import type { PayStatus, Profile, Registration, Shift } from '../lib/types'
import { SHIFT_STATUS_COLOR, SHIFT_STATUS_LABEL } from '../lib/types'
import { downloadCsv, effStatus, fmtD, fmtDT, fmtT, money, monthName, num, shiftFormError, shiftTimes, ym } from '../lib/util'

export function CreateShift() {
  const { profile } = useSession()
  const { push } = useToast()
  const nav = (to: string) => { window.location.hash = to }
  const today = new Date()
  const [f, setF] = useState({
    title: '', location: '', contact_name: '', contact_phone: '', note: '',
    work_date: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
    start_time: '08:00', end_time: '12:00',
    rate: '', capacity: '10', reg_deadline: '',
  })
  const [busy, setBusy] = useState(false)

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })

  const submit = async () => {
    if (!profile) return
    const rateNum = Math.round(Number(f.rate))
    const capNum = Math.round(Number(f.capacity))
    const err = shiftFormError({
      title: f.title, location: f.location, work_date: f.work_date,
      start_time: f.start_time, end_time: f.end_time,
      rate: rateNum, capacity: capNum, contact_phone: f.contact_phone || undefined,
    })
    if (err) { push(err, true); return }
    setBusy(true)
    try {
      const s = await createShift(
        {
          title: f.title.trim(),
          location: f.location.trim(),
          contact_name: f.contact_name.trim() || null,
          contact_phone: f.contact_phone.trim() || null,
          note: f.note.trim() || null,
          work_date: f.work_date,
          start_time: f.start_time + ':00',
          end_time: f.end_time + ':00',
          hours_override: null,
          rate: rateNum,
          capacity: capNum,
          reg_deadline: f.reg_deadline ? new Date(f.reg_deadline).toISOString() : null,
          created_by: profile.id,
        },
        profile.id,
      )
      const recruiters = (await listProfiles()).filter((p) => p.role === 'recruiter' || p.role === 'admin').map((p) => p.id)
      await notify(recruiters, 'shift_new', 'Ca mới chờ duyệt', `${profile.full_name || 'Chủ'} vừa tạo ca "${s.title}" — ${fmtD(s.work_date)} ${fmtT(s.start_time)}, cần ${s.capacity} người.`, s.id)
      await audit(profile.id, profile.full_name || profile.username, 'create_shift', `Tạo ca ${s.title} (${fmtD(s.work_date)})`)
      push('Đã tạo ca — đang chờ tuyển dụng duyệt')
      nav('/my-shifts')
    } catch (e) { push((e as Error).message, true) }
    setBusy(false)
  }

  const autoH = (() => {
    const [sh, sm] = f.start_time.split(':').map(Number)
    const [eh, em] = f.end_time.split(':').map(Number)
    let mins = eh * 60 + em - (sh * 60 + sm)
    if (mins <= 0) mins += 24 * 60
    return Math.round((mins / 60) * 100) / 100
  })()

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Tạo ca làm mới</h1>
        <p className="text-sm text-zinc-500">Ca tạo xong sẽ gửi sang bên tuyển dụng duyệt. Đơn giá được thông báo công khai cho người làm ngay khi duyệt.</p>
      </div>
      <div className="card space-y-3.5 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><span className="label">Tên ca *</span><input className="field" value={f.title} onChange={set('title')} placeholder="VD: Hỗ trợ hội chợ — cổng B" maxLength={120} /></div>
          <div className="sm:col-span-2"><span className="label">Địa điểm *</span><input className="field" value={f.location} onChange={set('location')} placeholder="Địa chỉ cụ thể nơi làm việc" maxLength={200} /></div>
          <div><span className="label">Ngày làm *</span><input type="date" className="field" value={f.work_date} onChange={set('work_date')} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><span className="label">Bắt đầu *</span><input type="time" className="field" value={f.start_time} onChange={set('start_time')} /></div>
            <div><span className="label">Kết thúc *</span><input type="time" className="field" value={f.end_time} onChange={set('end_time')} /></div>
          </div>
          <div><span className="label">Đơn giá (đ/giờ) *</span><input type="number" className="field" value={f.rate} onChange={set('rate')} placeholder="vd: 35000" inputMode="numeric" /></div>
          <div><span className="label">Số lượng cần *</span><input type="number" className="field" value={f.capacity} onChange={set('capacity')} inputMode="numeric" /></div>
          <div><span className="label">Hạn đăng ký (tùy chọn)</span><input type="datetime-local" className="field" value={f.reg_deadline} onChange={set('reg_deadline')} /><p className="mt-1 text-xs text-zinc-500">Bỏ trống = đăng ký đến giờ bắt đầu ca</p></div>
          <div className="grid grid-cols-2 gap-3">
            <div><span className="label">Người liên hệ</span><input className="field" value={f.contact_name} onChange={set('contact_name')} /></div>
            <div><span className="label">SĐT liên hệ</span><input className="field" value={f.contact_phone} onChange={set('contact_phone')} inputMode="tel" /></div>
          </div>
          <div className="sm:col-span-2"><span className="label">Lưu ý cho người làm (trang phục, công việc…)</span><textarea className="field h-20" maxLength={500} value={f.note} onChange={set('note')} /></div>
        </div>
        <div className="rounded-lg bg-ink px-4 py-3 text-sm text-paper">
          Ca kéo dài <b>{autoH} giờ</b> · đơn giá <b className="text-accent">{money(Number(f.rate) || 0)}/giờ</b> · mỗi người nhận <b className="text-accent">{money((Number(f.rate) || 0) * autoH)}</b> nếu đi đủ ca · tổng ước tính <b>{money((Number(f.rate) || 0) * autoH * (Number(f.capacity) || 0))}</b>
        </div>
        <button className="btn-primary w-full" disabled={busy} onClick={submit}>{busy ? 'Đang tạo…' : 'Tạo ca — gửi tuyển dụng duyệt'}</button>
      </div>
    </div>
  )
}

export function OwnerShifts() {
  const { profile } = useSession()
  const { push } = useToast()
  const nav = (to: string) => { window.location.hash = to }
  const [shifts, setShifts] = useState<Shift[] | null>(null)
  const [regs, setRegs] = useState<Registration[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [sel, setSel] = useState<Shift | null>(null)
  const [payFor, setPayFor] = useState<Shift | null>(null)
  const [payNote, setPayNote] = useState('')
  const [payRows, setPayRows] = useState<Record<string, PayStatus>>({})
  const [failNotes, setFailNotes] = useState<Record<string, string>>({})
  const [tick, setTick] = useState(0)

  const load = async () => {
    try {
      const [ss, rr, pp] = await Promise.all([listShifts(), listRegistrations(), listProfiles()])
      setShifts(ss); setRegs(rr); setProfiles(pp)
    } catch (e) { console.error(e); setShifts([]) }
  }
  useEffect(() => { load() }, [tick])

  if (!shifts || !profile) return <Spinner />
  const mine = shifts.filter((s) => s.created_by === profile.id || profile.role === 'admin').sort((a, b) => (b.work_date + b.start_time).localeCompare(a.work_date + a.start_time))
  const nameOf = (wid: string) => profiles.find((p) => p.id === wid)?.full_name || 'Người làm'
  const reload = () => setTick((t) => t + 1)

  const cancelShift = async (s: Shift) => {
    if (!confirm(`Hủy ca "${s.title}"? Người đã đăng ký sẽ nhận thông báo.`)) return
    try {
      await updateShift(s.id, { status: 'cancelled' })
      const targets = regs.filter((r) => r.shift_id === s.id && (r.status === 'pending' || r.status === 'approved')).map((r) => r.worker_id)
      await notify(targets, 'shift_cancelled', 'Ca làm bị hủy', `Ca "${s.title}" ngày ${fmtD(s.work_date)} đã bị hủy bởi chủ. Bạn không cần đến.`, s.id)
      await audit(profile.id, profile.full_name || profile.username, 'cancel_shift', `Hủy ca ${s.title}`)
      push('Đã hủy ca — người đăng ký đã nhận thông báo')
      reload()
    } catch (e) { push((e as Error).message, true) }
  }

  const payRegs = payFor
    ? regs.filter((r) => r.shift_id === payFor.id && r.status === 'approved' && (r.attendance === 'full' || r.attendance === 'half'))
    : []

  const openPay = (s: Shift) => {
    const rs = regs.filter((r) => r.shift_id === s.id && r.status === 'approved' && (r.attendance === 'full' || r.attendance === 'half'))
    setPayRows(Object.fromEntries(rs.map((r) => [r.id, r.pay_status ?? 'unpaid'])))
    setFailNotes(Object.fromEntries(rs.map((r) => [r.id, r.pay_fail_note ?? ''])))
    setPayFor(s)
    setPayNote('')
  }

  /** Lưu tình trạng trả lương 1 người — mỗi thay đổi báo ngay cho người đó */
  const saveRow = async (r: Registration, status: PayStatus, quiet = false) => {
    if (!payFor || !profile) return
    if (status === 'failed' && !(failNotes[r.id] ?? '').trim()) {
      push('Nhập lý do không thanh toán được cho ' + nameOf(r.worker_id), true)
      return
    }
    try {
      await setPersonPay(r.id, {
        pay_status: status,
        paid_at: status === 'paid' ? new Date().toISOString() : null,
        pay_fail_note: status === 'failed' ? (failNotes[r.id] ?? '').trim() : null,
      })
      if (status === 'paid') {
        const acc = profiles.find((p) => p.id === r.worker_id)?.bank_account
        await notify([r.worker_id], 'paid', 'Đã nhận thanh toán ✓', `Ca "${payFor.title}" (${fmtD(payFor.work_date)}) đã được chuyển khoản ${money(r.pay ?? 0)}${acc ? ' vào STK ' + acc : ''}.`, payFor.id)
      } else if (status === 'failed') {
        await notify([r.worker_id], 'pay_failed', 'Ca này chưa thanh toán được', `Ca "${payFor.title}" (${fmtD(payFor.work_date)}): ${(failNotes[r.id] ?? '').trim()}. Liên hệ tuyển dụng để cập nhật thông tin nhận tiền.`, payFor.id)
      }
      await audit(profile.id, profile.full_name || profile.username,
        status === 'paid' ? 'mark_person_paid' : status === 'failed' ? 'mark_person_failed' : 'mark_person_unpaid',
        `${status === 'paid' ? 'Đã trả' : status === 'failed' ? 'Không trả được' : 'Bỏ đánh dấu'} ${nameOf(r.worker_id)} — ca ${payFor.title}${status === 'failed' ? ' (' + (failNotes[r.id] ?? '').trim() + ')' : ''}`)
      setPayRows((m) => ({ ...m, [r.id]: status }))
      if (!quiet) push(status === 'paid' ? `Đã đánh dấu: ${nameOf(r.worker_id)} đã nhận tiền` : `Đã cập nhật trạng thái của ${nameOf(r.worker_id)}`)
    } catch (e) { push((e as Error).message, true) }
  }

  /** Luồng mặc định: cả ca đã thanh toán — tích tất cả người còn lại rồi chốt */
  const payAllAndClose = async () => {
    if (!payFor) return
    const unpaid = payRegs.filter((r) => (payRows[r.id] ?? 'unpaid') === 'unpaid')
    for (const r of unpaid) await saveRow(r, 'paid', true)
    await confirmPaid()
  }

  const confirmPaid = async () => {
    if (!payFor || !profile) return
    // chốt: tự lưu lại mọi trạng thái hiện có để chắc chắn đồng bộ database
    for (const r of payRegs) {
      const st = payRows[r.id] ?? 'unpaid'
      if (st === 'failed') {
        if (!(failNotes[r.id] ?? '').trim()) { push(`Nhập lý do không thanh toán được cho ${nameOf(r.worker_id)}`, true); return }
        await setPersonPay(r.id, { pay_status: 'failed', paid_at: null, pay_fail_note: (failNotes[r.id] ?? '').trim() })
      } else if (st === 'paid') {
        await setPersonPay(r.id, { pay_status: 'paid', paid_at: r.paid_at ?? new Date().toISOString(), pay_fail_note: null })
      }
    }
    try {
      await updateShift(payFor.id, { status: 'paid', payment_note: payNote.trim() || null, paid_at: new Date().toISOString() })
      await audit(profile.id, profile.full_name || profile.username, 'mark_paid', `Chốt thanh toán ca ${payFor.title}`)
      const nPaid = payRegs.filter((r) => (payRows[r.id] ?? 'unpaid') === 'paid').length
      const nFail = payRegs.filter((r) => (payRows[r.id] ?? 'unpaid') === 'failed').length
      push(`Đã chốt ca: Đã thanh toán — ${nPaid} người đã nhận tiền${nFail > 0 ? `, ${nFail} người chưa chuyển được (đã ghi lý do và báo người làm)` : ''}`)
      setPayFor(null); setPayNote(''); setPayRows({}); setFailNotes({})
      reload()
    } catch (e) { push((e as Error).message, true) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Ca của công ty</h1>
          <p className="text-sm text-zinc-500">Theo dõi trạng thái, số lượng hiện tại và cập nhật thanh toán sau đối soát.</p>
        </div>
        <button className="btn-primary" onClick={() => nav('/create')}><Plus size={15} /> Tạo ca mới</button>
      </div>

      <div className="space-y-2.5">
        {mine.length === 0 && <Empty msg="Chưa có ca nào. Bấm “Tạo ca mới” để bắt đầu." />}
        {mine.map((s) => {
          const eff = effStatus(s)
          const rs = regs.filter((r) => r.shift_id === s.id)
          const act = rs.filter((r) => r.status === 'pending' || r.status === 'approved')
          const approved = rs.filter((r) => r.status === 'approved')
          const worked = approved.filter((r) => r.attendance === 'full' || r.attendance === 'half')
          const total = worked.reduce((acc, r) => acc + (r.pay ?? 0), 0)
          const { hours } = shiftTimes(s)
          return (
            <div key={s.id} className="card p-4">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <div className="min-w-44">
                  <div className="font-display text-lg font-bold leading-6">{s.title}</div>
                  <div className="text-xs text-zinc-500">{s.location}</div>
                </div>
                <div className="text-sm"><div className="font-semibold">{fmtD(s.work_date)}</div><div className="text-zinc-500">{fmtT(s.start_time)}→{fmtT(s.end_time)} · {hours}h</div></div>
                <div className="text-sm"><div className="font-semibold text-accent">{money(s.rate)}/h</div><div className="text-zinc-500">{money(s.rate * hours)}/người đủ ca</div></div>
                <div className="text-sm text-zinc-600">{act.length}/{s.capacity} người</div>
                <span className={`badge border ${SHIFT_STATUS_COLOR[eff.status]}`}>{SHIFT_STATUS_LABEL[s.status]}{eff.status === 'ongoing' && eff.ended ? ' (hết giờ)' : ''}</span>
                <div className="ml-auto flex flex-wrap gap-2">
                  {(s.status === 'recruiting' || s.status === 'ongoing' || s.status === 'pending_approval') && (
                    <button className="btn-danger !py-1.5 text-xs" onClick={() => cancelShift(s)}><X size={13} /> Hủy ca</button>
                  )}
                  {s.status !== 'rejected' && s.status !== 'cancelled' && s.status !== 'pending_approval' && (
                    <ShiftZaloShare shift={s} regs={rs} />
                  )}
                  {s.status === 'cancelled' && <CancelZaloShare shift={s} />}
                  {s.status === 'paying' && (
                    <button className="btn-primary !py-1.5 text-xs" onClick={() => openPay(s)}><Banknote size={13} /> Thanh toán cả ca</button>
                  )}
                  {s.status === 'paid' && (
                    <button className="btn-ghost !py-1.5 text-xs" onClick={() => openPay(s)}><Banknote size={13} /> Trả lương từng người</button>
                  )}
                </div>
              </div>

              {worked.length > 0 && (
                <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm">
                  <b>{worked.length}</b> người có công · tổng <b className="text-accent">{money(total)}</b>
                  {s.status === 'paid' && <span className="text-emerald-700"> · Đã thanh toán {s.paid_at ? fmtDT(s.paid_at) : ''}{s.payment_note ? ` (${s.payment_note})` : ''}</span>}
                  {s.status === 'paying' && <span className="text-orange-600"> · Đang chờ công ty chuyển khoản</span>}
                </div>
              )}
              {act.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {act.map((r) => (
                    <Badge key={r.id} className={r.status === 'approved' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-amber-300 bg-amber-50 text-amber-800'}>
                      {nameOf(r.worker_id)}{r.status === 'pending' ? ' (chờ duyệt)' : ''}
                    </Badge>
                  ))}
                </div>
              )}
              {s.status === 'rejected' && <div className="mt-2 text-sm text-red-600">Ca bị tuyển dụng từ chối.</div>}
              <div className="mt-2"><button className="text-xs font-semibold text-accent underline" onClick={() => setSel(s)}>Xem chi tiết</button></div>
            </div>
          )
        })}
      </div>

      <ShiftDetail shift={sel} regs={sel ? regs.filter((r) => r.shift_id === sel.id) : []} profiles={profiles} onClose={() => setSel(null)} onChanged={reload} />

      <Modal open={!!payFor} onClose={() => { setPayFor(null); setPayRows({}); setFailNotes({}) }} title={payFor?.status === 'paid' ? 'Trả lương từng người (sửa lại được)' : 'Thanh toán cả ca'} wide>
        {payFor && (() => {
          const isPaid = payFor.status === 'paid'
          const undecided = payRegs.filter((r) => (payRows[r.id] ?? 'unpaid') === 'unpaid')
          const nPaid = payRegs.filter((r) => (payRows[r.id] ?? 'unpaid') === 'paid').length
          const nFail = payRegs.filter((r) => (payRows[r.id] ?? 'unpaid') === 'failed').length
          const grandTotal = payRegs.filter((r) => (payRows[r.id] ?? 'unpaid') === 'paid').reduce((acc, r) => acc + (r.pay ?? 0), 0)
          return (
            <div className="space-y-3">
              {!isPaid && (
                <Banner kind="info">
                  Mặc định <b>tất cả người có công đều được thanh toán</b>. Nếu có trường hợp đặc biệt
                  (không chuyển được, tranh chấp…) thì <b>bỏ tích người đó và ghi lý do</b> — họ sẽ nhận thông báo riêng.
                </Banner>
              )}
              {isPaid && <Banner kind="warn">Mỗi thay đổi được lưu ngay và gửi thông báo cho người đó.</Banner>}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead><tr>
                    <th className="th w-12">Trả?</th>
                    <th className="th">Người</th><th className="th">Chấm</th><th className="th">Giờ</th>
                    <th className="th">Ngân hàng · Số TK</th><th className="th text-right">Tiền</th><th className="th">Tình trạng</th>
                  </tr></thead>
                  <tbody>
                    {payRegs.map((r) => {
                      const p = profiles.find((x) => x.id === r.worker_id)
                      const st: PayStatus = payRows[r.id] ?? 'unpaid'
                      return (
                        <tr key={r.id} className={st === 'failed' ? 'bg-red-50/60' : st === 'paid' ? 'bg-emerald-50/40' : ''}>
                          <td className="td text-center">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-orange-600"
                              checked={st === 'paid'}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  saveRow(r, 'paid')
                                } else {
                                  // bỏ tích: chuyển sang "không trả được" — bắt buộc nhập lý do trước khi chốt
                                  setPayRows((m) => ({ ...m, [r.id]: 'failed' }))
                                }
                              }}
                            />
                          </td>
                          <td className="td font-semibold">{p?.full_name}</td>
                          <td className="td"><AttendanceBadge a={r.attendance} /></td>
                          <td className="td">{num(r.hours ?? 0)}</td>
                          <td className="td">{p?.bank_name || '—'} · <span className="font-mono">{p?.bank_account || '—'}</span></td>
                          <td className="td text-right font-bold">{money(r.pay ?? 0)}</td>
                          <td className="td">
                            {st === 'paid' && <span className="badge border-emerald-300 bg-emerald-600 text-white">Đã trả{r.paid_at ? ' ' + fmtDT(r.paid_at).slice(-5) : ''}</span>}
                            {st === 'failed' && <span className="badge border-red-300 bg-red-600 text-white">Không trả được</span>}
                            {st === 'unpaid' && <span className="text-xs text-zinc-400">chưa xử lý</span>}
                            {st === 'failed' && (
                              <input
                                className="field mt-1 !py-1 text-xs"
                                placeholder="Lý do không trả được *"
                                value={failNotes[r.id] ?? ''}
                                onChange={(e) => setFailNotes((m) => ({ ...m, [r.id]: e.target.value }))}
                                onBlur={() => { if ((failNotes[r.id] ?? '').trim()) saveRow(r, 'failed', true) }}
                              />
                            )}
                          </td>
                        </tr>
                      )
                    })}
                    <tr className="bg-zinc-100">
                      <td className="td font-bold" colSpan={5}>ĐỒNG Ý TRẢ: {nPaid}/{payRegs.length} người</td>
                      <td className="td text-right font-bold text-accent">{money(grandTotal)}</td>
                      <td className="td text-xs text-zinc-500">{nFail > 0 ? `${nFail} người bị loại (có lý do)` : ''}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <input className="field" placeholder="Ghi chú chung (VD: đã CK đợt 1 lúc 15h)" value={payNote} onChange={(e) => setPayNote(e.target.value)} />
              <div className="flex flex-wrap gap-2">
                {!isPaid && (
                  <button className="btn-primary flex-1" onClick={payAllAndClose}>
                    Thanh toán cả ca — chốt ({money(grandTotal + undecided.reduce((a, r) => a + (r.pay ?? 0), 0))})
                  </button>
                )}
                {!isPaid && (
                  <button className="btn-dark flex-1" onClick={confirmPaid} disabled={undecided.length > 0}>
                    {undecided.length > 0 ? `Chốt ca (còn ${undecided.length} người chưa xử lý…)` : 'Chốt ca — giữ nguyên các người bị bỏ tích'}
                  </button>
                )}
              </div>
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}

export function OwnerStats() {
  const { profile } = useSession()
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
  if (loading || !profile) return <Spinner />
  const mine = shifts.filter((s) => s.created_by === profile.id || profile.role === 'admin')
  const inMonth = mine.filter((s) => s.work_date.startsWith(month))
  const nameOf = (wid: string) => profiles.find((p) => p.id === wid)?.full_name || '—'

  const costOf = (s: Shift) => regs.filter((r) => r.shift_id === s.id && r.status === 'approved').reduce((acc, r) => acc + (r.pay ?? 0), 0)
  const totalCost = inMonth.reduce((acc, s) => acc + costOf(s), 0)
  const paidCost = inMonth.filter((s) => s.status === 'paid').reduce((acc, s) => acc + costOf(s), 0)
  const planned = inMonth.reduce((acc, s) => acc + s.capacity * shiftTimes(s).hours * s.rate, 0)
  const fill = planned > 0 ? Math.round((totalCost / planned) * 100) : 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Chi phí & thống kê</h1>
          <p className="text-sm text-zinc-500">Tổng hợp chi phí nhân công theo tháng.</p>
        </div>
        <div className="flex gap-2">
          <div><span className="label">Tháng</span><input type="month" className="field" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
          <button
            className="btn-ghost self-end"
            onClick={() => downloadCsv(`chi-phi-${month}.csv`, [
              ['Ngày', 'Ca', 'Địa điểm', 'Trạng thái', 'Số người có công', 'Chi phí thực tế'],
              ...inMonth.map((s) => {
                const worked = regs.filter((r) => r.shift_id === s.id && r.status === 'approved' && (r.attendance === 'full' || r.attendance === 'half')).length
                return [s.work_date, s.title, s.location, SHIFT_STATUS_LABEL[s.status], worked, costOf(s)]
              }),
              ['', '', '', 'TỔNG', '', totalCost],
            ])}
          >
            <FileDown size={15} /> Xuất Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={`Ca trong ${monthName(month)}`} value={inMonth.length} />
        <StatCard label="Chi phí thực tế" value={money(totalCost)} accent />
        <StatCard label="Đã thanh toán" value={money(paidCost)} />
        <StatCard label="Tỉ lệ lấp đầy" value={`${fill}%`} sub="so với kế hoạch đủ ca" />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead><tr><th className="th">Ngày</th><th className="th">Ca</th><th className="th">Trạng thái</th><th className="th">Người có công</th><th className="th text-right">Chi phí</th></tr></thead>
          <tbody>
            {inMonth.sort((a, b) => (b.work_date + b.start_time).localeCompare(a.work_date + a.start_time)).map((s) => {
              const worked = regs.filter((r) => r.shift_id === s.id && r.status === 'approved' && (r.attendance === 'full' || r.attendance === 'half'))
              return (
                <tr key={s.id}>
                  <td className="td whitespace-nowrap">{fmtD(s.work_date)}</td>
                  <td className="td">{s.title}<div className="text-[11px] text-zinc-400">{s.location}</div></td>
                  <td className="td"><span className={`badge border ${SHIFT_STATUS_COLOR[s.status]}`}>{SHIFT_STATUS_LABEL[s.status]}</span></td>
                  <td className="td">{worked.map((r) => nameOf(r.worker_id)).join(', ') || '—'}</td>
                  <td className="td text-right font-semibold">{money(costOf(s))}</td>
                </tr>
              )
            })}
            {inMonth.length === 0 && <tr><td className="td text-center text-zinc-400" colSpan={5}>Không có ca trong tháng này</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
