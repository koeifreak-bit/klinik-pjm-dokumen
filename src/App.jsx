import { useCallback, useEffect, useState } from 'react'
import { BadgeCheck, CircleUserRound, FolderHeart, LayoutDashboard, LogOut, Mail, Settings, Stethoscope, UsersRound } from 'lucide-react'
import { supabase } from './lib/supabase'
import { Login } from './akses/Login'
import { Pengguna } from './akses/Pengguna'
import { Pengaturan } from './akses/Pengaturan'
import { Dasbor } from './dasbor/Dasbor'
import { Surat } from './surat/Surat'
import { Kredensial } from './kredensial/Kredensial'
import { Pasien } from './pasien/Pasien'

const DINONAKTIFKAN = 'Akun Anda dinonaktifkan. Hubungi admin klinik.'

export default function App() {
  const [sesi, setSesi] = useState(null)
  const [profil, setProfil] = useState(null)
  const [memuat, setMemuat] = useState(true)
  const [nav, setNav] = useState({ halaman: 'dasbor', filter: null, pasien: null, kunci: 0 })
  const [pesanLogin, setPesanLogin] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSesi(data.session); if (!data.session) setMemuat(false) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSesi(s))
    return () => subscription.unsubscribe()
  }, [])

  // Profil hanya terbaca bila akun aktif (aturan RLS). Kosong = dinonaktifkan → keluar.
  const periksaProfil = useCallback(async () => {
    if (!sesi?.user) { setProfil(null); return }
    const { data, error } = await supabase.from('profiles').select('*').eq('id', sesi.user.id).maybeSingle()
    if (error) { setMemuat(false); return } // gangguan jaringan: jangan keluarkan pengguna
    if (!data) { setPesanLogin(DINONAKTIFKAN); setProfil(null); await supabase.auth.signOut(); setMemuat(false); return }
    setProfil(data); setMemuat(false)
  }, [sesi?.user?.id])

  useEffect(() => { if (sesi) { setPesanLogin(''); periksaProfil() } else { setProfil(null) } }, [sesi?.user?.id])
  useEffect(() => { if (sesi) periksaProfil() }, [nav.halaman, nav.kunci])
  useEffect(() => {
    const onFocus = () => { if (document.visibilityState === 'visible' && sesi) periksaProfil() }
    window.addEventListener('focus', onFocus); document.addEventListener('visibilitychange', onFocus)
    return () => { window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus) }
  }, [periksaProfil, sesi])

  if (memuat) return <div className="center-screen">Memuat…</div>
  if (!sesi || !profil) return <Login key={pesanLogin} pesanAwal={pesanLogin}/>

  const menu = [
    ['dasbor', 'Dasbor', LayoutDashboard],
    ['surat', 'Surat', Mail],
    ['kredensial', 'Kredensial Staf', BadgeCheck],
    ['pasien', 'Dokumen Pasien', FolderHeart],
    ...(profil.is_admin ? [['pengguna', 'Pengguna', UsersRound]] : []),
    ['pengaturan', 'Pengaturan', Settings],
  ]
  const aktif = menu.some(([k]) => k === nav.halaman) ? nav.halaman : 'dasbor'
  const buka = (halaman, filter = null, pasien = null) => { setNav(n => ({ halaman, filter, pasien, kunci: n.kunci + 1 })); window.scrollTo(0, 0) }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark small"><Stethoscope size={20}/></div><div><strong>Dokumen Klinik</strong><span>PT Prima Jasa Medica</span></div></div>
      <nav>{menu.map(([k, label, Icon]) => <button key={k} className={aktif === k ? 'active' : ''} onClick={() => buka(k)}><Icon size={18}/> {label}</button>)}</nav>
      <div className="sidebar-bottom">
        <div className="user-chip"><CircleUserRound size={22}/><div><strong>{profil.nama}</strong><span>{profil.jabatan}{profil.is_admin ? ' · Admin' : ''}</span></div></div>
        <button className="nav-logout" onClick={() => supabase.auth.signOut()}><LogOut size={17}/> Keluar</button>
      </div>
    </aside>
    <main key={`${aktif}-${nav.kunci}`}>
      {aktif === 'dasbor' && <Dasbor profil={profil} buka={buka}/>}
      {aktif === 'surat' && <Surat profil={profil}/>}
      {aktif === 'kredensial' && <Kredensial profil={profil} filterAwal={nav.filter}/>}
      {aktif === 'pasien' && <Pasien profil={profil} pasienAwal={nav.pasien}/>}
      {aktif === 'pengguna' && <Pengguna profil={profil} onBerubah={periksaProfil}/>}
      {aktif === 'pengaturan' && <Pengaturan profil={profil} onBerubah={periksaProfil}/>}
    </main>
  </div>
}
