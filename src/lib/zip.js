// Penulis ZIP sederhana (metode STORE, tanpa kompresi) untuk ekspor cadangan di browser — tanpa pustaka tambahan.
// Nama berkas UTF-8 (bit 11). PDF/JPEG sudah terkompresi, jadi STORE cukup.
const TABEL = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 }
  return t
})()

export function crc32(data) {
  let c = 0xFFFFFFFF
  for (let i = 0; i < data.length; i++) c = TABEL[(c ^ data[i]) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}

function dosWaktu(d) {
  const waktu = (d.getHours() << 11) | (d.getMinutes() << 5) | (Math.floor(d.getSeconds() / 2))
  const tanggal = ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  return { waktu, tanggal }
}

// entries: [{ nama: 'folder/berkas.pdf', data: Uint8Array, tanggal?: Date }]
export function buatZip(entries) {
  const enc = new TextEncoder()
  const lokal = []; const pusat = []; let offset = 0
  const dipakai = new Set()
  for (const e of entries) {
    let nama = e.nama.replace(/\\/g, '/').replace(/^\/+/, '')
    // Nama ganda dalam satu ZIP diberi akhiran (2), (3), …
    if (dipakai.has(nama)) { const m = nama.match(/^(.*?)(\.[^./]*)?$/); let i = 2; while (dipakai.has(`${m[1]} (${i})${m[2] || ''}`)) i++; nama = `${m[1]} (${i})${m[2] || ''}` }
    dipakai.add(nama)
    const namaB = enc.encode(nama); const data = e.data; const crc = crc32(data); const { waktu, tanggal } = dosWaktu(e.tanggal || new Date())
    const h = new DataView(new ArrayBuffer(30))
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true)
    h.setUint16(10, waktu, true); h.setUint16(12, tanggal, true); h.setUint32(14, crc, true)
    h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, namaB.length, true); h.setUint16(28, 0, true)
    lokal.push(new Uint8Array(h.buffer), namaB, data)
    const c = new DataView(new ArrayBuffer(46))
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true)
    c.setUint16(12, waktu, true); c.setUint16(14, tanggal, true); c.setUint32(16, crc, true)
    c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, namaB.length, true)
    c.setUint16(30, 0, true); c.setUint16(32, 0, true); c.setUint16(34, 0, true); c.setUint16(36, 0, true); c.setUint32(38, 0, true); c.setUint32(42, offset, true)
    pusat.push(new Uint8Array(c.buffer), namaB)
    offset += 30 + namaB.length + data.length
  }
  const ukuranPusat = pusat.reduce((s, b) => s + b.length, 0)
  const akhir = new DataView(new ArrayBuffer(22))
  akhir.setUint32(0, 0x06054b50, true); akhir.setUint16(8, entries.length, true); akhir.setUint16(10, entries.length, true)
  akhir.setUint32(12, ukuranPusat, true); akhir.setUint32(16, offset, true)
  const bagian = [...lokal, ...pusat, new Uint8Array(akhir.buffer)]
  const hasil = new Uint8Array(bagian.reduce((s, b) => s + b.length, 0))
  let pos = 0; for (const b of bagian) { hasil.set(b, pos); pos += b.length }
  return hasil
}
