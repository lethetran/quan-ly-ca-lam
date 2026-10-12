# AUDIT — sổ theo dõi lỗi & thay đổi

> **Quy ước làm việc:** AI đọc file này ĐẦU MỖI LƯỢT để biết đã làm tới đâu. Mọi phát hiện mới
> và mọi sửa đổi đều ghi vào đây. Quy tắc: không xóa dữ liệu thật; không ghi mật khẩu/khóa vào
> log hay README; thay đổi SQL viết thành migration mới trong `supabase/migrations/` (chạy lại
> được + rollback); phải `npm run build` + `npm test` pass trước khi báo xong.
> Trạng thái: ✅ đã sửa · 🔄 đang làm · ⏳ chờ quyết định · 📌 backlog

---

## 1) ĐÃ SỬA

### Nghiêm trọng
| Mô tả | File | Cách tái hiện | Trạng thái |
|---|---|---|---|
| Kẻ lạ đăng ký đúng email admin → tự thành admin (trigger gán role theo email) | `supabase/schema.sql`, `supabase/migrations/0001`, `src/lib/util.ts`, `src/lib/api.ts` | Đăng ký tài khoản mới với email admin cũ | ✅ Quyền admin giờ qua bảng `app_admins` (seed thủ công, client không can thiệp); `ADMIN_EMAILS` đã xóa khỏi client |
| Mật khẩu admin + tài khoản mẫu nằm công khai trong README và lịch sử git | `README.md`, toàn bộ history | `git log -S "test1234"` (trước khi sửa) | ✅ README viết lại; `git filter-repo` làm sạch — kiểm chứng 0 kết quả; gh-pages đẩy lại bằng bản dựng mới |
| Recruiter không lưu được bảng đối soát (upsert thiếu cột NOT NULL, lỗi nuốt im lặng) | `src/lib/api.ts`, `src/pages/Recruiter.tsx`, `supabase/schema.sql` (policy INSERT) | Đối soát ca → Lưu → không có gì vào DB | ✅ Upsert gửi đủ cột; policy INSERT cho recruiter; luôn đọc lại DB để xác nhận |
| Modal chi tiết ca trộn đăng ký của ca khác (đếm nhầm người, hiểu nhầm "đã đăng ký") | `src/components/ShiftDetail.tsx` | Mở ca A sau khi đăng ký ca B → hiện "Đã đăng ký" sai | ✅ Lọc `regs` theo `shift_id` + roster qua RPC `roster_for` |
| Tiền ca đối soát bị đè theo công thức dù đã sửa tay | `src/pages/Recruiter.tsx` | Sửa tiền 250k → đổi giờ → tiền bị tính lại | ✅ Tiền là số độc lập; công thức chỉ là gợi ý khi tích chấm công |
| Đơn giá 0đ hợp lệ (check `>= 0`) | `supabase/migrations/0004_input_validation.sql` | Tạo ca rate 0 qua API | ✅ Siết `rate > 0`, blackbox xác nhận chặn |

