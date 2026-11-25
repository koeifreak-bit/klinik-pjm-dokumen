# Cara memasang Dokumen Klinik PJM

Aplikasi: https://klinik-pjm-dokumen.koeifreak.workers.dev
Supabase: proyek **klinik-pjm-dokumen** (`gseyoaopsmipdbkwhzri`, Singapura, paket gratis).

---

## Versi 2 — Surat, Kredensial, Dokumen Pasien, Dasbor

**Database sudah diperbarui oleh Claude** (migrasi 002–006: penyimpanan berkas, hari libur, surat, kredensial, pasien). Uji otomatis 24 aturan lulus. Anda **tidak perlu** menjalankan SQL apa pun.

### Yang perlu Anda lakukan: unggah kode ke GitHub (± 5 menit)
1. Buka https://github.com/koeifreak-bit/klinik-pjm-dokumen
2. Klik **Add file → Upload files**.
3. Buka folder `Documents\Claude\klinik-pjm-upload-v2\` di File Explorer, pilih **semua isinya** (Ctrl+A), lalu seret ke halaman GitHub.
   - Berkas lama dengan nama sama akan diganti otomatis. Folder baru (`src\surat`, `src\kredensial`, `src\pasien`, `src\dasbor`) ikut terunggah.
4. Commit message: `v2: surat, kredensial, pasien, dasbor` → **Commit changes**.
5. Cloudflare membangun otomatis. Tunggu **Success** (± 1–2 menit), lalu buka aplikasi dan tekan **Ctrl+F5**.

### Pemeriksaan singkat setelah tayang
1. **Surat → Buat Surat Keluar**: isi tujuan & perihal → simpan. Nomor muncul otomatis, mis. `001/PJM-KLN/XI/2026`.
2. **Kredensial Staf → Tambah Kredensial**: pilih SIP tanpa tanggal "Berlaku sampai" → harus ditolak. Isi tanggal 20 hari lagi → di **Dasbor** muncul di "Berakhir ≤ 30 hari".
3. **Dokumen Pasien → Tambah Pasien** → **Tambah Dokumen** (unggah PDF/foto) → klik nama berkas untuk membukanya → **Unduh semua (ZIP)**.
4. Data uji boleh dihapus sendiri: surat → *Batalkan surat*; kredensial → ikon hapus. **Dokumen pasien tidak dapat dihapus** (sesuai aturan retensi); gunakan No. RM uji yang jelas, mis. `UJI-001`, lalu minta Claude menghapusnya dari database.

### Pengaturan yang bisa diubah admin
- **Pengaturan → Kode surat keluar**: bagian tengah nomor surat (bawaan `PJM-KLN`). Nomor yang sudah terbit tidak berubah.

### Cadangan dokumen pasien (penting — paket gratis Supabase tidak punya backup otomatis)
- Admin: **Dokumen Pasien → Cadangkan semua (ZIP)**, misalnya **setiap awal bulan**. Simpan ZIP di 2 tempat (mis. hard disk eksternal + Google Drive klinik).
- Isi ZIP: folder per pasien + `indeks-dokumen-pasien.csv` (termasuk kolom "Simpan sampai" = 25 tahun sejak kunjungan terakhir).

---

## Versi 1 — akun & login (sudah terpasang)
Langkah awal (sudah selesai): matikan pendaftaran publik di Supabase, buat admin pertama, unggah ke GitHub, hubungkan Cloudflare dengan variabel `VITE_SUPABASE_URL` dan `VITE_SUPABASE_PUBLISHABLE_KEY`.
Pastikan **Authentication → Sign In / Providers → Allow new users to sign up** tetap **MATI**.
