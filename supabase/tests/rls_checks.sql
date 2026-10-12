-- ============================================================
-- BỘ TEST RLS + LUẬT NGHIỆP VỤ (chạy trong Supabase SQL Editor hoặc qua API)
-- Mỗi khối DO mô phỏng một vai trò (set role + jwt claims) và RAISE EXCEPTION
-- khi thất bại. File tự dọn dữ liệu test (tiêu đề 'ZZTEST').
-- Cần: các uid mẫu ở phần CẤU HÌNH — thay bằng uid thật của môi trường bạn.
-- ============================================================

-- CẤU HÌNH UID (thay theo môi trường):
--   :worker1, :worker2, :owner1, :recruiter1

do $$
declare
  -- uid ĐỘNG: tự lấy worker đã duyệt hồ sơ (chống hỏng sau khi reset dữ liệu/tài khoản)
  worker1 uuid := (select id from public.profiles where role = 'worker' and kyc_status = 'approved' order by created_at asc limit 1);
  worker2 uuid := (select id from public.profiles where role = 'worker' and kyc_status = 'approved' order by created_at desc limit 1);
  owner1  uuid := (select id from public.profiles where role = 'owner' limit 1);
  recruiter1 uuid := (select id from public.profiles where role = 'recruiter' limit 1);
  s1 uuid; s2 uuid; reg uuid;
