import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Calendar from '../components/Calendar'
import ShiftDetail from '../components/ShiftDetail'
import { Empty, Spinner, StatCard } from '../components/ui'
import { AttendanceBadge, RegStatusBadge } from '../components/ZaloShare'
import { listLabels, listRegistrations, listShifts } from '../lib/api'
import { useSession } from '../lib/store'
import type { Label, Profile, Registration, Shift } from '../lib/types'
import { LABELS } from '../lib/types'
import { SHIFT_STATUS_COLOR, SHIFT_STATUS_LABEL } from '../lib/types'
import { effStatus, fmtD, fmtT, money, num, shiftTimes, ym, monthName } from '../lib/util'

/** Trạng thái nhận tiền của chính người làm cho 1 ca */
function payText(r: Registration, s: Shift): { text: string; bad?: boolean } {
  if (s.status === 'paid') {
    if (r.pay_status === 'failed') return { text: `Chưa nhận được${r.pay_fail_note ? ': ' + r.pay_fail_note : ''}`, bad: true }
    return { text: 'Đã nhận ✓' }
  }
  if (s.status === 'paying') return { text: 'Công ty đang thanh toán…' }
  if (s.status === 'reconciling') return { text: 'Đang đối soát' }
  return { text: 'Chờ đối soát' }
}

export function WorkerShifts() {
  const { userId } = useSession()
  const [shifts, setShifts] = useState<Shift[] | null>(null)
  const [regs, setRegs] = useState<Registration[]>([])
  const [view, setView] = useState<'calendar' | 'list'>('list')
  const [sel, setSel] = useState<Shift | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [ss, rr] = await Promise.all([listShifts(), userId ? listRegistrations({ workerId: userId }) : Promise.resolve([])])
        if (alive) { setShifts(ss); setRegs(rr) }
      } catch (e) { console.error(e); if (alive) setShifts([]) }
    })()
    return () => { alive = false }
  }, [userId, tick])

  if (!shifts) return <Spinner />
  const reload = () => setTick((t) => t + 1)
  // Ca đang/đã diễn ra chỉ hiện với người THUỘC ca đó; còn lại chỉ thấy ca đang tuyển
  const hasActiveReg = (s: Shift) => regs.some((r) => r.shift_id === s.id && (r.status === 'pending' || r.status === 'approved'))
  const openShifts = shifts.filter((s) => {
    const e = effStatus(s)
    if (e.status === 'paid' || e.status === 'rejected' || e.status === 'cancelled') return false
    if (e.status === 'recruiting') return true
    return hasActiveReg(s)
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Lịch ca làm</h1>
          <p className="text-sm text-zinc-500">Có <b>{openShifts.length}</b> ca đang tuyển — bấm vào ca để xem chi tiết và đăng ký.</p>
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-zinc-100 p-1">
          {(['list', 'calendar'] as const).map((v) => (
            <button key={v} className={`rounded-md px-3.5 py-1.5 text-sm font-bold ${view === v ? 'bg-white shadow' : 'text-zinc-500'}`} onClick={() => setView(v)}>
              {v === 'list' ? 'Danh sách' : 'Lịch tháng'}
            </button>
          ))}
        </div>
      </div>

      {view === 'calendar' ? (
        <Calendar
          items={openShifts.map((s) => {
            const eff = effStatus(s)
            const cls = SHIFT_STATUS_COLOR[eff.status]
            return {
              date: s.work_date,
              key: s.id,
              node: (
                <div className={`badge w-full justify-start truncate border ${cls} ${eff.status === 'ongoing' && eff.ended ? 'opacity-60' : ''}`}>
                  <span className="truncate">{fmtT(s.start_time)} {s.title}</span>
                </div>
              ),
            }
          })}
          onChipClick={(id) => setSel(shifts.find((s) => s.id === id) ?? null)}
        />
      ) : (
        <div className="space-y-2.5">
          {openShifts.length === 0 && (
            <Empty msg="Chưa có ca nào đang mở. Khi chủ tạo ca mới và tuyển dụng duyệt, ca sẽ hiện ở đây." />
          )}
          {[...openShifts]
            .sort((a, b) => (a.work_date + a.start_time).localeCompare(b.work_date + b.start_time))
            .map((s) => {
              const eff = effStatus(s)
              const { hours } = shiftTimes(s)
              const active = regs.filter((r) => r.shift_id === s.id && (r.status === 'pending' || r.status === 'approved'))
              const my = regs.find((r) => r.shift_id === s.id && r.worker_id === userId && r.status !== 'removed')
              return (
                <button key={s.id} className="card flex w-full flex-wrap items-center gap-x-5 gap-y-2 p-4 text-left hover:border-accent" onClick={() => setSel(s)}>
                  <div className="min-w-40">
                    <div className="font-display text-lg font-bold leading-6">{s.title}</div>
                    <div className="text-xs text-zinc-500">{s.location}</div>
                  </div>
                  <div className="text-sm">
                    <div className="font-semibold">{fmtD(s.work_date)}</div>
                    <div className="text-zinc-500">{fmtT(s.start_time)}→{fmtT(s.end_time)} · {hours}h</div>
                  </div>
                  <div className="text-sm">
                    <div className="font-semibold text-accent">{money(s.rate)}/h</div>
                    <div className="text-zinc-500">≈ {money(s.rate * hours)}/ca</div>
                  </div>
                  <div className="text-sm text-zinc-600">{active.length}/{s.capacity} người</div>
                  <div className="ml-auto flex items-center gap-2">
                    <span className={`badge border ${SHIFT_STATUS_COLOR[eff.status]}`}>{SHIFT_STATUS_LABEL[eff.status]}</span>
                    {my && <RegStatusBadge status={my.status} />}
                  </div>
                </button>
              )
            })}
        </div>
      )}

      <ShiftDetail shift={sel} regs={regs} profiles={[]} allShifts={shifts} onClose={() => setSel(null)} onChanged={reload} />
    </div>
  )
}

