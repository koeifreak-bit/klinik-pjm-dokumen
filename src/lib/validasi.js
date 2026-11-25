// Validasi formulir akun. Aturan yang sama dicek ulang di fungsi tambah-pengguna dan di database.
export const JABATAN = ['Perawat', 'Kepala Perawat', 'Bidan', 'Dokter', 'Staf Administrasi', 'Lainnya']

export function validasiNama(nama) {
  const n = String(nama || '').trim()
  if (n.length < 2) return 'Nama minimal 2 huruf.'
  if (n.length > 120) return 'Nama maksimal 120 huruf.'
  return ''
}

export function validasiEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim()) ? '' : 'Format email tidak valid.'
}

export function validasiSandi(sandi, ulang) {
  const s = String(sandi || '')
  if (s.length < 8) return 'Kata sandi minimal 8 karakter.'
  if (ulang !== undefined && s !== ulang) return 'Kedua kata sandi tidak sama.'
  return ''
}

export function validasiPenggunaBaru({ nama, email, password, jabatan }) {
  return validasiNama(nama) || validasiEmail(email) || validasiSandi(password) || (JABATAN.includes(jabatan) ? '' : 'Pilih jabatan.')
}
