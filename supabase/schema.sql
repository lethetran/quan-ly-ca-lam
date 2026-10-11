-- ============================================================
-- QUẢN LÝ CA LÀM — schema khởi tạo cho Supabase (PostgreSQL)
-- Chạy toàn bộ file này trong Supabase SQL Editor (hoặc qua script tự động)
-- ============================================================

-- 1) HỒ SƠ NGƯỜI DÙNG ---------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  role text not null default 'worker'
    check (role in ('worker','recruiter','owner','admin2','admin')),
  full_name text,
  cccd text,
  phone text,
  address text,
  bank_name text,
  bank_account text,
  cccd_front_path text,
  cccd_back_path text,
  kyc_status text not null default 'unsubmitted'
    check (kyc_status in ('unsubmitted','pending','approved','rejected')),
  kyc_note text,
  created_at timestamptz not null default now()
);

-- Vai trò của người đang đăng nhập (bypass RLS để tránh đệ quy)
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as
$$ select role from public.profiles where id = auth.uid() $$;

-- Tự ép vai trò khi tạo hồ sơ: admin@example.com là quản trị cao nhất,
-- mọi tài khoản khác mặc định là người đi làm (không tin client)
create or replace function public.handle_new_profile() returns trigger
language plpgsql security definer set search_path = public as $$
declare u_email text;
begin
  select lower(coalesce(email, '')) into u_email from auth.users where id = new.id;
  if u_email in ('admin@example.com', 'admin@nhanvien.local') then
    new.role := 'admin';
  else
    new.role := 'worker';
  end if;
  return new;
end $$;

drop trigger if exists trg_new_profile on public.profiles;
create trigger trg_new_profile
  before insert on public.profiles
  for each row execute function public.handle_new_profile();

-- Chặn tự ý đổi vai trò / trạng thái duyệt hồ sơ
create or replace function public.guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare editor text;
begin
  select role into editor from public.profiles where id = auth.uid();
  if auth.uid() is null then
    return new; -- service key (vận hành hệ thống)
  end if;
  if auth.uid() <> new.id then
    if editor not in ('admin', 'admin2') then
      raise exception 'Bạn không có quyền sửa hồ sơ người khác';
    end if;
    if editor = 'admin2' then
      new.role := old.role; -- Admin 2 chỉ được duyệt hồ sơ, không đổi vai trò
    end if;
    return new;
  end if;
  -- tự sửa chính mình: không được đổi vai trò
  if new.role is distinct from old.role then
    raise exception 'Không thể tự đổi vai trò — liên hệ quản trị viên';
  end if;
  -- tự sửa chính mình: chỉ được đẩy hồ sơ sang "chờ duyệt" khi nộp/nộp lại
  if new.kyc_status is distinct from old.kyc_status then
    if not (old.kyc_status in ('unsubmitted','rejected') and new.kyc_status = 'pending') then
      raise exception 'Không thể tự đổi trạng thái hồ sơ';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_profile on public.profiles;
create trigger trg_guard_profile
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- 2) CA LÀM --------------------------------------------------
create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  location text not null,
  contact_name text,
  contact_phone text,
  note text,
  work_date date not null,
  start_time time not null,
  end_time time not null,
  hours_override numeric(5,2),
  rate numeric(12,0) not null check (rate >= 0),
  capacity int not null check (capacity > 0),
  reg_deadline timestamptz,
  status text not null default 'pending_approval'
    check (status in ('pending_approval','recruiting','ongoing','reconciling','paying','paid','rejected','cancelled')),
  created_by uuid not null references auth.users(id) on delete cascade,
  approved_by uuid references auth.users(id),
  payment_note text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_shifts_date on public.shifts (work_date);

-- 3) ĐĂNG KÝ CA ---------------------------------------------
create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts(id) on delete cascade,
  worker_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','cancelled','removed')),
  attendance text
    check (attendance in ('full','half','absent_excused','absent_unexcused')),
  hours numeric(5,2),
  pay numeric(12,0),
  pay_note text,
  worker_note text,
  reviewed_by uuid references auth.users(id),
  reconciled_by uuid references auth.users(id),
  reconciled_at timestamptz,
  created_at timestamptz not null default now(),
  unique (shift_id, worker_id)
);
create index if not exists idx_regs_shift on public.registrations (shift_id);
create index if not exists idx_regs_worker on public.registrations (worker_id);

-- 4) NHÃN NGƯỜI LÀM -----------------------------------------
create table if not exists public.labels (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references auth.users(id) on delete cascade,
  shift_id uuid references public.shifts(id) on delete set null,
  code text not null,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_labels_worker on public.labels (worker_id);

-- 5) THÔNG BÁO ----------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text,
  title text not null,
  body text,
  shift_id uuid,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notif_user on public.notifications (user_id, read);

