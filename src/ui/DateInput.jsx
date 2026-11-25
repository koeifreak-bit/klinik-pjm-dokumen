// Pemilih tanggal (disalin dari DCM): kalender dengan tanda hari libur nasional (Senin–Jumat) dengan libur nasional & cuti bersama
// dari tabel public_holidays (SKB 3 Menteri). Bisa diketik (HH/BB/TTTT) atau dipilih dari kalender.
// Dipakai sebagai pengganti <input type="date">: onChange menerima objek { target: { value: 'YYYY-MM-DD' } }.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const DAY_SHORT = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des']

// ——— Utilitas tanggal (string YYYY-MM-DD, dihitung dalam UTC agar bebas zona waktu perangkat) ———
const pad = n => String(n).padStart(2, '0')
const isIso = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s
export const weekday = s => new Date(`${s}T00:00:00Z`).getUTCDay()
export const addDays = (s, n) => new Date(Date.parse(`${s}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10)
const shiftMonth = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}` }
export const todayJakarta = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
export const toText = s => isIso(s) ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : ''
export const shortText = s => isIso(s) ? `${DAY_SHORT[(weekday(s) + 6) % 7]} ${Number(s.slice(8, 10))} ${MONTHS_SHORT[Number(s.slice(5, 7)) - 1]}` : ''
export function parseText(t) {
  const s = String(t || '').trim()
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) { const v = `${m[1]}-${pad(m[2])}-${pad(m[3])}`; return isIso(v) ? v : null }
  m = s.match(/^(\d{1,2})[/.\- ](\d{1,2})[/.\- ](\d{2}|\d{4})$/)
  if (!m) return null
  const year = m[3].length === 2 ? `20${m[3]}` : m[3]
  const v = `${year}-${pad(m[2])}-${pad(m[1])}`
  return isIso(v) ? v : null
}

// ——— Hari libur (dimuat sekali per sesi) ———
let holidayPromise = null
let holidayCache = null
export function loadHolidays() {
  if (!holidayPromise) {
    holidayPromise = supabase.from('public_holidays').select('day,name').then(({ data, error }) => {
      if (error || !data?.length) { holidayPromise = null; return holidayCache || new Map() } // coba lagi nanti (mis. sebelum login)
      holidayCache = new Map(data.map(h => [h.day, h.name]))
      return holidayCache
    })
  }
  return holidayPromise
}
export function useHolidays() {
  const [map, setMap] = useState(() => holidayCache || new Map())
  useEffect(() => { let live = true; loadHolidays().then(m => { if (live) setMap(m) }); return () => { live = false } }, [])
  return map
}

// Hari kerja pengadilan = Senin–Jumat, bukan libur nasional, bukan cuti bersama (sama dengan is_workday di database).
export function dayInfo(s, holidays) {
  const w = weekday(s)
  const name = holidays.get(s) || null
  const cuti = !!name && /cuti bersama/i.test(name)
  const weekend = w === 0 || w === 6
  return { dayName: DAY_NAMES[w], weekend, holiday: name && !cuti ? name : null, cuti: cuti ? name : null, working: !weekend && !name }
}
export function nearestWorkday(s, dir, holidays) {
  let x = s
  for (let i = 0; i < 31; i++) { x = addDays(x, dir); if (dayInfo(x, holidays).working) return x }
  return null
}
const coveredYears = holidays => new Set([...holidays.keys()].map(k => k.slice(0, 4)))

