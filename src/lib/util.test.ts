import { describe, expect, it } from 'vitest'
import {
  authErrorVi, clampNum, digitsOk, effStatus, imageOk, maskCccd, money, num, passwordOk,
  regOpen, shiftFormError, shiftsOverlap, shiftTimes, toEmail, todayVN, usernameOk,
} from './util'
import type { Shift } from './types'

const mk = (o: Partial<Shift>): Shift => ({
  id: 's1', title: 'Ca test', location: 'Hà Nội', contact_name: null, contact_phone: null, note: null,
  work_date: '2026-10-15', start_time: '08:00:00', end_time: '12:00:00',
  hours_override: null, rate: 40000, capacity: 5, reg_deadline: null,
  status: 'recruiting', created_by: 'owner', approved_by: null, payment_note: null, paid_at: null,
  created_at: '2026-10-01T00:00:00Z', ...o,
})

describe('tiền tệ', () => {
  it('định dạng VNĐ chuẩn', () => {
    expect(money(1250000)).toBe('1.250.000đ')
    expect(money(0)).toBe('0đ')
    expect(money(null)).toBe('—')
  })
  it('số giờ dùng dấu phẩy kiểu VN', () => {
    expect(num(4)).toBe('4')
    expect(num(4.5)).toBe('4,5')
    expect(num(null)).toBe('—')
  })
})

describe('tính giờ ca làm (múi giờ VN +07:00)', () => {
  it('ca thường 08:00–12:00 = 4 giờ', () => {
    const { hours } = shiftTimes(mk({}))
    expect(hours).toBe(4)
  })
  it('ca qua đêm 22:00–02:00 = 4 giờ', () => {
    const { hours, start } = shiftTimes(mk({ start_time: '22:00:00', end_time: '02:00:00' }))
    expect(hours).toBe(4)
    // 22:00 VN ngày 15/10 = 15:00 UTC
    expect(start.toISOString()).toBe('2026-10-15T15:00:00.000Z')
  })
  it('hours_override đè giá trị tự tính', () => {
    expect(shiftTimes(mk({ hours_override: 6.5 })).hours).toBe(6.5)
  })
  it('trạng thái tự chuyển đúng thời điểm theo giờ VN', () => {
    const before = new Date('2026-10-15T06:00:00+07:00').getTime()
    const during = new Date('2026-10-15T10:00:00+07:00').getTime()
    const after = new Date('2026-10-15T13:00:00+07:00').getTime()
    expect(effStatus(mk({}), before).status).toBe('recruiting')
    expect(effStatus(mk({}), during).status).toBe('ongoing')
    expect(effStatus(mk({}), after).ended).toBe(true)
  })
  it('hạn đăng ký: mở trước hạn, đóng sau hạn', () => {
    const now1 = new Date('2026-10-15T06:00:00+07:00').getTime()
    const now2 = new Date('2026-10-15T10:00:00+07:00').getTime()
    expect(regOpen(mk({}), now1)).toBe(true)
    expect(regOpen(mk({}), now2)).toBe(false)
  })
})

describe('tài khoản', () => {
  it('tên ngắn ánh xạ về @nhanvien.local; email giữ nguyên và thường hóa', () => {
    expect(toEmail('0901234567')).toBe('0901234567@nhanvien.local')
    expect(toEmail('Lam1')).toBe('lam1@nhanvien.local')
    expect(toEmail('Example@Gmail.COM')).toBe('example@gmail.com')
  })
  it('tên đăng nhập hợp lệ 3–24 ký tự', () => {
    expect(usernameOk('lam1')).toBe(true)
    expect(usernameOk('nguyen.van_a')).toBe(true)
    expect(usernameOk('ab')).toBe(false)
    expect(usernameOk('có dấu!')).toBe(false)
    expect(usernameOk('a'.repeat(25))).toBe(false)
  })
  it('mật khẩu chuẩn: ≥8 ký tự, có chữ và số', () => {
    expect(passwordOk('manh12345')).toBe(true)
    expect(passwordOk('12345678')).toBe(false)
    expect(passwordOk('abcdefgh')).toBe(false)
    expect(passwordOk('123456')).toBe(false)
  })
})

describe('hiển thị & bảo mật nhỏ', () => {
  it('che CCCD giữ 3 đầu + 3 cuối', () => {
    expect(maskCccd('038219901234')).toBe('038******234')
    expect(maskCccd(null)).toBe('—')
  })
  it('lỗi đăng nhập không tiết lộ tài khoản tồn tại', () => {
    expect(authErrorVi('Invalid login credentials')).not.toContain('email')
    expect(authErrorVi('User already registered')).toBe('Tên đăng nhập này đã được dùng — hãy đăng nhập, hoặc chọn tên khác.')
  })
  it('chỉ nhận ảnh jpg/png/webp ≤ 5MB', () => {
    expect(imageOk(new File([new Uint8Array(8)], 'a.gif', { type: 'image/gif' }))).toContain('JPG')
    expect(imageOk(new File([new Uint8Array(6 * 1024 * 1024)], 'a.jpg', { type: 'image/jpeg' }))).toContain('quá lớn')
    expect(imageOk(new File([new Uint8Array(8)], 'a.jpg', { type: 'image/jpeg' }))).toBeNull()
  })
})

