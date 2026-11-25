import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validasiNama, validasiEmail, validasiSandi, validasiPenggunaBaru } from '../src/lib/validasi.js'

test('nama', () => {
  assert.equal(validasiNama(' A '), 'Nama minimal 2 huruf.')
  assert.equal(validasiNama('Siti Aminah'), '')
  assert.equal(validasiNama('x'.repeat(121)), 'Nama maksimal 120 huruf.')
})
test('email', () => {
  assert.equal(validasiEmail('perawat@klinik.co.id'), '')
  assert.equal(validasiEmail('perawat@klinik'), 'Format email tidak valid.')
  assert.equal(validasiEmail('a b@x.id'), 'Format email tidak valid.')
})
test('kata sandi', () => {
  assert.equal(validasiSandi('1234567'), 'Kata sandi minimal 8 karakter.')
  assert.equal(validasiSandi('12345678'), '')
  assert.equal(validasiSandi('12345678', '12345679'), 'Kedua kata sandi tidak sama.')
  assert.equal(validasiSandi('12345678', '12345678'), '')
})
test('pengguna baru lengkap', () => {
  const ok = { nama: 'Siti', email: 's@klinik.id', password: 'rahasia123', jabatan: 'Bidan' }
  assert.equal(validasiPenggunaBaru(ok), '')
  assert.equal(validasiPenggunaBaru({ ...ok, jabatan: 'Satpam' }), 'Pilih jabatan.')
  assert.equal(validasiPenggunaBaru({ ...ok, email: 'salah' }), 'Format email tidak valid.')
})
