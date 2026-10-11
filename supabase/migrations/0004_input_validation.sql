-- ============================================================
-- 0004 — CHẶN GIÁ TRỊ SAI/ÂM Ở TẦNG DATABASE (chốt chặn cuối cùng)
-- Mọi con số không được âm; định dạng CCCD/SĐT/STK chuẩn; độ dài hợp lý.
-- Chạy lại được (drop constraint if exists trước khi thêm).
-- Rollback ở cuối file.
-- ============================================================

-- ===== CA LÀM =====
alter table public.shifts drop constraint if exists shifts_title_len;
alter table public.shifts add constraint shifts_title_len check (length(btrim(title)) between 2 and 120);
alter table public.shifts drop constraint if exists shifts_location_len;
alter table public.shifts add constraint shifts_location_len check (length(btrim(location)) between 2 and 200);
alter table public.shifts drop constraint if exists shifts_rate_cap;
alter table public.shifts add constraint shifts_rate_cap check (rate <= 100000000); -- đơn giá tối đa 100trđ/giờ
-- siết từ >= 0 (schema gốc) thành > 0: ca 0 đồng vô nghĩa
alter table public.shifts drop constraint if exists shifts_rate_check;
alter table public.shifts add constraint shifts_rate_positive check (rate > 0);
alter table public.shifts drop constraint if exists shifts_capacity_cap;
alter table public.shifts add constraint shifts_capacity_cap check (capacity <= 1000);
alter table public.shifts drop constraint if exists shifts_hours_override_ok;
alter table public.shifts add constraint shifts_hours_override_ok
  check (hours_override is null or hours_override between 0.25 and 24);
alter table public.shifts drop constraint if exists shifts_date_sane;
alter table public.shifts add constraint shifts_date_sane
  check (work_date between date '2020-01-01' and date '2040-12-31');
alter table public.shifts drop constraint if exists shifts_note_len;
alter table public.shifts add constraint shifts_note_len check (note is null or length(note) <= 500);

-- ===== ĐĂNG KÝ CA =====
alter table public.registrations drop constraint if exists regs_hours_nonneg;
alter table public.registrations add constraint regs_hours_nonneg check (hours is null or hours >= 0);
alter table public.registrations drop constraint if exists regs_pay_nonneg;
alter table public.registrations add constraint regs_pay_nonneg check (pay is null or pay >= 0);
alter table public.registrations drop constraint if exists regs_paynote_len;
alter table public.registrations add constraint regs_paynote_len
  check (pay_note is null or length(pay_note) <= 300);
alter table public.registrations drop constraint if exists regs_workernote_len;
alter table public.registrations add constraint regs_workernote_len
  check (worker_note is null or length(worker_note) <= 300);

-- ===== HỒ SƠ =====
alter table public.profiles drop constraint if exists prof_cccd_fmt;
alter table public.profiles add constraint prof_cccd_fmt
  check (cccd is null or cccd ~ '^[0-9]{9,12}$');
alter table public.profiles drop constraint if exists prof_phone_fmt;
alter table public.profiles add constraint prof_phone_fmt
  check (phone is null or phone ~ '^[0-9]{9,11}$');
alter table public.profiles drop constraint if exists prof_bank_fmt;
alter table public.profiles add constraint prof_bank_fmt
  check (bank_account is null or bank_account ~ '^[0-9]{6,19}$');
alter table public.profiles drop constraint if exists prof_name_len;
alter table public.profiles add constraint prof_name_len
  check (full_name is null or length(btrim(full_name)) between 2 and 100);
alter table public.profiles drop constraint if exists prof_address_len;
alter table public.profiles add constraint prof_address_len
  check (address is null or length(btrim(address)) <= 200);
alter table public.profiles drop constraint if exists prof_username_fmt;
alter table public.profiles add constraint prof_username_fmt
  check (username ~ '^[a-z0-9._]{3,24}$');

-- ============================================================
-- ROLLBACK:
--
-- alter table public.profiles drop constraint if exists prof_username_fmt;
-- alter table public.profiles drop constraint if exists prof_address_len;
-- alter table public.profiles drop constraint if exists prof_name_len;
-- alter table public.profiles drop constraint if exists prof_bank_fmt;
-- alter table public.profiles drop constraint if exists prof_phone_fmt;
-- alter table public.profiles drop constraint if exists prof_cccd_fmt;
-- alter table public.registrations drop constraint if exists regs_workernote_len;
-- alter table public.registrations drop constraint if exists regs_paynote_len;
-- alter table public.registrations drop constraint if exists regs_pay_nonneg;
-- alter table public.registrations drop constraint if exists regs_hours_nonneg;
-- alter table public.shifts drop constraint if exists shifts_note_len;
-- alter table public.shifts drop constraint if exists shifts_date_sane;
-- alter table public.shifts drop constraint if exists shifts_hours_override_ok;
-- alter table public.shifts drop constraint if exists shifts_capacity_cap;
-- alter table public.shifts drop constraint if exists shifts_rate_cap;
-- alter table public.shifts drop constraint if exists shifts_location_len;
-- alter table public.shifts drop constraint if exists shifts_title_len;
-- alter table public.shifts add constraint shifts_rate_check check (rate >= 0); -- trả lại ràng buộc cũ khi rollback
-- ============================================================
