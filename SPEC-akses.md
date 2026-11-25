# Spec: `akses` — login & akun pengguna

Module 1 of 5 in [CAPABILITY-MAP.md](CAPABILITY-MAP.md) (approved 2026-11-25). Status: **APPROVED** 2026-11-25. Open questions resolved by default: name "Dokumen Klinik PJM"; jabatan list as written; repo `koeifreak-bit/klinik-pjm-dokumen` (private).
This spec also sets up the project skeleton (repo, build, deploy) that every later module uses.

## Objective
Staff of Klinik PT Prima Jasa Medica can sign in to "Dokumen Klinik PJM" with email and password, and an admin can create, edit and deactivate staff accounts from inside the app. Everything is in Bahasa Indonesia.

Owner's decision (2026-11-25): security is kept minimal. There are no roles beyond "admin vs. staff", no audit log, and any active account can see and edit all documents. Only two rules are enforced, because without them the module doesn't work:
- a deactivated account can no longer read or change anything, even if it was already signed in;
- only admins can create accounts or change other accounts.

### User stories
1. As a staff member, I sign in with my email and password and land on the dashboard. If I enter the wrong password I see "Email atau kata sandi salah."
2. As a staff member, I can change my own password (Pengaturan → Ubah kata sandi).
3. As an admin, on the **Pengguna** page I add a user with name, email, an initial password (min. 8 characters), *jabatan* (Perawat, Kepala Perawat, Bidan, Dokter, Staf Administrasi, Lainnya) and an "Admin" checkbox. The user can sign in immediately.
4. As an admin, I can edit a user's name, jabatan and admin flag, and set a user **Nonaktif** / **Aktif**. A deactivated user who is still signed in sees "Akun Anda dinonaktifkan" on their next action and is signed out.
5. The app never lets the last active admin be deactivated or lose admin rights (lesson from DCM, migration 011).
6. As a staff member, I see who I am (name and jabatan) in the sidebar, and I can sign out.

## Tech Stack
Copied from DCM Firma, which already runs on this stack:
- React 19.1 + Vite 7, plain JSX (no TypeScript), `lucide-react` 0.544 icons, `@supabase/supabase-js` 2.57.
- Supabase (new account, region **Singapore ap-southeast-1**): Postgres 17, Auth (email + password, email confirmation **off**), Storage (used from module 2 onwards).
- One Supabase Edge Function, `tambah-pengguna`, which creates auth users. It is a port of DCM's v2: direct Postgres via `SUPABASE_DB_URL` plus the auth admin API, with the clock-skew retry that fixed "JWT issued at future".
- Cloudflare Workers (static assets with SPA fallback via `wrangler.jsonc`), built from GitHub by Cloudflare Workers Builds. No server code on Cloudflare.

## Commands
No npm or git on this PC's PATH. Builds use the Codex Node runtime, as with DCM:
```
Build:  & "$env:LOCALAPPDATA\OpenAI\Codex\runtimes\cua_node\13827bafdc0b5422\bin\node.exe" node_modules\vite\bin\vite.js build
Test:   & "<same node.exe>" --test "tests/*.test.mjs"
Dev:    & "<same node.exe>" node_modules\vite\bin\vite.js --port 5180
```
Cloudflare build (in its dashboard): build command `npm ci && npm run build`, deploy command `npx wrangler deploy`. Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
Database changes: numbered SQL files in `supabase/migrations/`. I apply them with the Supabase connector once it is linked to the new account; until then you paste them into the SQL Editor.

## Project Structure
```
klinik-pjm-dokumen/
  CAPABILITY-MAP.md, SPEC-*.md   → approved map and per-module specs
  index.html, vite.config.js, wrangler.jsonc, package.json, .env.example
  src/main.jsx                   → entry
  src/App.jsx                    → shell: login gate, sidebar, page switch
  src/lib/supabase.js            → client
  src/lib/format.js              → Indonesian date/number helpers (WIB)
  src/akses/Login.jsx, Pengguna.jsx, Pengaturan.jsx
  src/ui/                        → shared components (Modal, DateInput copied from DCM, etc.)
  src/styles.css
  supabase/migrations/001_akses.sql
  supabase/functions/tambah-pengguna/index.ts
  supabase/tests/akses.sql       → rolled-back SQL test blocks
  tests/*.test.mjs               → node:test unit tests for pure helpers
  CARA-UPLOAD.md                 → step-by-step deploy guide in Bahasa Indonesia
```
Each later module adds `src/<module>/`, `supabase/migrations/00N_<module>.sql` and `supabase/tests/<module>.sql`.

