import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { addLabel, getProfile, listLabels, removeLabel } from '../lib/api'
import { useSession, useToast } from '../lib/store'
import { LABELS, type Label, type Profile, type Registration, KycStatus, } from '../lib/types'
import { LABELS as LBL } from '../lib/types'
import { fmtD, maskCccd, money, num } from '../lib/util'
import { Badge, Modal, Spinner } from './ui'

const KYC_LABEL: Record<KycStatus, { text: string; cls: string }> = {
  unsubmitted: { text: 'Chưa nộp hồ sơ', cls: 'bg-zinc-200 text-zinc-600 border-zinc-300' },
  pending: { text: 'Chờ duyệt hồ sơ', cls: 'bg-amber-100 text-amber-800 border-amber-300' },
  approved: { text: 'Hồ sơ đã duyệt', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  rejected: { text: 'Hồ sơ bị từ chối', cls: 'bg-red-100 text-red-700 border-red-300' },
}

export function LabelChips({ labels }: { labels: Label[] }) {
  if (!labels.length) return <span className="text-xs text-zinc-400">Chưa có nhãn</span>
  return (
    <div className="flex flex-wrap gap-1">
      {labels.map((l) => {
        const def = LABELS[l.code]
        return (
          <Badge key={l.id} className={def?.bad ? 'border-red-300 bg-red-50 text-red-700' : 'border-emerald-300 bg-emerald-50 text-emerald-700'}>
            {def?.label ?? l.code}
          </Badge>
        )
      })}
    </div>
  )
}

/** Thống kê nhanh + nhãn của 1 người làm — dùng khi duyệt đăng ký / đối soát */
export default function WorkerCard({
  workerId,
  registrations,
  shiftIdForLabel,
  onChanged,
}: {
  workerId: string
  registrations: Registration[]
  shiftIdForLabel?: string | null
  onChanged?: () => void
}) {
  const { profile: me } = useSession()
  const { push } = useToast()
  const [p, setP] = useState<Profile | null>(null)
  const [labels, setLabels] = useState<Label[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [code, setCode] = useState('late')
  const [note, setNote] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      setP(await getProfile(workerId))
      const all = await listLabels()
      setLabels(all.filter((l) => l.worker_id === workerId))
    } catch (e) {
      push((e as Error).message, true)
    }
    setLoading(false)
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [workerId])

  if (loading) return <Spinner text="Đang tải hồ sơ…" />
  if (!p) return <div className="text-sm text-zinc-500">Không tìm thấy hồ sơ.</div>

  const mine = registrations.filter((r) => r.worker_id === workerId)
  const approved = mine.filter((r) => r.status === 'approved')
  const full = approved.filter((r) => r.attendance === 'full').length
  const half = approved.filter((r) => r.attendance === 'half').length
  const absE = approved.filter((r) => r.attendance === 'absent_excused').length
  const absU = approved.filter((r) => r.attendance === 'absent_unexcused').length
  const pending = mine.filter((r) => r.status === 'pending').length
  const badCount = labels.filter((l) => LABELS[l.code]?.bad).length
  const canLabel = me && ['recruiter', 'owner', 'admin'].includes(me.role)

  const submitLabel = async () => {
    if (!me) return
    try {
      await addLabel(workerId, code, note, shiftIdForLabel ?? null, me.id)
      setNote('')
      setShowAdd(false)
      push('Đã gắn nhãn')
      await load()
      onChanged?.()
    } catch (e) { push((e as Error).message, true) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-display text-xl font-bold">{p.full_name || '(Chưa điền họ tên)'}</div>
          <div className="text-sm text-zinc-500">{p.phone || '—'} · CCCD {maskCccd(p.cccd)}</div>
        </div>
        <Badge className={KYC_LABEL[p.kyc_status].cls}>{KYC_LABEL[p.kyc_status].text}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 p-2.5 text-center"><div className="text-lg font-bold">{full}</div><div className="text-[11px] font-semibold uppercase text-zinc-500">Đủ ca</div></div>
        <div className="rounded-lg border border-zinc-200 p-2.5 text-center"><div className="text-lg font-bold">{half}</div><div className="text-[11px] font-semibold uppercase text-zinc-500">Nửa ca</div></div>
        <div className="rounded-lg border border-zinc-200 p-2.5 text-center"><div className="text-lg font-bold">{absE}</div><div className="text-[11px] font-semibold uppercase text-zinc-500">Vắng có báo</div></div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-center"><div className="text-lg font-bold text-red-700">{absU}</div><div className="text-[11px] font-semibold uppercase text-red-600">Vắng không phép</div></div>
      </div>
      <div className="text-xs text-zinc-500">Đang chờ duyệt: {pending} ca · Tổng ca được duyệt: {approved.length}</div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="label mb-0">Nhãn ({labels.filter((l) => LABELS[l.code]?.bad).length} xấu / {labels.length} tất cả)</span>
          {canLabel && (
            <button className="btn-ghost !px-2.5 !py-1 text-xs" onClick={() => setShowAdd(true)}>
              <Plus size={13} /> Gắn nhãn
            </button>
          )}
        </div>
        <div className="space-y-1.5">
          <LabelChips labels={labels} />
          {labels.map((l) => (
            <div key={l.id} className="flex items-center justify-between rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs">
              <span>
                <Badge className={LABELS[l.code]?.bad ? 'border-red-300 bg-red-50 text-red-700' : 'border-emerald-300 bg-emerald-50 text-emerald-700'}>
                  {LBL[l.code]?.label ?? l.code}
                </Badge>
                {l.note && <span className="ml-2 text-zinc-500">{l.note}</span>}
              </span>
              {canLabel && me && l.created_by === me.id && (
                <button
                  className="text-zinc-400 hover:text-red-600"
                  onClick={async () => { try { await removeLabel(l.id); await load(); onChanged?.() } catch (e) { push((e as Error).message, true) } }}
                  aria-label="Xóa nhãn"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm">
        <div className="font-semibold">Thông tin thanh toán</div>
        <div className="mt-1 text-zinc-600">
          Ngân hàng: <b>{p.bank_name || '—'}</b> · Số TK: <b>{p.bank_account || '—'}</b>
        </div>
        <div className="text-zinc-600">Địa chỉ: {p.address || '—'}</div>
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Gắn nhãn cho người làm">
        <div className="space-y-3">
          <div>
            <span className="label">Loại nhãn</span>
            <select className="field" value={code} onChange={(e) => setCode(e.target.value)}>
              {Object.entries(LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v.bad ? '(xấu) ' : '(tốt) '}{v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <span className="label">Ghi chú</span>
            <input className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ví dụ: trễ 20 phút ca 10/10" />
          </div>
          <button className="btn-primary w-full" onClick={submitLabel}>Lưu nhãn</button>
          <p className="text-xs text-zinc-500">
            Người làm sẽ nhìn thấy nhãn này trong thống kê cá nhân của họ. Tổng thu nhãn xấu: {badCount}
          </p>
        </div>
      </Modal>
    </div>
  )
}

export function regSummaryText(r: Registration, hours: number, rate: number): string {
  const h = r.hours ?? hours
  return `${num(h)}h × ${money(rate)}/h = ${money(r.pay ?? h * rate)}`
}

export function dateShort(iso: string | null): string {
  return iso ? fmtD(iso.slice(0, 10)) : '—'
}
