-- 002: penyimpanan berkas (bucket privat `dokumen`), hari libur nasional, dan pengaturan klinik.

-- Bucket privat. Batas 10 MB per berkas.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dokumen', 'dokumen', false, 10485760, array[
  'application/pdf','image/jpeg','image/png','image/webp',
  'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy dokumen_baca on storage.objects for select to authenticated
  using (bucket_id = 'dokumen' and (select public.is_active_staff()));
create policy dokumen_unggah on storage.objects for insert to authenticated
  with check (bucket_id = 'dokumen' and (select public.is_active_staff())
              and split_part(name, '/', 1) in ('surat', 'kredensial', 'pasien'));
-- Berkas pasien TIDAK PERNAH dihapus (retensi 25 tahun). Berkas surat & kredensial boleh dihapus.
create policy dokumen_hapus on storage.objects for delete to authenticated
  using (bucket_id = 'dokumen' and (select public.is_active_staff()) and split_part(name, '/', 1) in ('surat', 'kredensial'));
-- Tidak ada kebijakan UPDATE: berkas tidak dapat ditimpa.

-- Hari libur nasional & cuti bersama (SKB 3 Menteri), sama dengan DCM. Hanya informasi di kalender.
create table public.public_holidays (day date primary key, name text not null);
alter table public.public_holidays enable row level security;
create policy libur_baca on public.public_holidays for select to authenticated using (true);
create policy libur_admin on public.public_holidays for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
insert into public.public_holidays (day, name) values
('2025-01-01','Tahun Baru Masehi'),('2025-01-27','Isra Mi''raj'),('2025-01-28','Cuti Bersama Imlek'),('2025-01-29','Tahun Baru Imlek'),
('2025-03-28','Cuti Bersama Nyepi'),('2025-03-29','Nyepi'),('2025-03-31','Idul Fitri'),('2025-04-01','Idul Fitri'),('2025-04-02','Cuti Bersama Idul Fitri'),
('2025-04-03','Cuti Bersama Idul Fitri'),('2025-04-04','Cuti Bersama Idul Fitri'),('2025-04-07','Cuti Bersama Idul Fitri'),('2025-04-18','Jumat Agung'),('2025-04-20','Paskah'),
('2025-05-01','Hari Buruh'),('2025-05-12','Waisak'),('2025-05-13','Cuti Bersama Waisak'),('2025-05-29','Kenaikan Yesus Kristus'),('2025-05-30','Cuti Bersama Kenaikan'),
('2025-06-01','Hari Lahir Pancasila'),('2025-06-06','Idul Adha'),('2025-06-09','Cuti Bersama Idul Adha'),('2025-06-27','Tahun Baru Islam'),('2025-08-17','Hari Kemerdekaan'),
('2025-08-18','Cuti Bersama Kemerdekaan'),('2025-09-05','Maulid Nabi'),('2025-12-25','Natal'),('2025-12-26','Cuti Bersama Natal'),
('2026-01-01','Tahun Baru Masehi'),('2026-01-16','Isra Mi''raj'),('2026-02-16','Cuti Bersama Imlek'),('2026-02-17','Tahun Baru Imlek'),('2026-03-18','Cuti Bersama Nyepi'),
('2026-03-19','Nyepi'),('2026-03-20','Cuti Bersama Idul Fitri'),('2026-03-21','Idul Fitri'),('2026-03-22','Idul Fitri'),('2026-03-23','Cuti Bersama Idul Fitri'),
('2026-03-24','Cuti Bersama Idul Fitri'),('2026-04-03','Jumat Agung'),('2026-04-05','Paskah'),('2026-05-01','Hari Buruh'),('2026-05-14','Kenaikan Yesus Kristus'),
('2026-05-15','Cuti Bersama Kenaikan'),('2026-05-27','Idul Adha'),('2026-05-28','Cuti Bersama Idul Adha'),('2026-05-31','Waisak'),('2026-06-01','Hari Lahir Pancasila'),
('2026-06-16','Tahun Baru Islam'),('2026-08-17','Hari Kemerdekaan'),('2026-08-25','Maulid Nabi'),('2026-12-24','Cuti Bersama Natal'),('2026-12-25','Natal'),
('2027-01-01','Tahun Baru Masehi'),('2027-01-05','Isra Mi''raj'),('2027-02-05','Cuti Bersama Imlek'),('2027-02-06','Tahun Baru Imlek'),('2027-03-08','Nyepi'),
('2027-03-09','Cuti Bersama Idul Fitri'),('2027-03-10','Idul Fitri'),('2027-03-11','Idul Fitri'),('2027-03-12','Cuti Bersama Idul Fitri'),('2027-03-15','Cuti Bersama Idul Fitri'),
('2027-03-25','Cuti Bersama Wafat Yesus Kristus'),('2027-03-26','Jumat Agung'),('2027-03-28','Paskah'),('2027-05-01','Hari Buruh'),('2027-05-06','Kenaikan Yesus Kristus'),
('2027-05-17','Idul Adha'),('2027-05-18','Cuti Bersama Idul Adha'),('2027-05-19','Cuti Bersama Waisak'),('2027-05-20','Waisak'),('2027-06-01','Hari Lahir Pancasila'),
('2027-06-06','Tahun Baru Islam'),('2027-08-15','Maulid Nabi'),('2027-08-17','Hari Kemerdekaan'),('2027-12-24','Cuti Bersama Natal'),('2027-12-25','Natal'),
('2027-12-26','Isra Mi''raj')
on conflict (day) do nothing;

-- Pengaturan klinik (satu baris).
create table public.pengaturan_klinik (
  id int primary key default 1 check (id = 1),
  nama_klinik text not null default 'Klinik PT Prima Jasa Medica',
  kode_surat text not null default 'PJM-KLN' check (kode_surat ~ '^[A-Za-z0-9.\-]{1,20}$'),
  updated_at timestamptz not null default now()
);
insert into public.pengaturan_klinik (id) values (1) on conflict do nothing;
create trigger trg_pengaturan_updated_at before update on public.pengaturan_klinik for each row execute function public.set_updated_at();
alter table public.pengaturan_klinik enable row level security;
create policy pengaturan_baca on public.pengaturan_klinik for select to authenticated using ((select public.is_active_staff()));
create policy pengaturan_admin on public.pengaturan_klinik for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Tanggal hari ini (WIB) untuk penomoran & perhitungan.
create or replace function public.hari_ini_wib() returns date language sql stable as $$ select (now() at time zone 'Asia/Jakarta')::date $$;

-- Angka Romawi bulan untuk nomor surat keluar.
create or replace function public.bulan_romawi(p int) returns text language sql immutable as $$
  select (array['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'])[p]
$$;
