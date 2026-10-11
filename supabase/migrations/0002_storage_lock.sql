-- ============================================================
-- 0002 — STORAGE: ảnh CCCD chỉ chủ thư mục + Admin2/Admin đọc được
-- (thu hồi quyền recruiter/owner), giới hạn loại file và dung lượng.
-- Chạy lại được. Rollback ở cuối file.
-- ============================================================

-- 1) Giới hạn bucket: chỉ ảnh, tối đa 5 MB
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','image/webp']
where id = 'hrfiles';

-- 2) Chính sách đọc: chủ thư mục (người nộp) + Admin2/Admin duyệt hồ sơ.
--    Recruiter/owner KHÔNG còn xem được ảnh CCCD (đúng mô tả sản phẩm).
drop policy if exists p_storage_read on storage.objects;
create policy p_storage_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'hrfiles'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.my_role() in ('admin2','admin')
    )
  );

-- 3) Ghi: chỉ chủ thư mục được tải lên thư mục của chính mình (giữ nguyên, nêu rõ)
drop policy if exists p_storage_upload on storage.objects;
create policy p_storage_upload on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'hrfiles'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- ROLLBACK:
--
-- drop policy if exists p_storage_read on storage.objects;
-- create policy p_storage_read on storage.objects
--   for select to authenticated
--   using (bucket_id = 'hrfiles');
-- update storage.buckets set file_size_limit = null, allowed_mime_types = null where id = 'hrfiles';
-- ============================================================
