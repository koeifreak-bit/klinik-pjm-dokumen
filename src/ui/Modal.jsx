import { X } from 'lucide-react'

export function Modal({ judul, tutup, children, lebar = false }) {
  return <div className="modal-backdrop" onMouseDown={tutup}>
    <div className={`modal ${lebar ? 'lebar' : ''}`} role="dialog" aria-label={judul} onMouseDown={e => e.stopPropagation()}>
      <div className="modal-head"><h2>{judul}</h2><button className="icon-btn" aria-label="Tutup" onClick={tutup}><X size={20}/></button></div>
      {children}
    </div>
  </div>
}