### Vừa
| Mô tả | File | Cách tái hiện | Trạng thái |
|---|---|---|---|
| Nửa ca không tự tính lại giờ/tiền khi đổi chấm công | `src/pages/Recruiter.tsx` | Đổi "Đủ ca" → "Nửa ca" trong đối soát | ✅ Tự đặt giờ mặc định (nửa = 1/2, vắng = 0), vẫn sửa tay được |
| Giờ ca tính theo múi giờ thiết bị (người dùng ở múi giờ khác → ca lệch) | `src/lib/util.ts` | Đổi múi giờ máy rồi mở lịch | ✅ Cố định UTC+7 (`+07:00`), có unit test |
| Luật chuyển trạng thái ca chỉ nằm ở giao diện (bypass API được) | `supabase/migrations/0003_business_rules.sql` | Gọi PATCH đổi status tùy ý | ✅ Trigger kiểm tra đúng vai trò từng bước + cấm sửa ngầm thông tin ca khi chuyển trạng thái |
| Đăng ký trùng giờ giữa 2 ca vẫn được duyệt | `supabase/migrations/0003` | Đăng ký 2 ca giao thời gian cùng ngày | ✅ Trigger chặn (hỗ trợ ca qua đêm) |
| Duyệt vượt số lượng ca (capacity) | `supabase/migrations/0003` | Duyệt người thứ N+1 khi đủ chỗ | ✅ Trigger chặn phía server |
| Chốt đối soát xong vẫn sửa được chấm công/tiền | `supabase/migrations/0003`, `src/pages/Recruiter.tsx` | Sửa bảng sau khi ca ở "Đang thanh toán" | ✅ DB khóa số liệu; recruiter có nút "Mở lại đối soát" khi cần sửa |
| Ảnh CCCD: recruiter/owner đọc được (trái mô tả "chỉ Admin 2") | `supabase/migrations/0002_storage_lock.sql` | Signed URL ảnh người khác bằng JWT recruiter | ✅ Chỉ chủ thư mục + Admin2/Admin; giới hạn JPG/PNG/WebP ≤ 5MB (bucket + client) |
| Người làm không hủy được ca đã duyệt (chỉ hủy được khi chờ duyệt) | `src/components/ShiftDetail.tsx` | Ca được duyệt → mở chi tiết → không có nút hủy | ✅ Hủy được tới trước giờ bắt đầu; recruiter nhận thông báo |
| Thông báo lỗi đăng nhập lộ kỹ thuật + tiết lộ tài khoản tồn tại | `src/lib/util.ts` (`authErrorVi`), `src/lib/store.tsx` | Sai mật khẩu → thấy message tiếng Anh gốc | ✅ Chuẩn hóa tiếng Việt, không phân biệt "sai email" và "sai mật khẩu" |
| Mật khẩu client cho 6 ký tự, server đòi ≥8 (mâu thuẫn) | `src/pages/Login.tsx`, `src/pages/Shared.tsx`, `src/lib/util.ts` | Đăng ký `123456` | ✅ Chuẩn ≥8 ký tự có chữ + số, chặn 2 đầu, có test |
| Hồ sơ bị từ chối: người làm không thấy lý do, không biết nộp lại | `src/pages/Login.tsx` (Onboarding), `src/pages/ProfileForm.tsx` | Admin2 từ chối hồ sơ → đăng nhập lại | ✅ Bắt về trang onboarding, hiện lý do, nộp lại được |
| Trang Hồ sơ không có đường vào menu | `src/components/Layout.tsx` | Đăng nhập → nhìn sidebar | ✅ Mục "Hồ sơ & cài đặt" cho mọi vai trò + đổi mật khẩu |
| Thanh toán cả ca không ghi được trường hợp đặc biệt | `src/pages/Owner.tsx`, `supabase/migrations` (pay_status) | Ca có người không chuyển được | ✅ Tích/bỏ tích từng người + lý do bắt buộc + thông báo riêng + sửa lại sau chốt |

