# FEATURES — kiểm kê, so sánh, lộ trình bổ sung chức năng

> Quy trình 5 bước (kiểm kê → so sánh → thiếu hụt → xếp hạng → xây dựng từng cái).
> Cập nhật file này sau MỖI tính năng. Trạng thái: ✅ đã làm · 🔜 chọn làm tiếp · 💰 chờ chủ hệ thống duyệt (đụng tiền/quyền/xóa dữ liệu/nhắn người dùng) · 📌 backlog.

Cơ sở so sánh (Bước 2): **hiểu biết chung về các hệ thống xếp ca thương mại** (Deputy, When I Work, Homebase, Sling, 7shifts, Connecteam) — *không tra cứu web trực tiếp trong phiên này*, chỉ đối chiếu mức chức năng, không sao chép giao diện. Đặc thù VN: đội nhân công thời vụ (hội chợ, sự kiện, kho xưởng) — worker dùng điện thoại giá rẻ, Zalo là kênh chính, chấm công ký giấy, trả lương chuyển khoản từng đợt.

---

## BƯỚC 1 — KIỂM KÊ HIỆN TRẠNG (đã đi từng màn hình, từng vai trò)

### Worker (người đi làm)
| Màn hình | Nút/chức năng hiện có | Hoạt động đúng? | Ghi chú |
|---|---|---|---|
| Lịch ca & đăng ký | Xem danh sách / Lịch tháng; bấm ca → chi tiết; Gửi đăng ký; Hủy đăng ký | ✅ | Chưa lọc/tìm theo địa điểm-ngày (dữ liệu nhiều sẽ khó); chưa đăng ký nhiều ca 1 lần |
| Chi tiết ca (modal) | Thông tin giờ/tiền/địa điểm; **Mở bản đồ ↗; Gọi SĐT** (mới); người trong ca | ✅ | Bản đồ là link Google Maps, không nhúng map (đủ dùng, nhẹ) |
| Ca của tôi | Lịch cá nhân; bảng chi tiết trạng thái chấm công + trả lương từng người | ✅ | Chưa xuất CSV lịch sử cá nhân |
| Thống kê của tôi | Chọn tháng; 6 ô số liệu; nhãn tốt/xấu; bảng ca trong tháng | ✅ | Chỉ gom theo tháng; chưa có cảnh báo "đã có ca trùng giờ khi đăng ký" ngoài toast DB |
| Thông báo | Danh sách + Đọc tất cả; badge số chưa đọc | ✅ | Chưa lọc loại thông báo |
| Hồ sơ & cài đặt | Nộp/sửa hồ sơ CCCD; Đổi mật khẩu | ✅ | Không có "xóa tài khoản"; không có "quên mật khẩu" tự phục vụ |
| Hướng dẫn | Trạng thái rỗng có hướng dẫn bước tiếp theo ở mọi trang rỗng | ✅ | — |

### Recruiter (tuyển dụng)
| Màn hình | Nút/chức năng hiện có | Hoạt động đúng? | Ghi chú |
|---|---|---|---|
| Bảng điều khiển | 4 thẻ hàng đợi + biểu đồ trạng thái theo tháng + top người tích cực + bảng ca | ✅ | ~~Thẻ "Hồ sơ CCCD chờ duyệt" đá về dashboard khi recruiter bấm~~ **ĐÃ SỬA** (chỉ hiện với admin) |
| Duyệt ca (từ chủ) | Duyệt / Từ chối; bảng tất cả ca | ✅ | Chưa lọc theo ngày/trạng thái |
| Duyệt người trong ca | Hồ sơ từng người (thống kê + nhãn + STK); Duyệt / Từ chối; Chia sẻ Zalo | ✅ | Chưa duyệt hàng loạt; ca đầy thì nút duyệt khóa nhưng **chưa có danh sách chờ (waitlist)** |
| Đối soát (danh sách + bảng) | Bắt đầu đối soát; Mở lại đối soát; bảng Excel đầy đủ + **chế độ thẻ mobile**; Xuất CSV; Lưu; Hoàn tất | ✅ | Chưa có chế độ in; chưa có ghi chú nội bộ riêng (pay_note dùng chung) |
| Hồ sơ người làm (modal) | 4 ô thống kê; nhãn gắn/gỡ kèm ghi chú; thông tin thanh toán | ✅ | Nhãn chưa có thời hạn; chưa lọc/tìm người khi ca đông |

