// Aturan murni (tanpa browser/Supabase) — diuji dengan node --test.

export const BULAN_ROMAWI = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
export const bulanRomawi = tanggal => BULAN_ROMAWI[Number(String(tanggal).slice(5, 7)) - 1] || ''

export const selisihHari = (dari, ke) => Math.round((Date.parse(`${ke}T00:00:00Z`) - Date.parse(`${dari}T00:00:00Z`)) / 86400000)

// Status kredensial pada tanggal `hariIni` (YYYY-MM-DD, WIB).
export function statusKredensial(berlakuSampai, hariIni) {
  if (!berlakuSampai) return { kode: 'tanpa', label: 'Tanpa batas', urutan: 4, sisa: null }
  const sisa = selisihHari(hariIni, berlakuSampai)
  if (sisa < 0) return { kode: 'lewat', label: `Kedaluwarsa ${-sisa} hari`, urutan: 0, sisa }
  if (sisa <= 30) return { kode: 'h30', label: sisa === 0 ? 'Berakhir hari ini' : `${sisa} hari lagi`, urutan: 1, sisa }
  if (sisa <= 90) return { kode: 'h90', label: `${sisa} hari lagi`, urutan: 2, sisa }
  return { kode: 'ok', label: 'Berlaku', urutan: 3, sisa }
}

// Retensi rekam medis: paling singkat 25 tahun sejak kunjungan terakhir (Permenkes 24/2022). 29 Feb → 28 Feb bila tahun tujuan bukan kabisat.
export function simpanSampai(kunjunganTerakhir) {
  if (!kunjunganTerakhir) return null
  const [y, m, d] = kunjunganTerakhir.split('-').map(Number)
  const tahun = y + 25
  const akhirBulan = new Date(Date.UTC(tahun, m, 0)).getUTCDate()
  return `${tahun}-${String(m).padStart(2, '0')}-${String(Math.min(d, akhirBulan)).padStart(2, '0')}`
}

// CSV aman untuk Excel (BOM UTF-8, ; tidak dipakai agar konsisten dengan DCM, rumus dinetralkan).
const sel = v => { let t = String(v ?? ''); if (/^[\s]*[=+@\-]/.test(t)) t = `'${t}`; return `"${t.replaceAll('"', '""')}"` }
export function keCsv(baris, kolom) {
  return '﻿' + [kolom.map(([, label]) => sel(label)).join(','), ...baris.map(b => kolom.map(([k]) => sel(typeof k === 'function' ? k(b) : b[k])).join(','))].join('\r\n')
}

// Berkas: tipe yang diterima & keputusan memperkecil foto.
export const MAKS_BYTE = 10 * 1024 * 1024
const TIPE_DASAR = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const TIPE_WORD = ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
export function cekBerkas({ name, type, size }, { izinWord = false } = {}) {
  const tipe = type || ''
  const diizinkan = izinWord ? [...TIPE_DASAR, ...TIPE_WORD] : TIPE_DASAR
  if (!diizinkan.includes(tipe)) return izinWord ? 'Gunakan PDF, JPG, PNG, WEBP, atau Word.' : 'Gunakan PDF, JPG, PNG, atau WEBP.'
  if (size > MAKS_BYTE && !perluDiperkecil({ type: tipe, size })) return `Berkas "${name}" lebih dari 10 MB.`
  return ''
}
export const perluDiperkecil = ({ type, size }) => /^image\/(jpeg|png|webp)$/.test(type || '') && size > 1.5 * 1024 * 1024
export const ukuranTeks = b => b == null ? '' : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`
export const namaAman = nama => String(nama || 'berkas').normalize('NFKD').replace(/[^\w.\-]+/g, '_').replace(/_+/g, '_').slice(-120)
