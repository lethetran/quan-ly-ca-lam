-- ============================================================
-- BẢO MẬT CSDL — gia đoạn 2: siết RLS theo vai trò
-- Chạy sau schema.sql. Nguyên tắc:
--   • Người làm: chỉ thấy hồ sơ/nhãn/đăng ký của CHÍNH MÌNH
--   • Chủ: chỉ thấy đăng ký thuộc ca do MÌNH tạo
--   • Tuyển dụng/Admin: thấy toàn bộ (phục vụ duyệt, đối soát)
--   • Ảnh CCCD: chỉ chủ nhân thư mục + Admin2/Admin đọc được
-- ============================================================

-- 1) Hồ sơ: chặn người lạ đọc CCCD, địa chỉ, số tài khoản của người khác
drop policy if exists p_profiles_select on public.profiles;
create policy p_profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.my_role() in ('recruiter','owner','admin2','admin'));

-- Hàm lấy danh sách tên người trong ca (cho người làm xem ca có ai,
-- không lộ CCCD/tài khoản). security definer vì cần đọc xuyên RLS.
create or replace function public.roster_for(p_shift uuid)
returns table (worker_id uuid, full_name text, reg_status text)
language sql stable security definer set search_path = public
as $$
  select r.worker_id, p.full_name, r.status
  from public.registrations r
  join public.profiles p on p.id = r.worker_id
  where r.shift_id = p_shift and r.status in ('pending','approved')
$$;
grant execute on function public.roster_for(uuid) to authenticated;

-- 2) Nhãn: người làm chỉ thấy nhãn của mình; nhóm vận hành thấy tất cả
drop policy if exists p_labels_select on public.labels;
create policy p_labels_select on public.labels
  for select to authenticated
  using (worker_id = auth.uid() or public.my_role() in ('recruiter','owner','admin'));

-- 3) Đăng ký ca: người làm chỉ thấy của mình;
--    chủ chỉ thấy đăng ký thuộc ca mình đã tạo
drop policy if exists p_regs_select on public.registrations;
create policy p_regs_select on public.registrations
  for select to authenticated
  using (
    worker_id = auth.uid()
    or public.my_role() in ('recruiter','admin')
    or (
      public.my_role() = 'owner'
      and exists (select 1 from public.shifts s
                  where s.id = shift_id and s.created_by = auth.uid())
    )
  );

-- 4) Storage: khoá đọc ảnh CCCD — chỉ chủ thư mục + Admin2/Admin
drop policy if exists p_storage_read on storage.objects;
create policy p_storage_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'hrfiles'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.my_role() in ('admin2','admin','recruiter','owner')
    )
  );

-- 5) Thông báo: chặn người lạ đọc vẫn giữ nguyên; chèn chỉ cần đăng nhập (bất kỳ vai trò
--    nào tạo ra thông báo trong lúc thao tác đều hợp lệ)
--    (không đổi — đã đúng từ schema.sql)

-- Xong phần CSDL. ======================================================
