import { useEffect, useMemo, useState } from 'react'
import { BadgeCheck, Download, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { fmtTanggal, hariIni, pesanGalat } from '../lib/format'
import { keCsv, statusKredensial } from '../lib/aturan'
import { hapusBerkas, simpanSebagai, unggahBerkas } from '../lib/berkas'
import { Modal } from '../ui/Modal'
import { DateInput } from '../ui/DateInput'
import { DaftarBerkas } from '../ui/DaftarBerkas'

export const JENIS_KREDENSIAL = ['STR', 'SIP', 'Sertifikat Pelatihan', 'Lainnya']
const NAMA_AWAL = { STR: 'STR', SIP: 'SIP', 'Sertifikat Pelatihan': '', Lainnya: '' }
export const KELAS_KREDENSIAL = { lewat: 'off', h30: 'warn', h90: 'info', ok: 'ok', tanpa: 'muted' }
const FILTER_STATUS = [['', 'Semua status'], ['lewat', 'Kedaluwarsa'], ['h30', '≤ 30 hari'], ['h90', '≤ 90 hari'], ['ok', 'Berlaku'], ['tanpa', 'Tanpa batas']]
const PILIH = '*, staf:profiles!kredensial_profil_id_fkey(id,nama,jabatan,aktif), berkas:kredensial_berkas(id,nama_file,storage_path,ukuran,mime,created_at)'

export function Kredensial({ profil, filterAwal }) {
  const [daftar, setDaftar] = useState([])
  const [staf, setStaf] = useState([])
  const [filter, setFilter] = useState({ staf: '', jenis: '', status: filterAwal || '' })
  const [form, setForm] = useState(null)
  const [galat, setGalat] = useState('')
  const [info, setInfo] = useState('')
  const hari = hariIni()

  const muat = async () => {
    const { data, error } = await supabase.from('kredensial').select(PILIH)
    if (error) setGalat(pesanGalat(error.message)); else setDaftar(data || [])
  }
  useEffect(() => { muat(); supabase.from('profiles').select('id,nama,jabatan,aktif').order('nama').then(({ data }) => setStaf(data || [])) }, [])

  const baris = useMemo(() => daftar
    .map(k => ({ ...k, st: statusKredensial(k.berlaku_sampai, hari) }))
    .filter(k => (!filter.staf || k.profil_id === filter.staf) && (!filter.jenis || k.jenis === filter.jenis) && (!filter.status || k.st.kode === filter.status))
    .sort((a, b) => a.st.urutan - b.st.urutan || String(a.berlaku_sampai || '9').localeCompare(String(b.berlaku_sampai || '9')) || (a.staf?.nama || '').localeCompare(b.staf?.nama || '')), [daftar, filter, hari])
  const hitung = kode => daftar.filter(k => statusKredensial(k.berlaku_sampai, hari).kode === kode).length

  const ekspor = () => simpanSebagai(`kredensial-staf-${hari}.csv`, keCsv(baris, [
    [k => k.staf?.nama || '', 'Nama staf'], [k => k.staf?.jabatan || '', 'Jabatan'], ['jenis', 'Jenis'], ['nama', 'Nama dokumen'], ['nomor', 'Nomor'],
    ['penerbit', 'Penerbit'], [k => fmtTanggal(k.tanggal_terbit), 'Terbit'], [k => k.berlaku_sampai ? fmtTanggal(k.berlaku_sampai) : 'Tanpa batas', 'Berlaku sampai'],
    [k => k.st.label, 'Status'], [k => (k.berkas || []).length, 'Lampiran'], ['catatan', 'Catatan'],
  ]), 'text/csv;charset=utf-8')

  const hapus = async k => {
    if (!window.confirm(`Hapus ${k.jenis} "${k.nama}" milik ${k.staf?.nama}? Lampirannya ikut terhapus.`)) return
    setGalat(''); setInfo('')
    const { data, error } = await supabase.from('kredensial').delete().eq('id', k.id).select('id')
    if (error || !data?.length) { setGalat(error ? pesanGalat(error.message) : 'Data tidak terhapus.'); return }
    try { await hapusBerkas((k.berkas || []).map(b => b.storage_path)) } catch (err) { setGalat(err.message) }
    setInfo('Kredensial dihapus.'); muat()
  }

  return <div className="page">
    <div className="page-heading">
      <div><div className="eyebrow">KREDENSIAL STAF</div><h1>STR, SIP & Sertifikat</h1><p className="muted">STR berlaku seumur hidup (UU 17/2023) — kosongkan tanggal berakhirnya. SIP wajib bertanggal. Yang paling mendesak tampil paling atas.</p></div>
      <div className="row-actions"><button className="btn" onClick={ekspor} disabled={!baris.length}><Download size={16}/> Ekspor CSV</button><button className="btn primary" onClick={() => { setGalat(''); setInfo(''); setForm({ profil_id: profil.id, jenis: 'STR', nama: 'STR', nomor: '', penerbit: '', tanggal_terbit: '', berlaku_sampai: '', catatan: '', files: [] }) }}><Plus size={16}/> Tambah Kredensial</button></div>
    </div>
    <div className="stats">
      {[['lewat', 'Kedaluwarsa'], ['h30', 'Berakhir ≤ 30 hari'], ['h90', 'Berakhir ≤ 90 hari']].map(([kode, label]) => <button key={kode} className={`card stat ${kode === 'lewat' && hitung(kode) ? 'alarm' : ''} ${filter.status === kode ? 'dipilih' : ''}`} onClick={() => setFilter(f => ({ ...f, status: f.status === kode ? '' : kode }))}><span>{label}</span><strong>{hitung(kode)}</strong></button>)}
    </div>
    {galat && !form && <div className="alert error">{galat}</div>}
    {info && <div className="alert success">{info}</div>}
    <div className="toolbar card">
      <select aria-label="Staf" value={filter.staf} onChange={e => setFilter(f => ({ ...f, staf: e.target.value }))}><option value="">Semua staf</option>{staf.map(p => <option key={p.id} value={p.id}>{p.nama}{p.aktif ? '' : ' (nonaktif)'}</option>)}</select>
      <select aria-label="Jenis" value={filter.jenis} onChange={e => setFilter(f => ({ ...f, jenis: e.target.value }))}><option value="">Semua jenis</option>{JENIS_KREDENSIAL.map(j => <option key={j}>{j}</option>)}</select>
      <select aria-label="Status" value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}>{FILTER_STATUS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      <button className={`btn small ${filter.staf === profil.id ? 'primary' : ''}`} onClick={() => setFilter(f => ({ ...f, staf: f.staf === profil.id ? '' : profil.id }))}><BadgeCheck size={14}/> Kredensial saya</button>
    </div>
    <div className="card table-wrap"><table>
      <thead><tr><th>Staf</th><th>Dokumen</th><th>Nomor</th><th>Berlaku sampai</th><th>Status</th><th>Lampiran</th><th></th></tr></thead>
      <tbody>{baris.map(k => <tr key={k.id}>
        <td><strong>{k.staf?.nama}</strong><div className="small muted">{k.staf?.jabatan}{k.staf && !k.staf.aktif ? ' · nonaktif' : ''}</div></td>
        <td><strong>{k.jenis}</strong>{k.nama !== k.jenis && <> · {k.nama}</>}<div className="small muted">{k.penerbit || ''}</div></td>
        <td>{k.nomor || '—'}<div className="small muted">{k.tanggal_terbit ? `Terbit ${fmtTanggal(k.tanggal_terbit)}` : ''}</div></td>
        <td>{k.berlaku_sampai ? fmtTanggal(k.berlaku_sampai) : <span className="muted">{k.jenis === 'STR' ? 'Seumur hidup' : 'Tanpa batas'}</span>}</td>
        <td><span className={`pill ${KELAS_KREDENSIAL[k.st.kode]}`}>{k.st.label}</span></td>
        <td className="small">{k.berkas?.length || '—'}</td>
        <td><div className="row-actions"><button className="btn small" onClick={() => { setGalat(''); setInfo(''); setForm({ ...k, nomor: k.nomor || '', penerbit: k.penerbit || '', tanggal_terbit: k.tanggal_terbit || '', berlaku_sampai: k.berlaku_sampai || '', catatan: k.catatan || '', files: [] }) }}>Buka</button><button className="icon-btn danger" aria-label="Hapus" onClick={() => hapus(k)}><Trash2 size={15}/></button></div></td>
      </tr>)}</tbody>
    </table>{!baris.length && <div className="empty">{daftar.length ? 'Tidak ada kredensial yang cocok dengan filter.' : 'Belum ada kredensial. Tambahkan STR, SIP, dan sertifikat pelatihan staf.'}</div>}</div>
    {form && <FormKredensial awal={form} staf={staf} tutup={() => setForm(null)} selesai={pesan => { setForm(null); setInfo(pesan); muat() }} segarkan={muat}/>}
  </div>
}

function FormKredensial({ awal, staf, tutup, selesai, segarkan }) {
  const [f, setF] = useState(awal)
  const [berkas, setBerkas] = useState(awal.berkas || [])
  const [galat, setGalat] = useState('')
  const [proses, setProses] = useState(false)
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))
  const gantiJenis = j => setF(x => ({ ...x, jenis: j, nama: !x.nama || Object.values(NAMA_AWAL).includes(x.nama) ? NAMA_AWAL[j] : x.nama }))

  const simpan = async e => {
    e.preventDefault(); setGalat('')
    if (f.jenis === 'SIP' && !f.berlaku_sampai) { setGalat('SIP wajib memiliki tanggal berlaku sampai.'); return }
    if (f.berlaku_sampai && f.tanggal_terbit && f.berlaku_sampai < f.tanggal_terbit) { setGalat('Tanggal berlaku sampai tidak boleh sebelum tanggal terbit.'); return }
    setProses(true)
    const payload = { profil_id: f.profil_id, jenis: f.jenis, nama: f.nama.trim(), nomor: f.nomor.trim() || null, penerbit: f.penerbit.trim() || null, tanggal_terbit: f.tanggal_terbit || null, berlaku_sampai: f.berlaku_sampai || null, catatan: f.catatan.trim() || null }
    const q = f.id ? supabase.from('kredensial').update(payload).eq('id', f.id).select('id') : supabase.from('kredensial').insert(payload).select('id')
    const { data, error } = await q
    if (error || !data?.length) { setProses(false); setGalat(error ? pesanGalat(error.message) : 'Data tidak tersimpan.'); return }
    const id = data[0].id; const gagal = []
    for (const file of f.files) {
      try { await simpanLampiran(id, file) } catch { gagal.push(file.name) }
    }
    setProses(false)
    if (gagal.length) window.alert(`Data tersimpan, tetapi lampiran ini gagal diunggah: ${gagal.join(', ')}.`)
    selesai(f.id ? 'Kredensial diperbarui.' : 'Kredensial ditambahkan.')
  }
  const simpanLampiran = async (id, file) => {
    const u = await unggahBerkas(`kredensial/${id}`, file)
    const { data, error } = await supabase.from('kredensial_berkas').insert({ kredensial_id: id, nama_file: u.nama, storage_path: u.path, ukuran: u.ukuran, mime: u.mime }).select('*').single()
    if (error) { await hapusBerkas([u.path]).catch(() => {}); throw new Error(pesanGalat(error.message)) }
    return data
  }
  const unggahLangsung = async files => { for (const file of files) { const b = await simpanLampiran(f.id, file); setBerkas(x => [...x, b]) } segarkan() }
  const hapusLampiran = async b => {
    if (!window.confirm(`Hapus lampiran "${b.nama_file}"?`)) return
    const { data, error } = await supabase.from('kredensial_berkas').delete().eq('id', b.id).select('id')
    if (error || !data?.length) { setGalat(error ? pesanGalat(error.message) : 'Lampiran tidak terhapus.'); return }
    try { await hapusBerkas([b.storage_path]) } catch (err) { setGalat(err.message) }
    setBerkas(x => x.filter(y => y.id !== b.id)); segarkan()
  }

  return <Modal judul={f.id ? `${f.jenis} · ${staf.find(p => p.id === f.profil_id)?.nama || ''}` : 'Tambah Kredensial'} tutup={tutup} lebar>
    <form className="form-grid" onSubmit={simpan}>
      <label>Staf*<select required value={f.profil_id} onChange={e => set('profil_id', e.target.value)}>{staf.filter(p => p.aktif || p.id === f.profil_id).map(p => <option key={p.id} value={p.id}>{p.nama} · {p.jabatan}</option>)}</select></label>
      <label>Jenis*<select value={f.jenis} onChange={e => gantiJenis(e.target.value)}>{JENIS_KREDENSIAL.map(j => <option key={j}>{j}</option>)}</select></label>
      <label className="span-2">Nama dokumen*<input required value={f.nama} onChange={e => set('nama', e.target.value)} placeholder={f.jenis === 'Sertifikat Pelatihan' ? 'mis. BTCLS, PPI Dasar, Hiperkes' : ''}/></label>
      <label>Nomor<input value={f.nomor} onChange={e => set('nomor', e.target.value)}/></label>
      <label>Penerbit<input value={f.penerbit} onChange={e => set('penerbit', e.target.value)} placeholder={f.jenis === 'SIP' ? 'mis. DPMPTSP Kota …' : f.jenis === 'STR' ? 'KKI' : ''}/></label>
      <label>Tanggal terbit<DateInput value={f.tanggal_terbit} onChange={e => set('tanggal_terbit', e.target.value)}/></label>
      <label>Berlaku sampai{f.jenis === 'SIP' ? '*' : ''}<DateInput required={f.jenis === 'SIP'} min={f.tanggal_terbit || undefined} value={f.berlaku_sampai} onChange={e => set('berlaku_sampai', e.target.value)}/><span className="small muted">{f.jenis === 'STR' ? 'Kosongkan: STR berlaku seumur hidup.' : f.jenis === 'SIP' ? 'Wajib. Masa berlaku SIP 5 tahun.' : 'Kosongkan bila tidak ada batas.'}</span></label>
      <label className="span-2">Catatan<textarea rows={2} value={f.catatan} onChange={e => set('catatan', e.target.value)}/></label>
      {!f.id && <label className="span-2">Lampiran (pindaian dokumen)<input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={e => set('files', Array.from(e.target.files || []))}/></label>}
      {galat && <div className="alert error span-2">{galat}</div>}
      <div className="form-actions span-2"><button type="button" className="btn" onClick={tutup}>Tutup</button><button className="btn primary" disabled={proses}>{proses ? 'Menyimpan…' : 'Simpan'}</button></div>
    </form>
    {f.id && <div className="kotak"><h3>Lampiran</h3><DaftarBerkas berkas={berkas} setGalat={setGalat} onUnggah={unggahLangsung} onHapus={hapusLampiran}/></div>}
  </Modal>
}
