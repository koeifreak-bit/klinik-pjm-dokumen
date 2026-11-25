import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bulanRomawi, statusKredensial, simpanSampai, keCsv, cekBerkas, perluDiperkecil, namaAman, ukuranTeks } from '../src/lib/aturan.js'

test('bulan Romawi untuk nomor surat', () => {
  assert.equal(bulanRomawi('2026-11-03'), 'XI')
  assert.equal(bulanRomawi('2026-01-31'), 'I')
  assert.equal(bulanRomawi('2026-04-01'), 'IV')
  assert.equal(bulanRomawi('2026-12-25'), 'XII')
})

test('status kredensial', () => {
  const h = '2026-11-25'
  assert.equal(statusKredensial(null, h).kode, 'tanpa')
  assert.equal(statusKredensial('2026-11-24', h).kode, 'lewat')
  assert.equal(statusKredensial('2026-11-24', h).label, 'Kedaluwarsa 1 hari')
  assert.equal(statusKredensial('2026-11-25', h).label, 'Berakhir hari ini')
  assert.equal(statusKredensial('2026-12-15', h).kode, 'h30')   // 20 hari → ≤ 30
  assert.equal(statusKredensial('2026-12-25', h).kode, 'h30')   // tepat 30
  assert.equal(statusKredensial('2026-12-26', h).kode, 'h90')   // 31
  assert.equal(statusKredensial('2027-02-23', h).kode, 'h90')   // 90
  assert.equal(statusKredensial('2027-02-24', h).kode, 'ok')    // 91
})

test('retensi 25 tahun sejak kunjungan terakhir', () => {
  assert.equal(simpanSampai('2026-11-25'), '2051-11-25')
  assert.equal(simpanSampai('2028-02-29'), '2053-02-28') // 2053 bukan kabisat
  assert.equal(simpanSampai(null), null)
})

test('CSV: BOM, kutip, rumus dinetralkan', () => {
  const csv = keCsv([{ a: 'Siti "Ani"', b: '=SUM(A1)' }], [['a', 'Nama'], ['b', 'Isi']])
  assert.ok(csv.startsWith('﻿"Nama","Isi"'))
  assert.ok(csv.includes('"Siti ""Ani"""'))
  assert.ok(csv.includes(`"'=SUM(A1)"`))
})

test('cek berkas & keputusan memperkecil foto', () => {
  assert.equal(cekBerkas({ name: 'a.pdf', type: 'application/pdf', size: 1000 }), '')
  assert.match(cekBerkas({ name: 'a.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 1000 }), /PDF, JPG/)
  assert.equal(cekBerkas({ name: 'a.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 1000 }, { izinWord: true }), '')
  assert.match(cekBerkas({ name: 'besar.pdf', type: 'application/pdf', size: 11 * 1024 * 1024 }), /lebih dari 10 MB/)
  assert.equal(cekBerkas({ name: 'foto.jpg', type: 'image/jpeg', size: 11 * 1024 * 1024 }), '') // akan diperkecil
  assert.equal(perluDiperkecil({ type: 'image/jpeg', size: 2 * 1024 * 1024 }), true)
  assert.equal(perluDiperkecil({ type: 'image/jpeg', size: 1024 * 1024 }), false)
  assert.equal(perluDiperkecil({ type: 'application/pdf', size: 9 * 1024 * 1024 }), false)
})

test('nama berkas aman & ukuran', () => {
  assert.equal(namaAman('Surat Dinkes (final) #2.pdf'), 'Surat_Dinkes_final_2.pdf')
  assert.equal(ukuranTeks(2048), '2 KB')
  assert.equal(ukuranTeks(3 * 1024 * 1024), '3.0 MB')
})
