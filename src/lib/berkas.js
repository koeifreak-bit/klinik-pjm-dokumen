// Unggah, buka, dan unduh berkas di bucket privat `dokumen`.
import { supabase } from './supabase'
import { MAKS_BYTE, namaAman, perluDiperkecil } from './aturan'

const BUCKET = 'dokumen'

// Foto besar diperkecil (sisi terpanjang 2000 px, JPEG 0,82) agar 1 GB penyimpanan gratis awet.
export async function perkecilFoto(file) {
  if (!perluDiperkecil(file)) return file
  try {
    const bitmap = await createImageBitmap(file)
    const skala = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * skala); canvas.height = Math.round(bitmap.height * skala)
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close?.()
    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.82))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.(png|webp|jpe?g)$/i, '') + '.jpg', { type: 'image/jpeg' })
  } catch { return file }
}

// Mengunggah ke `${folder}/${uuid}-${nama}`. Mengembalikan { path, nama, ukuran, mime } atau melempar Error berbahasa Indonesia.
export async function unggahBerkas(folder, file) {
  const siap = await perkecilFoto(file)
  if (siap.size > MAKS_BYTE) throw new Error(`Berkas "${file.name}" lebih dari 10 MB setelah diperkecil.`)
  const path = `${folder}/${crypto.randomUUID()}-${namaAman(siap.name)}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, siap, { contentType: siap.type, upsert: false })
  if (error) throw new Error(/mime|type/i.test(error.message) ? 'Jenis berkas tidak diterima.' : /size|large/i.test(error.message) ? 'Berkas terlalu besar (maks. 10 MB).' : `Gagal mengunggah: ${error.message}`)
  return { path, nama: siap.name, ukuran: siap.size, mime: siap.type }
}

export async function hapusBerkas(paths) {
  if (!paths.length) return
  const { error } = await supabase.storage.from(BUCKET).remove(paths)
  if (error) throw new Error(`Berkas belum terhapus dari penyimpanan: ${error.message}`)
}

// Buka di tab baru lewat tautan bertanda tangan 60 detik. Tab dibuka lebih dulu agar tidak diblokir browser.
export async function bukaBerkas(path) {
  const tab = window.open('', '_blank')
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60)
  if (error) { tab?.close(); throw new Error(`Berkas tidak dapat dibuka: ${error.message}`) }
  if (tab) tab.location.href = data.signedUrl; else window.location.assign(data.signedUrl)
}

export async function ambilBerkas(path) {
  const { data, error } = await supabase.storage.from(BUCKET).download(path)
  if (error) throw new Error(`Gagal mengambil ${path.split('/').pop()}: ${error.message}`)
  return new Uint8Array(await data.arrayBuffer())
}

export function simpanSebagai(namaBerkas, isi, tipe = 'application/octet-stream') {
  const url = URL.createObjectURL(isi instanceof Blob ? isi : new Blob([isi], { type: tipe }))
  const a = document.createElement('a'); a.href = url; a.download = namaBerkas; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
