import { useEffect, useMemo, useState } from 'react'
import { Download, Inbox, Plus, Send, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { fmtTanggal, hariIni, pesanGalat } from '../lib/format'
import { bulanRomawi, keCsv } from '../lib/aturan'
import { hapusBerkas, simpanSebagai, unggahBerkas } from '../lib/berkas'
import { Modal } from '../ui/Modal'
import { DateInput } from '../ui/DateInput'
import { DaftarBerkas } from '../ui/DaftarBerkas'

export const JENIS_SURAT = ['Undangan', 'Pemberitahuan', 'Permohonan', 'Laporan', 'Rujukan', 'Edaran', 'Keputusan', 'Lainnya']
export const SIFAT = ['Biasa', 'Penting', 'Segera', 'Rahasia']
const STATUS = { Masuk: ['Diterima', 'Didisposisi', 'Selesai', 'Dibatalkan'], Keluar: ['Draf', 'Terkirim', 'Selesai', 'Dibatalkan'] }
const KELAS_STATUS = { Diterima: 'info', Didisposisi: 'warn', Draf: 'muted', Terkirim: 'info', Selesai: 'ok', Dibatalkan: 'off' }
const PILIH = '*, disposisi:profiles!surat_disposisi_kepada_fkey(id,nama), berkas:surat_berkas(id,nama_file,storage_path,ukuran,mime,created_at)'
const PER_HALAMAN = 50
const bersihCari = q => q.replace(/[,()%*\\]/g, ' ').trim()

export function Surat({ profil }) {
  const tahunIni = Number(hariIni().slice(0, 4))
  const [filter, setFilter] = useState({ arah: '', tahun: String(tahunIni), status: '', jenis: '', q: '' })
  const [halaman, setHalaman] = useState(0)
  const [daftar, setDaftar] = useState([])
  const [jumlah, setJumlah] = useState(0)
  const [staf, setStaf] = useState([])
  const [kode, setKode] = useState('PJM-KLN')
  const [baru, setBaru] = useState(null)
  const [bukaId, setBukaId] = useState(null)
  const [galat, setGalat] = useState('')
  const [info, setInfo] = useState('')
  const [muatUlang, setMuatUlang] = useState(0)

  const susunQuery = (q, f) => {
    if (f.arah) q = q.eq('arah', f.arah)
    if (f.tahun) q = q.eq('tahun', Number(f.tahun))
    if (f.status) q = q.eq('status', f.status)
    if (f.jenis) q = q.eq('jenis', f.jenis)
    const cari = bersihCari(f.q)
    if (cari) q = q.or(['nomor_agenda', 'nomor_surat', 'perihal', 'pihak'].map(k => `${k}.ilike.%${cari}%`).join(','))
    return q.order('tahun', { ascending: false }).order('created_at', { ascending: false })
  }

  useEffect(() => {
    let aktif = true
    susunQuery(supabase.from('surat').select(PILIH, { count: 'exact' }), filter).range(halaman * PER_HALAMAN, (halaman + 1) * PER_HALAMAN - 1)
      .then(({ data, count, error }) => { if (!aktif) return; if (error) setGalat(pesanGalat(error.message)); else { setDaftar(data || []); setJumlah(count || 0) } })
    return () => { aktif = false }
  }, [filter, halaman, muatUlang])
  useEffect(() => {
    supabase.from('profiles').select('id,nama,jabatan').eq('aktif', true).order('nama').then(({ data }) => setStaf(data || []))
    supabase.from('pengaturan_klinik').select('kode_surat').eq('id', 1).maybeSingle().then(({ data }) => data && setKode(data.kode_surat))
  }, [])

  const ubahFilter = (k, v) => { setHalaman(0); setFilter(f => ({ ...f, [k]: v })) }
  const segarkan = () => setMuatUlang(v => v + 1)
  const tahunPilihan = Array.from({ length: 6 }, (_, i) => tahunIni + 1 - i)

  const ekspor = async () => {
    const { data, error } = await susunQuery(supabase.from('surat').select(PILIH), filter).limit(5000)
    if (error) { setGalat(pesanGalat(error.message)); return }
    simpanSebagai(`register-surat-${filter.tahun || 'semua'}.csv`, keCsv(data, [
      ['nomor_agenda', 'No. Agenda'], ['arah', 'Arah'], ['nomor_surat', 'Nomor Surat'], [r => fmtTanggal(r.tanggal_surat), 'Tanggal Surat'],
      [r => fmtTanggal(r.arah === 'Masuk' ? r.tanggal_terima : r.tanggal_kirim), 'Tgl Diterima/Dikirim'], ['pihak', 'Pengirim/Tujuan'], ['perihal', 'Perihal'],
      ['jenis', 'Jenis'], ['sifat', 'Sifat'], ['status', 'Status'], [r => r.disposisi?.nama || '', 'Disposisi kepada'], ['disposisi_instruksi', 'Instruksi'],
      [r => (r.berkas || []).length, 'Jumlah lampiran'], ['catatan', 'Catatan'],
    ]), 'text/csv;charset=utf-8')
  }

  const dibuka = daftar.find(s => s.id === bukaId)

  return <div className="page">
    <div className="page-heading">
      <div><div className="eyebrow">ADMINISTRASI KANTOR</div><h1>Surat Masuk & Keluar</h1><p className="muted">Nomor agenda dan nomor surat keluar dibuat otomatis dan tidak dapat diubah. Surat tidak dihapus; batalkan bila keliru.</p></div>
      <div className="row-actions">
        <button className="btn" onClick={ekspor}><Download size={16}/> Ekspor CSV</button>
        <button className="btn" onClick={() => setBaru({ arah: 'Masuk' })}><Inbox size={16}/> Catat Surat Masuk</button>
        <button className="btn primary" onClick={() => setBaru({ arah: 'Keluar' })}><Send size={16}/> Buat Surat Keluar</button>
      </div>
    </div>
    {galat && !baru && !bukaId && <div className="alert error">{galat}</div>}
    {info && <div className="alert success">{info}</div>}
    <div className="toolbar card">
      <div className="search"><Search size={16}/><input aria-label="Cari surat" placeholder="Cari nomor, perihal, pengirim/tujuan…" value={filter.q} onChange={e => ubahFilter('q', e.target.value)}/></div>
      <select aria-label="Arah" value={filter.arah} onChange={e => ubahFilter('arah', e.target.value)}><option value="">Masuk & Keluar</option><option>Masuk</option><option>Keluar</option></select>
      <select aria-label="Tahun" value={filter.tahun} onChange={e => ubahFilter('tahun', e.target.value)}><option value="">Semua tahun</option>{tahunPilihan.map(t => <option key={t}>{t}</option>)}</select>
      <select aria-label="Status" value={filter.status} onChange={e => ubahFilter('status', e.target.value)}><option value="">Semua status</option>{[...new Set([...STATUS.Masuk, ...STATUS.Keluar])].map(s => <option key={s}>{s}</option>)}</select>
      <select aria-label="Jenis" value={filter.jenis} onChange={e => ubahFilter('jenis', e.target.value)}><option value="">Semua jenis</option>{JENIS_SURAT.map(s => <option key={s}>{s}</option>)}</select>
    </div>
    <div className="card table-wrap"><table>
      <thead><tr><th>No. Agenda</th><th>Nomor & tanggal surat</th><th>Pengirim / tujuan</th><th>Perihal</th><th>Status</th><th>Lampiran</th></tr></thead>
      <tbody>{daftar.map(s => <tr key={s.id} className="klik" onClick={() => { setGalat(''); setInfo(''); setBukaId(s.id) }}>
        <td><strong>{s.nomor_agenda}</strong><div className="small muted">{s.arah === 'Masuk' ? '↓ Masuk' : '↑ Keluar'}</div></td>
        <td>{s.nomor_surat || <span className="muted">—</span>}<div className="small muted">{fmtTanggal(s.tanggal_surat)}</div></td>
        <td>{s.pihak}</td>
        <td><span className={s.status === 'Dibatalkan' ? 'coret' : ''}>{s.perihal}</span><div className="small muted">{s.jenis}{s.sifat !== 'Biasa' ? ` · ${s.sifat}` : ''}</div></td>
        <td><span className={`pill ${KELAS_STATUS[s.status]}`}>{s.status}</span>{s.disposisi && <div className="small muted">→ {s.disposisi.nama}</div>}</td>
        <td className="small">{s.berkas?.length || '—'}</td>
      </tr>)}</tbody>
    </table>{!daftar.length && <div className="empty">Belum ada surat yang cocok.</div>}</div>
    <div className="pager"><span className="small muted">{jumlah ? `${halaman * PER_HALAMAN + 1}–${halaman * PER_HALAMAN + daftar.length} dari ${jumlah}` : '0 surat'}</span>
      <div className="row-actions"><button className="btn small" disabled={!halaman} onClick={() => setHalaman(h => h - 1)}>Sebelumnya</button><button className="btn small" disabled={(halaman + 1) * PER_HALAMAN >= jumlah} onClick={() => setHalaman(h => h + 1)}>Berikutnya</button></div></div>

    {baru && <FormSuratBaru arah={baru.arah} kode={kode} tutup={() => setBaru(null)} selesai={async s => { setBaru(null); setInfo(`${s.arah === 'Keluar' ? `Surat keluar ${s.nomor_surat}` : 'Surat masuk'} tercatat dengan No. Agenda ${s.nomor_agenda}.`); segarkan(); setBukaId(s.id) }}/>}
    {dibuka && <DetailSurat surat={dibuka} staf={staf} profil={profil} tutup={() => setBukaId(null)} segarkan={segarkan}/>}
  </div>
}

function FormSuratBaru({ arah, kode, tutup, selesai }) {
  const [f, setF] = useState({ tanggal_surat: hariIni(), tanggal_terima: hariIni(), tanggal_kirim: '', nomor_masuk: '', perihal: '', pihak: '', jenis: arah === 'Masuk' ? 'Pemberitahuan' : 'Pemberitahuan', sifat: 'Biasa', catatan: '' })
  const [files, setFiles] = useState([])
  const [galat, setGalat] = useState('')
  const [proses, setProses] = useState(false)
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))
  const contohNomor = f.tanggal_surat ? `…/${kode}/${bulanRomawi(f.tanggal_surat)}/${f.tanggal_surat.slice(0, 4)}` : ''
  const simpan = async e => {
    e.preventDefault(); setGalat('')
    if (!f.tanggal_surat) { setGalat('Isi tanggal surat.'); return }
    setProses(true)
    const { data, error } = await supabase.rpc('buat_surat', {
      p_arah: arah, p_tanggal_surat: f.tanggal_surat, p_tanggal_terima: arah === 'Masuk' ? f.tanggal_terima || null : null,
      p_tanggal_kirim: arah === 'Keluar' ? f.tanggal_kirim || null : null, p_perihal: f.perihal, p_pihak: f.pihak,
      p_jenis: f.jenis, p_sifat: f.sifat, p_nomor_surat_masuk: arah === 'Masuk' ? f.nomor_masuk : null, p_catatan: f.catatan,
    })
    if (error) { setProses(false); setGalat(pesanGalat(error.message)); return }
    const gagal = []
    for (const file of files) {
      try {
        const u = await unggahBerkas(`surat/${data.id}`, file)
        const { error: e2 } = await supabase.from('surat_berkas').insert({ surat_id: data.id, nama_file: u.nama, storage_path: u.path, ukuran: u.ukuran, mime: u.mime })
        if (e2) { await hapusBerkas([u.path]).catch(() => {}); gagal.push(file.name) }
      } catch { gagal.push(file.name) }
    }
    setProses(false)
    if (gagal.length) window.alert(`Surat tersimpan (${data.nomor_agenda}), tetapi lampiran ini gagal diunggah: ${gagal.join(', ')}. Unggah ulang dari detail surat.`)
    selesai(data)
  }
  return <Modal judul={arah === 'Masuk' ? 'Catat Surat Masuk' : 'Buat Surat Keluar'} tutup={tutup} lebar>
    <form className="form-grid" onSubmit={simpan}>
      {arah === 'Keluar' && <div className="alert info span-2">Nomor surat akan dibuat otomatis saat disimpan, mis. <strong>{contohNomor}</strong>. Bulan pada nomor mengikuti tanggal surat.</div>}
      <label>Tanggal surat*<DateInput required value={f.tanggal_surat} onChange={e => set('tanggal_surat', e.target.value)}/></label>
      {arah === 'Masuk'
        ? <label>Tanggal diterima*<DateInput required value={f.tanggal_terima} onChange={e => set('tanggal_terima', e.target.value)}/></label>
        : <label>Tanggal dikirim<DateInput value={f.tanggal_kirim} onChange={e => set('tanggal_kirim', e.target.value)}/></label>}
      {arah === 'Masuk' && <label className="span-2">Nomor surat dari pengirim<input value={f.nomor_masuk} onChange={e => set('nomor_masuk', e.target.value)} placeholder="mis. 045/RS/XI/2026"/></label>}
      <label className="span-2">{arah === 'Masuk' ? 'Pengirim*' : 'Tujuan*'}<input required value={f.pihak} onChange={e => set('pihak', e.target.value)} placeholder={arah === 'Masuk' ? 'Instansi / orang pengirim' : 'Instansi / orang tujuan'}/></label>
      <label className="span-2">Perihal*<input required value={f.perihal} onChange={e => set('perihal', e.target.value)}/></label>
      <label>Jenis<select value={f.jenis} onChange={e => set('jenis', e.target.value)}>{JENIS_SURAT.map(j => <option key={j}>{j}</option>)}</select></label>
      <label>Sifat<select value={f.sifat} onChange={e => set('sifat', e.target.value)}>{SIFAT.map(j => <option key={j}>{j}</option>)}</select></label>
      <label className="span-2">Catatan<textarea rows={2} value={f.catatan} onChange={e => set('catatan', e.target.value)}/></label>
      <label className="span-2">Lampiran (pindaian / berkas surat)<input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" onChange={e => setFiles(Array.from(e.target.files || []))}/><span className="small muted">Boleh lebih dari satu. Maks. 10 MB per berkas.</span></label>
      {galat && <div className="alert error span-2">{galat}</div>}
      <div className="form-actions span-2"><button type="button" className="btn" onClick={tutup}>Batal</button><button className="btn primary" disabled={proses}>{proses ? 'Menyimpan…' : arah === 'Keluar' ? 'Simpan & Beri Nomor' : 'Simpan'}</button></div>
    </form>
  </Modal>
}

