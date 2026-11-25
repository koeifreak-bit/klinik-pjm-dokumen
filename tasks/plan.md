# Plan: module `akses` (from SPEC-akses.md, approved 2026-11-25)

Repo: **private** GitHub repo `koeifreak-bit/klinik-pjm-dokumen` (owner's decision 2026-11-25).

## Components and dependencies
```
skeleton (Vite + React + wrangler) ──┐
001_akses.sql (profiles, helpers, triggers) ──┬── tambah-pengguna edge function
                                              └── Login / shell / Pengguna / Pengaturan UI
                                                          └── CARA-UPLOAD.md + live check
```
- The **skeleton** and the **migration** don't depend on each other.
- The **UI** needs both.
- **tambah-pengguna** needs the migration's profile trigger.

## Order
1. Skeleton that builds and shows a placeholder login (proves the toolchain).
2. Migration and SQL tests.
3. Login, app shell and sign-out.
4. Pengguna page plus the `tambah-pengguna` function.
5. Pengaturan (change password) and the deactivation sign-out.
6. Deploy guide, upload package, live check.

## Risks and mitigations
| Risk | Mitigation |
|---|---|
| The Supabase connector can't reach the new account | You reconnect the connector to the new account yourself, signing in on Supabase's own page. If not, I test the SQL in a rolled-back transaction in a temporary schema on the DCM project (nothing persists), and you paste the migration into the new project |
| "JWT issued at future" when creating users (hit in DCM) | Port DCM `tambah-pengguna` v2 as-is: direct DB plus the clock-skew retry |
| New-style keys (`sb_publishable_` / `sb_secret_`) | The browser only uses the publishable key; the edge function uses `SUPABASE_DB_URL` |
| Cloudflare build fails without a lockfile | Ship `package-lock.json` |
| Wrong upload folder (`src/src/`), as with DCM | `CARA-UPLOAD.md` plus a post-deploy bundle check |

## Verification checkpoints
- After step 1: `vite build` passes.
- After step 2: every SQL test block ends in `ROLLBACK_OK` with the expected values.
- After step 4: the build and the node unit tests pass.
- After step 6: the live check from the spec passes.
