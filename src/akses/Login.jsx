import { useState } from 'react'
import { Stethoscope } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { pesanGalat } from '../lib/format'

export function Login({ pesanAwal = '' }) {
  const [email, setEmail] = useState('')
  const [sandi, setSandi] = useState('')
  const [proses, setProses] = useState(false)
  const [galat, setGalat] = useState(pesanAwal)

  const masuk = async e => {
    e.preventDefault(); setProses(true); setGalat('')
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
      setGalat('Konfigurasi belum lengkap: isi VITE_SUPABASE_URL dan VITE_SUPABASE_PUBLISHABLE_KEY di pengaturan build Cloudflare.')
      setProses(false); return
    }
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: sandi })
    if (error) setGalat(pesanGalat(error.message))
    setProses(false)
  }

  return <div className="login-shell">
    <form className="login-card" onSubmit={masuk}>
      <div className="brand-mark"><Stethoscope size={28}/></div>
      <div>
        <div className="eyebrow">KLINIK PT PRIMA JASA MEDICA</div>
        <h1>Dokumen Klinik</h1>
        <p className="muted">Surat, kredensial perawat, dan dokumen asuhan keperawatan.</p>
      </div>
      <label>Email<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} placeholder="nama@klinik.co.id"/></label>
      <label>Kata sandi<input type="password" autoComplete="current-password" required value={sandi} onChange={e => setSandi(e.target.value)}/></label>
      {galat && <div className="alert error" role="alert">{galat}</div>}
      <button className="btn primary" disabled={proses}>{proses ? 'Memproses…' : 'Masuk'}</button>
      <p className="small muted">Lupa kata sandi? Hubungi admin klinik.</p>
    </form>
  </div>
}
