-- ============================================================
-- 0001 — BẢO MẬT: quyền admin + rà siết RLS + audit phía server
-- Chạy lại được (idempotent). Rollback ở cuối file.
-- Nguyên tắc quyền:
--   • admin: KHÔNG còn gán theo email. Chỉ ai có dòng trong
--     public.app_admins (seed thủ công bởi chủ hệ thống) mới
--     được tặng vai trò admin khi tạo hồ sơ mới.
--   • notifications: chỉ người đã đăng nhập được chèn (giữ nguyên),
--     người nhận chỉ đọc được của mình.
--   • audit_logs: chỉ admin đọc; trigger server ghi, không ai sửa/xóa.
-- ============================================================

-- 1) Bảng admin seed thủ công (không chứa dữ liệu nhạy cảm)
create table if not exists public.app_admins (
  email text primary key,
  added_at timestamptz not null default now()
);
-- RLS: bảng này không phục vụ client → chặn hoàn toàn với client
alter table public.app_admins enable row level security;
-- (không tạo policy nào = không ai qua client đọc/ghi được)

-- 2) Trigger tạo hồ sơ: bỏ kiểm tra email admin cũ
create or replace function public.handle_new_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Chỉ tài khoản có email nằm trong app_admins (seed thủ công) được làm admin
  if exists (select 1 from public.app_admins a where lower(a.email) = lower(coalesce((select email from auth.users where id = new.id), ''))) then
    new.role := 'admin';
  else
    new.role := 'worker';
  end if;
  return new;
end $$;

-- 3) Audit phía server: đổi vai trò / duyệt hồ sơ / chốt trả lương đều được ghi
--    bằng trigger — client không thể bỏ qua hoặc làm sai lệch.
create or replace function public.audit_server_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  action text;
  detail text;
begin
  if TG_TABLE_NAME = 'profiles' then
    if new.role is distinct from old.role then
      action := 'server_role_change';
      detail := (select username from public.profiles where id = new.id) || ': ' || old.role || ' → ' || new.role;
    elsif new.kyc_status is distinct from old.kyc_status then
      action := 'server_kyc_' || new.kyc_status;
      detail := 'Hồ sơ ' || coalesce(new.full_name, new.username) || ' → ' || new.kyc_status;
    end if;
  elsif TG_TABLE_NAME = 'registrations' then
    if new.pay_status is distinct from old.pay_status then
      action := 'server_pay_' || coalesce(new.pay_status, 'reset');
      detail := 'Đăng ký ' || new.id || ' → ' || coalesce(new.pay_status, 'unpaid')
        || case when new.pay_fail_note is not null then ' (' || new.pay_fail_note || ')' else '' end;
    end if;
  end if;
  if action is not null then
    insert into public.audit_logs (actor_id, actor_name, action, detail)
    values (auth.uid(), coalesce((select full_name from public.profiles where id = auth.uid()), 'hệ thống'), action, detail);
  end if;
  return null;
end $$;

drop trigger if exists trg_audit_profiles on public.profiles;
create trigger trg_audit_profiles
  after update on public.profiles
  for each row execute function public.audit_server_change();

drop trigger if exists trg_audit_regs on public.registrations;
create trigger trg_audit_regs
  after update on public.registrations
  for each row execute function public.audit_server_change();

-- 4) Chỉnh cuối: giới hạn độ dài danh sách truy vấn lớn đã xử lý ở client (.limit)
--    và index phục vụ lọc hay dùng
create index if not exists idx_shifts_status on public.shifts (status, work_date);
create index if not exists idx_shifts_creator on public.shifts (created_by, work_date);
create index if not exists idx_regs_status on public.registrations (status);
create index if not exists idx_notif_user_time on public.notifications (user_id, created_at desc);

-- ============================================================
-- ROLLBACK (chạy nếu cần hoàn tác toàn bộ migration này):
--
-- drop trigger if exists trg_audit_regs on public.registrations;
-- drop trigger if exists trg_audit_profiles on public.profiles;
-- drop function if exists public.audit_server_change();
-- drop function if exists public.handle_new_profile(); -- tạo lại theo schema.sql nếu cần
-- drop index if exists idx_notif_user_time on public.notifications;
-- drop index if exists idx_regs_status on public.registrations;
-- drop index if exists idx_shifts_creator on public.shifts;
-- drop index if exists idx_shifts_status on public.shifts;
-- drop table if exists public.app_admins;
-- ============================================================
