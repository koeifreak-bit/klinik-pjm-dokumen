# Cara memasang Dokumen Klinik PJM (modul 1: akun & login)

Sudah dikerjakan Claude:
- Proyek Supabase **klinik-pjm-dokumen** (Singapura, paket gratis), ref `gseyoaopsmipdbkwhzri`.
- Database: tabel akun staf dan aturan aksesnya (migrasi `001_akses`). Uji otomatis lulus.
- Fungsi server **tambah-pengguna** (untuk admin membuat akun staf).

Yang perlu Anda lakukan: 4 langkah di bawah, sekitar 20 menit.

---

## Langkah 1 — Pengaturan login di Supabase
Buka https://supabase.com/dashboard → proyek **klinik-pjm-dokumen**.

1. **Authentication → Sign In / Providers**
   - **Allow new users to sign up** → **MATIKAN**. Ini wajib: tanpa ini, siapa pun dapat mendaftar sendiri.
   - Di bagian **Email**: **Confirm email** → matikan (akun dibuat oleh admin, tidak perlu konfirmasi).
   - Klik **Save**.
2. **Authentication → URL Configuration → Site URL**: isi nanti dengan alamat aplikasi dari Langkah 3 (mis. `https://klinik-pjm-dokumen.xxxx.workers.dev`).

## Langkah 2 — Buat admin pertama
1. **Authentication → Users → Add user → Create new user**
   - Email: email Anda (atau email kepala perawat/admin klinik)
   - Password: kata sandi yang kuat (jangan ditulis di chat)
   - Centang **Auto Confirm User** → **Create user**
2. **SQL Editor → New query**, tempel lalu **Run** (ganti email dan nama):
   ```sql
   update public.profiles
   set is_admin = true, nama = 'Nama Lengkap Anda', jabatan = 'Kepala Perawat'
   where email = 'email-anda@contoh.com';
   ```
   Hasil yang benar: `Success. 1 row affected` (atau "1 row"). Bila 0 baris, periksa ejaan email.

## Langkah 3 — GitHub (repo PRIVAT)
1. Buka https://github.com/new
   - Owner: **koeifreak-bit**, Repository name: **klinik-pjm-dokumen**
   - Pilih **Private** (wajib, aplikasi ini untuk data klinik)
   - Jangan centang README → **Create repository**
2. Di halaman repo kosong, klik **uploading an existing file**.
3. Buka folder `Documents\Claude\klinik-pjm-upload-v1\` di File Explorer, pilih **semua isinya** (Ctrl+A), lalu seret ke halaman GitHub. Folder `src`, `supabase`, `tests` ikut terunggah beserta isinya.
   - Pastikan di daftar unggahan ada `package.json`, `package-lock.json`, `wrangler.jsonc`, `index.html` **di tingkat paling atas** (bukan di dalam folder lain).
4. Commit message: `modul akses` → **Commit changes**.

## Langkah 4 — Cloudflare
1. Buka https://dash.cloudflare.com → **Workers & Pages → Create → Workers → Import a repository**.
2. Hubungkan GitHub bila diminta, lalu pilih repo **klinik-pjm-dokumen**.
3. Isi:
   - Project name: `klinik-pjm-dokumen`
   - Build command: `npm run build`
   - Deploy command: `npx wrangler deploy`
   - **Advanced settings → Build variables**, tambahkan dua variabel:
     | Nama | Nilai |
     |---|---|
     | `VITE_SUPABASE_URL` | `https://gseyoaopsmipdbkwhzri.supabase.co` |
     | `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_QTNxIW4TEp3XfCVXU1D38g_vdZUG_1x` |
     (Kunci *publishable* memang aman untuk aplikasi web; jangan pernah memakai kunci *secret* di sini.)
4. **Deploy**. Tunggu sampai **Success**, lalu buka alamat `…workers.dev` yang muncul.
5. Kembali ke Langkah 1 nomor 2 dan isi **Site URL** dengan alamat tersebut.

Bila build gagal karena variabel belum terisi: **Settings → Build → Variables and secrets**, tambahkan kedua variabel di atas, lalu **Deployments → Retry deployment**.

---

## Pemeriksaan setelah terpasang
1. Masuk dengan akun admin dari Langkah 2 → muncul **Dasbor** dengan nama Anda.
2. **Pengguna → Tambah Pengguna**: buat akun uji (mis. `uji@klinik.test`, jabatan Perawat). Muncul pesan "Akun … dibuat".
3. Buka jendela penyamaran (Ctrl+Shift+N), masuk sebagai akun uji → menu **Pengguna** tidak ada (bukan admin).
4. Kembali ke jendela admin → **Nonaktifkan** akun uji. Di jendela uji, klik menu mana pun → muncul "Akun Anda dinonaktifkan" dan keluar otomatis.
5. Akun uji boleh dibiarkan nonaktif, atau hapus di Supabase: **Authentication → Users → … → Delete user**.

Beri tahu Claude bila sudah terpasang; Claude akan memeriksa versi yang tayang dan isi database.
