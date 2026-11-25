import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { pesanGalat } from '../lib/format'
import { validasiNama, validasiSandi } from '../lib/validasi'

export function Pengaturan({ profil, onBerubah }) {
  const [nama, setNama] = useState(profil.nama)
  const [sandi, setSandi] = useState('')
  const [ulang, setUlang] = useState('')
  const [pesan, setPesan] = useState({ nama: null, sandi: null }) // { jenis: 'error'|'success', teks }
  const [proses, setProses] = useState('')

  const simpanNama = async e => {
    e.preventDefault()
    const salah = validasiNama(nama); if (salah) { setPesan(p => ({ ...p, nama: { jenis: 'error', teks: salah } })); return }
    setProses('nama')
    const { data, error } = await supabase.from('profiles').update({ nama: nama.trim() }).eq('id', profil.id).select('id')
    setProses('')
    if (error || !data?.length) { setPesan(p => ({ ...p, nama: { jenis: 'error', teks: error ? pesanGalat(error.message) : 'Nama tidak tersimpan. Coba masuk ulang.' } })); return }
    setPesan(p => ({ ...p, nama: { jenis: 'success', teks: 'Nama diperbarui.' } }))
    await onBerubah?.()
  }

  const simpanSandi = async e => {
    e.preventDefault()
    const salah = validasiSandi(sandi, ulang); if (salah) { setPesan(p => ({ ...p, sandi: { jenis: 'error', teks: salah } })); return }
    setProses('sandi')
    const { error } = await supabase.auth.updateUser({ password: sandi })
    setProses('')
    if (error) { setPesan(p => ({ ...p, sandi: { jenis: 'error', teks: pesanGalat(error.message) } })); return }
    setSandi(''); setUlang('')
    setPesan(p => ({ ...p, sandi: { jenis: 'success', teks: 'Kata sandi diganti. Gunakan kata sandi baru saat masuk berikutnya.' } }))
  }

  const Pesan = ({ p }) => p ? <div className={`alert ${p.jenis} span-2`} role="status">{p.teks}</div> : null

  return <div className="page">
    <div className="page-heading"><div><div className="eyebrow">AKUN SAYA</div><h1>Pengaturan</h1><p className="muted">{profil.email} · {profil.jabatan}{profil.is_admin ? ' · Admin' : ''}</p></div></div>
    <form className="card section-card form-grid" onSubmit={simpanNama}>
      <h3 className="span-2">Nama</h3>
      <label className="span-2">Nama lengkap<input required value={nama} onChange={e => setNama(e.target.value)}/></label>
      <Pesan p={pesan.nama}/>
      <div className="form-actions span-2"><button className="btn primary" disabled={proses === 'nama' || nama.trim() === profil.nama}>{proses === 'nama' ? 'Menyimpan…' : 'Simpan Nama'}</button></div>
    </form>
    <form className="card section-card form-grid" onSubmit={simpanSandi}>
      <h3 className="span-2">Ubah kata sandi</h3>
      <label>Kata sandi baru<input type="password" autoComplete="new-password" required minLength={8} value={sandi} onChange={e => setSandi(e.target.value)}/></label>
      <label>Ulangi kata sandi baru<input type="password" autoComplete="new-password" required minLength={8} value={ulang} onChange={e => setUlang(e.target.value)}/></label>
      <p className="small muted span-2">Minimal 8 karakter. Jabatan dan hak admin hanya dapat diubah oleh admin.</p>
      <Pesan p={pesan.sandi}/>
      <div className="form-actions span-2"><button className="btn primary" disabled={proses === 'sandi'}>{proses === 'sandi' ? 'Menyimpan…' : 'Ganti Kata Sandi'}</button></div>
    </form>
    {profil.is_admin && <PengaturanKlinik/>}
  </div>
}

// Khusus admin: kode di tengah nomor surat keluar (001/KODE/XI/2026).
function PengaturanKlinik() {
  const [kode, setKode] = useState('')
  const [asal, setAsal] = useState('')
  const [pesan, setPesan] = useState(null)
  useEffect(() => { supabase.from('pengaturan_klinik').select('kode_surat').eq('id', 1).maybeSingle().then(({ data }) => { if (data) { setKode(data.kode_surat); setAsal(data.kode_surat) } }) }, [])
  const simpan = async e => {
    e.preventDefault()
    const k = kode.trim()
    if (!/^[A-Za-z0-9.\-]{1,20}$/.test(k)) { setPesan({ jenis: 'error', teks: 'Kode hanya huruf, angka, titik, atau tanda hubung (maks. 20), tanpa spasi.' }); return }
    const { data, error } = await supabase.from('pengaturan_klinik').update({ kode_surat: k }).eq('id', 1).select('kode_surat')
    if (error || !data?.length) { setPesan({ jenis: 'error', teks: error ? pesanGalat(error.message) : 'Tidak tersimpan. Pastikan Anda admin aktif.' }); return }
    setAsal(k); setPesan({ jenis: 'success', teks: `Kode disimpan. Surat keluar berikutnya: …/${k}/…` })
  }
  return <form className="card section-card form-grid" onSubmit={simpan}>
    <h3 className="span-2">Kode surat keluar (admin)</h3>
    <label>Kode<input value={kode} onChange={e => setKode(e.target.value)} placeholder="PJM-KLN"/></label>
    <p className="small muted" style={{ alignSelf: 'end' }}>Contoh nomor: <strong>001/{kode.trim() || 'PJM-KLN'}/XI/2026</strong>. Nomor yang sudah terbit tidak berubah.</p>
    {pesan && <div className={`alert ${pesan.jenis} span-2`}>{pesan.teks}</div>}
    <div className="form-actions span-2"><button className="btn primary" disabled={kode.trim() === asal}>Simpan Kode</button></div>
  </form>
}
