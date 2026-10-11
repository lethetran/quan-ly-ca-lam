-- ============================================================
-- 0003 — LUẬT NGHIỆP VỤ PHÍA SERVER (không chỉ dựa vào giao diện)
--   1. Chuyển trạng thái ca: chỉ đúng vai trò mới chuyển được đúng bước.
--   2. Chốt đối soát xong (paying/paid): cấm sửa chấm công & tiền.
--   3. Cấm đăng ký trùng giờ (cùng ngày, giao thời gian) — kể cả ca qua đêm.
--   4. Cấm duyệt vượt số lượng ca (capacity) phía server.
--   5. Sửa thông tin ca: chỉ chủ tạo (trong khi chờ duyệt/đang tuyển) + admin.
-- Chạy lại được. Rollback ở cuối file.
-- ============================================================

-- Hàm phụ: độ dài ca tính bằng phút (ca qua đêm tự cộng 24h)
create or replace function public.shift_minutes(t1 time, t2 time) returns int
language sql immutable as $$
  select case
    when t2 > t1 then (extract(hour from t2)::int * 60 + extract(minute from t2)::int)
                     - (extract(hour from t1)::int * 60 + extract(minute from t1)::int)
    else 1440 - (extract(hour from t1)::int * 60 + extract(minute from t1)::int)
              + (extract(hour from t2)::int * 60 + extract(minute from t2)::int)
  end
$$;

-- 1) Luật chuyển trạng thái ca
create or replace function public.guard_shift_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare editor text; is_own boolean;
begin
  if auth.uid() is null then return new; end if; -- service key
  select role into editor from public.profiles where id = auth.uid();
  is_own := (old.created_by = auth.uid());

  if new.status = old.status then
    -- Sửa thông tin ca (không đổi trạng thái): chủ tạo / admin, và chỉ khi chưa diễn ra
    if editor in ('owner','admin') and is_own and old.status in ('pending_approval','recruiting') then
      return new;
    end if;
    raise exception 'Bạn không có quyền sửa ca này ở giai đoạn hiện tại';
  end if;

  -- Khi chuyển trạng thái: cấm sửa ngầm thông tin ca
  new.title := old.title; new.location := old.location;
  new.work_date := old.work_date; new.start_time := old.start_time; new.end_time := old.end_time;
  new.hours_override := old.hours_override; new.rate := old.rate; new.capacity := old.capacity;
  new.note := old.note; new.contact_name := old.contact_name; new.contact_phone := old.contact_phone;
  new.reg_deadline := old.reg_deadline;

  case new.status
    when 'recruiting' then
      if not (old.status = 'pending_approval' and editor in ('recruiter','admin')) then
        raise exception 'Chỉ bên tuyển dụng được duyệt ca từ trạng thái "Chờ duyệt"';
      end if;
    when 'rejected' then
      if not (old.status = 'pending_approval' and editor in ('recruiter','admin')) then
        raise exception 'Chỉ bên tuyển dụng được từ chối ca chờ duyệt';
      end if;
    when 'cancelled' then
      if not (editor = 'admin' or (editor = 'owner' and is_own)) or old.status not in ('pending_approval','recruiting') then
        raise exception 'Chỉ chủ tạo ca được hủy khi ca chưa diễn ra';
      end if;
    when 'reconciling' then
      if not (editor in ('recruiter','admin') and old.status in ('recruiting','ongoing','paying')) then
        raise exception 'Chỉ bên tuyển dụng được mở đối soát (hoặc mở lại từ "Đang thanh toán" để sửa)';
      end if;
    when 'paying' then
      if not (editor in ('recruiter','admin') and old.status = 'reconciling') then
        raise exception 'Chỉ bên tuyển dụng được chuyển "Đang đối soát" sang "Đang thanh toán"';
      end if;
    when 'paid' then
      if not (editor = 'admin' or (editor = 'owner' and is_own)) or old.status <> 'paying' then
        raise exception 'Chỉ chủ tạo ca được xác nhận thanh toán sau khi đối soát xong';
      end if;
    else
      raise exception 'Trạng thái ca không hợp lệ';
  end case;
  return new;
end $$;

drop trigger if exists trg_guard_shift on public.shifts;
create trigger trg_guard_shift before update on public.shifts
  for each row execute function public.guard_shift_status();

