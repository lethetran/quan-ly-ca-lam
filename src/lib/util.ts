import type { Shift, ShiftStatus } from './types'

// ===== Tài khoản quản trị cao nhất =====
// admin (đăng nhập trực tiếp) hoặc admin@example.com
export const ADMIN_EMAILS = ['admin@example.com', 'admin@nhanvien.local']

/** Đăng nhập bằng email hoặc tên đăng nhập thuần (SĐT, nickname) */
export function toEmail(login: string): string {
  const s = login.trim().toLowerCase()
  if (s.includes('@')) return s
  return `${s}@nhanvien.local`
}

export function shortAccount(email: string | null | undefined): string {
  if (!email) return ''
  return email.endsWith('@nhanvien.local') ? email.slice(0, -'@nhanvien.local'.length) : email
}

// ===== Thời gian / ca làm =====
export function shiftTimes(s: Shift): { start: Date; end: Date; hours: number } {
  const [y, m, d] = s.work_date.split('-').map(Number)
  const [sh, sm] = s.start_time.split(':').map(Number)
  const [eh, em] = s.end_time.split(':').map(Number)
  const start = new Date(y, m - 1, d, sh, sm, 0)
  let end = new Date(y, m - 1, d, eh, em, 0)
  if (end.getTime() <= start.getTime()) end = new Date(end.getTime() + 24 * 3600 * 1000) // ca qua đêm
  const auto = (end.getTime() - start.getTime()) / 3600000
  return { start, end, hours: s.hours_override ?? Math.round(auto * 100) / 100 }
}

/** Trạng thái hiệu lực: đang tuyển tự chuyển "đang diễn ra" theo thời gian */
export function effStatus(s: Shift, now = Date.now()): { status: ShiftStatus; ended: boolean } {
  if (s.status !== 'recruiting') {
    if (s.status === 'ongoing') {
      const { end } = shiftTimes(s)
      return { status: 'ongoing', ended: now >= end.getTime() }
    }
    return { status: s.status, ended: false }
  }
  const { start, end } = shiftTimes(s)
  if (now >= end.getTime()) return { status: 'ongoing', ended: true }
  if (now >= start.getTime()) return { status: 'ongoing', ended: false }
  return { status: 'recruiting', ended: false }
}

export function regOpen(s: Shift, now = Date.now()): boolean {
  if (s.status !== 'recruiting') return false
  const { start } = shiftTimes(s)
  const deadline = s.reg_deadline ? new Date(s.reg_deadline).getTime() : start.getTime()
  return now < Math.min(deadline, start.getTime())
}

// ===== Định dạng =====
const DOW = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
export function fmtD(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return `${DOW[dt.getDay()]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
}
export function fmtT(t: string): string {
  return t.slice(0, 5)
}
export function fmtDT(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${DOW[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
export function money(n: number | null | undefined): string {
  if (n == null) return '—'
  return Math.round(n).toLocaleString('vi-VN') + 'đ'
}
export function num(n: number | null | undefined): string {
  if (n == null) return '—'
  return String(Math.round(n * 100) / 100).replace('.', ',')
}
export function ym(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
export function monthName(ymStr: string): string {
  const [y, m] = ymStr.split('-').map(Number)
  return `Tháng ${m}/${y}`
}
export function hoursIn(kh: number | null | undefined): string {
  if (kh == null) return '—'
  return `${num(kh)} giờ`
}

// ===== CSV (mở bằng Excel, hỗ trợ tiếng Việt) =====
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? '')
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = '\uFEFF' + rows.map((r) => r.map(esc).join(';')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

// ===== Nén ảnh trước khi upload CCCD =====
export async function compressImage(file: File, maxSide = 1280, quality = 0.82): Promise<Blob> {
  if (!file.type.startsWith('image/')) return file
  const img = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
  const w = Math.round(img.width * scale)
  const h = Math.round(img.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, w, h)
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality))
  return blob ?? file
}

export function maskCccd(cccd: string | null): string {
  if (!cccd) return '—'
  return cccd.length <= 6 ? cccd : cccd.slice(0, 3) + '*'.repeat(cccd.length - 6) + cccd.slice(-3)
}
