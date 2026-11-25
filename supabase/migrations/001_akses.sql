-- 001_akses: akun staf Klinik PT Prima Jasa Medica.
-- Keputusan pemilik (2026-11-25): keamanan minimal. Hanya dua aturan yang ditegakkan:
--   1) akun nonaktif tidak dapat membaca/mengubah apa pun;
--   2) hanya admin yang dapat membuat/mengubah akun orang lain.
-- Pendaftaran publik WAJIB dimatikan di dashboard (Authentication → Sign In / Providers → Allow new users to sign up = off).

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

create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;
create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Dipakai oleh RLS semua tabel modul berikutnya.
create or replace function public.is_active_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and aktif)
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and aktif and is_admin)
$$;

-- Akun baru di auth.users → baris profil. is_admin TIDAK dibaca dari metadata (selalu false di sini).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_nama text := nullif(trim(new.raw_user_meta_data->>'nama'), '');
        v_jabatan text := nullif(new.raw_user_meta_data->>'jabatan', '');
begin
  if v_nama is null or length(v_nama) < 2 then v_nama := coalesce(nullif(split_part(new.email, '@', 1), ''), 'Pengguna'); end if;
  if length(v_nama) < 2 then v_nama := 'Pengguna'; end if;
  if v_jabatan is null or v_jabatan not in ('Perawat','Kepala Perawat','Bidan','Dokter','Staf Administrasi','Lainnya') then v_jabatan := 'Perawat'; end if;
  insert into public.profiles (id, nama, email, jabatan) values (new.id, left(v_nama, 120), coalesce(new.email, ''), v_jabatan)
  on conflict (id) do nothing;
  return new;
end $$;
create trigger trg_auth_new_user after insert on auth.users
  for each row execute function public.handle_new_user();

-- Penjaga perubahan profil:
--  • non-admin hanya boleh mengubah nama miliknya sendiri;
--  • admin aktif terakhir tidak boleh dinonaktifkan atau kehilangan hak admin.
-- Perubahan dari SQL Editor / server (auth.uid() kosong) tidak dibatasi aturan pertama, agar admin pertama dapat dibuat.
create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.id <> auth.uid() then
      raise exception 'Hanya admin yang dapat mengubah akun pengguna lain.';
    end if;
    if new.is_admin is distinct from old.is_admin or new.aktif is distinct from old.aktif
       or new.jabatan is distinct from old.jabatan or new.email is distinct from old.email then
      raise exception 'Anda hanya dapat mengubah nama Anda sendiri. Jabatan, status, dan hak admin diubah oleh admin.';
    end if;
  end if;
  if old.is_admin and old.aktif and not (new.is_admin and new.aktif)
     and not exists (select 1 from public.profiles p where p.id <> old.id and p.is_admin and p.aktif) then
    raise exception 'Tidak dapat menonaktifkan atau mencabut hak admin dari admin aktif terakhir. Jadikan pengguna lain admin terlebih dahulu.';
  end if;
  return new;
end $$;
create trigger trg_profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();

alter table public.profiles enable row level security;
create policy profiles_read on public.profiles for select to authenticated
  using ((select public.is_active_staff()));
create policy profiles_update_admin on public.profiles for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid()) and (select public.is_active_staff()))
  with check (id = (select auth.uid()));
-- Tidak ada kebijakan INSERT/DELETE: akun dibuat lewat fungsi tambah-pengguna, dan tidak dihapus (cukup dinonaktifkan).

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.profiles_guard() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.is_active_staff() from public, anon;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_active_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;
