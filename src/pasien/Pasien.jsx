import { useEffect, useState } from 'react'
import { ArrowLeft, Archive, FilePlus2, FileText, Search, UserPlus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { fmtTanggal, fmtWaktu, hariIni, pesanGalat } from '../lib/format'
import { cekBerkas, keCsv, simpanSampai, ukuranTeks } from '../lib/aturan'
import { ambilBerkas, bukaBerkas, simpanSebagai, unggahBerkas } from '../lib/berkas'
import { buatZip } from '../lib/zip'
import { Modal } from '../ui/Modal'
import { DateInput } from '../ui/DateInput'

export const JENIS_DOKUMEN = ['Pengkajian Keperawatan', 'Asuhan Keperawatan', 'Catatan Perkembangan', 'Informed Consent', 'Resume Pulang', 'Hasil Penunjang', 'Rujukan', 'Lainnya']
const PASIEN_KOSONG = { no_rm: '', nama: '', tanggal_lahir: '', jenis_kelamin: '', telepon: '', alamat: '', catatan: '' }
const bersihCari = q => q.replace(/[,()%*\\]/g, ' ').trim()
const namaFolder = p => `${p.no_rm} ${p.nama}`.replace(/[\\/:*?"<>|]+/g, '_').trim()

export function Pasien({ profil, pasienAwal }) {
  const [q, setQ] = useState('')
  const [daftar, setDaftar] = useState([])
  const [jumlah, setJumlah] = useState(0)
  const [pilihId, setPilihId] = useState(pasienAwal || null)
  const [form, setForm] = useState(null)
  const [galat, setGalat] = useState('')
  const [info, setInfo] = useState('')
  const [ekspor, setEkspor] = useState('')
  const [muatUlang, setMuatUlang] = useState(0)

  useEffect(() => {
    let aktif = true
    let query = supabase.from('pasien').select('*, dokumen:pasien_dokumen(count)', { count: 'exact' }).order('updated_at', { ascending: false }).limit(100)
    const cari = bersihCari(q)
    if (cari) query = query.or(`no_rm.ilike.%${cari}%,nama.ilike.%${cari}%`)
    query.then(({ data, count, error }) => { if (!aktif) return; if (error) setGalat(pesanGalat(error.message)); else { setDaftar(data || []); setJumlah(count || 0) } })
    return () => { aktif = false }
  }, [q, muatUlang])

  const simpanPasien = async e => {
    e.preventDefault(); setGalat('')
    const payload = { no_rm: form.no_rm.trim(), nama: form.nama.trim(), tanggal_lahir: form.tanggal_lahir || null, jenis_kelamin: form.jenis_kelamin || null, telepon: form.telepon.trim() || null, alamat: form.alamat.trim() || null, catatan: form.catatan.trim() || null }
    const qy = form.id ? supabase.from('pasien').update(payload).eq('id', form.id).select('id') : supabase.from('pasien').insert(payload).select('id')
    const { data, error } = await qy
    if (error || !data?.length) { setGalat(error ? pesanGalat(error.message) : 'Data pasien tidak tersimpan.'); return }
    setForm(null); setInfo(form.id ? 'Data pasien diperbarui.' : 'Pasien ditambahkan.'); setMuatUlang(v => v + 1); setPilihId(data[0].id)
  }

  // Cadangan semua pasien: satu ZIP berisi folder per pasien + indeks CSV.
  const eksporSemua = async () => {
    if (!window.confirm('Unduh cadangan SEMUA dokumen pasien dalam satu berkas ZIP? Bisa memakan waktu beberapa menit bila berkasnya banyak. Simpan ZIP di tempat aman.')) return
    setGalat(''); setEkspor('Menyiapkan daftar…')
    try {
      const { data: semua, error } = await supabase.from('pasien_dokumen').select('*, pasien:pasien_id(no_rm,nama,tanggal_lahir,kunjungan_terakhir)').order('pasien_id').order('tanggal_dokumen')
      if (error) throw new Error(pesanGalat(error.message))
      const total = semua.reduce((s, d) => s + (d.ukuran || 0), 0)
      if (total > 700 * 1024 * 1024 && !window.confirm(`Total berkas sekitar ${ukuranTeks(total)}. Lanjutkan? (Browser memerlukan memori sebesar itu.)`)) { setEkspor(''); return }
      const entri = []
      for (let i = 0; i < semua.length; i++) {
        const d = semua[i]; setEkspor(`Mengunduh berkas ${i + 1} dari ${semua.length}…`)
        entri.push({ nama: `${namaFolder(d.pasien)}/${d.tanggal_dokumen} ${d.jenis} - ${d.nama_file}`, data: await ambilBerkas(d.storage_path) })
      }
      entri.unshift({ nama: 'indeks-dokumen-pasien.csv', data: new TextEncoder().encode(keCsv(semua, [
        [d => d.pasien?.no_rm, 'No. RM'], [d => d.pasien?.nama, 'Nama pasien'], [d => fmtTanggal(d.pasien?.tanggal_lahir), 'Tgl lahir'],
        [d => fmtTanggal(d.tanggal_dokumen), 'Tanggal dokumen'], ['jenis', 'Jenis'], ['judul', 'Judul'], ['status', 'Status'], ['alasan_tarik', 'Alasan ditarik'],
        ['nama_file', 'Berkas'], [d => `${namaFolder(d.pasien)}/${d.tanggal_dokumen} ${d.jenis} - ${d.nama_file}`, 'Lokasi di ZIP'],
        [d => fmtTanggal(simpanSampai(d.pasien?.kunjungan_terakhir)), 'Simpan sampai'],
      ])) })
      setEkspor('Menyusun ZIP…')
      simpanSebagai(`cadangan-dokumen-pasien-${hariIni()}.zip`, buatZip(entri), 'application/zip')
      setInfo(`Cadangan berisi ${semua.length} dokumen diunduh.`)
    } catch (err) { setGalat(err.message) }
    setEkspor('')
  }

  if (pilihId) return <DetailPasien id={pilihId} profil={profil} kembali={() => { setPilihId(null); setMuatUlang(v => v + 1) }}/>

  return <div className="page">
    <div className="page-heading">
      <div><div className="eyebrow">ASUHAN KEPERAWATAN</div><h1>Dokumen Pasien</h1><p className="muted">Dokumen pendukung keperawatan per pasien. Dokumen tidak dapat dihapus (retensi minimal 25 tahun sejak kunjungan terakhir, Permenkes 24/2022).</p></div>
      <div className="row-actions">
        {profil.is_admin && <button className="btn" disabled={!!ekspor} onClick={eksporSemua}><Archive size={16}/> {ekspor ? 'Mencadangkan…' : 'Cadangkan semua (ZIP)'}</button>}
        <button className="btn primary" onClick={() => { setGalat(''); setInfo(''); setForm({ ...PASIEN_KOSONG }) }}><UserPlus size={16}/> Tambah Pasien</button>
      </div>
    </div>
    <div className="alert warn">Aplikasi ini menyimpan dokumen pendukung keperawatan, bukan rekam medis elektronik resmi klinik (yang wajib terhubung ke SATUSEHAT).</div>
    {ekspor && <div className="alert info">{ekspor}</div>}
    {galat && !form && <div className="alert error">{galat}</div>}
    {info && <div className="alert success">{info}</div>}
    <div className="toolbar card"><div className="search"><Search size={16}/><input aria-label="Cari pasien" placeholder="Cari No. RM atau nama pasien…" value={q} onChange={e => setQ(e.target.value)}/></div><span className="small muted">{jumlah} pasien{jumlah > 100 ? ' (100 terbaru ditampilkan; gunakan pencarian)' : ''}</span></div>
    <div className="card table-wrap"><table>
      <thead><tr><th>No. RM</th><th>Nama</th><th>Tgl lahir</th><th>Kunjungan terakhir</th><th>Dokumen</th></tr></thead>
      <tbody>{daftar.map(p => <tr key={p.id} className="klik" onClick={() => { setInfo(''); setPilihId(p.id) }}>
        <td><strong>{p.no_rm}</strong></td><td>{p.nama}{p.jenis_kelamin ? <span className="small muted"> · {p.jenis_kelamin}</span> : ''}</td>
        <td>{fmtTanggal(p.tanggal_lahir)}</td><td>{fmtTanggal(p.kunjungan_terakhir)}</td><td className="small">{p.dokumen?.[0]?.count ?? 0}</td>
      </tr>)}</tbody>
    </table>{!daftar.length && <div className="empty">{q ? 'Pasien tidak ditemukan.' : 'Belum ada pasien. Klik "Tambah Pasien".'}</div>}</div>
    {form && <FormPasien form={form} setForm={setForm} galat={galat} simpan={simpanPasien}/>}
  </div>
}

function FormPasien({ form, setForm, galat, simpan }) {
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  return <Modal judul={form.id ? `Ubah ${form.no_rm}` : 'Tambah Pasien'} tutup={() => setForm(null)} lebar>
    <form className="form-grid" onSubmit={simpan}>
      <label>No. RM*<input required autoFocus value={form.no_rm} onChange={e => set('no_rm', e.target.value)} placeholder="Sesuai nomor rekam medis klinik"/></label>
      <label>Nama pasien*<input required value={form.nama} onChange={e => set('nama', e.target.value)}/></label>
      <label>Tanggal lahir<DateInput value={form.tanggal_lahir} onChange={e => set('tanggal_lahir', e.target.value)}/></label>
      <label>Jenis kelamin<select value={form.jenis_kelamin} onChange={e => set('jenis_kelamin', e.target.value)}><option value="">—</option><option value="L">Laki-laki</option><option value="P">Perempuan</option></select></label>
      <label>Telepon<input value={form.telepon} onChange={e => set('telepon', e.target.value)}/></label>
      <label>Alamat<input value={form.alamat} onChange={e => set('alamat', e.target.value)}/></label>
      <label className="span-2">Catatan<textarea rows={2} value={form.catatan} onChange={e => set('catatan', e.target.value)} placeholder="mis. alergi, catatan penting untuk perawat"/></label>
      {galat && <div className="alert error span-2">{galat}</div>}
      <div className="form-actions span-2"><button type="button" className="btn" onClick={() => setForm(null)}>Batal</button><button className="btn primary">Simpan</button></div>
    </form>
  </Modal>
}

function DetailPasien({ id, profil, kembali }) {
  const [p, setP] = useState(null)
  const [dok, setDok] = useState([])
  const [form, setForm] = useState(null)
  const [unggah, setUnggah] = useState(null)
  const [tarik, setTarik] = useState(null)
  const [galat, setGalat] = useState('')
  const [info, setInfo] = useState('')
  const [proses, setProses] = useState('')

  const muat = async () => {
    const [a, b] = await Promise.all([
      supabase.from('pasien').select('*').eq('id', id).maybeSingle(),
      supabase.from('pasien_dokumen').select('*, pengunggah:profiles!pasien_dokumen_created_by_fkey(nama), penarik:profiles!pasien_dokumen_ditarik_oleh_fkey(nama)').eq('pasien_id', id).order('tanggal_dokumen', { ascending: false }).order('created_at', { ascending: false }),
    ])
    if (a.error || b.error) { setGalat(pesanGalat((a.error || b.error).message)); return }
    setP(a.data); setDok(b.data || [])
  }
  useEffect(() => { muat() }, [id])

  const simpanPasien = async e => {
    e.preventDefault(); setGalat('')
    const payload = { no_rm: form.no_rm.trim(), nama: form.nama.trim(), tanggal_lahir: form.tanggal_lahir || null, jenis_kelamin: form.jenis_kelamin || null, telepon: form.telepon.trim() || null, alamat: form.alamat.trim() || null, catatan: form.catatan.trim() || null }
    const { data, error } = await supabase.from('pasien').update(payload).eq('id', id).select('id')
    if (error || !data?.length) { setGalat(error ? pesanGalat(error.message) : 'Data pasien tidak tersimpan.'); return }
    setForm(null); setInfo('Data pasien diperbarui.'); muat()
  }

  const simpanDokumen = async e => {
    e.preventDefault(); setGalat('')
    if (!unggah.file) { setGalat('Pilih berkas dokumen.'); return }
    const salah = cekBerkas(unggah.file); if (salah) { setGalat(salah); return }
    setProses('unggah')
    try {
      const docId = crypto.randomUUID()
      const u = await unggahBerkas(`pasien/${id}/${docId}`, unggah.file)
      const { error } = await supabase.from('pasien_dokumen').insert({ id: docId, pasien_id: id, jenis: unggah.jenis, tanggal_dokumen: unggah.tanggal, judul: unggah.judul.trim(), catatan: unggah.catatan.trim() || null, nama_file: u.nama, storage_path: u.path, ukuran: u.ukuran, mime: u.mime })
      // Berkas pasien tidak dapat dihapus lewat aplikasi; bila pencatatan gagal, berkas yatim dibiarkan (aman) dan pengguna diminta mencoba lagi.
      if (error) throw new Error(pesanGalat(error.message))
      setUnggah(null); setInfo('Dokumen tersimpan.'); muat()
    } catch (err) { setGalat(err.message) }
    setProses('')
  }

  const simpanTarik = async e => {
    e.preventDefault(); setGalat('')
    if (tarik.alasan.trim().length < 5) { setGalat('Tuliskan alasan penarikan (minimal 5 huruf).'); return }
    const { data, error } = await supabase.from('pasien_dokumen').update({ status: 'Ditarik', alasan_tarik: tarik.alasan.trim() }).eq('id', tarik.id).select('id')
    if (error || !data?.length) { setGalat(error ? pesanGalat(error.message) : 'Dokumen tidak berubah.'); return }
    setTarik(null); setInfo('Dokumen ditarik. Dokumen tetap tersimpan sebagai arsip.'); muat()
  }

  const eksporPasien = async () => {
    setGalat(''); setProses('ekspor')
    try {
      const entri = [{ nama: 'daftar-dokumen.csv', data: new TextEncoder().encode(keCsv(dok, [
        [d => fmtTanggal(d.tanggal_dokumen), 'Tanggal'], ['jenis', 'Jenis'], ['judul', 'Judul'], ['status', 'Status'], ['alasan_tarik', 'Alasan ditarik'],
        ['catatan', 'Catatan'], ['nama_file', 'Berkas'], [d => d.pengunggah?.nama || '', 'Diunggah oleh'], [d => fmtWaktu(d.created_at), 'Diunggah pada'],
      ])) }]
      for (const d of dok) entri.push({ nama: `${d.tanggal_dokumen} ${d.jenis} - ${d.nama_file}`, data: await ambilBerkas(d.storage_path) })
      simpanSebagai(`${namaFolder(p)}.zip`, buatZip(entri), 'application/zip')
    } catch (err) { setGalat(err.message) }
    setProses('')
  }

  if (!p) return <div className="page">{galat ? <div className="alert error">{galat}</div> : <div className="empty">Memuat…</div>}</div>
  const sampai = simpanSampai(p.kunjungan_terakhir)

  return <div className="page">
    <div className="page-heading">
      <div><button className="link-btn" onClick={kembali}><ArrowLeft size={14}/> Semua pasien</button><div className="eyebrow">{p.no_rm}</div><h1>{p.nama}</h1>
        <p className="muted">{[p.jenis_kelamin === 'L' ? 'Laki-laki' : p.jenis_kelamin === 'P' ? 'Perempuan' : null, p.tanggal_lahir ? `Lahir ${fmtTanggal(p.tanggal_lahir)}` : null, p.telepon].filter(Boolean).join(' · ') || 'Data identitas belum lengkap'}</p></div>
      <div className="row-actions">
        <button className="btn" onClick={() => setForm({ ...p, tanggal_lahir: p.tanggal_lahir || '', jenis_kelamin: p.jenis_kelamin || '', telepon: p.telepon || '', alamat: p.alamat || '', catatan: p.catatan || '' })}>Ubah data</button>
        <button className="btn" disabled={!dok.length || !!proses} onClick={eksporPasien}><Archive size={16}/> {proses === 'ekspor' ? 'Menyiapkan…' : 'Unduh semua (ZIP)'}</button>
        <button className="btn primary" onClick={() => { setGalat(''); setUnggah({ jenis: 'Asuhan Keperawatan', tanggal: hariIni(), judul: '', catatan: '', file: null }) }}><FilePlus2 size={16}/> Tambah Dokumen</button>
      </div>
    </div>
    {galat && !form && <div className="alert error">{galat}</div>}
    {info && <div className="alert success">{info}</div>}
    <div className="detail-grid card section-card">
      <div><span>Kunjungan terakhir</span><strong>{fmtTanggal(p.kunjungan_terakhir)}</strong></div>
      <div><span>Simpan dokumen sampai</span><strong>{sampai ? fmtTanggal(sampai) : '—'}</strong><span className="small muted">25 tahun sejak kunjungan terakhir</span></div>
      {p.alamat && <div><span>Alamat</span><strong>{p.alamat}</strong></div>}
      {p.catatan && <div className="span-2"><span>Catatan</span><p>{p.catatan}</p></div>}
    </div>

    {unggah && <form className="card section-card form-grid" onSubmit={simpanDokumen}>
      <h3 className="span-2">Tambah dokumen</h3>
      <label>Jenis dokumen*<select value={unggah.jenis} onChange={e => setUnggah({ ...unggah, jenis: e.target.value })}>{JENIS_DOKUMEN.map(j => <option key={j}>{j}</option>)}</select></label>
      <label>Tanggal dokumen*<DateInput required value={unggah.tanggal} onChange={e => setUnggah({ ...unggah, tanggal: e.target.value })}/></label>
      <label className="span-2">Judul*<input required value={unggah.judul} onChange={e => setUnggah({ ...unggah, judul: e.target.value })} placeholder="mis. Askep hari ke-1, Persetujuan tindakan infus"/></label>
      <label className="span-2">Catatan<input value={unggah.catatan} onChange={e => setUnggah({ ...unggah, catatan: e.target.value })}/></label>
      <label className="span-2">Berkas* (PDF atau foto, maks. 10 MB)<input type="file" required accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={e => setUnggah({ ...unggah, file: e.target.files?.[0] || null })}/><span className="small muted">Pastikan berkas benar sebelum menyimpan: dokumen pasien tidak dapat dihapus, hanya ditarik dengan alasan.</span></label>
      {galat && <div className="alert error span-2">{galat}</div>}
      <div className="form-actions span-2"><button type="button" className="btn" onClick={() => setUnggah(null)}>Batal</button><button className="btn primary" disabled={proses === 'unggah'}>{proses === 'unggah' ? 'Mengunggah…' : 'Simpan Dokumen'}</button></div>
    </form>}

    <div className="card table-wrap"><table>
      <thead><tr><th>Tanggal</th><th>Jenis & judul</th><th>Berkas</th><th>Diunggah</th><th>Status</th><th></th></tr></thead>
      <tbody>{dok.map(d => <tr key={d.id} className={d.status === 'Ditarik' ? 'redup' : ''}>
        <td>{fmtTanggal(d.tanggal_dokumen)}</td>
        <td><span className={d.status === 'Ditarik' ? 'coret' : ''}><strong>{d.jenis}</strong> · {d.judul}</span>{d.catatan && <div className="small muted">{d.catatan}</div>}</td>
        <td><button className="link-btn" onClick={() => bukaBerkas(d.storage_path).catch(err => setGalat(err.message))}><FileText size={14}/> {d.nama_file}</button><div className="small muted">{ukuranTeks(d.ukuran)}</div></td>
        <td className="small">{d.pengunggah?.nama || '—'}<div className="muted">{fmtWaktu(d.created_at)}</div></td>
        <td>{d.status === 'Aktif' ? <span className="pill ok">Aktif</span> : <><span className="pill off">Ditarik</span><div className="small muted">{d.alasan_tarik}{d.penarik ? ` — ${d.penarik.nama}` : ''}</div></>}</td>
        <td>{d.status === 'Aktif' && <button className="btn small danger" onClick={() => { setGalat(''); setTarik({ id: d.id, judul: d.judul, alasan: '' }) }}>Tarik</button>}</td>
      </tr>)}</tbody>
    </table>{!dok.length && <div className="empty">Belum ada dokumen untuk pasien ini.</div>}</div>

    {tarik && <Modal judul="Tarik dokumen" tutup={() => setTarik(null)}>
      <form className="form-grid" onSubmit={simpanTarik}>
        <p className="span-2">Dokumen <strong>{tarik.judul}</strong> akan ditandai <strong>Ditarik</strong>. Berkasnya tetap tersimpan sebagai arsip dan tidak dapat diaktifkan kembali.</p>
        <label className="span-2">Alasan penarikan*<textarea required rows={2} value={tarik.alasan} onChange={e => setTarik({ ...tarik, alasan: e.target.value })} placeholder="mis. Salah unggah ke pasien lain; diganti dokumen versi benar"/></label>
        {galat && <div className="alert error span-2">{galat}</div>}
        <div className="form-actions span-2"><button type="button" className="btn" onClick={() => setTarik(null)}>Batal</button><button className="btn primary danger-fill">Tarik Dokumen</button></div>
      </form>
    </Modal>}
    {form && <FormPasien form={form} setForm={setForm} galat={galat} simpan={simpanPasien}/>}
  </div>
}