begin
  if worker1 is null or worker2 is null or worker1 = worker2 then
    raise notice 'Cần ít nhất 2 tài khoản worker đã duyệt hồ sơ để chạy test — bỏ qua';
    return;
  end if;
  -- dọn rác lần chạy cũ
  delete from public.shifts where title like 'ZZTEST%';

  -- ========== 1. WORKER CHỈ THẤY DỮ LIỆU CỦA MÌNH ==========
  perform set_config('role','authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', worker1, 'role','authenticated')::text, true);
  if (select count(*) from public.profiles) <> 1 then
    raise exception 'FAIL 1a: worker thấy % hồ sơ người khác', (select count(*) from public.profiles);
  end if;
  if exists (select 1 from public.registrations where worker_id <> worker1) then
    raise exception 'FAIL 1b: worker thấy đăng ký của người khác';
  end if;
  if exists (select 1 from public.labels where worker_id <> worker1) then
    raise exception 'FAIL 1c: worker thấy nhãn của người khác';
  end if;
  if exists (select 1 from storage.objects where bucket_id='hrfiles' and name like worker2::text || '/%') then
    raise exception 'FAIL 1d: worker thấy ảnh CCCD của người khác (SQL)';
  end if;
  perform set_config('role','postgres', true);
  perform set_config('request.jwt.claims', '', true);

  -- ========== 2. OWNER CHỈ THẤY ĐĂNG KÝ THUỘC CA CỦA MÌNH ==========
  perform set_config('role','authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', owner1, 'role','authenticated')::text, true);
  if exists (
    select 1 from public.registrations r join public.shifts s on s.id = r.shift_id
    where s.created_by <> owner1
  ) then
    raise exception 'FAIL 2: owner thấy đăng ký của ca người khác';
  end if;
  perform set_config('role','postgres', true);
  perform set_config('request.jwt.claims', '', true);

  -- ========== 3. KHÔNG AI TỰ ĐỔI VAI TRÒ / TỰ DUYỆT HỒ SƠ ==========
  perform set_config('role','authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', worker1, 'role','authenticated')::text, true);
  begin
    update public.profiles set role = 'admin' where id = worker1;
    raise exception 'FAIL 3a: worker TỰ ĐỔI vai trò thành công';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if; -- lỗi mong muốn
  end;
  -- đặt hồ sơ về "chưa nộp" rồi thử TỰ DUYỆT từ đó (đúng kịch bản leo thang)
  perform set_config('role','postgres', true);
  perform set_config('request.jwt.claims', '', true);
  update public.profiles set kyc_status = 'unsubmitted' where id = worker1;
  perform set_config('role','authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', worker1, 'role','authenticated')::text, true);
  begin
    update public.profiles set kyc_status = 'approved' where id = worker1;
    raise exception 'FAIL 3b: worker TỰ DUYỆT hồ sơ thành công';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  perform set_config('role','postgres', true);
  perform set_config('request.jwt.claims', '', true);
  update public.profiles set kyc_status = 'approved' where id = worker1; -- phục hồi

  -- ========== 4. WORKER KHÔNG TẠO CA / GẮN NHÃN ==========
  perform set_config('role','authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', worker1, 'role','authenticated')::text, true);
  begin
    insert into public.shifts (title, location, work_date, start_time, end_time, rate, capacity, created_by)
    values ('ZZTEST worker tạo ca', 'Hà Nội', current_date, '08:00', '12:00', 1000, 1, worker1);
    raise exception 'FAIL 4a: worker tạo được ca';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  begin
    insert into public.labels (worker_id, code, created_by) values (worker2, 'late', worker1);
    raise exception 'FAIL 4b: worker gắn nhãn cho người khác';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  perform set_config('role','postgres', true);
  perform set_config('request.jwt.claims', '', true);

  -- ========== 5. LUỒNG TRẠNG THÁI CA DO SERVER KIỂM SOÁT ==========
  -- chủ tạo ca (như client owner làm)
  perform set_config('role','authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', owner1, 'role','authenticated')::text, true);
  insert into public.shifts (title, location, work_date, start_time, end_time, rate, capacity, created_by, status)
  values ('ZZTEST luong trang thai', 'Hà Nội', current_date + 7, '08:00', '12:00', 10000, 5, owner1, 'pending_approval')
  returning id into s1;
  perform set_config('role','postgres', true);
  perform set_config('request.jwt.claims', '', true);

  -- worker cố tự duyệt ca → RLS lọc dòng (0 dòng khớp) hoặc trigger chặn → trạng thái phải giữ nguyên
  perform set_config('role','authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', worker1, 'role','authenticated')::text, true);
  update public.shifts set status = 'recruiting' where id = s1;
  if exists (select 1 from public.shifts where id = s1 and status <> 'pending_approval') then
    raise exception 'FAIL 5a: worker duyệt được ca';
  end if;
  perform set_config('role','postgres', true);
  perform set_config('request.jwt.claims', '', true);

  -- recruiter duyệt → recruiting; owner cố chốt thanh toán sớm → chặn
  perform set_config('role','authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', recruiter1, 'role','authenticated')::text, true);
  update public.shifts set status = 'recruiting', approved_by = recruiter1 where id = s1;
  begin
    update public.shifts set status = 'paid' where id = s1;
    raise exception 'FAIL 5b: nhảy cóc sang paid';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  update public.shifts set status = 'reconciling' where id = s1;
  update public.shifts set status = 'paying' where id = s1;
  -- recruiter cố tự xác nhận đã thanh toán → chặn
  begin
    update public.shifts set status = 'paid' where id = s1;
    raise exception 'FAIL 5c: recruiter tự xác nhận thanh toán';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  -- recruiter mở lại đối soát để sửa (đúng luật) rồi chốt trả lại paying
  update public.shifts set status = 'reconciling' where id = s1;
  update public.shifts set status = 'paying' where id = s1;
  perform set_config('role','postgres', true);
  perform set_config('request.jwt.claims', '', true);

  -- owner xác nhận thanh toán → OK (ca của mình)
  perform set_config('role','authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', owner1, 'role','authenticated')::text, true);
  update public.shifts set status = 'paid' where id = s1;
  -- sau chốt: recruiter không sửa được chấm công
  perform set_config('role','postgres', true);
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role','authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', recruiter1, 'role','authenticated')::text, true);
  insert into public.registrations (shift_id, worker_id, status, attendance, hours, pay)
  values (s1, worker1, 'approved', 'full', 4, 40000) returning id into reg;
  begin
    update public.registrations set hours = 1 where id = reg;
    raise exception 'FAIL 5d: sửa chấm công sau khi chốt';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  perform set_config('role','postgres', true);
  perform set_config('request.jwt.claims', '', true);

  -- ========== 6. CẤM TRÙNG GIỜ ==========
  perform set_config('role','authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', owner1, 'role','authenticated')::text, true);
  insert into public.shifts (title, location, work_date, start_time, end_time, rate, capacity, created_by, status)
  values ('ZZTEST trung gio', 'Hà Nội', current_date + 8, '09:00', '11:00', 10000, 5, owner1, 'recruiting')
  returning id into s2;
  perform set_config('role','postgres', true);
  perform set_config('request.jwt.claims', '', true);
  -- worker1 tự đăng ký (pending — 0006 cấm worker tự chèn approved); s2 là ngày khác với s1 → hợp lệ
  perform set_config('role','authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', worker1, 'role','authenticated')::text, true);
  insert into public.registrations (shift_id, worker_id, status) values (s2, worker1, 'pending');
  -- tạo ca trùng giờ với s2 → đăng ký thêm phải bị chặn
  perform set_config('role','postgres', true);
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role','authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', owner1, 'role','authenticated')::text, true);
  insert into public.shifts (title, location, work_date, start_time, end_time, rate, capacity, created_by, status)
  values ('ZZTEST trung gio 2', 'Hà Nội', current_date + 8, '10:00', '12:00', 10000, 5, owner1, 'recruiting')
  returning id into s1;
  perform set_config('role','postgres', true);
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role','authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', worker1, 'role','authenticated')::text, true);
  begin
    insert into public.registrations (shift_id, worker_id, status) values (s1, worker1, 'pending');
    raise exception 'FAIL 6: đăng ký trùng giờ vẫn được qua';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  perform set_config('role','postgres', true);
  perform set_config('request.jwt.claims', '', true);

  -- ========== 7. CẤM DUYỆT VƯỢT SỐ LƯỢNG ==========
  perform set_config('role','authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', owner1, 'role','authenticated')::text, true);
  insert into public.shifts (title, location, work_date, start_time, end_time, rate, capacity, created_by, status)
  values ('ZZTEST du nguoi', 'Hà Nội', current_date + 9, '08:00', '09:00', 10000, 1, owner1, 'recruiting')
  returning id into s2;
  perform set_config('role','postgres', true);
  perform set_config('request.jwt.claims', '', true);
  insert into public.registrations (shift_id, worker_id, status) values (s2, worker1, 'approved');
  begin
    insert into public.registrations (shift_id, worker_id, status) values (s2, worker2, 'approved');
    raise exception 'FAIL 7: vượt số lượng vẫn được duyệt';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;

  -- ========== 8. ĐIỀU KIỆN TIÊN QUYẾT ĐĂNG KÝ (migration 0006) ==========
  -- 8a. worker hồ sơ CHƯA DUYỆT → không đăng ký được (ca mới, chưa đăng ký)
  perform set_config('role','authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', owner1, 'role','authenticated')::text, true);
  insert into public.shifts (title, location, work_date, start_time, end_time, rate, capacity, created_by, status)
  values ('ZZTEST kyc chua duyet', 'Hà Nội', current_date + 12, '08:00', '09:00', 10000, 5, owner1, 'recruiting')
  returning id into s1;
  perform set_config('role','postgres', true);
  perform set_config('request.jwt.claims', '', true);
  update public.profiles set kyc_status = 'unsubmitted' where id = worker1;
  perform set_config('role','authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', worker1, 'role','authenticated')::text, true);
  begin
    insert into public.registrations (shift_id, worker_id, status) values (s1, worker1, 'pending');
    raise exception 'FAIL 8a: hồ sơ chưa duyệt vẫn đăng ký được';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  perform set_config('role','postgres', true);
  perform set_config('request.jwt.claims', '', true);
  update public.profiles set kyc_status = 'approved' where id = worker1;

  -- 8b. worker KHÔNG TỰ DUYỆT (pending → approved bị chặn); hủy pending thì được
  perform set_config('role','authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', worker1, 'role','authenticated')::text, true);
  insert into public.registrations (shift_id, worker_id, status) values (s1, worker1, 'pending');
  begin
    update public.registrations set status = 'approved' where shift_id = s1 and worker_id = worker1;
    raise exception 'FAIL 8b: worker TỰ DUYỆT đăng ký thành công';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  update public.registrations set status = 'cancelled' where shift_id = s1 and worker_id = worker1;
  perform set_config('role','postgres', true);
  perform set_config('request.jwt.claims', '', true);

  -- 8c. worker tự chèn đăng ký trạng thái approved → bị chặn
  perform set_config('role','authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', worker1, 'role','authenticated')::text, true);
  begin
    insert into public.registrations (shift_id, worker_id, status) values (s1, worker1, 'approved');
    raise exception 'FAIL 8c: worker tự chèn đăng ký approved';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  perform set_config('role','postgres', true);
  perform set_config('request.jwt.claims', '', true);

  -- 8d. đăng ký ca KHÔNG còn tuyển → bị chặn (worker)
  perform set_config('role','authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', owner1, 'role','authenticated')::text, true);
  insert into public.shifts (title, location, work_date, start_time, end_time, rate, capacity, created_by, status)
  values ('ZZTEST khong tuyen', 'Hà Nội', current_date + 10, '08:00', '09:00', 10000, 5, owner1, 'ongoing')
  returning id into s1;
  perform set_config('role','postgres', true);
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role','authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', worker1, 'role','authenticated')::text, true);
  begin
    insert into public.registrations (shift_id, worker_id, status) values (s1, worker1, 'pending');
    raise exception 'FAIL 8d: đăng ký ca không còn tuyển vẫn được';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  perform set_config('role','postgres', true);
  perform set_config('request.jwt.claims', '', true);

  -- 8e. hủy ca ĐÃ BẮT ĐẦU (đã duyệt) → bị chặn
  perform set_config('role','authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', owner1, 'role','authenticated')::text, true);
  insert into public.shifts (title, location, work_date, start_time, end_time, rate, capacity, created_by, status)
  values ('ZZTEST da bat dau', 'Hà Nội', current_date - 1, '08:00', '09:00', 10000, 5, owner1, 'recruiting')
  returning id into s1;
  perform set_config('role','postgres', true);
  perform set_config('request.jwt.claims', '', true);
  insert into public.registrations (shift_id, worker_id, status) values (s1, worker1, 'approved');
  perform set_config('role','authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', worker1, 'role','authenticated')::text, true);
  begin
    update public.registrations set status = 'cancelled' where shift_id = s1 and worker_id = worker1;
    raise exception 'FAIL 8e: hủy ca đã bắt đầu vẫn được';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  perform set_config('role','postgres', true);
  perform set_config('request.jwt.claims', '', true);

  -- ========== DỌN DẸP ==========
  delete from public.registrations where shift_id in (select id from public.shifts where title like 'ZZTEST%');
  delete from public.shifts where title like 'ZZTEST%';
  raise notice 'TẤT CẢ TEST ĐẠT ✅';
end $$;

select 'RLS + BUSINESS RULES: ALL PASS ✅' as result;
