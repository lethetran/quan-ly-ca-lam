// ===== Kiểu dữ liệu dùng chung toàn app =====

export type Role = 'worker' | 'recruiter' | 'owner' | 'admin2' | 'admin'
export type KycStatus = 'unsubmitted' | 'pending' | 'approved' | 'rejected'

export const ROLE_LABEL: Record<Role, string> = {
  worker: 'Người đi làm',
  recruiter: 'Tuyển dụng',
  owner: 'Chủ / Công ty',
  admin2: 'Duyệt hồ sơ (Admin 2)',
  admin: 'Quản trị cao nhất',
}

export interface Profile {
  id: string
  username: string
  email: string | null
  role: Role
  full_name: string | null
  cccd: string | null
  phone: string | null
  address: string | null
  bank_name: string | null
  bank_account: string | null
  cccd_front_path: string | null
  cccd_back_path: string | null
  kyc_status: KycStatus
  kyc_note: string | null
  created_at: string
}

export type ShiftStatus =
  | 'pending_approval' | 'recruiting' | 'ongoing'
  | 'reconciling' | 'paying' | 'paid'
  | 'rejected' | 'cancelled'

export const SHIFT_STATUS_LABEL: Record<ShiftStatus, string> = {
  pending_approval: 'Chờ duyệt ca',
  recruiting: 'Đang tuyển',
  ongoing: 'Đang diễn ra',
  reconciling: 'Đang đối soát',
  paying: 'Đang thanh toán',
  paid: 'Đã thanh toán',
  rejected: 'Bị từ chối',
  cancelled: 'Đã hủy',
}

export const SHIFT_STATUS_COLOR: Record<ShiftStatus, string> = {
  pending_approval: 'bg-zinc-200 text-zinc-700 border-zinc-300',
  recruiting: 'bg-sky-100 text-sky-800 border-sky-300',
  ongoing: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  reconciling: 'bg-amber-100 text-amber-900 border-amber-300',
  paying: 'bg-orange-100 text-orange-800 border-orange-300',
  paid: 'bg-teal-100 text-teal-900 border-teal-300',
  rejected: 'bg-red-100 text-red-800 border-red-300',
  cancelled: 'bg-zinc-300 text-zinc-600 border-zinc-400 line-through',
}

export interface Shift {
  id: string
  title: string
  location: string
  contact_name: string | null
  contact_phone: string | null
  note: string | null
  work_date: string   // yyyy-mm-dd
  start_time: string  // HH:mm:ss
  end_time: string    // HH:mm:ss (qua đêm tự xử lý)
  hours_override: number | null // null => tự tính theo giờ bắt đầu/kết thúc
  rate: number        // VND / giờ
  capacity: number
  reg_deadline: string | null // ISO datetime
  status: ShiftStatus
  created_by: string
  approved_by: string | null
  payment_note: string | null
  paid_at: string | null
  created_at: string
}

export type RegStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'removed'
export const REG_STATUS_LABEL: Record<RegStatus, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
  cancelled: 'Đã hủy bởi người làm',
  removed: 'Đã gỡ bởi tuyển dụng',
}

export type Attendance = 'full' | 'half' | 'absent_excused' | 'absent_unexcused'
export const ATTENDANCE_LABEL: Record<Attendance, string> = {
  full: 'Đủ ca',
  half: 'Nửa ca',
  absent_excused: 'Vắng có báo trước',
  absent_unexcused: 'Vắng không phép',
}
export const ATTENDANCE_COLOR: Record<Attendance, string> = {
  full: 'bg-emerald-600 text-white',
  half: 'bg-sky-600 text-white',
  absent_excused: 'bg-amber-500 text-white',
  absent_unexcused: 'bg-red-600 text-white',
}

export type PayStatus = 'unpaid' | 'paid' | 'failed'

export interface Registration {
  id: string
  shift_id: string
  worker_id: string
  status: RegStatus
  attendance: Attendance | null
  hours: number | null
  pay: number | null
  pay_note: string | null
  worker_note: string | null
  reviewed_by: string | null
  reconciled_by: string | null
  reconciled_at: string | null
  pay_status: PayStatus | null
  paid_at: string | null
  pay_fail_note: string | null
  created_at: string
}

// ===== Nhãn người làm =====
export const LABELS: Record<string, { label: string; bad: boolean }> = {
  good_work: { label: 'Làm việc tốt', bad: false },
  proactive: { label: 'Nhiệt tình, chủ động', bad: false },
  punctual: { label: 'Luôn đúng giờ', bad: false },
  late: { label: 'Đi trễ', bad: true },
  leave_early: { label: 'Về sớm không phép', bad: true },
  no_show: { label: 'Không đến khi đã đăng ký', bad: true },
  cancel_late: { label: 'Hủy ca sát giờ', bad: true },
  attitude: { label: 'Thái độ kém', bad: true },
  uniform: { label: 'Không đúng trang phục', bad: true },
  other_bad: { label: 'Lý do khác (xấu)', bad: true },
}

export interface Label {
  id: string
  worker_id: string
  shift_id: string | null
  code: string
  note: string | null
  created_by: string | null
  created_at: string
}

export interface Notif {
  id: string
  user_id: string
  kind: string
  title: string
  body: string | null
  shift_id: string | null
  read: boolean
  created_at: string
}

export interface AuditLog {
  id: string
  actor_id: string | null
  actor_name: string | null
  action: string
  detail: string | null
  created_at: string
}
