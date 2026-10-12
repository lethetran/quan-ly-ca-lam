-- ============================================================
-- 0007 — CHỐNG TRÙNG THÔNG TIN HỒ SƠ
--   1. CCCD là duy nhất: không thể có 2 hồ sơ đang chờ/đã duyệt cùng
--      một số CCCD (chặn ở trigger + unique index riêng một phần).
--   2. Thông báo lỗi thân thiện khi nộp trùng.
-- Chạy lại được. Rollback ở cuối file.
-- ============================================================

create or replace function public.guard_profile_kyc() returns trigger
language plpgsql security definer set search_path = public as $$
declare dup uuid;
begin
  -- chỉ kiểm khi hồ sơ ở trạng thái cần thẩm định / đã duyệt và có CCCD
  if new.kyc_status in ('pending','approved') and new.cccd is not null then
    select id into dup from public.profiles
    where id <> new.id
      and cccd = new.cccd
      and kyc_status in ('pending','approved')
    limit 1;
    if dup is not null then
      raise exception 'CCCD này đã được dùng bởi một tài khoản khác — không thể nộp trùng. Nếu nghi ngờ gian lận, báo quản trị viên.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_kyc on public.profiles;
create trigger trg_guard_kyc before insert or update on public.profiles
  for each row execute function public.guard_profile_kyc();

-- Rào cản cuối: 2 hồ sơ pending/approved không thể cùng CCCD
create unique index if not exists uq_profiles_cccd_active
  on public.profiles (cccd)
  where cccd is not null and kyc_status in ('pending','approved');

-- ============================================================
-- ROLLBACK:
--
-- drop trigger if exists trg_guard_kyc on public.profiles;
-- drop function if exists public.guard_profile_kyc();
-- drop index if exists uq_profiles_cccd_active;
-- ============================================================