-- 2) Khóa đối soát + giới hạn chủ chỉ sửa trả lương (bổ sung guard có sẵn)
create or replace function public.guard_registration_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare editor text; shift_status text;
begin
  if auth.uid() is null then return new; end if;
  select role into editor from public.profiles where id = auth.uid();
  select status into shift_status from public.shifts where id = new.shift_id;

  -- Sau khi chốt (paying/paid): cấm sửa chấm công & tiền. Owner chỉ được sửa trả lương.
  if shift_status in ('paying','paid') then
    if editor = 'owner' then
      if not exists (select 1 from public.shifts s where s.id = new.shift_id and s.created_by = auth.uid()) then
        raise exception 'Bạn không có quyền với đăng ký này';
      end if;
      new.status := old.status; new.attendance := old.attendance; new.hours := old.hours;
      new.pay := old.pay; new.pay_note := old.pay_note; new.worker_note := old.worker_note;
      new.reviewed_by := old.reviewed_by; new.reconciled_by := old.reconciled_by; new.reconciled_at := old.reconciled_at;
      return new;
    end if;
    if editor in ('recruiter','admin') and new.shift_id = old.shift_id
       and new.attendance is not distinct from old.attendance
       and new.hours is not distinct from old.hours
       and new.pay is not distinct from old.pay
       and new.pay_note is not distinct from old.pay_note then
      return new; -- không đụng số liệu chấm công thì cho qua
    end if;
    raise exception 'Đối soát đã chốt — không thể sửa số liệu. Nếu cần, hãy mở lại ca sang "Đang đối soát".';
  end if;

  -- Người làm tự hủy đăng ký của mình (chỉ cột status)
  if editor = 'worker' then
    if new.shift_id is distinct from old.shift_id or new.worker_id is distinct from old.worker_id
       or new.attendance is distinct from old.attendance or new.hours is distinct from old.hours
       or new.pay is distinct from old.pay or new.pay_note is distinct from old.pay_note then
      raise exception 'Bạn chỉ được hủy đăng ký, không được sửa nội dung khác';
    end if;
    return new;
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_reg on public.registrations;
create trigger trg_guard_reg before update on public.registrations
  for each row execute function public.guard_registration_update();

-- 3) Cấm đăng ký trùng giờ + đủ người (áp cho đăng ký mới và khi được duyệt)
create or replace function public.guard_registration_rules() returns trigger
language plpgsql security definer set search_path = public as $$
declare s record;
begin
  select * into s from public.shifts where id = new.shift_id;
  if s.id is null then raise exception 'Ca không tồn tại'; end if;

  -- Đủ người: đếm đăng ký còn hiệu lực (pending + approved), không tính chính nó
  if TG_OP = 'INSERT' or new.status = 'approved' then
    if (select count(*) from public.registrations r
        where r.shift_id = new.shift_id and r.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000')
          and r.status in ('pending','approved')) >= s.capacity then
      raise exception 'Ca đã đủ % người — không thể thêm', s.capacity;
    end if;
  end if;

  -- Trùng giờ: đăng ký khác còn hiệu lực cùng ngày có thời gian giao nhau
  if TG_OP = 'INSERT' or (new.status = 'approved' and coalesce(old.status,'') <> 'approved') then
    if exists (
      select 1
      from public.registrations r
      join public.shifts s2 on s2.id = r.shift_id
      where r.worker_id = new.worker_id
        and r.shift_id <> new.shift_id
        and r.status in ('pending','approved')
        and s2.work_date = s.work_date
        and s2.start_time < (s.start_time + make_interval(mins => public.shift_minutes(s.start_time, s.end_time)))::time
        and s.start_time < (s2.start_time + make_interval(mins => public.shift_minutes(s2.start_time, s2.end_time)))::time
    ) then
      raise exception 'Bạn đã có ca khác trùng giờ trong ngày này — hãy hủy ca đó trước khi đăng ký';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_reg_rules on public.registrations;
create trigger trg_reg_rules before insert or update on public.registrations
  for each row execute function public.guard_registration_rules();

-- ============================================================
-- ROLLBACK:
--
-- drop trigger if exists trg_reg_rules on public.registrations;
-- drop trigger if exists trg_guard_reg on public.registrations; -- tạo lại theo schema.sql
-- drop trigger if exists trg_guard_shift on public.shifts;
-- drop function if exists public.guard_registration_rules();
-- drop function if exists public.guard_registration_update();
-- drop function if exists public.guard_shift_status();
-- drop function if exists public.shift_minutes(time, time);
-- ============================================================
