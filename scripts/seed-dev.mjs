// Seed tài khoản mẫu — CHỈ dùng cho môi trường dev/test.
// Cách chạy (không bao giờ hard-code key trong file hay commit):
//   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=sbp_secret_xxx node scripts/seed-dev.mjs
// Script tạo vài tài khoản mỗi vai trò + một ca mẫu để test luồng nhanh.
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY — đọc từ biến môi trường, không hard-code.')
  process.exit(1)
}
const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

const PW = 'Dev' + Math.random().toString(36).slice(2, 8) // mật khẩu ngẫu nhiên, in 1 lần cho người chạy
const people = [
  { email: 'dev-owner@nhanvien.local', role: 'owner', name: 'DEV Chủ Công ty' },
  { email: 'dev-recruiter@nhanvien.local', role: 'recruiter', name: 'DEV Tuyển Dụng' },
  { email: 'dev-admin2@nhanvien.local', role: 'admin2', name: 'DEV Duyệt Hồ Sơ' },
  { email: 'dev-worker@nhanvien.local', role: 'worker', name: 'DEV Người Làm' },
]

console.log('Tạo tài khoản dev (mật khẩu dùng 1 lần:', PW + ')')
for (const p of people) {
  const { data, error } = await admin.auth.admin.createUser({
    email: p.email, password: PW, email_confirm: true,
    user_metadata: { full_name: p.name },
  })
  if (error) { console.error('Lỗi', p.email, error.message); continue }
  await admin.from('profiles').upsert({ id: data.user.id, username: p.email.split('@')[0], full_name: p.name, kyc_status: 'approved' })
  await admin.from('profiles').update({ role: p.role }).eq('id', data.user.id)
  console.log('✓', p.role, p.email)
}
console.log('Xong — chỉ chạy trên môi trường dev, không chạy trên dữ liệu thật.')
