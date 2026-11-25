import { useRef, useState } from 'react'
import { FileText, Paperclip, Trash2 } from 'lucide-react'
import { bukaBerkas } from '../lib/berkas'
import { cekBerkas, ukuranTeks } from '../lib/aturan'
import { fmtWaktu } from '../lib/format'

// Daftar lampiran + tombol unggah. onUnggah(files) mengunggah & menyimpan; onHapus(berkas) opsional.
export function DaftarBerkas({ berkas = [], onUnggah, onHapus, izinWord = false, banyak = true, setGalat }) {
  const input = useRef(null)
  const [proses, setProses] = useState(false)
  const pilih = async e => {
    const files = Array.from(e.target.files || []); e.target.value = ''
    if (!files.length) return
    const salah = files.map(f => cekBerkas(f, { izinWord })).find(Boolean)
    if (salah) { setGalat?.(salah); return }
    setProses(true); setGalat?.('')
    try { await onUnggah(files) } catch (err) { setGalat?.(err.message) }
    setProses(false)
  }
  const buka = async b => { try { await bukaBerkas(b.storage_path) } catch (err) { setGalat?.(err.message) } }
  return <div className="berkas">
    {berkas.map(b => <div className="berkas-row" key={b.id}>
      <FileText size={16}/>
      <button type="button" className="link-btn" onClick={() => buka(b)}>{b.nama_file}</button>
      <span className="small muted">{ukuranTeks(b.ukuran)}{b.created_at ? ` · ${fmtWaktu(b.created_at)}` : ''}</span>
      {onHapus && <button type="button" className="icon-btn danger" aria-label={`Hapus ${b.nama_file}`} onClick={() => onHapus(b)}><Trash2 size={15}/></button>}
    </div>)}
    {!berkas.length && <div className="small muted">Belum ada lampiran.</div>}
    {onUnggah && <div>
      <input ref={input} type="file" hidden multiple={banyak} accept={izinWord ? '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx' : '.pdf,.jpg,.jpeg,.png,.webp'} onChange={pilih}/>
      <button type="button" className="btn small" disabled={proses} onClick={() => input.current?.click()}><Paperclip size={14}/> {proses ? 'Mengunggah…' : 'Tambah lampiran'}</button>
      <span className="small muted"> PDF/foto{izinWord ? '/Word' : ''}, maks. 10 MB. Foto besar diperkecil otomatis.</span>
    </div>}
  </div>
}
