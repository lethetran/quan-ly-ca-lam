import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import type { Registration, Shift } from '../lib/types'
import { ATTENDANCE_LABEL, REG_STATUS_LABEL } from '../lib/types'
import { fmtD, fmtT, money, shiftTimes } from '../lib/util'
import { Modal } from './ui'

function shiftText(s: Shift, approved: number): string {
  const { hours } = shiftTimes(s)
  return [
    '📢 THÔNG BÁO CA LÀM',
    `• Ca: ${s.title}`,
    `• Thời gian: ${fmtD(s.work_date)} ${fmtT(s.start_time)}-${fmtT(s.end_time)} (${hours} giờ)`,
    `• Địa điểm: ${s.location}`,
    `• Đơn giá: ${money(s.rate)}/giờ (~${money(s.rate * hours)}/ca)`,
    `• Số lượng: ${approved}/${s.capacity} người`,
    s.contact_name ? `• Liên hệ: ${s.contact_name}${s.contact_phone ? ' - ' + s.contact_phone : ''}` : '',
    s.note ? `• Lưu ý: ${s.note}` : '',
  ].filter(Boolean).join('\n')
}

export function ZaloShareButton({ text, label = 'Chia sẻ nhóm Zalo' }: { text: string; label?: string }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }
  return (
    <>
      <button className="btn-ghost" onClick={() => setOpen(true)}>
        <Copy size={15} /> {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Gửi thông báo vào nhóm Zalo">
        <p className="mb-2 text-sm text-zinc-500">
          Bấm sao chép nội dung bên dưới rồi dán vào nhóm Zalo của đội (Zalo chưa cho website gửi tự động vào nhóm).
        </p>
        <textarea className="field h-56 font-mono text-xs" readOnly value={text} onFocus={(e) => e.currentTarget.select()} />
        <button className={`mt-3 w-full ${copied ? 'btn-dark' : 'btn-primary'}`} onClick={copy}>
          {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Đã sao chép — dán vào Zalo nhé!' : 'Sao chép nội dung'}
        </button>
      </Modal>
    </>
  )
}

export function ShiftZaloShare({ shift, regs }: { shift: Shift; regs: Registration[] }) {
  const approved = regs.filter((r) => r.status === 'approved').length
  return <ZaloShareButton text={shiftText(shift, approved)} />
}

export function CancelZaloShare({ shift }: { shift: Shift }) {
  const text = [
    '⚠️ THÔNG BÁO HỦY CA',
    `• Ca: ${shift.title}`,
    `• Đã dự kiến: ${fmtD(shift.work_date)} ${fmtT(shift.start_time)}-${fmtT(shift.end_time)}`,
    `• Địa điểm: ${shift.location}`,
    '• Ca bị hủy — mọi người không đến địa điểm trên nhé.',
  ].join('\n')
  return <ZaloShareButton text={text} label="Báo hủy vào nhóm Zalo" />
}

export function RegStatusBadge({ status }: { status: Registration['status'] }) {
  const cls: Record<string, string> = {
    pending: 'border-amber-300 bg-amber-50 text-amber-800',
    approved: 'border-emerald-300 bg-emerald-50 text-emerald-700',
    rejected: 'border-red-300 bg-red-50 text-red-700',
    cancelled: 'border-zinc-300 bg-zinc-100 text-zinc-500',
    removed: 'border-zinc-300 bg-zinc-100 text-zinc-500',
  }
  return <span className={`badge ${cls[status]}`}>{REG_STATUS_LABEL[status]}</span>
}

export function AttendanceBadge({ a }: { a: Registration['attendance'] }) {
  if (!a) return <span className="text-xs text-zinc-400">Chưa chấm</span>
  const cls: Record<string, string> = {
    full: 'border-emerald-300 bg-emerald-600 text-white',
    half: 'border-sky-300 bg-sky-600 text-white',
    absent_excused: 'border-amber-300 bg-amber-500 text-white',
    absent_unexcused: 'border-red-300 bg-red-600 text-white',
  }
  return <span className={`badge ${cls[a]}`}>{ATTENDANCE_LABEL[a]}</span>
}
