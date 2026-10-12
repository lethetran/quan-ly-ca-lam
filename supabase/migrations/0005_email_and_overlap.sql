-- ============================================================
-- 0005 — EMAIL TRONG HỒ SƠ + ĐỒNG BỘ LUẬT TRÙNG GIỜ CA QUA ĐÊM
--   1. profiles.email: lưu email đăng nhập để hiển thị/phục vụ liên hệ
--   2. shifts_overlap_same_day: so trùng giờ trên PHẦN THUỘC CÙNG NGÀY —
--      đuôi ca qua đêm (00:00–02:00) thuộc hôm sau, không giao ca sáng
--      cùng ngày nữa (khớp với client). Thay cho phép tính cũ 0003.
-- Chạy lại được. Rollback ở cuối file.
-- ============================================================

alter table public.profiles add column if not exists email text;

-- Hàm so trùng chuẩn (cùng ngày): [start, end) — ca qua đêm lấy đến 24:00
create or replace function public.shifts_overlap_same_day(
  s1_start time, s1_end time, s2_start time, s2_end time
) returns boolean language sql immutable as $$
  select
    (date_part('hour', s1_start)::int * 60 + date_part('minute', s1_start)::int)
      < case when s2_end > s2_start
             then date_part('hour', s2_end)::int * 60 + date_part('minute', s2_end)::int
             else 1440 end
    and
    (date_part('hour', s2_start)::int * 60 + date_part('minute', s2_start)::int)
      < case when s1_end > s1_start
             then date_part('hour', s1_end)::int * 60 + date_part('minute', s1_end)::int
             else 1440 end
$$;

-- Gắn lại luật trùng giờ trong trigger đăng ký dùng hàm chuẩn
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

  -- Trùng giờ cùng ngày (đúng luật ca qua đêm)
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

-- ============================================================
-- ROLLBACK:
--
-- create or replace function public.guard_registration_rules() ... (theo 0003)
-- drop function if exists public.shifts_overlap_same_day(time, time, time, time);
-- alter table public.profiles drop column if exists email;
-- ============================================================
