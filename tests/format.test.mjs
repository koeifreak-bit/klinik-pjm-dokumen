import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fmtTanggal, fmtWaktu, pesanGalat } from '../src/lib/format.js'

test('tanggal YYYY-MM-DD tidak bergeser hari (WIB)', () => {
  assert.match(fmtTanggal('2026-11-25'), /^25 Nov 2026$/)
  assert.match(fmtTanggal('2026-01-01'), /^01 Jan 2026$/)
})
test('timestamp UTC dibaca sebagai WIB', () => {
  // 17:30 UTC = 00:30 WIB hari berikutnya
  assert.match(fmtTanggal('2026-11-24T17:30:00Z'), /^25 Nov 2026$/)
  assert.match(fmtWaktu('2026-11-24T17:30:00Z'), /25 Nov 2026.*00[.:]30/)
})
test('nilai kosong/tidak valid → tanda pisah', () => {
  assert.equal(fmtTanggal(''), '—'); assert.equal(fmtTanggal(null), '—'); assert.equal(fmtTanggal('bukan tanggal'), '—')
})
test('pesan galat Auth diterjemahkan', () => {
  assert.equal(pesanGalat('Invalid login credentials'), 'Email atau kata sandi salah.')
  assert.equal(pesanGalat('A user with this email address has already been registered'), 'Email sudah terdaftar.')
  assert.equal(pesanGalat('TypeError: Failed to fetch'), 'Tidak dapat terhubung ke server. Periksa koneksi internet.')
  assert.equal(pesanGalat('Pesan lain'), 'Pesan lain')
})