// ——— Komponen ———
export function DateInput({ value = '', onChange, required, min, max, disabled, id, court = false, 'aria-label': ariaLabel, placeholder = 'HH/BB/TTTT' }) {
  const holidays = useHolidays()
  const iso = isIso(value) ? value : ''
  const [text, setText] = useState(toText(iso))
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(() => (iso || todayJakarta()).slice(0, 7))
  const [pos, setPos] = useState(null)
  const wrapRef = useRef(null)
  const inputRef = useRef(null)
  const popRef = useRef(null)

  useEffect(() => { setText(toText(iso)); inputRef.current?.setCustomValidity('') }, [iso])
  const emit = v => onChange?.({ target: { value: v } })
  const outOfRange = v => (min && v < min) || (max && v > max)
  const pick = v => { inputRef.current?.setCustomValidity(''); setText(toText(v)); if (v !== iso) emit(v); setOpen(false) }

  const commitText = () => {
    const el = inputRef.current
    const t = text.trim()
    if (!t) { el.setCustomValidity(''); if (iso) emit(''); return }
    const v = parseText(t)
    if (!v) { el.setCustomValidity('Format tanggal: HH/BB/TTTT, mis. 17/08/2026'); return }
    if (outOfRange(v)) { el.setCustomValidity(min && v < min ? `Tidak boleh sebelum ${toText(min)}` : `Tidak boleh setelah ${toText(max)}`); return }
    el.setCustomValidity('')
    setText(toText(v))
    // Pindah bulan hanya bila tanggal benar-benar berubah; blur karena pindah jendela tidak boleh menggeser kalender.
    if (v !== iso) { setView(v.slice(0, 7)); emit(v) }
  }

  // Hanya atur bulan saat kalender BARU dibuka. Fokus yang kembali (pindah jendela/tab) tidak boleh
  // mengembalikan kalender ke bulan ini — itu dapat membuat klik berikutnya memilih tanggal yang salah.
  const openPicker = () => { if (disabled || open) return; setView((parseText(text) || iso || todayJakarta()).slice(0, 7)); setOpen(true) }

  // Posisi popup: fixed + portal agar tidak terpotong oleh tabel/modal yang ber-overflow.
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const r = wrapRef.current?.getBoundingClientRect(); if (!r) return
      const h = popRef.current?.offsetHeight || 380, w = popRef.current?.offsetWidth || 300
      const below = window.innerHeight - r.bottom
      const top = below < h + 8 && r.top > below ? Math.max(8, r.top - h - 4) : Math.min(r.bottom + 4, window.innerHeight - h - 8)
      setPos({ top: Math.max(8, top), left: Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) })
    }
    place()
    window.addEventListener('resize', place); window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open, view])
  useEffect(() => {
    if (!open) return
    const onDown = e => { if (!wrapRef.current?.contains(e.target) && !popRef.current?.contains(e.target)) setOpen(false) }
    const onKey = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown); document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const info = iso ? dayInfo(iso, holidays) : null
  const years = coveredYears(holidays)
  const showWarn = court && info && !info.working
  const reason = info && (info.holiday ? `Libur nasional: ${info.holiday}` : info.cuti ? info.cuti : info.dayName)
  const prev = showWarn ? nearestWorkday(iso, -1, holidays) : null
  const next = showWarn ? nearestWorkday(iso, 1, holidays) : null

  return <span className="date-input" ref={wrapRef}>
    <span className="date-field">
      <input ref={inputRef} id={id} type="text" inputMode="numeric" autoComplete="off" aria-label={ariaLabel} placeholder={placeholder}
        value={text} required={required} disabled={disabled}
        onChange={e => { setText(e.target.value); inputRef.current.setCustomValidity('') }}
        onBlur={commitText} onFocus={openPicker} onClick={openPicker}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitText(); setOpen(false) } if (e.key === 'Tab') setOpen(false) }}/>
      <button type="button" className="date-btn" tabIndex={-1} disabled={disabled} aria-label="Buka kalender" onClick={() => open ? setOpen(false) : (inputRef.current?.focus(), openPicker())}><CalendarDays size={16}/></button>
    </span>
    {iso && info && <span className={`date-note ${showWarn ? 'warn' : ''}`}>
      {info.dayName}{!showWarn && (info.holiday || info.cuti) ? ` · ${info.holiday || info.cuti}` : ''}
      {showWarn && <> · {reason} — bukan hari kerja pengadilan.{' '}
        {prev && !outOfRange(prev) && <button type="button" className="link-btn small" onClick={() => pick(prev)}>← {shortText(prev)}</button>}{' '}
        {next && !outOfRange(next) && <button type="button" className="link-btn small" onClick={() => pick(next)}>{shortText(next)} →</button>}</>}
      {years.size > 0 && !years.has(iso.slice(0, 4)) && <> · data libur {iso.slice(0, 4)} belum tersedia (hanya Sabtu/Minggu ditandai)</>}
    </span>}
    {open && createPortal(<CalendarPopup refEl={popRef} pos={pos} view={view} setView={setView} value={iso} holidays={holidays} years={years}
      min={min} max={max} onPick={pick} required={required} onClear={() => { setText(''); emit(''); setOpen(false) }}/>, document.body)}
  </span>
}

