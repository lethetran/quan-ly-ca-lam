import { describe, expect, it } from 'vitest'
import { BANKS, BANK_OTHER, bankSelectValue } from './banks'

describe('danh sách ngân hàng chuẩn', () => {
  it('không trùng tên hay mã, không có ô trống', () => {
    const names = new Set(BANKS.map((b) => b.name.toLowerCase()))
    const codes = new Set(BANKS.map((b) => b.code))
    expect(names.size).toBe(BANKS.length)
    expect(codes.size).toBe(BANKS.length)
    expect(BANKS.every((b) => b.name.length >= 2 && b.code.length >= 2)).toBe(true)
  })
  it('có các ngân hàng phổ biến nhất', () => {
    for (const n of ['Vietcombank', 'MB Bank', 'Techcombank', 'Agribank', 'BIDV', 'VietinBank']) {
      expect(BANKS.some((b) => b.name === n)).toBe(true)
    }
  })
  it('bankSelectValue: nhận diện giá trị cũ, lạ → "Khác"', () => {
    expect(bankSelectValue('MB Bank')).toBe('MB Bank')
    expect(bankSelectValue('vietcombank')).toBe('Vietcombank') // không phân biệt hoa thường
    expect(bankSelectValue('Ngân hàng đại ngàn')).toBe(BANK_OTHER)
    expect(bankSelectValue(null)).toBe('')
  })
})
