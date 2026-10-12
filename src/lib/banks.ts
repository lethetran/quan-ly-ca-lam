// Danh sách ngân hàng Việt Nam chuẩn (theo List B - NHNN, mã theo chuẩn VietQR/Napas 24/7)
// Người dùng chọn từ danh sách để dữ liệu sạch, thống nhất khi đối soát & chuyển khoản.

export interface Bank {
  name: string
  code: string
}

export const BANKS: Bank[] = [
  // Ngoại thương & 4 ngân hàng nhà nước lớn
  { name: 'Vietcombank', code: 'VCB' },
  { name: 'VietinBank', code: 'CTG' },
  { name: 'BIDV', code: 'BIDV' },
  { name: 'Agribank', code: 'AGRIBANK' },
  // Ngân hàng thương mại cổ phần lớn
  { name: 'MB Bank', code: 'MB' },
  { name: 'Techcombank', code: 'TCB' },
  { name: 'VPBank', code: 'VPB' },
  { name: 'ACB', code: 'ACB' },
  { name: 'TPBank', code: 'TPB' },
  { name: 'Sacombank', code: 'STB' },
  { name: 'HDBank', code: 'HDB' },
  { name: 'VIB', code: 'VIB' },
  { name: 'SHB', code: 'SHB' },
  { name: 'Eximbank', code: 'EIB' },
  { name: 'MSB', code: 'MSB' },
  { name: 'SeABank', code: 'SEA' },
  { name: 'LPBank', code: 'LPB' },
  { name: 'OCB', code: 'OCB' },
  { name: 'Nam A Bank', code: 'NAMABANK' },
  { name: 'VietABank', code: 'VAB' },
  { name: 'PVcomBank', code: 'PVCOMBANK' },
  { name: 'BaoVietBank', code: 'BVB' },
  { name: 'VietBank', code: 'VIETBANK' },
  { name: 'ABBank', code: 'ABB' },
  { name: 'Bac A Bank', code: 'BACABANK' },
  { name: 'KienlongBank', code: 'KLB' },
  { name: 'SaigonBank', code: 'SGB' },
  { name: 'Ngân hàng Hợp tác xã VN (CoopBank)', code: 'COOPBANK' },
  { name: 'TrustBank', code: 'TRUST' },
  { name: 'MyBank', code: 'MYBANK' },
  { name: 'PGBank', code: 'PGB' },
  { name: 'OceanBank', code: 'OJB' },
  { name: 'VRBank', code: 'VRB' },
  // Ngân hàng số
  { name: 'Cake by VPBank', code: 'CAKE' },
  { name: 'Timo', code: 'TIMO' },
  { name: 'TNEX (MSB)', code: 'TNEX' },
  // Ngân hàng ngoại
  { name: 'Shinhan Bank Việt Nam', code: 'SHINHAN' },
  { name: 'Woori Bank Việt Nam', code: 'WOORI' },
  { name: 'UOB Việt Nam', code: 'UOB' },
  { name: 'CIMB Việt Nam', code: 'CIMB' },
  { name: 'HSBC Việt Nam', code: 'HSBC' },
  { name: 'Standard Chartered Việt Nam', code: 'SC' },
  { name: 'Public Bank Việt Nam', code: 'PBVN' },
  { name: 'Hong Leong Việt Nam', code: 'HLB' },
  { name: 'KB Kookmin Việt Nam', code: 'KOOKMIN' },
  { name: 'KEB Hana Việt Nam', code: 'KEBHANA' },
  { name: 'IBK HCM', code: 'IBKHCM' },
  { name: 'IBK Hà Nội', code: 'IBKHN' },
]

export const BANK_OTHER = '__OTHER__' // giá trị lựa chọn "Khác" (kèm ô nhập tên)

/** Giá trị chọn cho select: ngân hàng nếu nằm trong danh sách, ngược lại "Khác" */
export function bankSelectValue(bankName: string | null | undefined): string {
  if (!bankName) return ''
  return BANKS.some((b) => b.name.toLowerCase() === bankName.trim().toLowerCase())
    ? BANKS.find((b) => b.name.toLowerCase() === bankName.trim().toLowerCase())!.name
    : BANK_OTHER
}