describe('chặn giá trị sai/âm', () => {
  it('clampNum chặn âm và vượt trần, chữ rác về min', () => {
    expect(clampNum(-5000, 0, 24)).toBe(0)
    expect(clampNum(99, 0, 24)).toBe(24)
    expect(clampNum(NaN, 0, 24)).toBe(0)
    expect(clampNum(5, 0, 24)).toBe(5)
  })
  it('digitsOk: STK/CCCD chỉ chữ số đúng độ dài', () => {
    expect(digitsOk('0912345678901', 6, 19)).toBe(true)
    expect(digitsOk('12ab901', 6, 19)).toBe(false)
    expect(digitsOk(' -5000 ', 6, 19)).toBe(false)
    expect(digitsOk('12345', 6, 19)).toBe(false)
  })
  it('form tạo ca: chặn âm, 0, trống, ngày quá khứ, giờ trùng', () => {
    const base = {
      title: 'Ca hợp lệ', location: 'Hà Nội', work_date: '2026-12-01',
      start_time: '08:00', end_time: '12:00', rate: 40000, capacity: 5,
    }
    expect(shiftFormError(base)).toBeNull()
    expect(shiftFormError({ ...base, rate: -40000 })).toContain('số nguyên dương')
    expect(shiftFormError({ ...base, rate: 0 })).toContain('số nguyên dương')
    expect(shiftFormError({ ...base, rate: 35000.5 })).toContain('số nguyên dương')
    expect(shiftFormError({ ...base, rate: 200000000 })).toContain('số nguyên dương')
    expect(shiftFormError({ ...base, capacity: 0 })).toContain('từ 1 đến 1000')
    expect(shiftFormError({ ...base, capacity: -5 })).toContain('từ 1 đến 1000')
    expect(shiftFormError({ ...base, title: '  ' })).toContain('Tên ca')
    expect(shiftFormError({ ...base, title: 'a' })).toContain('Tên ca')
    expect(shiftFormError({ ...base, location: '' })).toContain('Địa điểm')
    expect(shiftFormError({ ...base, work_date: '1999-01-01' })).toContain('ngày đã qua')
    expect(shiftFormError({ ...base, work_date: todayVN() })).toBeNull()
    expect(shiftFormError({ ...base, start_time: '08:00', end_time: '08:00' })).toContain('khác giờ bắt đầu')
    expect(shiftFormError({ ...base, contact_phone: 'abc' })).toContain('9–11 chữ số')
    expect(shiftFormError({ ...base, contact_phone: undefined })).toBeNull()
  })
})

describe('chặn đăng ký trùng giờ', () => {
  const d = (o: Partial<Parameters<typeof shiftTimes>[0]>) => mk(o)
  it('giao giờ cùng ngày → trùng', () => {
    const a = d({ start_time: '08:00:00', end_time: '12:00:00' })
    expect(shiftsOverlap(a, d({ start_time: '11:00:00', end_time: '15:00:00' }))).toBe(true)
    expect(shiftsOverlap(a, d({ start_time: '07:00:00', end_time: '08:30:00' }))).toBe(true)
    expect(shiftsOverlap(a, d({ start_time: '06:00:00', end_time: '23:00:00' }))).toBe(true)
  })
  it('chạm mép / khác giờ → không trùng', () => {
    const a = d({ start_time: '08:00:00', end_time: '12:00:00' })
    expect(shiftsOverlap(a, d({ start_time: '12:00:00', end_time: '16:00:00' }))).toBe(false)
    expect(shiftsOverlap(a, d({ start_time: '13:00:00', end_time: '17:00:00' }))).toBe(false)
  })
  it('ca qua đêm 22:00-02:00 cùng ngày: trùng ca tối 21:00, KHÔNG trùng ca sáng hôm sau của cùng ngày', () => {
    const night = d({ start_time: '22:00:00', end_time: '02:00:00' })
    expect(shiftsOverlap(night, d({ start_time: '21:00:00', end_time: '23:00:00' }))).toBe(true)
    expect(shiftsOverlap(night, d({ start_time: '20:00:00', end_time: '22:30:00' }))).toBe(true)
    // đuôi 00:00-02:00 thuộc ngày HÔM SAU nên không giao ca sáng cùng ngày
    expect(shiftsOverlap(night, d({ start_time: '00:30:00', end_time: '03:00:00' }))).toBe(false)
    expect(shiftsOverlap(night, d({ start_time: '03:00:00', end_time: '05:00:00' }))).toBe(false)
  })
  it('hai ca đều qua đêm cùng ngày → luôn trùng phần tối', () => {
    expect(shiftsOverlap(
      d({ start_time: '22:00:00', end_time: '02:00:00' }),
      d({ start_time: '23:00:00', end_time: '03:00:00' }),
    )).toBe(true)
  })
  it('khác ngày → không bao giờ trùng', () => {
    const a = d({})
    expect(shiftsOverlap(a, d({ work_date: '2026-10-16' }))).toBe(false)
  })
})
