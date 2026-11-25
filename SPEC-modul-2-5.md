# Spec: modules `surat`, `kredensial`, `rekam-pasien`, `dasbor`

Status: **BUILD APPROVED** 2026-11-25. The owner said "build all modules at once", so the per-module approval gates are skipped. The defaults below are mine, marked **[default]**; change any of them later and I'll adjust.
Rules from module 1 still apply: Bahasa Indonesia UI, minimal security (any active account sees and edits everything), no Telegram, $0 stack.

## Shared: files
- One private Storage bucket, **`dokumen`**, with paths `surat/<id>/…`, `kredensial/<id>/…` and `pasien/<pasien_id>/<dokumen_id>/…`. Only active staff can read or upload.
- Patient files can **never be deleted**, not even through the API: there is no delete policy on the `pasien/` folder.
- Accepted files: PDF, JPG, PNG, WEBP, and for letters also DOC/DOCX. Maximum **10 MB** per file **[default]**.
- Photos larger than 1.5 MB are shrunk in the browser (longest side 2000 px, JPEG quality 0.82) before upload, so the 1 GB free storage lasts longer **[default]**.
- Opening a file uses a signed link valid for 60 seconds.

## Module 2 `surat`: incoming and outgoing letters
- **Register** with two directions, **Masuk** and **Keluar**. Every letter gets an **agenda number** when it is saved, counted per year and direction: `M-0001/2026`, `K-0001/2026`.
- **Outgoing letters** also get an official letter number: `001/PJM-KLN/XI/2026`. That is sequence/code/Roman month/year. The code `PJM-KLN` can be changed by the admin in **Pengaturan → Kode surat** **[default format]**.
- **Incoming letters** store the sender's own number as typed.
- Numbers are generated atomically in the database and can't be edited afterwards. A cancelled letter keeps its number (status **Dibatalkan**); letters are never deleted.
- **Fields:**
  - letter date;
  - received date (incoming) or sent date (outgoing);
  - subject (perihal);
  - sender/recipient;
  - type: Undangan, Pemberitahuan, Permohonan, Laporan, Rujukan, Edaran, Keputusan, Lainnya;
  - sifat: Biasa, Penting, Segera, Rahasia;
  - notes.
- **Status flow:**
  - Masuk: Diterima → Didisposisi → Selesai.
  - Keluar: Draf → Terkirim → Selesai.
  - Both directions can be Dibatalkan.
- **Disposition** (incoming): the staff member it is passed to, an instruction, and a date. It shows up on that person's dashboard.
- **Attachments:** multiple files per letter; letter files can be deleted.
- **Register page:** search by number, subject or sender; filter by direction, year, status and type; paging of 50; CSV export of the filtered list.

## Module 3 `kredensial`: nurse credentials
- One record per document per staff member. **Types:** STR, SIP, Sertifikat Pelatihan, Lainnya. **Fields:** document name (e.g. "BTCLS"), number, issuer, issue date, **valid until**, notes, and files.
- **STR:** the valid-until date may be empty, meaning valid for life (UU 17/2023).
- **SIP:** a valid-until date is required.
- **Certificates:** the date is optional.
- **Status** is computed daily (WIB): **Kedaluwarsa** (past), **≤ 30 hari**, **≤ 90 hari**, **Berlaku**, **Seumur hidup / tanpa batas**.
- **Page:**
  - filter by staff member, type and status;
  - a "Kredensial saya" shortcut;
  - lists sorted with the most urgent first;
  - CSV export.

## Module 4 `rekam-pasien`: patient nursing documents
- **Patient index:**
  - fields: **No. RM** (unique, required), name, date of birth, sex (L/P), phone, address, notes;
  - search by No. RM or name.
- **Documents:**
  - **types:** Pengkajian Keperawatan, Asuhan Keperawatan, Catatan Perkembangan, Informed Consent, Resume Pulang, Hasil Penunjang, Rujukan, Lainnya;
  - **fields:** document date, title, notes, and **one file per document**.
- **Never deleted:** a document can only be **Ditarik** (withdrawn) with a reason. Withdrawn documents stay listed (struck through) and can still be opened. Patients can't be deleted either.
- **Retention:**
  - each patient has a **last-visit date**, updated automatically from the latest document date;
  - the page shows **"Simpan sampai"** = last visit + 25 years (Permenkes 24/2022).
- **Export / backup**, generated in the browser (no server cost, no new library):
  - per patient: a ZIP of all files plus `daftar-dokumen.csv`;
  - all patients (admin): a ZIP of every patient's files plus an index CSV.
  - The ZIP format is written in-house (store method, CRC-32) and unit-tested.
- A permanent line on the page reminds that the official medical record and SATUSEHAT live elsewhere **[default wording]**.

## Module 5 `dasbor`: dashboard with in-app reminders
- **Counters:**
  - incoming letters not yet Selesai;
  - letters this month;
  - credentials expired, or expiring within 30 days and within 90 days;
  - number of patients;
  - patient documents added in the last 7 days.
- **"Pengingat" list**, most urgent first:
  - expired or expiring credentials (within 90 days);
  - dispositions assigned to me that aren't Selesai;
  - outgoing letters still Draf after 7 days.
- **Recent activity:** the latest 8 letters and the latest 8 patient documents.

## Date picker
DCM's calendar picker is copied, with Indonesian holidays 2025–2027 (`public_holidays`, copied from DCM 014). In this clinic app holidays are **informational only**: no "not a working day" warning, because clinics work weekends **[default]**.

## Database (migrations)
- **`002_berkas_dan_libur`:** bucket `dokumen` plus its storage policies; `public_holidays` with data; `pengaturan_klinik` (id = 1, `kode_surat`).
- **`003_surat`:** `surat`, `surat_urutan`, `surat_berkas`; RPC `buat_surat(...)`; a lock on number fields; RLS = active staff.
- **`004_kredensial`:** `kredensial`, `kredensial_berkas`; check constraint: SIP needs a valid-until date.
- **`005_pasien`:** `pasien`, `pasien_dokumen`. No DELETE policy. Triggers:
  - update `kunjungan_terakhir`;
  - lock the file path;
  - require a reason when withdrawing.

## Testing
- **SQL** (`supabase/tests/modul-2-5.sql`, rolled back):
  - numbering: a sequence per direction and year; outgoing number format with Roman month; numbers can't be edited; no delete;
  - SIP without a date is rejected;
  - patient: deleting a document is rejected; withdrawing without a reason is rejected; last visit updates; no-delete on storage `pasien/`;
  - a deactivated account sees nothing.
- **Unit** (`node --test`): Roman months, credential status by date, retention date, CSV escaping, CRC-32 and the ZIP structure, the image-shrink decision.
- **Local preview** of every page; then you test live after upload.

## Success criteria
1. Saving 2 outgoing letters in November 2026 gives `001/PJM-KLN/XI/2026` and `002/PJM-KLN/XI/2026`; incoming letters get `M-0001/2026`, and the counters are independent.
2. A SIP saved without a valid-until date is rejected with an Indonesian message; a SIP expiring in 20 days shows as **≤ 30 hari** on the dashboard.
3. A patient document can't be deleted (UI has no button; the API/database refuses). Withdrawing needs a reason, and "Simpan sampai" = last visit + 25 years.
4. A patient ZIP export opens in Windows Explorer and contains the files plus `daftar-dokumen.csv`.
5. All pages are in Bahasa Indonesia; build, unit tests and SQL tests pass.