### Owner (chủ/công ty)
| Màn hình | Nút/chức năng hiện có | Hoạt động đúng? | Ghi chú |
|---|---|---|---|
| Tạo ca làm | Form đầy đủ + tóm tắt tiền tự động | ✅ | Chưa có mẫu ca / ca lặp theo tuần |
| Ca của công ty | Hủy ca (kèm báo Zalo); Chia sẻ Zalo; Thanh toán cả ca / Trả lương từng người (bỏ tích + lý do); xem chi tiết | ✅ | Chưa tải chứng từ thanh toán (ảnh) |
| Chi phí & thống kê | Chọn tháng; 4 thẻ; bảng chi phí; Xuất Excel | ✅ | Chưa xem theo từng ca/người lồng nhau |
| — | — | — | Owner chưa có dashboard riêng (dùng my-shifts làm trang chủ) |

### Admin2 (duyệt hồ sơ)
| Màn hình | Nút/chức năng hiện có | Hoạt động đúng? | Ghi chú |
|---|---|---|---|
| Duyệt hồ sơ CCCD | Xem ảnh 2 mặt (signed URL); Duyệt / Từ chối (lý do 1 câu cố định); bảng đã xử lý | ✅ | Thiếu: bộ lọc hàng đợi, **lý do từ chối chọn sẵn**, **phóng to ảnh**, **kiểm tra CCCD trùng**, lịch sử hồ sơ |

### Admin (quản trị)
| Màn hình | Nút/chức năng hiện có | Hoạt động đúng? | Ghi chú |
|---|---|---|---|
| Quản lý người dùng | Tìm kiếm; đổi vai trò (dropdown); badge hồ sơ | ✅ | Chưa: khóa/mở tài khoản, đặt lại mật khẩu, phân trang |
| Nhật ký hệ thống | Bảng 200 dòng gần nhất (client + trigger server) | ✅ | Chưa tìm kiếm/lọc/xuất |
| — | — | — | Chưa có bảng thống kê toàn hệ thống, cài đặt chung |

### Chung
| Mục | Hiện trạng |
|---|---|
| Trung tâm thông báo + badge | ✅ có |
| Trạng thái rỗng có hướng dẫn | ✅ có ở mọi trang chính |
| Chia sẻ Zalo (copy nội dung) | ✅ hoạt động tốt cả mobile |
| Tìm kiếm toàn cục, phím tắt, chế độ tối, phân trang | ❌ chưa có |
| In bảng đối soát | ❌ chưa có (đã có xuất CSV) |

---

## BƯỚC 2 — SO SÁNH VỚI HỆ THỐNG THAM CHIẾU

| Chức năng | Hệ thống tham chiếu (Deputy/WIW/Homebase/Sling/7shifts/Connecteam) | Repo đã có? | Quan trọng với người dùng thật VN |
|---|---|---|---|
| Xếp ca theo lịch tháng + trạng thái | Có (cốt lõi) | ✅ Có | Cao |
| Đăng ký/ca trắng (open shift) + duyệt | Có | ✅ Có | Cao |
| Vòng đời ca nhiều giai đoạn (đối soát → thanh toán) | Một phần (chỉ scheduling + timesheet) | ✅ Có — **điểm khác biệt** | Cao (đúng bài toán 3 bên VN) |
| Chấm công GPS/time clock tại ca | Có (Homebase/Connecteam) | ❌ (ký giấy + tích sau) | Vừa (quy trình hiện tại ký giấy) |
| Điểm danh có giờ vào/ra | Có | ❌ | Vừa |
| Đổi ca giữa workers / ca whiteboard | Có (Sling/7shifts) | ❌ | Thấp (mô hình 3 bên không khuyến khích) |
| Tình trạng sẵn sàng (availability) của worker | Có | ❌ | Vừa |
| Nhắn tin trong app / hàng loạt | Có | ❌ (Zalo copy-paste + notification) | Vừa (Zalo là kênh thật) |
| Thông báo đẩy mobile app | Có | ❌ (web notification trong app) | Vừa |
| Bảng lương / xuất tính lương | Có | ✅ Xuất CSV đối soát + chi phí | Cao (đã có) |
| Chi phí lao động theo tháng | Có | ✅ Có | Cao |
| Onboarding giấy tờ (KYC) | Một phần (Connecteam) | ✅ Có — đúng đặc thù VN | Cao |
| Ca lặp lại / mẫu ca | Có | ❌ | Vừa-Cao (hội chợ lặp theo tuần) |
| Nhân bản ca | Có | ❌ | Vừa |
| Nhãn/đánh giá nhân sự | Có | ✅ Có (2 chiều hiển thị) | Cao |
| Waitlist khi ca đầy | Ít hệ thống có | ❌ | Vừa |