export function WorkerMyShifts() {
  const { userId } = useSession()
  const [shifts, setShifts] = useState<Shift[] | null>(null)
  const [regs, setRegs] = useState<Registration[]>([])
  const [sel, setSel] = useState<Shift | null>(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [ss, rr] = await Promise.all([listShifts(), userId ? listRegistrations({ workerId: userId }) : Promise.resolve([])])
        if (alive) { setShifts(ss); setRegs(rr) }
      } catch (e) { console.error(e); if (alive) setShifts([]) }
    })()
    return () => { alive = false }
  }, [userId, tick])
  if (!shifts) return <Spinner />
  const reload = () => setTick((t) => t + 1)
  const byId = new Map(shifts.map((s) => [s.id, s]))
  const mine = regs
    .filter((r) => r.status !== 'removed')
    .map((r) => ({ r, s: byId.get(r.shift_id) }))
    .filter((x) => x.s)
    .sort((a, b) => (a.s!.work_date + a.s!.start_time).localeCompare(b.s!.work_date + b.s!.start_time))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Ca của tôi</h1>
        <p className="text-sm text-zinc-500">Lịch cá nhân theo dõi ca đã đăng ký, kết quả chấm công và tình trạng thanh toán.</p>
      </div>

      <Calendar
        items={mine.map(({ r, s }) => {
          const eff = effStatus(s!)
          const cls =
            r.status === 'pending' ? 'border-amber-300 bg-amber-100 text-amber-900'
            : r.status === 'approved' ? (eff.status === 'paid' ? 'border-teal-300 bg-teal-600 text-white' : 'border-emerald-300 bg-emerald-500 text-white')
            : r.status === 'rejected' ? 'border-red-300 bg-red-100 text-red-700 line-through'
            : 'border-zinc-300 bg-zinc-100 text-zinc-500 line-through'
          return {
            date: s!.work_date,
            key: r.id,
            node: <div className={`badge w-full justify-start truncate border ${cls}`}><span className="truncate">{fmtT(s!.start_time)} {s!.title}</span></div>,
          }
        })}
        onChipClick={(id) => {
          const found = mine.find((x) => x.r.id === id)
          if (found) setSel(found.s!)
        }}
      />

      <div className="space-y-2">
        {mine.length === 0 && <Empty msg="Bạn chưa đăng ký ca nào. Vào mục “Lịch ca & đăng ký” để đăng ký." />}
        {[...mine].reverse().map(({ r, s }) => {
          const eff = effStatus(s!)
          const { hours } = shiftTimes(s!)
          const workedH = r.hours ?? (r.attendance === 'half' ? hours / 2 : r.attendance === 'full' ? hours : 0)
          const pay = r.pay ?? (r.attendance === 'full' || r.attendance === 'half' ? workedH * s!.rate : 0)
          return (
            <div key={r.id} className="card flex flex-wrap items-center gap-x-5 gap-y-2 p-4">
              <div className="min-w-44">
                <div className="font-display text-lg font-bold leading-6">{s!.title}</div>
                <div className="text-xs text-zinc-500">{s!.location}</div>
              </div>
              <div className="text-sm"><div className="font-semibold">{fmtD(s!.work_date)}</div><div className="text-zinc-500">{fmtT(s!.start_time)}→{fmtT(s!.end_time)}</div></div>
              <RegStatusBadge status={r.status} />
              {r.status === 'approved' && (
                <>
                  <AttendanceBadge a={r.attendance} />
                  {r.attendance === 'full' || r.attendance === 'half' ? (
                    <div className="text-sm">
                      <div className="font-semibold">{num(workedH)} giờ · {money(pay)}</div>
                      <div className="text-xs text-zinc-500">
                        {(() => { const pt = payText(r, s!); return <span className={pt.bad ? 'font-semibold text-red-600' : ''}>{pt.text}</span> })()}
                      </div>
                    </div>
                  ) : r.attendance ? (
                    <div className="text-xs text-zinc-500">Không có công</div>
                  ) : (
                    <div className="text-xs text-zinc-400">Chưa chấm công</div>
                  )}
                </>
              )}
              <button className="btn-ghost ml-auto !py-1.5" onClick={() => setSel(s!)}>Chi tiết</button>
            </div>
          )
        })}
      </div>

      <ShiftDetail shift={sel} regs={regs} profiles={[]} allShifts={shifts} onClose={() => setSel(null)} onChanged={reload} />
    </div>
  )
}

