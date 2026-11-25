import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync, mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { crc32, buatZip } from '../src/lib/zip.js'

test('CRC-32 vektor standar', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xCBF43926)
  assert.equal(crc32(new Uint8Array()), 0)
})

test('struktur ZIP: tanda tangan, jumlah entri, nama ganda', () => {
  const enc = new TextEncoder()
  const z = buatZip([
    { nama: 'RM-0001/daftar-dokumen.csv', data: enc.encode('a,b\r\n1,2') },
    { nama: 'RM-0001/askep.pdf', data: enc.encode('%PDF-1.4 uji') },
    { nama: 'RM-0001/askep.pdf', data: enc.encode('%PDF-1.4 kedua') },
  ])
  const dv = new DataView(z.buffer)
  assert.equal(dv.getUint32(0, true), 0x04034b50)
  const akhir = z.length - 22
  assert.equal(dv.getUint32(akhir, true), 0x06054b50)
  assert.equal(dv.getUint16(akhir + 10, true), 3)
  const teks = new TextDecoder().decode(z)
  assert.ok(teks.includes('RM-0001/askep (2).pdf'))
})

// Bukti nyata: Windows (PowerShell Expand-Archive) dapat membuka ZIP buatan kita dan isinya utuh.
test('ZIP dapat dibuka Windows dan isinya sama', { skip: process.platform !== 'win32' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'zipuji-'))
  const isi = new Uint8Array(200000).map((_, i) => (i * 31) % 251)
  writeFileSync(join(dir, 'uji.zip'), buatZip([
    { nama: 'Pasien Uji/daftar-dokumen.csv', data: new TextEncoder().encode('﻿Judul\r\nAskep') },
    { nama: 'Pasien Uji/berkas.bin', data: isi },
  ]))
  execFileSync('powershell.exe', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${join(dir, 'uji.zip')}' -DestinationPath '${join(dir, 'out')}' -Force`])
  assert.ok(existsSync(join(dir, 'out', 'Pasien Uji', 'daftar-dokumen.csv')))
  assert.deepEqual(new Uint8Array(readFileSync(join(dir, 'out', 'Pasien Uji', 'berkas.bin'))), isi)
})