### Nhỏ
| Mô tả | File | Cách tái hiện | Trạng thái |
|---|---|---|---|
| Trang trắng trên GitHub Pages (asset path tuyệt đối) | `vite.config.ts` (`base: './'`) | Mở URL pages | ✅ |
| Bundle 520KB một khối | `vite.config.ts` (manualChunks) | Build | ✅ Tách 3 chunk, app ~130KB |
| Không có trang 404, lỗi render thành màn hình trắng | `src/App.tsx` (ErrorBoundary, NotFound) | Vào URL sai | ✅ |
| Bảng đối soát không dùng được trên điện thoại (cuộn ngang) | `src/pages/Recruiter.tsx` | Mở đối soát ở màn hình 390px | ✅ Chế độ thẻ cho mobile |
| `tsconfig.tsbuildinfo` bị commit; README lẫn chữ Hán ("本地") | `.gitignore`, `README.md` | `git ls-files` | ✅ |
| Truy vấn không giới hạn độ dài | `src/lib/api.ts` | DB lớn dần | ✅ `.limit(500)` + index (migration 0001) |
| Thẻ "Hồ sơ CCCD chờ duyệt" trên dashboard recruiter trỏ trang không có quyền (bấm = đá về dashboard) | `src/pages/Recruiter.tsx` | Đăng nhập recruiter → Bảng điều khiển → bấm thẻ KYC | ✅ Chỉ hiện với admin (FEATURES.md bước 1) |
| **Tạo tài khoản xong "đã đăng nhập" nhưng mọi nút chết, không bị bắt điền hồ sơ** (gốc rễ: 2 sự kiện phiên cùng gọi tạo hồ sơ → chèn trùng → profile null → vòng lặp Login/"Vào hệ thống" vô nghĩa) | `src/lib/api.ts` (ensureProfile), `src/lib/store.tsx`, `src/App.tsx`, `src/pages/Login.tsx` | Tạo tài khoản mới ngay sau deploy cũ | ✅ ensureProfile chống đua (gom 1 luồng + đọc lại khi trùng, chuẩn hóa username); Shell tách 3 trạng thái: chưa đăng nhập → Login, có phiên nhưng chưa có hồ sơ → màn hình khôi phục (tự thử lại + Thử lại + Đăng xuất, không còn nút chết); xóa thẻ "Vào hệ thống" chết trong Login. E2E: tạo tk mới → rơi thẳng trang "Hoàn thiện hồ sơ để bắt đầu" ✓; lam2 → menu "Hồ sơ & cài đặt" mở form sửa + Lưu thay đổi ✓ |

---

## 2) ĐANG LÀM

_Hiện không có việc dở dang._ (Ghi vào đây ngay khi bắt đầu việc nào chưa xong, kèm bước kế tiếp.)

---

## 3) BACKLOG

### Nghiêm trọng
| Mô tả | File | Cách tái hiện | Trạng thái |
|---|---|---|---|
| Tài khoản mẫu trên production dùng mật khẩu đã từng công khai trong lịch sử git (`test1234` — dù đã xóa khỏi history, kẻ bộ đôi có thể đã lưu) | Supabase Auth (ngoài repo) | Đăng nhập `lam1/test1234` trên vercel.app | ⏳ Chủ hệ thống đổi mật khẩu hoặc xóa tài khoản mẫu (mục 4) |

### Vừa
| Mô tả | File | Cách tái hiện | Trạng thái |
|---|---|---|---|
| Bất kỳ user đăng nhập nào cũng chèn được notification cho người khác (policy insert `with check (true)`) | `supabase/schema.sql` (`p_notif_insert`) | POST /rest/v1/notifications với user_id bất kỳ | 📌 Cần RPC/cloud function kiểm tra "người gửi có quyền trên ca này" |
| Duyệt ca/từ chối ca chỉ ghi audit từ client (malicious client bỏ qua được) — DB chỉ tự ghi đổi vai trò/KYC/trả lương | `supabase/migrations/0001` (audit trigger), `src/pages/Recruiter.tsx` | Duyệt ca bằng curl không có dòng audit | 📌 Thêm trigger audit cho `shifts.status` |
| Đăng ký không có xác nhận email → ai cũng chiếm được tên ngắn (`lam1`, SĐT…) trước người thật | Supabase Auth config; `src/lib/util.ts` (`toEmail`) | Đăng ký `lam1` trước người thật | ⏳ Cần quyết định: bật SMTP + email thật, hoặc SĐT + OTP |
| Rate-limit đăng nhập chỉ mức mặc định của Supabase, chưa thấy số cụ thể/loại bỏ trong UI | Supabase Auth | Spam đăng nhập sai | 📌 Bật Captcha nếu cần |
| Danh sách dài (500 ca) chưa có phân trang UI | `src/lib/api.ts` (LIST_LIMIT) | Tạo >500 ca | 📌 |

