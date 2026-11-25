// Format tanggal & waktu (WIB) dan pesan galat dalam Bahasa Indonesia.
const ZONA = 'Asia/Jakarta'

export const hariIni = () => new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date())

export function fmtTanggal(v) {
  if (!v) return '—'
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T12:00:00+07:00` : v)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('id-ID', { timeZone: ZONA, day: '2-digit', month: 'short', year: 'numeric' }).format(d)
}

export function fmtWaktu(v) {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('id-ID', { timeZone: ZONA, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d)
}

// Pesan galat Supabase Auth → Bahasa Indonesia.
export function pesanGalat(message = '') {
  const m = String(message)
  if (/invalid login credentials/i.test(m)) return 'Email atau kata sandi salah.'
  if (/email not confirmed/i.test(m)) return 'Email belum dikonfirmasi. Hubungi admin.'
  if (/user is banned/i.test(m)) return 'Akun Anda dinonaktifkan. Hubungi admin.'
  if (/already (been )?registered|already exists/i.test(m)) return 'Email sudah terdaftar.'
  if (/password should be at least|weak password/i.test(m)) return 'Kata sandi terlalu lemah (minimal 8 karakter).'
  if (/same.*password|new password should be different/i.test(m)) return 'Kata sandi baru harus berbeda dari yang lama.'
  if (/failed to fetch|network/i.test(m)) return 'Tidak dapat terhubung ke server. Periksa koneksi internet.'
  if (/rate limit|too many/i.test(m)) return 'Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.'
  return m || 'Terjadi kesalahan.'
}