Kết luận: hệ thống đã phủ đúng lõi "xếp ca → duyệt → đối soát → thanh toán" của đội thời vụ VN. Khoảng trống lớn nhất so với sản phẩm thương mại: **ca lặp/mẫu ca, giờ vào-ra, thông báo đẩy** — trong đó chỉ "mẫu ca/nhân bản" là đáng làm ngay với công sức nhỏ.

---

## BƯỚC 3 — DANH SÁCH THIẾU THEO VAI TRÒ (theo checklist bắt buộc)

**Worker:** ❌ xóa tài khoản; ❌ quên mật khẩu tự phục vụ; ❌ khiếu nại số giờ/tiền; ❌ nhắc trước giờ làm; ❌ đăng ký nhiều ca một lúc; ⚠️ bản đồ/người liên hệ — **vừa bổ sung (bấm được)**; ✅ sửa hồ sơ; ✅ hủy đăng ký; ✅ lịch sử + thu nhập theo tháng; ✅ thông báo (duyệt/thanh toán/hủy); ✅ báo vắng (có loại "vắng có báo" ở đối soát + ghi chú); ✅ đổi mật khẩu.
**Recruiter:** ❌ lọc/tìm người trong ca; ❌ duyệt hàng loạt; ❌ waitlist; ⚠️ nhãn kèm lý do (có) nhưng ❌ thiếu thời hạn; ❌ nhắn tin hàng loạt; ❌ giờ vào/ra; ✅ xuất CSV đối soát; ❌ nhân bản ca; ❌ ghi chú nội bộ riêng.
**Owner:** ❌ ca lặp lại; ✅ sửa/hủy ca kèm thông báo (hủy có, sửa trong hạn + thông báo qua guard); ❌ mẫu ca; ⚠️ chi phí theo tháng/ca (có, ❌ theo người lồng nhau); ❌ tải chứng từ; ❌ đánh giá sau ca (đã có nhãn — coi như phần nào).
**Admin2:** ❌ bộ lọc hàng đợi; ❌ lý do từ chối chọn sẵn; ❌ phóng to ảnh; ❌ CCCD trùng; ❌ lịch sử hồ sơ.
**Admin:** ❌ khóa/mở tài khoản; ❌ đặt lại mật khẩu; ❌ lọc/xuất nhật ký; ❌ thống kê toàn hệ thống; ❌ cài đặt chung.
**Chung:** ❌ tìm kiếm toàn cục; ⚠️ trung tâm thông báo (có); ❌ phân trang; ✅ trạng thái rỗng; ❌ phím tắt; ❌ chế độ tối; ✅ Zalo mobile; ❌ in bảng đối soát.

---

## BƯỚC 4 — XẾP HẠNG & THỨ TỰ LÀM

Chấm: GT = giá trị người dùng (1–5) · CS = công sức (S/M/L) · RR = rủi ro (thấp/vừa/cao).

| # | Tính năng thiếu | GT | CS | RR | Nhóm quyết định | Chọn |
|---|---|---|---|---|---|---|
| 1 | Bản đồ + gọi người liên hệ trong chi tiết ca (worker) | 5 | S | Thấp | — | ✅ **LÀM LÚC NÀY** |
| 2 | Admin2: CCCD trùng + phóng to ảnh + lý do từ chối chọn sẵn | 4 | S | Thấp (admin2 vốn được xem CCCD) | — | 🔜 kế tiếp |
| 3 | Admin: lọc + xuất CSV nhật ký | 3 | S | Thấp | — | 🔜 |
| 4 | Owner: nhân bản ca / mẫu ca nhanh | 4 | M | Thấp | — | 🔜 |
| 5 | Worker: xuất CSV lịch sử cá nhân; in bảng đối soát | 3 | S | Thấp | — | 🔜 |
| 6 | Recruiter: duyệt hàng loạt trong ca | 4 | S | Thấp-vừa (guard capacity đã chặn ở DB) | — | 🔜 |
| 7 | Worker: khiếu nại giờ/tiền (form gửi recruiter) | 4 | M | Vừa (sinh thông báo cho người dùng) | 💰 hỏi trước | ⏳ |
| 8 | Recruiter: nhắn tin hàng loạt / waitlist tự thông báo | 3 | M | Vừa (gửi tin cho người dùng) | 💰 hỏi trước | ⏳ |
| 9 | Owner: tải chứng từ thanh toán (ảnh) vào ca | 3 | M | Vừa (lưu ảnh mới, quyền xem cần chốt) | 💰 hỏi trước | ⏳ |
| 10 | Admin: khóa/mở tài khoản + đặt lại mật khẩu | 4 | M | **Cao** (đụng quyền truy cập) | 💰 hỏi trước | ⏳ |
| 11 | Xóa tài khoản worker tự phục vụ | 2 | M | **Cao** (xóa dữ liệu) | 💰 hỏi trước | ⏳ |
| 12 | Bật email xác nhận / SĐT+OTP | 5 | L | Cao (đổi luồng đăng ký toàn bộ) | 💰 hỏi trước | ⏳ |
| 13 | Nhắc trước giờ làm (cron/edge function) | 4 | L | Vừa (gửi tin + hạ tầng chạy nền) | 💰 hỏi trước | ⏳ |

