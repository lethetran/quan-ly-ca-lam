# Quản Lý Ca Làm — hệ thống phân ca & đối soát 3 bên

Website quản lý nhân sự đi làm theo ca, 3 bên phối hợp:

| Vai trò | Làm gì |
|---|---|
| **Người đi làm** (worker) | Đăng ký ca trên lịch, theo dõi ca được duyệt, xem thống kê buổi/giờ/tiền, thấy nhãn tốt/xấu của mình |
| **Tuyển dụng** (recruiter) | Duyệt ca do chủ tạo, duyệt người (xem hồ sơ + thống kê + nhãn xấu từng người), đối soát công kiểu Excel, thống kê theo tháng |
| **Chủ / Công ty** (owner) | Tạo ca (kèm đơn giá/giờ), theo dõi số lượng, cập nhật thanh toán (kèm bảng STK ngân hàng) |
| **Admin 2** (admin2) | Duyệt hồ sơ CCCD — duyệt xong người làm mới được đăng ký ca |
| **Quản trị cao nhất** (admin) | Quản lý vai trò người dùng, nhật ký hệ thống. **admin@example.com** tự động là admin |

## Vòng đời ca làm

```
Chờ duyệt ca → Đang tuyển → Đang diễn ra → Đang đối soát → Đang thanh toán → Đã thanh toán
   (chủ tạo)    (tuyển dụng   (TỰ ĐỘNG      (tuyển dụng     (chủ cập nhật    (chủ xác nhận
                 duyệt)        theo giờ)     chấm công)      đã chuyển tiền)   kèm ghi chú)
```

Chấm công thực tế = **ký giấy tại nơi làm việc**; trên web, tuyển dụng tích kết quả
(Đủ ca / Nửa ca / Vắng có báo / Vắng không phép) trong bước đối soát, kèm cột
**số giờ · đơn giá · tiền thanh toán** tự tính.

## Công nghệ

- React 18 + TypeScript + Vite + Tailwind CSS
- Supabase: PostgreSQL (RLS phân quyền từng bảng), Auth (email/tên đăng nhập + mật khẩu), Storage (ảnh CCCD trong bucket riêng tư `hrfiles`)
- Người làm không có email vẫn đăng nhập được: nhập SĐT/tên bất kỳ → hệ thống ánh xạ `<tên>@nhanvien.local`

## Cấu trúc

```
supabase/schema.sql   — toàn bộ bảng + RLS + storage bucket + trigger admin
src/lib/              — supabase client, api, store (phiên + toast), types, utils
src/components/       — ui kit, lịch tháng, layout, chi tiết ca, thẻ hồ sơ người làm, chia sẻ Zalo
src/pages/            — Login, Worker (lịch/ca của tôi/thống kê), Recruiter (duyệt ca,
                        duyệt người, đối soát, dashboard), Owner (tạo ca, ca của công ty,
                        chi phí), Admin (duyệt CCCD, người dùng, nhật ký), Shared
```

## Chạy本地 / triển khai

```bash
cp .env.example .env   # điền VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm install
npm run dev            # http://localhost:5173
npm run build          # thư mục dist/ — deploy lên bất kỳ hosting tĩnh nào
```

`.db-password` chứa mật khẩu database project Supabase (đã sinh tự động) — giữ bí mật.

## Bảo mật đã cài

- RLS chặt: người lạ không đọc được thông báo của người khác; ai được phép sửa gì đều khai báo trong `supabase/schema.sql`
- Trigger chặn tự đổi vai trò / tự "duyệt" hồ sơ của chính mình
- Ảnh CCCD nằm trong bucket riêng tư, truy cập qua signed URL 1 giờ; Admin 2 mới là người xem để duyệt
- Nhật ký hệ thống (audit log) ghi mọi thao tác quan trọng để xử lý tranh chấp