## Data model (001_akses.sql)
```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nama text not null check (length(trim(nama)) between 2 and 120),
  email text not null,
  jabatan text not null default 'Perawat'
    check (jabatan in ('Perawat','Kepala Perawat','Bidan','Dokter','Staf Administrasi','Lainnya')),
  is_admin boolean not null default false,
  aktif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- is_active_staff(): signed in AND profile aktif. Used by every table's RLS from module 2 on.
-- is_admin(): is_active_staff() AND is_admin.
-- RLS: profiles readable by active staff; insert/update only by admins, except a user may update their own nama.
-- Trigger: block deactivating/demoting the last active admin.
-- Trigger on auth.users insert: create profile from raw_user_meta_data (nama, jabatan, is_admin).
```
**First admin:** created once in the Supabase dashboard (Authentication → Add user), then made admin with one SQL line given in `CARA-UPLOAD.md`.

## Code Style
Same conventions as DCM: function components, small helpers, Indonesian UI text, English-free labels, dates as `YYYY-MM-DD` strings shown in WIB.
```jsx
export function Pengguna({ profil }) {
  const [daftar, setDaftar] = useState([])
  const [galat, setGalat] = useState('')
  const muat = async () => {
    const { data, error } = await supabase.from('profiles').select('*').order('nama')
    if (error) setGalat(error.message); else setDaftar(data)
  }
  useEffect(() => { muat() }, [])
  // …
}
```
- Variables and functions in Indonesian where they mirror UI concepts (`daftar`, `muat`, `simpan`); technical names stay English (`useEffect`, `error`).
- Every Supabase write checks `error` and, where RLS could silently skip it (UPDATE/DELETE), checks the affected rows. This is the DCM v19 lesson.
- Database error messages from triggers are written in Bahasa Indonesia so they can be shown directly.

## Testing Strategy
- **SQL tests** (`supabase/tests/akses.sql`): DO blocks that impersonate an admin, a staff member and a deactivated staff member via `request.jwt.claims`, check each rule, then roll back with `raise exception 'ROLLBACK_OK …'`. This is the pattern used for DCM 012–019.
- **Unit tests** (`tests/*.test.mjs`, `node --test`): pure helpers such as date formatting and input validation.
- **Live check after deploy**: sign in, add a test user, sign in as that user, deactivate it and confirm it is signed out, then delete the test user.

## Boundaries
- **Always:** UI text in Bahasa Indonesia; build passes before packaging; SQL tests pass before a migration goes live; check affected rows on UPDATE/DELETE; keep the database password, service key and DB URL out of chat, screenshots and GitHub.
- **Ask first:** new npm dependencies; changing the module map or build order; anything that sends data to a third party.
- **Never:** commit secrets or `.env`; make the GitHub repo public (it will hold patient-document code paths and config); hard-delete patient documents (module 4).

## Success Criteria
1. `vite build` succeeds, and the app deploys to a `*.workers.dev` URL from a **private** GitHub repo.
2. The login page and all `akses` screens show only Bahasa Indonesia text.
3. An admin creates a user in the app, and that user can sign in at once with the given password.
4. A non-admin cannot open the Pengguna page, and any attempt to add or edit users through the API is rejected (SQL test).
5. A deactivated user's next request returns no data, the app shows "Akun Anda dinonaktifkan" and signs them out (SQL test + live check).
6. Deactivating or demoting the last active admin fails with an Indonesian error message (SQL test).
7. A user can change their own password and sign in with the new one.

## Open Questions
1. **App name and URL:** "Dokumen Klinik PJM" at `klinik-pjm-dokumen.<your-subdomain>.workers.dev`. OK, or another name?
2. **Supabase connector:** it is still signed in to your old account. Reconnect it to the new account (I then do the database work myself), or do you prefer to paste SQL?
3. **Jabatan list:** Perawat, Kepala Perawat, Bidan, Dokter, Staf Administrasi, Lainnya. Add or remove any?
4. **GitHub:** a new private repo `klinik-pjm-dokumen` under `koeifreak-bit`, or under a clinic-owned GitHub account?
