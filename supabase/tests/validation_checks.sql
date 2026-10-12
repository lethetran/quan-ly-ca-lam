-- ============================================================
-- BỘ TEST CHẶN GIÁ TRỊ SAI/ÂM (migration 0004)
-- Mỗi khối thử chèn/cập nhật giá trị rác — BẮT BUỘC bị từ chối.
-- Thay uid mẫu đầu file cho môi trường của bạn.
-- ============================================================

do $$
declare
  owner1 uuid := (select id from public.profiles where role = 'owner' limit 1);
  -- uid ĐỘNG: tự lấy worker đã duyệt hồ sơ (chống hỏng sau khi reset dữ liệu/tài khoản)
  worker1 uuid := (select id from public.profiles where role = 'worker' and kyc_status = 'approved' order by created_at asc limit 1);
  worker2 uuid := (select id from public.profiles where role = 'worker' and kyc_status = 'approved' order by created_at desc limit 1);
  s uuid;
  expect_fail text;
begin
  if worker1 is null or worker2 is null or worker1 = worker2 then
    raise notice 'Cần ít nhất 2 tài khoản worker đã duyệt hồ sơ để chạy test — bỏ qua';
    return;
  end if;
  -- cho worker2 một CCCD test để kịch bản trùng CCCD có gì đó để trùng
  update public.profiles set cccd = '079300002002' where id = worker2;
  -- dọn rác lần chạy cũ
  delete from public.shifts where title like 'ZZVAL%';

  -- trợ giúp: chạy 1 lệnh và bắt lỗi
  -- (mỗi ca thử đều dùng begin/exception bên dưới)

  -- 1. đơn giá âm / 0 / quá trần
  perform set_config('role','authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', owner1, 'role','authenticated')::text, true);
  foreach expect_fail in array array['âm: rate -1000', 'không: rate 0', 'trần: rate 200000000'] loop
    begin
      if expect_fail like 'âm%' then
        insert into public.shifts (title, location, work_date, start_time, end_time, rate, capacity, created_by, status)
        values ('ZZVAL', 'Hà Nội', current_date + 30, '08:00', '12:00', -1000, 5, owner1, 'recruiting');
      elsif expect_fail like 'không%' then
        insert into public.shifts (title, location, work_date, start_time, end_time, rate, capacity, created_by, status)
        values ('ZZVAL', 'Hà Nội', current_date + 30, '08:00', '12:00', 0, 5, owner1, 'recruiting');
      else
        insert into public.shifts (title, location, work_date, start_time, end_time, rate, capacity, created_by, status)
        values ('ZZVAL', 'Hà Nội', current_date + 30, '08:00', '12:00', 200000000, 5, owner1, 'recruiting');
      end if;
      raise exception 'FAIL: đơn giá % vẫn chèn được', expect_fail;
    exception when others then
      if sqlerrm like 'FAIL%' then raise; end if;
    end;
  end loop;

  -- 2. số lượng 0/âm/quá trần — dùng 1 ca rate hợp lệ
  insert into public.shifts (title, location, work_date, start_time, end_time, rate, capacity, created_by, status)
  values ('ZZVAL giữ', 'Hà Nội', current_date + 30, '08:00', '12:00', 40000, 5, owner1, 'recruiting')
  returning id into s;
  foreach expect_fail in array array['capacity 0', 'capacity -5', 'capacity 2000'] loop
    begin
      if expect_fail = 'capacity 0' then
        update public.shifts set capacity = 0 where id = s;
      elsif expect_fail = 'capacity -5' then
        update public.shifts set capacity = -5 where id = s;
      else
        update public.shifts set capacity = 2000 where id = s;
      end if;
      raise exception 'FAIL: % vẫn cập nhật được', expect_fail;
    exception when others then
      if sqlerrm like 'FAIL%' then raise; end if;
    end;
  end loop;

  -- 3. hours_override âm / quá 24
  begin
    update public.shifts set hours_override = -2 where id = s;
    raise exception 'FAIL: hours_override âm vẫn được';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  begin
    update public.shifts set hours_override = 30 where id = s;
    raise exception 'FAIL: hours_override > 24 vẫn được';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;

  -- 4. tiêu đề rỗng / 1 ký tự / quá dài
  begin
    update public.shifts set title = '   ' where id = s;
    raise exception 'FAIL: tiêu đề toàn khoảng trắng vẫn được';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  begin
    update public.shifts set title = 'a' where id = s;
    raise exception 'FAIL: tiêu đề 1 ký tự vẫn được';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  begin
    update public.shifts set title = repeat('x', 121) where id = s;
    raise exception 'FAIL: tiêu đề 121 ký tự vẫn được';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;

  -- 5. ngày ngoài khoảng hợp lệ
  begin
    update public.shifts set work_date = date '2019-12-31' where id = s;
    raise exception 'FAIL: ngày 2019 vẫn được';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;

  -- 6. đăng ký: tiền âm, giờ âm
  perform set_config('role','authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', worker1, 'role','authenticated')::text, true);
  begin
    insert into public.registrations (shift_id, worker_id, status, attendance, hours, pay)
    values (s, worker1, 'approved', 'full', -4, -160000);
    raise exception 'FAIL: giờ và tiền âm vẫn đăng ký được';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  perform set_config('role','postgres', true);
  perform set_config('request.jwt.claims', '', true);

  -- 7. hồ sơ: CCCD không đúng số, STK có chữ, tên 1 ký tự (worker tự sửa hồ sơ mình)
  perform set_config('role','authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', worker1, 'role','authenticated')::text, true);
  begin
    update public.profiles set cccd = 'abc-123' where id = worker1;
    raise exception 'FAIL: CCCD chữ vẫn được';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  begin
    update public.profiles set bank_account = 'VIETCOM-123' where id = worker1;
    raise exception 'FAIL: STK có chữ vẫn được';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  begin
    update public.profiles set full_name = 'A' where id = worker1;
    raise exception 'FAIL: tên 1 ký tự vẫn được';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  begin
    update public.profiles set username = 'ab' where id = worker1;
    raise exception 'FAIL: username 2 ký tự vẫn được';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  perform set_config('role','postgres', true);
  perform set_config('request.jwt.claims', '', true);

  -- 8. TRÙNG THÔNG TIN → TỰ GẮN NHÃN dup_info (migration 0008, không chặn cứng)
  begin
    update public.profiles set kyc_status = 'pending', cccd = '079300002002' where id = worker1;
  exception when others then
    raise exception 'FAIL: nộp hồ sơ trùng CCCD lại bị chặn (luật mới là tự gắn nhãn): %', sqlerrm;
  end;
  if not exists (select 1 from public.labels where worker_id = worker1 and code = 'dup_info') then
    raise exception 'FAIL: trùng thông tin nhưng không tự gắn nhãn dup_info';
  end if;
  -- nộp lại KHÔNG trùng → nhãn phải tự gỡ
  begin
    update public.profiles set kyc_status = 'pending', cccd = '079300001001' where id = worker1;
  exception when others then
    raise exception 'FAIL: nộp hồ sơ CCCD hợp lệ lại lỗi: %', sqlerrm;
  end;
  if exists (select 1 from public.labels where worker_id = worker1 and code = 'dup_info') then
    raise exception 'FAIL: nhãn dup_info chưa được gỡ dù thông tin không còn trùng';
  end if;
  -- phục hồi trạng thái gốc
  update public.profiles set cccd = null where id = worker1;
  update public.profiles set cccd = '079300002002' where id = worker2;

  -- dọn
  delete from public.registrations where shift_id = s;
  delete from public.shifts where title like 'ZZVAL%';
  raise notice 'TẤT CẢ TEST CHẶN GIÁ TRỊ SAI ĐẠT ✅';
end $$;

select 'VALIDATION: ALL PASS ✅' as result;