function CalendarPopup({ refEl, pos, view, setView, value, holidays, years, min, max, onPick, onClear, required }) {
  const [y, m] = view.split('-').map(Number)
  const first = `${view}-01`
  const lead = (weekday(first) + 6) % 7 // Senin = kolom pertama
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const today = todayJakarta()
  const cells = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => `${view}-${pad(i + 1)}`)]
  while (cells.length % 7) cells.push(null)
  const monthHolidays = [...holidays].filter(([d]) => d.startsWith(view)).sort(([a], [b]) => a.localeCompare(b))
  const thisYear = Number(today.slice(0, 4))
  const yearOptions = Array.from({ length: thisYear + 6 - 1990 }, (_, i) => 1990 + i)
  const disabledDay = d => (min && d < min) || (max && d > max)
  return <div ref={refEl} className="date-pop" role="dialog" aria-label="Pilih tanggal" style={pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden' }} onMouseDown={e => e.stopPropagation()}>
    <div className="date-pop-head">
      <button type="button" className="icon-btn" aria-label="Bulan sebelumnya" onClick={() => setView(shiftMonth(view, -1))}><ChevronLeft size={16}/></button>
      <select aria-label="Bulan" value={m} onChange={e => setView(`${y}-${pad(e.target.value)}`)}>{MONTHS.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}</select>
      <select aria-label="Tahun" value={y} onChange={e => setView(`${e.target.value}-${pad(m)}`)}>{yearOptions.map(n => <option key={n}>{n}</option>)}</select>
      <button type="button" className="icon-btn" aria-label="Bulan berikutnya" onClick={() => setView(shiftMonth(view, 1))}><ChevronRight size={16}/></button>
    </div>
    <div className="date-grid">
      {DAY_SHORT.map((d, i) => <span key={d} className={`date-wd ${i >= 5 ? 'off' : ''}`}>{d}</span>)}
      {cells.map((d, i) => {
        if (!d) return <span key={`b${i}`}/>
        const info = dayInfo(d, holidays)
        const cls = ['date-day', info.weekend && 'weekend', info.holiday && 'holiday', info.cuti && 'cuti', d === today && 'today', d === value && 'selected'].filter(Boolean).join(' ')
        const title = [info.dayName, info.holiday || info.cuti, !info.working && 'bukan hari kerja pengadilan'].filter(Boolean).join(' · ')
        return <button type="button" key={d} className={cls} title={title} aria-label={`${Number(d.slice(8))} ${MONTHS[m - 1]} ${y}${info.working ? '' : ` (${info.holiday || info.cuti || 'akhir pekan'})`}`} disabled={disabledDay(d)} onClick={() => onPick(d)}>{Number(d.slice(8))}</button>
      })}
    </div>
    {!!monthHolidays.length && <ul className="date-holidays">{monthHolidays.map(([d, n]) => <li key={d} className={/cuti bersama/i.test(n) ? 'cuti' : 'holiday'}><strong>{Number(d.slice(8))} {MONTHS_SHORT[m - 1]}</strong> {n}</li>)}</ul>}
    {years.size > 0 && !years.has(String(y)) && <p className="date-missing">Data libur {y} belum tersedia — hanya Sabtu/Minggu ditandai.</p>}
    <div className="date-legend"><span><i className="lg-holiday"/>Libur nasional</span><span><i className="lg-cuti"/>Cuti bersama</span><span><i className="lg-weekend"/>Sabtu/Minggu</span></div>
    <div className="date-pop-foot">
      <button type="button" className="btn small-btn" disabled={disabledDay(today)} onClick={() => onPick(today)}>Hari ini</button>
      {!required && value && <button type="button" className="btn small-btn" onClick={onClear}>Kosongkan</button>}
    </div>
  </div>
}
