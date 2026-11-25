import { useCallback, useEffect, useState } from 'react'
import { CircleUserRound, LayoutDashboard, LogOut, Settings, Stethoscope, UsersRound } from 'lucide-react'
import { supabase } from './lib/supabase'
import { Login } from './akses/Login'
import { Pengguna } from './akses/Pengguna'
import { Pengaturan } from './akses/Pengaturan'

const DINONAKTIFKAN = 'Akun Anda dinonaktifkan. Hubungi admin klinik.'

export default function App() {
  const [sesi, setSesi] = useState(null)
  const [profil, setProfil] = useState(null)
  const [memuat, setMemuat] = useState(true)
  const [halaman, setHalaman] = useState('dasbor')
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
  useEffect(() => { if (sesi) periksaProfil() }, [halaman])
  useEffect(() => {
    const onFocus = () => { if (document.visibilityState === 'visible' && sesi) periksaProfil() }
    window.addEventListener('focus', onFocus); document.addEventListener('visibilitychange', onFocus)
    return () => { window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus) }
  }, [periksaProfil, sesi])

  if (memuat) return <div className="center-screen">Memuat…</div>
  if (!sesi || !profil) return <Login key={pesanLogin} pesanAwal={pesanLogin}/>

  const menu = [
    ['dasbor', 'Dasbor', LayoutDashboard],
    ...(profil.is_admin ? [['pengguna', 'Pengguna', UsersRound]] : []),
    ['pengaturan', 'Pengaturan', Settings],
  ]
  const aktif = menu.some(([k]) => k === halaman) ? halaman : 'dasbor'

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark small"><Stethoscope size={20}/></div><div><strong>Dokumen Klinik</strong><span>PT Prima Jasa Medica</span></div></div>
      <nav>{menu.map(([k, label, Icon]) => <button key={k} className={aktif === k ? 'active' : ''} onClick={() => setHalaman(k)}><Icon size={18}/> {label}</button>)}</nav>
      <div className="sidebar-bottom">
        <div className="user-chip"><CircleUserRound size={22}/><div><strong>{profil.nama}</strong><span>{profil.jabatan}{profil.is_admin ? ' · Admin' : ''}</span></div></div>
        <button className="nav-logout" onClick={() => supabase.auth.signOut()}><LogOut size={17}/> Keluar</button>
      </div>
    </aside>
    <main>
      {aktif === 'dasbor' && <Dasbor profil={profil}/>}
      {aktif === 'pengguna' && <Pengguna profil={profil} onBerubah={periksaProfil}/>}
      {aktif === 'pengaturan' && <Pengaturan profil={profil} onBerubah={periksaProfil}/>}
    </main>
  </div>
}

// Sementara sampai modul `dasbor` (modul 5) dibangun.
function Dasbor({ profil }) {
  return <div className="page">
    <div className="page-heading"><div><div className="eyebrow">DASBOR</div><h1>Selamat datang, {profil.nama.split(' ')[0]}</h1><p className="muted">Modul surat, kredensial perawat, dan dokumen pasien akan muncul di sini setelah dibangun.</p></div></div>
    <div className="card section-card"><p className="muted">Gunakan menu di samping. {profil.is_admin ? 'Sebagai admin, Anda dapat menambah dan mengatur akun staf di menu Pengguna.' : ''}</p></div>
  </div>
}