---

## BƯỚC 5 — NHẬT KÝ XÂY DỰNG

### ✅ Đã làm (phiên này)
**1. "Mở bản đồ + Gọi người liên hệ" trong chi tiết ca** — *ai dùng:* mọi vai trò (chủ yếu worker trên điện thoại). *Bấm ở đâu:* modal chi tiết ca → dòng "Địa điểm" có link **Mở bản đồ ↗** (Google Maps tìm theo địa chỉ), dòng "Người liên hệ" có **Gọi <SĐT>** (mở app gọi điện). *Kết quả:* worker tự tìm đường và gọi được khi đi lạc, không cần nhắn ai hỏi. *Lỗi xử lý:* không có địa điểm → không hiện link; không có SĐT → không hiện nút gọi (đã render có điều kiện).
Kèm **sửa lỗi thật:** thẻ "Hồ sơ CCCD chờ duyệt" trên dashboard recruiter trỏ tới trang không có quyền (bấm = đá về dashboard) — giờ chỉ hiện với admin (`src/pages/Recruiter.tsx`, `src/components/ShiftDetail.tsx`).
Kiểm chứng: build ✓ · 16/16 unit test ✓ · chụp màn hình mobile 390px xác nhận 2 nút hoạt động.

### ✅ Đã làm (phiên sau, theo yêu cầu chủ hệ thống)
**2. Chặn trùng giờ hiện rõ cho người làm + đồng bộ luật ở DB** — worker mở ca giao giờ với ca mình đã đăng ký → banner đỏ nêu đúng ca trùng (tên, ngày, giờ, địa điểm) + nút gửi bị tắt; DB trigger (0005) so trùng giờ chuẩn hóa ca qua đêm. Kiểm chứng: banner hiển thị với lam2 trên ca test trùng giờ; SQL suite PASS.
**3. Email trong hồ sơ** — Hồ sơ & cài đặt hiện "Email đăng nhập" (chỉ đọc); trang Quản lý người dùng (admin) có cột Email. Migration 0005 thêm cột `profiles.email`, tự lưu khi tạo hồ sơ.
**4. Xác thực email khi tạo tài khoản (chống tạo ồ ạt)** — server bật xác thực (autoconfirm=false); đăng ký bắt buộc **email thật** (chặn domain giả `.local`, có kiểm tra định dạng); sau đăng ký hiện màn hình "Kiểm tra email để xác thực"; đăng nhập trước khi bấm link bị chặn với thông báo tiếng Việt; link xác nhận đưa về đúng website (allow-list: vercel/pages/localhost). ⚠️ SMTP mặc định Supabase ~2 thư/giờ → **cần cấu hình SMTP riêng** (AUDIT.md mục 4.8). Đã kiểm chứng qua API: đăng ký không nhận session, đăng nhập trước xác thực bị chặn "Email not confirmed", domain giả bị từ chối phía server.
Kiểm chứng cả 3: build ✓ · 21/21 unit test ✓ · 2/2 SQL suite ✓ · blackbox API ✓.

### 🔜 Đề xuất làm ngay sau (theo bảng trên: 2 → 3 → 4 → 5 → 6)
Các mục 💰 (7–13) **chờ chủ hệ thống gật đầu** mới làm vì đụng tiền, quyền truy cập, xóa dữ liệu hoặc gửi thông báo cho người dùng.