### Nhỏ
| Mô tả | File | Cách tái hiện | Trạng thái |
|---|---|---|---|
| ESLint chưa cài được (xung đột peer deps React 18/vitest) | `package.json` | `npm i -D eslint` | 📌 Thêm khi nâng cấp toolchain |
| Chưa đo Lighthouse (mục tiêu ≥90 Performance/Accessibility/Best Practices) | — | Chạy Lighthouse trên vercel.app | 📌 |
| File trang quá lớn chưa tách (`Recruiter.tsx` ~700 dòng, `Owner.tsx`, `Worker.tsx`) | `src/pages/` | — | 📌 Tách dần khi chạm tay vào |
| Thống kê chỉ gom theo tháng; chưa có gom theo tuần | `src/pages/Worker.tsx`, `Recruiter.tsx` | Chọn tuần trong thống kê | 📌 |
| Ca lặp lại định kỳ (nhân bản tuần) chưa có | `src/pages/Owner.tsx` | — | 📌 |
| Zalo chỉ là copy-paste nội dung (API Zalo không cho web post nhóm) | `src/components/ZaloShare.tsx` | Bấm chia sẻ | 📌 Giữ nguyên, đã ghi rõ trong UI |
| Ảnh CCCD chỉ có nén client; chưa quét virus/verify nội dung ảnh phía server | Storage bucket | — | 📌 Cân nhắc edge function |
| Thống kê owner tính tiền trên `registrations` của ca mình — admin xem hộ sẽ thấy trống phần "người có công" nếu ca không phải của mình (RLS đúng, UI chưa có chế độ admin-xem-hộ đầy đủ) | `src/pages/Owner.tsx`, `src/pages/Recruiter.tsx` | Đăng nhập admin vào "Chi phí & thống kê" | 📌 |

---

## 4) VIỆC CẦN CHỦ HỆ THỐNG LÀM THỦ CÔNG

| # | Việc | Cách làm | Trạng thái |
|---|---|---|---|
| 1 | **Seed quyền admin cho email thật** — không seed thì không có admin nào ngoài tài khoản cũ | SQL Editor: `INSERT INTO public.app_admins (email) VALUES ('email-thật-của-bạn');` rồi đăng ký lại (hoặc cập nhật role trực tiếp cho tài khoản đã có) | ⏳ Chưa làm |
| 2 | **Đổi mật khẩu admin** (mật khẩu cũ từng công khai trong git history) | App → Hồ sơ & cài đặt → Đổi mật khẩu (≥8 ký tự, chữ + số) | ⏳ Chưa xác nhận |
| 3 | **Xử lý tài khoản mẫu** (`lam1`, `lam2`, `chucong`, `tuyendung`, `admin2` — mật khẩu đã từng công khai) | Đổi mật khẩu từng tài khoản, hoặc xóa: Dashboard → Authentication → Delete user (cascade xóa hồ sơ/ca liên quan) | ⏳ Chưa làm |
| 4 | **Xóa dữ liệu demo** (2 ca mẫu + đăng ký) nếu muốn bắt đầu trắng | Dashboard → Table Editor → shifts (xóa 2 ca "Hỗ trợ…") | ⏳ Tùy |
| 5 | **Quyết định cơ chế đăng ký thật**: bật SMTP + xác nhận email, hoặc SĐT + OTP (xem Backlog Vừa) | Dashboard → Authentication → Providers/SMTP | ⏳ Chờ quyết định |
| 6 | **Mở khóa GitHub billing** nếu muốn GitHub Pages dự phòng tự deploy (Vercel KHÔNG bị ảnh hưởng — vẫn tự deploy theo push) | github.com → Settings → Billing | ⏳ |
| 7 | **Sao lưu + quy trình xoay khóa khi lộ** (tài liệu có trong README) | Dashboard → Database → Backups; rotate key ở Dashboard → API; đổi mật khẩu DB ở Database → Settings | ⏳ Lên lịch định kỳ |

---

_Lần cập nhật cuối: 2026-10-12 — phiên "kiểm thử blackbox/whitebox + AUDIT.md"._
