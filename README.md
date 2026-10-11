# Quản Lý Ca Làm — hệ thống phân ca & đối soát 3 bên

**Website chính thức (Vercel, tự deploy mỗi `git push`): https://quan-ly-ca-lam.vercel.app**
Bản dự phòng: https://lethetran.github.io/quan-ly-ca-lam/

Hệ thống nội bộ cho 3 bên phối hợp:

| Vai trò | Làm gì |
|---|---|
| **Người đi làm** | Nộp hồ sơ CCCD (Admin 2 duyệt) → đăng ký ca trên lịch → theo dõi chấm công & tiền → xem nhãn tốt/xấu của mình |
| **Tuyển dụng** | Duyệt ca, duyệt người (xem thống kê + nhãn từng người), đối soát kiểu Excel, xuất CSV |
| **Chủ / Công ty** | Tạo ca (đơn giá/giờ), thanh toán cả ca hoặc bỏ tích trường hợp đặc biệt kèm lý do, thống kê chi phí |
| **Admin 2** | Duyệt hồ sơ CCCD — duyệt xong người làm mới đăng ký ca được |
| **Admin** | Quản lý vai trò, nhật ký hệ thống (ghi tự động bằng trigger server) |

Vòng đời ca: `Chờ duyệt → Đang tuyển → Đang diễn ra → Đang đối soát → Đang thanh toán → Đã thanh toán`
(Đang diễn ra tự chuyển theo giờ VN +07:00; mỗi bước chuyển được **trigger server** kiểm tra đúng vai trò.)

## Công nghệ

React 18 + TypeScript + Vite + Tailwind CSS + Vitest · Supabase (PostgreSQL + RLS, Auth, Storage)

## Chạy dự án

```bash
cp .env.example .env    # điền VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (Dashboard → Settings → API)
npm install
npm run dev             # http://localhost:5173
npm test                # test đơn vị (vitest)
npm run build           # dist/ — deploy lên hosting tĩnh bất kỳ
```

Chỉ **anon key** được đặt ở client (nó sinh ra để công khai, dữ liệu được bảo vệ bởi RLS).
Không bao giờ commit `.env`, service key, hay mật khẩu database.

## Cơ sở dữ liệu & migration

Chạy đúng thứ tự trong Supabase SQL Editor:

1. `supabase/schema.sql` — bảng, RLS gốc, storage bucket
2. `supabase/migrations/0001_admin_rls_audit.sql` — quyền admin qua bảng `app_admins` (seed thủ công), audit trigger
3. `supabase/migrations/0002_storage_lock.sql` — ảnh CCCD: chỉ chủ nhân + Admin2/Admin đọc; giới hạn loại file & 5MB
4. `supabase/migrations/0003_business_rules.sql` — luật chuyển trạng thái, khóa đối soát, cấm trùng giờ/vượt số lượng

Mỗi migration chạy lại được và có rollback ghi ở cuối file. Bộ test RLS: `supabase/tests/rls_checks.sql`
(thay uid mẫu đầu file bằng uid thật của môi trường bạn — đầu ra `ALL PASS`).

## Tài khoản & vai trò

Mọi tài khoản tự đăng ký mặc định là **Người đi làm** và bắt buộc hoàn thiện hồ sơ trước khi đăng ký ca.
Ai được cấp admin sẽ được khai báo thủ công: `INSERT INTO public.app_admins (email) VALUES ('email-của-bạn');`
— sau đó tài khoản với email đó đăng ký mới nhận vai trò admin (không gán qua giao diện).

Dữ liệu mẫu cho môi trường dev: `node scripts/seed-dev.mjs` (đọc `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE`
từ biến môi trường — không bao giờ hard-code vào repo). **Không chạy seed trên dữ liệu thật.**

## Bảo mật & vận hành

- RLS từng bảng theo nguyên tắc ít quyền nhất; bộ test SQL kiểm tra định kỳ sau mỗi migration
- Ảnh CCCD: bucket riêng tư, signed URL 1 giờ, chỉ Admin 2/Admin xem được
- Audit log server-side cho đổi vai trò / duyệt hồ sơ / chốt trả lương — không ai sửa/xóa được
- Vercel bật CSP + security headers (`vercel.json`); GitHub Pages không hỗ trợ header tùy chỉnh
- **Việc vận hành định kỳ:** đổi mật khẩu admin định kỳ; sao lưu database (Dashboard → Database → Backups);
  nếu lộ key: rotate anon/service key trong Dashboard → API, đổi mật khẩu database trong Dashboard → Database → Settings