export function WorkerStats() {
  const { userId } = useSession()
  const [shifts, setShifts] = useState<Shift[]>([])
  const [regs, setRegs] = useState<Registration[]>([])
  const [labels, setLabels] = useState<Label[]>([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(ym(new Date()))
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [ss, rr, ll] = await Promise.all([listShifts(), userId ? listRegistrations({ workerId: userId }) : Promise.resolve([]), listLabels()])
        if (alive) { setShifts(ss); setRegs(rr); setLabels(ll.filter((l) => l.worker_id === userId)) }
      } catch (e) { console.error(e) }
      if (alive) setLoading(false)
    })()
    return () => { alive = false }
  }, [userId])

  if (loading) return <Spinner />
  const byId = new Map(shifts.map((s) => [s.id, s]))
  const mine = regs.filter((r) => r.status === 'approved')
  const inMonth = mine.filter((r) => {
    const s = byId.get(r.shift_id)
    return s && s.work_date.startsWith(month)
  })
  const c = (a: string) => inMonth.filter((r) => r.attendance === a).length
  const totalHours = inMonth.reduce((acc, r) => {
    const s = byId.get(r.shift_id)!
    const h = r.hours ?? (r.attendance === 'half' ? shiftTimes(s).hours / 2 : r.attendance === 'full' ? shiftTimes(s).hours : 0)
    return acc + h
  }, 0)
  const totalPay = inMonth.reduce((acc, r) => acc + (r.pay ?? 0), 0)
  const paidPay = inMonth.reduce((acc, r) => {
    const s = byId.get(r.shift_id)
    return acc + (s && s.status === 'paid' ? (r.pay ?? 0) : 0)
  }, 0)
  const badLabels = labels.filter((l) => ['late', 'leave_early', 'no_show', 'cancel_late', 'attitude', 'uniform', 'other_bad'].includes(l.code))
  const goodLabels = labels.filter((l) => ['good_work', 'proactive', 'punctual'].includes(l.code))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Thống kê của tôi</h1>
          <p className="text-sm text-zinc-500">Số buổi đi làm, giờ công, tiền và nhánh đánh giá theo từng tháng.</p>
        </div>
        <div>
          <span className="label">Chọn tháng</span>
          <input type="month" className="field" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Buổi đi đủ ca" value={c('full')} accent />
        <StatCard label="Buổi nửa ca" value={c('half')} />
        <StatCard label="Vắng có báo" value={c('absent_excused')} />
        <StatCard label="Vắng không phép" value={c('absent_unexcused')} />
        <StatCard label="Tổng giờ công" value={num(totalHours)} />
        <StatCard label={`Tiền (${monthName(month)})`} value={money(totalPay)} sub={`Đã nhận: ${money(paidPay)}`} accent />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h3 className="mb-2 font-display text-lg font-bold uppercase text-red-700">Nhãn xấu ({badLabels.length})</h3>
          {badLabels.length === 0 ? <p className="text-sm text-zinc-400">Không có nhãn xấu — tốt lắm!</p> : (
            <ul className="space-y-1.5 text-sm">
              {badLabels.map((l) => (
                <li key={l.id} className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5">
                  <b>{LABELS[l.code]?.label ?? l.code}</b>
                  {l.note && <span className="text-zinc-600"> — {l.note}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card p-4">
          <h3 className="mb-2 font-display text-lg font-bold uppercase text-emerald-700">Nhãn tốt ({goodLabels.length})</h3>
          {goodLabels.length === 0 ? <p className="text-sm text-zinc-400">Chưa có nhãn tốt nào.</p> : (
            <ul className="space-y-1.5 text-sm">
              {goodLabels.map((l) => (
                <li key={l.id} className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5">
                  <b>{l.code === 'good_work' ? 'Làm việc tốt' : l.code === 'proactive' ? 'Nhiệt tình, chủ động' : 'Luôn đúng giờ'}</b>
                  {l.note && <span className="text-zinc-600"> — {l.note}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="th">Ngày</th><th className="th">Ca</th><th className="th">Chấm công</th><th className="th">Giờ</th><th className="th">Tiền</th><th className="th">Thanh toán</th>
            </tr>
          </thead>
          <tbody>
            {inMonth.length === 0 && <tr><td className="td text-center text-zinc-400" colSpan={6}>Không có ca nào trong tháng {monthName(month)}</td></tr>}
            {inMonth.map((r) => {
              const s = byId.get(r.shift_id)!
              const h = r.hours ?? (r.attendance === 'half' ? shiftTimes(s).hours / 2 : r.attendance === 'full' ? shiftTimes(s).hours : 0)
              return (
                <tr key={r.id}>
                  <td className="td whitespace-nowrap">{fmtD(s.work_date)}</td>
                  <td className="td">{s.title}</td>
                  <td className="td"><AttendanceBadge a={r.attendance} /></td>
                  <td className="td">{num(h)}</td>
                  <td className="td font-semibold">{money(r.pay ?? (r.attendance === 'full' || r.attendance === 'half' ? h * s.rate : 0))}</td>
                  <td className="td">{(() => { const pt = payText(r, s); return <span className={pt.bad ? 'font-semibold text-red-600' : ''}>{pt.text}</span> })()}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-400">Xem lịch sử toàn bộ ca đã đăng ký ở mục <Link to="/my" className="font-semibold text-accent underline">Ca của tôi</Link>.</p>
    </div>
  )
}
