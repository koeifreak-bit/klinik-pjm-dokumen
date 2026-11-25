import { useEffect, useState } from 'react'
import { AlertTriangle, BadgeCheck, FileText, Inbox, Mail, Send, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { fmtTanggal, fmtWaktu, hariIni, pesanGalat } from '../lib/format'
import { selisihHari, statusKredensial } from '../lib/aturan'
import { KELAS_KREDENSIAL } from '../kredensial/Kredensial'

export function Dasbor({ profil, buka }) {
  const [d, setD] = useState(null)
  const [galat, setGalat] = useState('')
  const hari = hariIni()

  useEffect(() => {
    const awalBulan = `${hari.slice(0, 7)}-01`
    const seminggu = new Date(Date.now() - 7 * 86400000).toISOString()
    Promise.all([
      supabase.from('surat').select('id', { count: 'exact', head: true }).eq('arah', 'Masuk').in('status', ['Diterima', 'Didisposisi']),
      supabase.from('surat').select('id', { count: 'exact', head: true }).gte('tanggal_surat', awalBulan),
      supabase.from('kredensial').select('id,jenis,nama,berlaku_sampai,staf:profiles!kredensial_profil_id_fkey(nama,aktif)').not('berlaku_sampai', 'is', null).lte('berlaku_sampai', new Date(Date.parse(`${hari}T00:00:00Z`) + 90 * 86400000).toISOString().slice(0, 10)),
      supabase.from('pasien').select('id', { count: 'exact', head: true }),
      supabase.from('pasien_dokumen').select('id', { count: 'exact', head: true }).gte('created_at', seminggu),
      supabase.from('surat').select('id,nomor_agenda,perihal,pihak,disposisi_instruksi,disposisi_tanggal').eq('disposisi_kepada', profil.id).eq('status', 'Didisposisi').order('disposisi_tanggal'),
      supabase.from('surat').select('id,nomor_agenda,nomor_surat,perihal,created_at').eq('arah', 'Keluar').eq('status', 'Draf').lt('created_at', seminggu).order('created_at'),
      supabase.from('surat').select('id,arah,nomor_agenda,perihal,pihak,status,created_at').order('created_at', { ascending: false }).limit(8),
      supabase.from('pasien_dokumen').select('id,jenis,judul,created_at,status,pasien:pasien_id(id,no_rm,nama)').order('created_at', { ascending: false }).limit(8),
    ]).then(r => {
      const gagal = r.find(x => x.error); if (gagal) { setGalat(pesanGalat(gagal.error.message)); return }
      const [masukTerbuka, bulanIni, kred, pasien, dokBaru, disposisi, draf, suratBaru, dokTerbaru] = r
      const kr = (kred.data || []).filter(k => k.staf?.aktif !== false).map(k => ({ ...k, st: statusKredensial(k.berlaku_sampai, hari) })).sort((a, b) => a.st.urutan - b.st.urutan || a.berlaku_sampai.localeCompare(b.berlaku_sampai))
      setD({ masukTerbuka: masukTerbuka.count, bulanIni: bulanIni.count, kr, pasien: pasien.count, dokBaru: dokBaru.count, disposisi: disposisi.data, draf: draf.data, suratBaru: suratBaru.data, dokTerbaru: dokTerbaru.data })
    })
  }, [])

  if (galat) return <div className="page"><div className="alert error">{galat}</div></div>
  if (!d) return <div className="page"><div className="empty">Memuat dasbor…</div></div>
  const lewat = d.kr.filter(k => k.st.kode === 'lewat').length
  const h30 = d.kr.filter(k => k.st.kode === 'h30').length
  const h90 = d.kr.filter(k => k.st.kode === 'h90').length
  const pengingat = [
    ...d.kr.map(k => ({ id: `k${k.id}`, nada: KELAS_KREDENSIAL[k.st.kode], ikon: BadgeCheck, teks: `${k.jenis}${k.nama !== k.jenis ? ` ${k.nama}` : ''} — ${k.staf?.nama}`, sub: `${k.st.kode === 'lewat' ? 'Kedaluwarsa sejak' : 'Berlaku sampai'} ${fmtTanggal(k.berlaku_sampai)} · ${k.st.label}`, ke: ['kredensial'] })),
    ...d.disposisi.map(s => ({ id: `d${s.id}`, nada: 'warn', ikon: Inbox, teks: `Disposisi untuk Anda: ${s.perihal}`, sub: `${s.nomor_agenda} · dari ${s.pihak}${s.disposisi_tanggal ? ` · sejak ${fmtTanggal(s.disposisi_tanggal)} (${selisihHari(s.disposisi_tanggal, hari)} hari)` : ''}${s.disposisi_instruksi ? ` — ${s.disposisi_instruksi}` : ''}`, ke: ['surat'] })),
    ...d.draf.map(s => ({ id: `s${s.id}`, nada: 'info', ikon: Send, teks: `Surat keluar masih Draf: ${s.perihal}`, sub: `${s.nomor_surat} · dibuat ${fmtTanggal(s.created_at)}`, ke: ['surat'] })),
  ]

  return <div className="page">
    <div className="page-heading"><div><div className="eyebrow">DASBOR</div><h1>Selamat datang, {profil.nama.split(' ')[0]}</h1><p className="muted">{new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}</p></div></div>
    <div className="stats">
      <button className="card stat" onClick={() => buka('surat')}><span><Inbox size={15}/> Surat masuk belum selesai</span><strong>{d.masukTerbuka}</strong><small>{d.bulanIni} surat bulan ini</small></button>
      <button className={`card stat ${lewat ? 'alarm' : ''}`} onClick={() => buka('kredensial', 'lewat')}><span><AlertTriangle size={15}/> Kredensial kedaluwarsa</span><strong>{lewat}</strong><small>staf aktif</small></button>
      <button className={`card stat ${h30 ? 'waspada' : ''}`} onClick={() => buka('kredensial', 'h30')}><span><BadgeCheck size={15}/> Berakhir ≤ 30 hari</span><strong>{h30}</strong><small>{h90} lagi dalam ≤ 90 hari</small></button>
      <button className="card stat" onClick={() => buka('pasien')}><span><Users size={15}/> Pasien</span><strong>{d.pasien}</strong><small>{d.dokBaru} dokumen baru 7 hari terakhir</small></button>
    </div>
    <section className="card section-card"><h3>Pengingat · {pengingat.length}</h3>
      <div className="daftar">{pengingat.map(p => <button key={p.id} className={`ingat ${p.nada}`} onClick={() => buka(...p.ke)}><p.ikon size={17}/><div><strong>{p.teks}</strong><div className="small muted">{p.sub}</div></div></button>)}
        {!pengingat.length && <div className="empty">Tidak ada pengingat. Semua kredensial berlaku lebih dari 90 hari dan tidak ada disposisi untuk Anda.</div>}</div>
    </section>
    <div className="dua-kolom">
      <section className="card section-card"><h3><Mail size={15}/> Surat terbaru</h3><div className="daftar">{d.suratBaru.map(s => <button key={s.id} className="ingat" onClick={() => buka('surat')}><span className="small">{s.arah === 'Masuk' ? '↓' : '↑'}</span><div><strong>{s.perihal}</strong><div className="small muted">{s.nomor_agenda} · {s.pihak} · {s.status}</div></div></button>)}{!d.suratBaru.length && <div className="empty">Belum ada surat.</div>}</div></section>
      <section className="card section-card"><h3><FileText size={15}/> Dokumen pasien terbaru</h3><div className="daftar">{d.dokTerbaru.map(x => <button key={x.id} className="ingat" onClick={() => buka('pasien', null, x.pasien?.id)}><FileText size={15}/><div><strong className={x.status === 'Ditarik' ? 'coret' : ''}>{x.jenis} · {x.judul}</strong><div className="small muted">{x.pasien?.no_rm} {x.pasien?.nama} · {fmtWaktu(x.created_at)}</div></div></button>)}{!d.dokTerbaru.length && <div className="empty">Belum ada dokumen pasien.</div>}</div></section>
    </div>
  </div>
}
