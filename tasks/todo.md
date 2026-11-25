# Tasks: module `akses`

- [x] **T1 Skeleton**
  - Acceptance: Vite + React app with a placeholder login page in Bahasa Indonesia; `wrangler.jsonc` set up for static assets with SPA fallback; `.env.example`; `package-lock.json`.
  - Verify: `vite build` passes; `node --test tests/` runs.
  - Files: package.json, package-lock.json, index.html, vite.config.js, wrangler.jsonc, src/main.jsx, src/lib/supabase.js

- [x] **T2 Migration 001_akses + SQL tests**
  - Acceptance:
    - `profiles` table, `is_active_staff()` and `is_admin()`.
    - RLS: active staff read; admin write; a user may change their own name.
    - Last-admin guard and the auth.users → profiles trigger, with Indonesian error messages.
  - Verify: `supabase/tests/akses.sql` covers admin, staff and deactivated staff; all blocks end in `ROLLBACK_OK`.
  - Files: supabase/migrations/001_akses.sql, supabase/tests/akses.sql

- [x] **T3 Login + shell**
  - Acceptance: login form with Indonesian error messages; sidebar showing name and jabatan; sign-out; a deactivated account is signed out with "Akun Anda dinonaktifkan".
  - Verify: build passes; `tests/format.test.mjs` passes.
  - Files: src/App.jsx, src/akses/Login.jsx, src/lib/format.js, src/styles.css, tests/format.test.mjs

- [x] **T4 Pengguna + tambah-pengguna**
  - Acceptance: admin-only page that adds, edits and activates/deactivates users; the edge function creates the auth user and profile and rejects non-admins.
  - Verify: build passes; input-validation unit tests pass; SQL test for the non-admin rejection.
  - Files: src/akses/Pengguna.jsx, src/lib/validasi.js, supabase/functions/tambah-pengguna/index.ts, tests/validasi.test.mjs

- [x] **T5 Pengaturan**
  - Acceptance: each user can change their own password (min. 8 characters, typed twice).
  - Verify: build passes.
  - Files: src/akses/Pengaturan.jsx, src/App.jsx

- [x] **T6 Deploy guide + live check**
  - Acceptance: `CARA-UPLOAD.md` in Bahasa Indonesia, covering:
    - the GitHub repo;
    - Supabase SQL and the edge function;
    - the first admin;
    - Cloudflare variables and build.
  - Verify: the spec's live check passes on the deployed URL; the test user is removed afterwards.
  - Files: CARA-UPLOAD.md
