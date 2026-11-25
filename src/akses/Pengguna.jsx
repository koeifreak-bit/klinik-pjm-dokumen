import { useEffect, useState } from 'react'
import { Pencil, Plus, UserCheck, UserX } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { fmtTanggal, pesanGalat } from '../lib/format'
import { JABATAN, validasiNama, validasiPenggunaBaru } from '../lib/validasi'
import { Modal } from '../ui/Modal'

const KOSONG = { nama: '', email: '', password: '', jabatan: 'Perawat', is_admin: false }

// Galat dari fungsi Edge: isi pesan ada di body respons.
async function galatFungsi(error, data) {
  if (data?.error) return data.error
  try { const body = await error?.context?.json?.(); if (body?.error) return body.error } catch { /* abaikan */ }
  return pesanGalat(error?.message)
}

export function Pengguna({ profil, onBerubah }) {
  const [daftar, setDaftar] = useState([])
  const [galat, setGalat] = useState('')
  const [info, setInfo] = useState('')
  const [form, setForm] = useState(null) // { mode: 'baru' | 'ubah', ... }
  const [proses, setProses] = useState(false)

  const muat = async () => {
    const { data, error } = await supabase.from('profiles').select('*').order('aktif', { ascending: false }).order('nama')
    if (error) setGalat(pesanGalat(error.message)); else setDaftar(data || [])
  }
  useEffect(() => { muat() }, [])

  if (!profil.is_admin) return <div className="page"><div className="alert error">Halaman ini hanya untuk admin.</div></div>

  const selesai = async pesan => { setForm(null); setInfo(pesan); await muat(); await onBerubah?.() }

  const simpan = async e => {
    e.preventDefault(); setGalat('')
    if (form.mode === 'baru') {
      const salah = validasiPenggunaBaru(form); if (salah) { setGalat(salah); return }
      setProses(true)
      const { data, error } = await supabase.functions.invoke('tambah-pengguna', { body: { nama: form.nama.trim(), email: form.email.trim().toLowerCase(), password: form.password, jabatan: form.jabatan, is_admin: form.is_admin } })
      setProses(false)
      if (error || data?.error) { setGalat(await galatFungsi(error, data)); return }
      await selesai(`Akun ${form.nama.trim()} dibuat. Ia dapat langsung masuk dengan email dan kata sandi tersebut.`)
    } else {
      const salah = validasiNama(form.nama); if (salah) { setGalat(salah); return }
      setProses(true)
      const { data, error } = await supabase.from('profiles').update({ nama: form.nama.trim(), jabatan: form.jabatan, is_admin: form.is_admin }).eq('id', form.id).select('id')
      setProses(false)
      if (error) { setGalat(pesanGalat(error.message)); return }
      if (!data?.length) { setGalat('Perubahan tidak tersimpan. Pastikan Anda masih admin aktif.'); return }
      await selesai(`Data ${form.nama.trim()} diperbarui.`)
    }
  }

  const ubahStatus = async p => {
    const tujuan = !p.aktif
    if (!window.confirm(tujuan ? `Aktifkan kembali akun ${p.nama}?` : `Nonaktifkan akun ${p.nama}? Ia tidak akan dapat membuka aplikasi sampai diaktifkan lagi.`)) return
    setGalat(''); setInfo('')
    const { data, error } = await supabase.from('profiles').update({ aktif: tujuan }).eq('id', p.id).select('id')
    if (error) { setGalat(pesanGalat(error.message)); return }
    if (!data?.length) { setGalat('Perubahan tidak tersimpan. Pastikan Anda masih admin aktif.'); return }
    await selesai(tujuan ? `Akun ${p.nama} aktif kembali.` : `Akun ${p.nama} dinonaktifkan.`)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return <div className="page">
    <div className="page-heading">
      <div><div className="eyebrow">AKUN STAF</div><h1>Pengguna</h1><p className="muted">Tambah dan atur akun staf klinik. Akun tidak dihapus; nonaktifkan bila staf tidak lagi bertugas.</p></div>
      <button className="btn primary" onClick={() => { setGalat(''); setInfo(''); setForm({ mode: 'baru', ...KOSONG }) }}><Plus size={17}/> Tambah Pengguna</button>
    </div>
    {galat && !form && <div className="alert error">{galat}</div>}
    {info && <div className="alert success">{info}</div>}
    <div className="card table-wrap"><table>
      <thead><tr><th>Nama</th><th>Email</th><th>Jabatan</th><th>Status</th><th>Dibuat</th><th></th></tr></thead>
      <tbody>{daftar.map(p => <tr key={p.id}>
        <td><strong>{p.nama}</strong>{p.id === profil.id && <span className="small muted"> (Anda)</span>}{p.is_admin && <> <span className="pill admin">Admin</span></>}</td>
        <td>{p.email}</td>
        <td>{p.jabatan}</td>
        <td><span className={`pill ${p.aktif ? 'ok' : 'off'}`}>{p.aktif ? 'Aktif' : 'Nonaktif'}</span></td>
        <td className="small muted">{fmtTanggal(p.created_at)}</td>
        <td><div className="row-actions">
          <button className="btn small" onClick={() => { setGalat(''); setInfo(''); setForm({ mode: 'ubah', id: p.id, nama: p.nama, email: p.email, jabatan: p.jabatan, is_admin: p.is_admin }) }}><Pencil size={14}/> Ubah</button>
          {p.id !== profil.id && <button className={`btn small ${p.aktif ? 'danger' : ''}`} onClick={() => ubahStatus(p)}>{p.aktif ? <><UserX size={14}/> Nonaktifkan</> : <><UserCheck size={14}/> Aktifkan</>}</button>}
        </div></td>
      </tr>)}</tbody>
    </table>{!daftar.length && <div className="empty">Belum ada pengguna.</div>}</div>

    {form && <Modal judul={form.mode === 'baru' ? 'Tambah Pengguna' : `Ubah ${form.email}`} tutup={() => setForm(null)}>
      <form className="form-grid" onSubmit={simpan}>
        <label className="span-2">Nama lengkap*<input required autoFocus value={form.nama} onChange={e => set('nama', e.target.value)}/></label>
        {form.mode === 'baru' && <>
          <label>Email*<input type="email" required autoComplete="off" value={form.email} onChange={e => set('email', e.target.value)}/></label>
          <label>Kata sandi awal*<input type="text" required minLength={8} autoComplete="new-password" value={form.password} onChange={e => set('password', e.target.value)}/><span className="small muted">Minimal 8 karakter. Berikan langsung ke staf; ia dapat menggantinya di Pengaturan.</span></label>
        </>}
        <label>Jabatan*<select value={form.jabatan} onChange={e => set('jabatan', e.target.value)}>{JABATAN.map(j => <option key={j}>{j}</option>)}</select></label>
        <label className="check" style={{ alignSelf: 'end' }}><input type="checkbox" checked={form.is_admin} onChange={e => set('is_admin', e.target.checked)}/> Admin (dapat mengatur akun staf)</label>
        {galat && <div className="alert error span-2">{galat}</div>}
        <div className="form-actions span-2"><button type="button" className="btn" onClick={() => setForm(null)}>Batal</button><button className="btn primary" disabled={proses}>{proses ? 'Menyimpan…' : form.mode === 'baru' ? 'Buat Akun' : 'Simpan'}</button></div>
      </form>
    </Modal>}
  </div>
}
