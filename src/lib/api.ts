import { supabase, BUCKET } from './supabase'
import type { AuditLog, Attendance, Label, Notif, PayStatus, Profile, Registration, Shift } from './types'
import { compressImage, imageOk } from './util'

function unwrap<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message)
  return data as T
}

// ===== Hồ sơ =====
// Vai trò do server quyết định (trigger đọc bảng app_admins) — client không gửi role.
// Chống đua: nhiều sự kiện phiên đăng nhập cùng gọi → gom về 1 lần chạy; nếu chèn trùng
// (2 luồng cùng lúc) thì đọc lại thay vì báo lỗi.
const profileInflight = new Map<string, Promise<Profile | null>>()

export async function ensureProfile(userId: string, email: string): Promise<Profile | null> {
  const running = profileInflight.get(userId)
  if (running) return running
  const task = (async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    if (data) return data as Profile
    // username chỉ a-z0-9._ (khớp ràng buộc DB); hỏng định dạng thì sinh từ id
    let username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9._]/g, '')
    if (username.length < 3) username = `u_${userId.slice(0, 8)}`
    const { error } = await supabase.from('profiles').insert({ id: userId, username, kyc_status: 'unsubmitted' })
    if (error) {
      const { data: again } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
      if (again) return again as Profile
      throw new Error(error.message)
    }
    const { data: created } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    return (created as Profile) ?? null
  })()
  profileInflight.set(userId, task)
  try {
    return await task
  } finally {
    profileInflight.delete(userId)
  }
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  return (data as Profile) ?? null
}

export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select('*').order('created_at')
  return unwrap<Profile[]>(data, error) ?? []
}