function DetailSurat({ surat: s, staf, profil, tutup, segarkan }) {
  const [f, setF] = useState(null)
  const [disp, setDisp] = useState(null)
  const [galat, setGalat] = useState('')
  const [info, setInfo] = useState('')
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))
  const statusBerikut = useMemo(() => STATUS[s.arah].filter(x => x !== s.status && x !== 'Dibatalkan' && !(x === 'Didisposisi')), [s])

  const ubah = async (payload, pesan) => {
    setGalat(''); setInfo('')
    const { data, error } = await supabase.from('surat').update(payload).eq('id', s.id).select('id')
    if (error) { setGalat(pesanGalat(error.message)); return false }
    if (!data?.length) { setGalat('Perubahan tidak tersimpan. Coba muat ulang halaman.'); return false }
    setInfo(pesan); segarkan(); return true
  }
  const simpanData = async e => {
    e.preventDefault()
    const payload = { perihal: f.perihal.trim(), pihak: f.pihak.trim(), jenis: f.jenis, sifat: f.sifat, catatan: f.catatan.trim() || null, tanggal_surat: f.tanggal_surat }
    if (s.arah === 'Masuk') { payload.tanggal_terima = f.tanggal_terima || null; payload.nomor_surat = f.nomor_surat.trim() || null } else payload.tanggal_kirim = f.tanggal_kirim || null
    if (await ubah(payload, 'Data surat diperbarui.')) setF(null)
  }
  const simpanDisposisi = async e => {
    e.preventDefault()
    if (!disp.kepada) { setGalat('Pilih staf tujuan disposisi.'); return }
    if (await ubah({ disposisi_kepada: disp.kepada, disposisi_instruksi: disp.instruksi.trim() || null, disposisi_tanggal: disp.tanggal || hariIni() }, 'Disposisi disimpan.')) setDisp(null)
  }
  const batalkan = () => { if (window.confirm(`Batalkan surat ${s.nomor_agenda}? Nomornya tetap tercatat sebagai dibatalkan dan tidak dipakai ulang.`)) ubah({ status: 'Dibatalkan' }, 'Surat dibatalkan.') }
  const unggah = async files => {
    for (const file of files) {
      const u = await unggahBerkas(`surat/${s.id}`, file)
      const { error } = await supabase.from('surat_berkas').insert({ surat_id: s.id, nama_file: u.nama, storage_path: u.path, ukuran: u.ukuran, mime: u.mime })
      if (error) { await hapusBerkas([u.path]).catch(() => {}); throw new Error(pesanGalat(error.message)) }
    }
    setInfo('Lampiran ditambahkan.'); segarkan()
  }
  const hapus = async b => {
    if (!window.confirm(`Hapus lampiran "${b.nama_file}"?`)) return
    const { data, error } = await supabase.from('surat_berkas').delete().eq('id', b.id).select('id')
    if (error || !data?.length) { setGalat(error ? pesanGalat(error.message) : 'Lampiran tidak terhapus.'); return }
    try { await hapusBerkas([b.storage_path]) } catch (err) { setGalat(err.message) }
    setInfo('Lampiran dihapus.'); segarkan()
  }
  const batal = s.status === 'Dibatalkan'

  return <Modal judul={`${s.nomor_agenda} · Surat ${s.arah}`} tutup={tutup} lebar>
    {galat && <div className="alert error">{galat}</div>}
    {info && <div className="alert success">{info}</div>}
    {!f ? <div className="detail-grid">
      <div><span>Nomor surat</span><strong>{s.nomor_surat || '—'}</strong></div>
      <div><span>Status</span><strong><span className={`pill ${KELAS_STATUS[s.status]}`}>{s.status}</span></strong></div>
      <div><span>Tanggal surat</span><strong>{fmtTanggal(s.tanggal_surat)}</strong></div>
      <div><span>{s.arah === 'Masuk' ? 'Diterima' : 'Dikirim'}</span><strong>{fmtTanggal(s.arah === 'Masuk' ? s.tanggal_terima : s.tanggal_kirim)}</strong></div>
      <div className="span-2"><span>{s.arah === 'Masuk' ? 'Pengirim' : 'Tujuan'}</span><strong>{s.pihak}</strong></div>
      <div className="span-2"><span>Perihal</span><strong className={batal ? 'coret' : ''}>{s.perihal}</strong></div>
      <div><span>Jenis</span><strong>{s.jenis}</strong></div><div><span>Sifat</span><strong>{s.sifat}</strong></div>
      {s.arah === 'Masuk' && <div className="span-2"><span>Disposisi</span><strong>{s.disposisi ? `${s.disposisi.nama} · ${fmtTanggal(s.disposisi_tanggal)}` : '—'}</strong>{s.disposisi_instruksi && <p className="small">{s.disposisi_instruksi}</p>}</div>}
      {s.catatan && <div className="span-2"><span>Catatan</span><p>{s.catatan}</p></div>}
    </div> : <form className="form-grid" onSubmit={simpanData}>
      <label>Tanggal surat<DateInput required value={f.tanggal_surat} onChange={e => set('tanggal_surat', e.target.value)}/>{s.arah === 'Keluar' && <span className="small muted">Hanya dapat diubah dalam bulan yang sama (bulan tercantum di nomor).</span>}</label>
      {s.arah === 'Masuk' ? <label>Tanggal diterima<DateInput value={f.tanggal_terima} onChange={e => set('tanggal_terima', e.target.value)}/></label>
        : <label>Tanggal dikirim<DateInput value={f.tanggal_kirim} onChange={e => set('tanggal_kirim', e.target.value)}/></label>}
      {s.arah === 'Masuk' && <label className="span-2">Nomor surat dari pengirim<input value={f.nomor_surat} onChange={e => set('nomor_surat', e.target.value)}/></label>}
      <label className="span-2">{s.arah === 'Masuk' ? 'Pengirim' : 'Tujuan'}<input required value={f.pihak} onChange={e => set('pihak', e.target.value)}/></label>
      <label className="span-2">Perihal<input required value={f.perihal} onChange={e => set('perihal', e.target.value)}/></label>
      <label>Jenis<select value={f.jenis} onChange={e => set('jenis', e.target.value)}>{JENIS_SURAT.map(j => <option key={j}>{j}</option>)}</select></label>
      <label>Sifat<select value={f.sifat} onChange={e => set('sifat', e.target.value)}>{SIFAT.map(j => <option key={j}>{j}</option>)}</select></label>
      <label className="span-2">Catatan<textarea rows={2} value={f.catatan} onChange={e => set('catatan', e.target.value)}/></label>
      <div className="form-actions span-2"><button type="button" className="btn" onClick={() => setF(null)}>Batal</button><button className="btn primary">Simpan</button></div>
    </form>}

    {disp && <form className="form-grid kotak" onSubmit={simpanDisposisi}>
      <label>Diteruskan kepada*<select value={disp.kepada} onChange={e => setDisp({ ...disp, kepada: e.target.value })}><option value="">— pilih staf —</option>{staf.map(p => <option key={p.id} value={p.id}>{p.nama} · {p.jabatan}</option>)}</select></label>
      <label>Tanggal disposisi<DateInput value={disp.tanggal} onChange={e => setDisp({ ...disp, tanggal: e.target.value })}/></label>
      <label className="span-2">Instruksi<textarea rows={2} value={disp.instruksi} onChange={e => setDisp({ ...disp, instruksi: e.target.value })} placeholder="mis. Mohon ditindaklanjuti dan laporkan"/></label>
      <div className="form-actions span-2"><button type="button" className="btn" onClick={() => setDisp(null)}>Batal</button><button className="btn primary">Simpan Disposisi</button></div>
    </form>}

    {!f && !disp && !batal && <div className="row-actions kiri">
      <button className="btn small" onClick={() => setF({ tanggal_surat: s.tanggal_surat, tanggal_terima: s.tanggal_terima || '', tanggal_kirim: s.tanggal_kirim || '', nomor_surat: s.nomor_surat || '', perihal: s.perihal, pihak: s.pihak, jenis: s.jenis, sifat: s.sifat, catatan: s.catatan || '' })}>Ubah data</button>
      {s.arah === 'Masuk' && <button className="btn small" onClick={() => setDisp({ kepada: s.disposisi_kepada || '', instruksi: s.disposisi_instruksi || '', tanggal: s.disposisi_tanggal || hariIni() })}>{s.disposisi_kepada ? 'Ubah disposisi' : 'Disposisi'}</button>}
      {statusBerikut.map(st => <button key={st} className="btn small primary" onClick={() => ubah({ status: st, ...(st === 'Terkirim' && !s.tanggal_kirim ? { tanggal_kirim: hariIni() } : {}) }, `Status menjadi ${st}.`)}>Tandai {st}</button>)}
      <button className="btn small danger" onClick={batalkan}>Batalkan surat</button>
    </div>}

    <div className="kotak"><h3>Lampiran</h3>
      <DaftarBerkas berkas={s.berkas || []} izinWord setGalat={setGalat} onUnggah={batal ? null : unggah} onHapus={batal ? null : hapus}/>
    </div>
    <p className="small muted">Dicatat {fmtTanggal(s.created_at)}.</p>
  </Modal>
}
