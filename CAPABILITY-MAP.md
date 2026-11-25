# Capability Map: Dokumen Keperawatan, Klinik PT Prima Jasa Medica

Status: **APPROVED** 2026-11-25. GitHub: private repo `koeifreak-bit/klinik-pjm-dokumen`. Supabase: new, separate account.

## What we're building
A web app in **Bahasa Indonesia** for the nursing team and office administration of Klinik PT Prima Jasa Medica. It manages three kinds of documents chosen by the owner:
1. **Surat masuk & keluar**: office administration correspondence.
2. **Kredensial perawat**: STR, SIP and training certificates, with expiry tracking.
3. **Rekam asuhan keperawatan pasien**: per-patient nursing documents (scans or uploads of asuhan keperawatan, informed consent and similar).

It uses the same stack as DCM Firma (React/Vite → GitHub → Cloudflare Workers Builds, Supabase Postgres + Storage + Auth), in a **new, separate** GitHub repo and Supabase project. It shares no code dependency with the law-firm app; proven parts are copied in.
Reminders are **in-app only** (dashboard). There is no Telegram.

## Modules

| Module id | Responsibility | Depends on |
|---|---|---|
| `akses` | Login and user accounts (admin creates accounts, can deactivate them). Every logged-in staff member can see and edit everything; no roles or audit log (owner's decision 2026-11-25) | — |
| `surat` | Register of incoming/outgoing letters with automatic, gap-free numbering, file uploads, status and delivery tracking, search and CSV export | `akses` |
| `kredensial` | Per-nurse STR, SIP and training certificates (BTCLS, PPI, etc.): number, issue/expiry date, file. Dashboard of items expiring within 90/30 days or already expired | `akses` |
| `rekam-pasien` | Patient index (No. RM, name, date of birth), per-patient nursing documents by type, "ditarik" instead of permanent delete (to protect the 25-year retention), export of all records | `akses` |
| `dasbor` | Home page: expiring credentials, new letters, recently changed patient documents; the in-app "pengingat" list | `surat`, `kredensial`, `rekam-pasien` |

Build order: **akses → surat → kredensial → rekam-pasien → dasbor**
(`surat` and `kredensial` are independent and could be built in either order. `rekam-pasien` comes last of the three because it carries the strictest rules and benefits from the patterns proven in the first two.)

## Assumptions (correct me now or I'll proceed with these)
1. **Users**: roughly 5–30 staff accounts, created by an admin (no public sign-up). Email + password login, the same as DCM.
2. **Language**: the entire UI, messages, CSV headers and PDFs are in Bahasa Indonesia; dates are in WIB.
3. **Letter numbering**: one register per year, format `NNN/PJM/KLINIK/BULAN-ROMAWI/TAHUN` (for example `012/PJM/KLINIK/XI/2026`). The exact clinic format is yours to confirm.
4. **STR**: under UU 17/2023 an STR is valid for life, so STR expiry is optional. **SIP** (5 years) and certificates have an expiry date.
5. **Patient records are supporting documents, not the clinic's official RME.** Under Permenkes 24/2022, a clinic's electronic medical record system must connect to SATUSEHAT. This app stores nursing documents and must not claim to be that system.
6. **Security kept minimal (owner's decision, 2026-11-25)**: staff must log in, and only an admin can create accounts. Beyond that, any active account can see and edit all documents, with no roles, view logging or audit log. Patient documents still can't be permanently deleted (only "ditarik"); that protects the retention duty, not access. Note: confidentiality and access rules for medical records (Permenkes 24/2022, UU 27/2022 PDP) remain the clinic's responsibility.
7. **Calendar**: date fields reuse the DCM court-calendar picker, but holiday marks are informational only (clinics work weekends).
8. **Free tier**: Supabase Free (500 MB database, 1 GB file storage) and Cloudflare free. Scanned patient documents will be compressed in the browser before upload.

## Decisions I need from you
1. **Where the database lives.** Leaning toward a **new Supabase account**, ideally registered with a clinic-owned email so the clinic owns its data. This keeps Catatku (and the "ratio" tables in its database, last used 19 Nov 2026) running. Consequence: my Supabase connector is signed in to your current account, so for the new one either you reconnect the connector to it, or I hand you SQL to paste into the SQL Editor (the original DCM workflow).
2. **Retention and backups for patient records.** Permenkes 24/2022 requires a clinic to keep medical records for at least **25 years** after the patient's last visit. The Supabase **free plan has no automatic backups**. Do you accept a monthly manual export (a button that downloads a ZIP of all patient documents plus an index), or will you go Pro for daily backups?
3. **Data location.** Supabase has no Jakarta region; the closest is Singapore. Is storing patient data in Singapore acceptable for the clinic? (The clinic's management or compliance team should confirm this. I'm flagging it, not ruling on it.)
4. **Letter number format**: confirm or give the clinic's real format.
5. **GitHub repo**: a **new private** repo (Catatku's repo is public). Suggested name: `koeifreak-bit/klinik-pjm-dokumen`. OK?

## Not in scope (unless you add it)
- Telegram reminders.
- SOPs, policies and accreditation documents (not chosen), incident reports, duty rosters.
- SATUSEHAT integration, e-prescriptions, billing, or a full electronic medical record.
- A mobile app (the web app will work on phone browsers).