export async function updateOwnProfile(id: string, patch: Partial<Profile>): Promise<void> {
  const { error } = await supabase.from('profiles').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function adminUpdateProfile(id: string, patch: Partial<Profile>): Promise<void> {
  const { error } = await supabase.from('profiles').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
}

// ===== Ảnh CCCD / chứng từ =====
export async function uploadImage(userId: string, slot: 'front' | 'back' | 'proof', file: File): Promise<string> {
  const bad = imageOk(file)
  if (bad) throw new Error(bad)
  const blob = await compressImage(file)
  const path = `${userId}/${slot}-${Date.now()}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: true })
  if (error) throw new Error('Tải ảnh lên thất bại: ' + error.message)
  return path
}

export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  const clean = paths.filter(Boolean)
  if (!clean.length) return out
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(clean, 60 * 60)
  if (error) throw new Error(error.message)
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) out[item.path] = item.signedUrl
  }
  return out
}

// ===== Ca làm =====
const LIST_LIMIT = 500 // chặn truy vấn vô hạn; nội bộ vài trăm dòng là đủ cho MVP
export async function listShifts(): Promise<Shift[]> {
  const { data, error } = await supabase.from('shifts').select('*').order('work_date').order('start_time').limit(LIST_LIMIT)
  return unwrap<Shift[]>(data, error) ?? []
}

export type NewShift = Omit<Shift, 'id' | 'status' | 'approved_by' | 'payment_note' | 'paid_at' | 'created_at'>

export async function createShift(payload: NewShift, createdBy: string): Promise<Shift> {
  const { data, error } = await supabase
    .from('shifts')
    .insert({ ...payload, status: 'pending_approval', created_by: createdBy })
    .select('*')
    .single()
  return unwrap<Shift>(data, error)
}

export async function updateShift(id: string, patch: Partial<Shift>): Promise<Shift> {
  const { data, error } = await supabase.from('shifts').update(patch).eq('id', id).select('*').single()
  return unwrap<Shift>(data, error)
}

export async function deleteShift(id: string): Promise<void> {
  const { error } = await supabase.from('shifts').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ===== Đăng ký ca =====
export async function listRegistrations(filter?: { shiftId?: string; workerId?: string }): Promise<Registration[]> {
  let q = supabase.from('registrations').select('*').order('created_at')
  if (filter?.shiftId) q = q.eq('shift_id', filter.shiftId)
  if (filter?.workerId) q = q.eq('worker_id', filter.workerId)
  const { data, error } = await q
  return unwrap<Registration[]>(data, error) ?? []
}

export async function registerShift(shiftId: string, workerId: string, note: string): Promise<Registration> {
  const { data, error } = await supabase
    .from('registrations')
    .insert({ shift_id: shiftId, worker_id: workerId, status: 'pending', worker_note: note || null })
    .select('*')
    .single()
  return unwrap<Registration>(data, error)
}

export async function updateRegistration(id: string, patch: Partial<Registration>): Promise<Registration> {
  const { data, error } = await supabase.from('registrations').update(patch).eq('id', id).select('*').single()
  return unwrap<Registration>(data, error)
}

/** Chủ đánh dấu tình trạng trả lương TỪNG NGƯỜI: đã chuyển khoản, không trả được (kèm lý do), hoặc hoàn tác */
export async function setPersonPay(
  regId: string,
  patch: { pay_status: 'unpaid' | 'paid' | 'failed'; paid_at?: string | null; pay_fail_note?: string | null },
): Promise<Registration> {
  const { data, error } = await supabase.from('registrations').update(patch).eq('id', regId).select('*').single()
  return unwrap<Registration>(data, error)
}

/** Lưu chấm công hàng loạt trong bước đối soát */
export async function saveReconcileRows(
  rows: {
    id: string
    shift_id: string
    worker_id: string
    status: 'approved'
    attendance: Attendance
    hours: number | null
    pay: number | null
    pay_note: string | null
    reconciled_by: string
    reconciled_at: string
  }[],
): Promise<void> {
  const { error } = await supabase.from('registrations').upsert(rows)
  if (error) throw new Error('Lưu đối soát thất bại: ' + error.message)
}

// ===== Nhãn =====
export async function listLabels(): Promise<Label[]> {
  const { data, error } = await supabase.from('labels').select('*').order('created_at', { ascending: false })
  return unwrap<Label[]>(data, error) ?? []
}

export async function addLabel(workerId: string, code: string, note: string, shiftId: string | null, createdBy: string): Promise<Label> {
  const { data, error } = await supabase
    .from('labels')
    .insert({ worker_id: workerId, code, note: note || null, shift_id: shiftId, created_by: createdBy })
    .select('*')
    .single()
  return unwrap<Label>(data, error)
}

export async function removeLabel(id: string): Promise<void> {
  const { error } = await supabase.from('labels').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ===== Danh sách tên người trong ca (RPC bảo mật, không lộ thông tin nhạy cảm) =====
export async function fetchRoster(shiftId: string): Promise<{ worker_id: string; full_name: string | null; reg_status: string }[]> {
  const { data, error } = await supabase.rpc('roster_for', { p_shift: shiftId })
  if (error) throw new Error(error.message)
  return (data as { worker_id: string; full_name: string | null; reg_status: string }[]) ?? []
}

// ===== Thông báo =====
export async function listNotifs(userId: string): Promise<Notif[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  return unwrap<Notif[]>(data, error) ?? []
}

export async function notify(userIds: string[], kind: string, title: string, body: string, shiftId?: string): Promise<void> {
  const unique = [...new Set(userIds)].filter(Boolean)
  if (!unique.length) return
  const rows = unique.map((user_id) => ({ user_id, kind, title, body, shift_id: shiftId ?? null, read: false }))
  const { error } = await supabase.from('notifications').insert(rows)
  if (error) console.warn('Không tạo được thông báo:', error.message)
}

export async function markNotifsRead(userId: string): Promise<void> {
  await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false)
}

// ===== Nhật ký hệ thống =====
export async function audit(actorId: string, actorName: string, action: string, detail: string): Promise<void> {
  await supabase.from('audit_logs').insert({ actor_id: actorId, actor_name: actorName, action, detail })
}

export async function listAudit(): Promise<AuditLog[]> {
  const { data, error } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200)
  return unwrap<AuditLog[]>(data, error) ?? []
}
