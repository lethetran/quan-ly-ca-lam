-- ============================================================
-- 0008 — ĐỔI LUẬT TRÙNG THÔNG TIN: bỏ chặn cứng → tự gắn nhãn
--   1. Gỡ chặn cứng trùng CCCD của 0007 (nộp hồ sơ không bị chặn nữa).
--   2. Khi nộp hồ sơ (kyc → 'pending'): nếu CCCD/SĐT/STK trùng với một
--      hồ sơ khác (chờ/đã duyệt) → TỰ ĐỘNG gắn nhãn 'dup_info' cho hồ sơ
--      đó (nhãn xấu, hiện với cả người làm + tuyển dụng + admin2).
--   3. Nộp lại mà không còn trùng → tự gỡ nhãn.
-- Chạy lại được. Rollback ở cuối file.
-- ============================================================

-- 1) gỡ chặn cứng của 0007
drop trigger if exists trg_guard_kyc on public.profiles;
drop function if exists public.guard_profile_kyc();
drop index if exists uq_profiles_cccd_active;

-- 2) tự gắn / gỡ nhãn 'dup_info' khi nộp hồ sơ
create or replace function public.flag_duplicate_profile() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  dup record;
  parts text[];
begin
  if new.kyc_status = 'pending' then
    select * into dup from public.profiles
    where id <> new.id
      and kyc_status in ('pending','approved')
      and ( (new.cccd is not null and cccd = new.cccd)
         or (new.phone is not null and phone = new.phone)
         or (new.bank_account is not null and bank_account = new.bank_account) )
    limit 1;

    if dup.id is not null then
      parts := array[]::text[];
      if new.cccd is not null and dup.cccd = new.cccd then parts := array_append(parts, 'CCCD'); end if;
      if new.phone is not null and dup.phone = new.phone then parts := array_append(parts, 'SĐT'); end if;
      if new.bank_account is not null and dup.bank_account = new.bank_account then parts := array_append(parts, 'STK'); end if;

      -- chỉ giữ 1 nhãn dup_info (cập nhật ghi chú mới nhất nếu nộp lại)
      if exists (select 1 from public.labels l where l.worker_id = new.id and l.code = 'dup_info') then
        update public.labels
        set note = 'Trùng ' || array_to_string(parts, ', ') || ' với ' || coalesce(dup.full_name, dup.username)
        where worker_id = new.id and code = 'dup_info';
      else
        insert into public.labels (worker_id, code, note, created_by)
        values (new.id, 'dup_info', 'Trùng ' || array_to_string(parts, ', ') || ' với ' || coalesce(dup.full_name, dup.username), null);
      end if;
    else
      -- không còn trùng → gỡ nhãn (nếu có)
      delete from public.labels where worker_id = new.id and code = 'dup_info';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_flag_dup on public.profiles;
create trigger trg_flag_dup after insert or update on public.profiles
  for each row execute function public.flag_duplicate_profile();

-- ============================================================
-- ROLLBACK:
--
-- drop trigger if exists trg_flag_dup on public.profiles;
-- drop function if exists public.flag_duplicate_profile();
-- delete from public.labels where code = 'dup_info';
-- (tái tạo guard 0007 nếu muốn chặn cứng trở lại)
-- ============================================================
