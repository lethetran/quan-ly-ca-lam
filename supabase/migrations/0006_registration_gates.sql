-- ============================================================
-- 0006 — ĐIỀU KIỆN TIÊN QUYẾT ĐĂNG KÝ CA (ép ở tầng server)
--   1. Chưa được Admin 2 duyệt hồ sơ → KHÔNG được đăng ký (và không được
--      duyệt vào ca), bất kể client gửi gì.
--   2. Worker KHÔNG THỂ tự duyệt: đăng ký mới luôn 'pending'; worker chỉ
--      được HỦY (chờ duyệt: thoải mái; đã duyệt: chỉ trước giờ bắt đầu).
--   3. Ca phải đang 'recruiting', chưa bắt đầu, chưa quá hạn đăng ký
--      (áp cho worker; giờ tính theo Asia/Ho_Chi_Minh).
--   4. Cấm đăng ký trùng trong cùng ca (thông báo thân thiện thay lỗi unique).
-- Chạy lại được. Rollback ở cuối file.
-- ============================================================

-- ---------- 1) Luật khi TẠO đăng ký / DUYỆT (kèm đủ người + trùng giờ) ----------
create or replace function public.guard_registration_rules() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  s record;
  worker_kyc text;
  editor text;
begin
  select * into s from public.shifts where id = new.shift_id;
  if s.id is null then raise exception 'Ca không tồn tại'; end if;

  select role into editor from public.profiles where id = auth.uid();
  select kyc_status into worker_kyc from public.profiles where id = new.worker_id;

  if TG_OP = 'INSERT' then
    -- trùng trong cùng ca (thông báo dễ hiểu thay lỗi unique khó đọc)
    if exists (select 1 from public.registrations r
               where r.shift_id = new.shift_id and r.worker_id = new.worker_id) then
      raise exception 'Bạn đã đăng ký ca này rồi — xem mục "Ca của tôi"';
    end if;

    -- ĐIỀU KIỆN TIÊN QUYẾT: hồ sơ phải đã được Admin 2 duyệt
    if worker_kyc is distinct from 'approved' then
      raise exception 'Hồ sơ chưa được Admin 2 duyệt — không thể đăng ký ca';
    end if;

    -- Worker: chỉ tự đăng ký cho mình, trạng thái chờ duyệt, ca phải còn tuyển và chưa qua giờ/hạn
    if editor = 'worker' then
      if new.worker_id <> auth.uid() then
        raise exception 'Chỉ được đăng ký cho chính mình';
      end if;
      if new.status <> 'pending' then
        raise exception 'Đăng ký mới phải ở trạng thái chờ duyệt';
      end if;
      if s.status <> 'recruiting' then
        raise exception 'Ca này không còn ở giai đoạn tuyển — không thể đăng ký';
      end if;
      if (s.work_date + s.start_time) <= (now() at time zone 'Asia/Ho_Chi_Minh') then
        raise exception 'Ca đã bắt đầu — không thể đăng ký';
      end if;
      if s.reg_deadline is not null and now() > s.reg_deadline then
        raise exception 'Đã quá hạn đăng ký của ca này';
      end if;
    end if;
  end if;

  -- Khi DUYỆT vào ca: hồ sơ người đó cũng phải đã được duyệt
  if TG_OP = 'UPDATE' and new.status = 'approved' and coalesce(old.status, '') <> 'approved' then
    if worker_kyc is distinct from 'approved' then
      raise exception 'Hồ sơ người này chưa được duyệt — không thể duyệt vào ca';
    end if;
  end if;

  -- Đủ người (pending + approved), không tính chính nó
  if TG_OP = 'INSERT' or new.status = 'approved' then
    if (select count(*) from public.registrations r
        where r.shift_id = new.shift_id and r.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000')
          and r.status in ('pending','approved')) >= s.capacity then
      raise exception 'Ca đã đủ % người — không thể thêm', s.capacity;
    end if;
  end if;

  -- Trùng giờ cùng ngày (đúng luật ca qua đêm — hàm chuẩn từ 0005)
  if TG_OP = 'INSERT' or (new.status = 'approved' and coalesce(old.status,'') <> 'approved') then
    if exists (
      select 1
      from public.registrations r
      join public.shifts s2 on s2.id = r.shift_id
      where r.worker_id = new.worker_id
        and r.shift_id <> new.shift_id
        and r.status in ('pending','approved')
        and s2.work_date = s.work_date
        and public.shifts_overlap_same_day(s.start_time, s.end_time, s2.start_time, s2.end_time)
    ) then
      raise exception 'Bạn đã có ca khác trùng giờ trong ngày này — hãy hủy ca đó trước khi đăng ký';
    end if;
  end if;
  return new;
end $$;

-- ---------- 2) Worker chỉ được HỦY, không tự duyệt ----------
create or replace function public.guard_registration_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  editor text;
  shift_status text;
  sd date;
  st time;
begin
  if auth.uid() is null then return new; end if;
  select role into editor from public.profiles where id = auth.uid();
  select status into shift_status from public.shifts where id = new.shift_id;

  -- Sau khi chốt (paying/paid): chỉ chủ sửa trả lương; recruiter không đụng số liệu
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
      return new;
    end if;
    raise exception 'Đối soát đã chốt — không thể sửa số liệu. Nếu cần, hãy mở lại ca sang "Đang đối soát".';
  end if;

  -- Worker: chỉ được HỦY đăng ký của chính mình (không tự duyệt, không sửa nội dung)
  if editor = 'worker' then
    if new.shift_id is distinct from old.shift_id or new.worker_id is distinct from old.worker_id
       or new.attendance is distinct from old.attendance or new.hours is distinct from old.hours
       or new.pay is distinct from old.pay or new.pay_note is distinct from old.pay_note then
      raise exception 'Bạn chỉ được hủy đăng ký, không được sửa nội dung khác';
    end if;
    if new.status is distinct from old.status then
      if old.status = 'pending' and new.status = 'cancelled' then
        null; -- hủy khi còn chờ duyệt: luôn được
      elsif old.status = 'approved' and new.status = 'cancelled' then
        select work_date, start_time into sd, st from public.shifts where id = new.shift_id;
        if (sd + st) <= (now() at time zone 'Asia/Ho_Chi_Minh') then
          raise exception 'Ca đã bắt đầu — không thể hủy. Liên hệ bên tuyển dụng để xử lý.';
        end if;
      else
        raise exception 'Bạn chỉ được hủy đăng ký — không thể tự duyệt hoặc đổi trạng thái khác';
      end if;
    end if;
    return new;
  end if;
  return new;
end $$;

-- ============================================================
-- ROLLBACK:
--
-- create or replace function public.guard_registration_update() ... (theo 0003)
-- create or replace function public.guard_registration_rules() ... (theo 0005)
-- ============================================================