-- 6) NHẬT KÝ HỆ THỐNG ---------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_name text,
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);

-- 7) BẬT RLS + PHÂN QUYỀN -----------------------------------
alter table public.profiles      enable row level security;
alter table public.shifts        enable row level security;
alter table public.registrations enable row level security;
alter table public.labels        enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs    enable row level security;

-- profiles: mọi người đã đăng nhập đọc được (phục vụ duyệt/đối soát)
drop policy if exists p_profiles_select on public.profiles;
create policy p_profiles_select on public.profiles
  for select to authenticated using (true);
drop policy if exists p_profiles_insert on public.profiles;
create policy p_profiles_insert on public.profiles
  for insert to authenticated with check (id = auth.uid());
drop policy if exists p_profiles_update on public.profiles;
create policy p_profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.my_role() in ('admin','admin2'))
  with check (id = auth.uid() or public.my_role() in ('admin','admin2'));

-- shifts
drop policy if exists p_shifts_select on public.shifts;
create policy p_shifts_select on public.shifts
  for select to authenticated using (true);
drop policy if exists p_shifts_insert on public.shifts;
create policy p_shifts_insert on public.shifts
  for insert to authenticated
  with check (public.my_role() in ('owner','admin') and created_by = auth.uid());
drop policy if exists p_shifts_update on public.shifts;
create policy p_shifts_update on public.shifts
  for update to authenticated
  using (public.my_role() in ('recruiter','admin') or (public.my_role() in ('owner','admin') and created_by = auth.uid()))
  with check (public.my_role() in ('recruiter','admin') or (public.my_role() in ('owner','admin') and created_by = auth.uid()));
drop policy if exists p_shifts_delete on public.shifts;
create policy p_shifts_delete on public.shifts
  for delete to authenticated using (public.my_role() = 'admin');

-- registrations: người làm đăng ký/hủy ca của mình; tuyển dụng duyệt & chấm công
drop policy if exists p_regs_select on public.registrations;
create policy p_regs_select on public.registrations
  for select to authenticated using (true);
drop policy if exists p_regs_insert on public.registrations;
create policy p_regs_insert on public.registrations
  for insert to authenticated
  with check (worker_id = auth.uid() or public.my_role() in ('recruiter','admin'));
drop policy if exists p_regs_update on public.registrations;
create policy p_regs_update on public.registrations
  for update to authenticated
  using (worker_id = auth.uid() or public.my_role() in ('recruiter','admin'))
  with check (worker_id = auth.uid() or public.my_role() in ('recruiter','admin'));

-- labels
drop policy if exists p_labels_select on public.labels;
create policy p_labels_select on public.labels
  for select to authenticated using (true);
drop policy if exists p_labels_insert on public.labels;
create policy p_labels_insert on public.labels
  for insert to authenticated
  with check (public.my_role() in ('recruiter','owner','admin'));
drop policy if exists p_labels_delete on public.labels;
create policy p_labels_delete on public.labels
  for delete to authenticated
  using (created_by = auth.uid() or public.my_role() = 'admin');

-- notifications: chỉ chủ nhân đọc/sửa của mình
drop policy if exists p_notif_select on public.notifications;
create policy p_notif_select on public.notifications
  for select to authenticated using (user_id = auth.uid());
drop policy if exists p_notif_insert on public.notifications;
create policy p_notif_insert on public.notifications
  for insert to authenticated with check (true);
drop policy if exists p_notif_update on public.notifications;
create policy p_notif_update on public.notifications
  for update to authenticated using (user_id = auth.uid());

-- audit_logs: chỉ admin đọc
drop policy if exists p_audit_select on public.audit_logs;
create policy p_audit_select on public.audit_logs
  for select to authenticated using (public.my_role() = 'admin');
drop policy if exists p_audit_insert on public.audit_logs;
create policy p_audit_insert on public.audit_logs
  for insert to authenticated with check (true);

-- 8) STORAGE ẢNH CCCD (bucket riêng, riêng tư) ---------------
insert into storage.buckets (id, name, public)
values ('hrfiles', 'hrfiles', false)
on conflict (id) do nothing;

drop policy if exists p_storage_upload on storage.objects;
create policy p_storage_upload on storage.objects
  for insert to authenticated
  with check (bucket_id = 'hrfiles' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists p_storage_read on storage.objects;
create policy p_storage_read on storage.objects
  for select to authenticated
  using (bucket_id = 'hrfiles');

-- Xong. ======================================================
