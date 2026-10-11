import type { Shift, ShiftStatus } from './types'

// ===== Tài khoản =====
// Quyền admin KHÔNG quyết định ở client — server quyết định qua bảng app_admins (seed thủ công).
/** Đăng nhập bằng email hoặc tên đăng nhập thuần (SĐT, nickname) */
export function toEmail(login: string): string {
  const s = login.trim().toLowerCase()
  if (s.includes('@')) return s
  return `${s}@nhanvien.local`
}

/** Tên đăng nhập hợp lệ: 3–24 ký tự, chữ thường/số/dấu chấm/gạch dưới */
export function usernameOk(name: string): boolean {
  return /^[a-z0-9._]{3,24}$/.test(name.trim().toLowerCase())
}

/** Thông báo lỗi đăng nhập/đăng ký thân thiện, không lộ chi tiết kỹ thuật */
export function authErrorVi(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Tài khoản hoặc mật khẩu không đúng.'
  if (m.includes('already registered') || m.includes('already exists') || m.includes('duplicate key')) return 'Tên đăng nhập này đã được dùng — hãy đăng nhập, hoặc chọn tên khác.'
  if (m.includes('password') && m.includes('least')) return 'Mật khẩu phải tối thiểu 8 ký tự.'
  if (m.includes('rate limit') || m.includes('too many')) return 'Bạn thử quá nhiều lần — đợi 1 phút rồi thử lại nhé.'
  if (m.includes('failed to fetch') || m.includes('network')) return 'Mất kết nối mạng — kiểm tra internet rồi thử lại.'
  return 'Không thực hiện được. Vui lòng thử lại sau ít phút.'
}

export function shortAccount(email: string | null | undefined): string {
  if (!email) return ''
  return email.endsWith('@nhanvien.local') ? email.slice(0, -'@nhanvien.local'.length) : email
}

// ===== Thời gian / ca làm =====
// Toàn hệ thống quy về múi giờ Việt Nam (UTC+7) bất kể thiết bị của người dùng
const VN_OFFSET = '+07:00'
export function shiftTimes(s: Shift): { start: Date; end: Date; hours: number } {
  const start = new Date(`${s.work_date}T${s.start_time.slice(0, 5)}:00${VN_OFFSET}`)
  let end = new Date(`${s.work_date}T${s.end_time.slice(0, 5)}:00${VN_OFFSET}`)
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
export const IMAGE_MAX_MB = 5
export function imageOk(file: File): string | null {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Chỉ nhận ảnh JPG, PNG hoặc WebP'
  if (file.size > IMAGE_MAX_MB * 1024 * 1024) return `Ảnh quá lớn (tối đa ${IMAGE_MAX_MB} MB) — hãy chụp lại hoặc chọn ảnh nhẹ hơn`
  return null
}

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

// ===== Chuẩn mật khẩu =====
export const PASSWORD_HINT = 'Tối thiểu 8 ký tự, gồm cả chữ và số'
export function passwordOk(pw: string): boolean {
  return pw.length >= 8 && /[a-zA-Z]/.test(pw) && /\d/.test(pw)
}

// ===== Kiểm tra/kẹp dữ liệu nhập (chặn giá trị âm, rác trước khi tới DB) =====
export function clampNum(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min
  return Math.min(max, Math.max(min, v))
}

export function digitsOk(s: string, min: number, max: number): boolean {
  return new RegExp(`^[0-9]{${min},${max}}$`).test(s.trim())
}

export function todayVN(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
}

export interface ShiftFormInput {
  title: string
  location: string
  work_date: string
  start_time: string
  end_time: string
  rate: number
  capacity: number
  contact_phone?: string
}

/** Trả về thông báo lỗi đầu tiên của form tạo ca, hoặc null nếu hợp lệ */
export function shiftFormError(f: ShiftFormInput): string | null {
  const title = f.title.trim()
  const loc = f.location.trim()
  if (title.length < 2 || title.length > 120) return 'Tên ca từ 2 đến 120 ký tự'
  if (loc.length < 2 || loc.length > 200) return 'Địa điểm từ 2 đến 200 ký tự'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.work_date)) return 'Chọn ngày làm'
  if (f.work_date < todayVN()) return 'Không tạo được ca cho ngày đã qua'
  if (f.start_time === f.end_time) return 'Giờ kết thúc phải khác giờ bắt đầu (ca qua đêm thì chọn ngày mai kết thúc sau 00:00)'
  if (!Number.isInteger(f.rate) || f.rate <= 0 || f.rate > 100000000) return 'Đơn giá phải là số nguyên dương, tối đa 100.000.000đ/giờ'
  if (!Number.isInteger(f.capacity) || f.capacity < 1 || f.capacity > 1000) return 'Số lượng cần từ 1 đến 1000 người'
  if (f.contact_phone && !digitsOk(f.contact_phone, 9, 11)) return 'SĐT liên hệ gồm 9–11 chữ số'
  return null
}
