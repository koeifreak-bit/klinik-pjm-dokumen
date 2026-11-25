import { useState } from 'react'
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
  </div>
}
