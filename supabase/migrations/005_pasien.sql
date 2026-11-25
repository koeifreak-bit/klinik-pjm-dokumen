-- 005: dokumen asuhan keperawatan pasien. TIDAK ADA penghapusan (retensi rekam medis ≥ 25 tahun sejak kunjungan terakhir, Permenkes 24/2022).
-- Catatan: ini dokumen pendukung keperawatan, bukan RME resmi klinik (yang wajib terhubung ke SATUSEHAT).
create table public.pasien (
  id uuid primary key default gen_random_uuid(),
  no_rm text not null check (length(trim(no_rm)) between 1 and 30),
  nama text not null check (length(trim(nama)) between 2 and 120),
  tanggal_lahir date,
  jenis_kelamin text check (jenis_kelamin in ('L','P')),
  telepon text,
  alamat text,
  catatan text,
  kunjungan_terakhir date,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index uq_pasien_no_rm on public.pasien (upper(trim(no_rm)));
create index idx_pasien_nama on public.pasien (lower(nama));
create trigger trg_pasien_updated_at before update on public.pasien for each row execute function public.set_updated_at();

-- No. RM unik dengan pesan Bahasa Indonesia.
create or replace function public.pasien_jaga() returns trigger
language plpgsql set search_path = public as $$
begin
  new.no_rm := upper(trim(new.no_rm));
  if exists (select 1 from public.pasien p where upper(trim(p.no_rm)) = new.no_rm and p.id <> new.id) then
    raise exception 'No. RM % sudah terdaftar.', new.no_rm;
  end if;
  return new;
end $$;
create trigger trg_pasien_jaga before insert or update on public.pasien for each row execute function public.pasien_jaga();

alter table public.pasien enable row level security;
create policy pasien_baca on public.pasien for select to authenticated using ((select public.is_active_staff()));
create policy pasien_tambah on public.pasien for insert to authenticated with check ((select public.is_active_staff()));
create policy pasien_ubah on public.pasien for update to authenticated
  using ((select public.is_active_staff())) with check ((select public.is_active_staff()));
-- Tidak ada kebijakan DELETE.

create table public.pasien_dokumen (
  id uuid primary key default gen_random_uuid(),
  pasien_id uuid not null references public.pasien(id) on delete restrict,
  jenis text not null check (jenis in ('Pengkajian Keperawatan','Asuhan Keperawatan','Catatan Perkembangan','Informed Consent','Resume Pulang','Hasil Penunjang','Rujukan','Lainnya')),
  tanggal_dokumen date not null,
  judul text not null check (length(trim(judul)) between 2 and 200),
  catatan text,
  nama_file text not null,
  storage_path text not null unique check (storage_path like 'pasien/%'),
  ukuran bigint,
  mime text,
  status text not null default 'Aktif' check (status in ('Aktif','Ditarik')),
  alasan_tarik text,
  ditarik_oleh uuid references public.profiles(id),
  ditarik_pada timestamptz,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_pasien_dokumen on public.pasien_dokumen (pasien_id, tanggal_dokumen desc);
create index idx_pasien_dokumen_baru on public.pasien_dokumen (created_at desc);
create trigger trg_pasien_dokumen_updated_at before update on public.pasien_dokumen for each row execute function public.set_updated_at();

create or replace function public.pasien_dokumen_jaga() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'Aktif' then raise exception 'Dokumen baru harus berstatus Aktif.'; end if;
    return new;
  end if;
  if new.pasien_id is distinct from old.pasien_id or new.storage_path is distinct from old.storage_path or new.nama_file is distinct from old.nama_file then
    raise exception 'Berkas dan pasien pada dokumen tidak dapat diganti. Unggah dokumen baru dan tarik yang lama bila keliru.';
  end if;
  if old.status = 'Ditarik' and new.status = 'Aktif' then
    raise exception 'Dokumen yang sudah ditarik tidak dapat diaktifkan kembali. Unggah ulang bila perlu.';
  end if;
  if old.status = 'Aktif' and new.status = 'Ditarik' then
    if length(trim(coalesce(new.alasan_tarik, ''))) < 5 then raise exception 'Tuliskan alasan penarikan (minimal 5 huruf).'; end if;
    new.alasan_tarik := trim(new.alasan_tarik);
    new.ditarik_oleh := auth.uid();
    new.ditarik_pada := now();
  end if;
  if old.status = 'Ditarik' and (new.alasan_tarik is distinct from old.alasan_tarik or new.ditarik_pada is distinct from old.ditarik_pada) then
    raise exception 'Catatan penarikan tidak dapat diubah.';
  end if;
  return new;
end $$;
create trigger trg_pasien_dokumen_jaga before insert or update on public.pasien_dokumen for each row execute function public.pasien_dokumen_jaga();

-- Kunjungan terakhir = tanggal dokumen terbaru (dasar hitung retensi 25 tahun).
create or replace function public.pasien_kunjungan() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.pasien set kunjungan_terakhir = greatest(coalesce(kunjungan_terakhir, new.tanggal_dokumen), new.tanggal_dokumen)
  where id = new.pasien_id;
  return null;
end $$;
create trigger trg_pasien_kunjungan after insert or update of tanggal_dokumen on public.pasien_dokumen
  for each row execute function public.pasien_kunjungan();

alter table public.pasien_dokumen enable row level security;
create policy pasien_dokumen_baca on public.pasien_dokumen for select to authenticated using ((select public.is_active_staff()));
create policy pasien_dokumen_tambah on public.pasien_dokumen for insert to authenticated with check ((select public.is_active_staff()));
create policy pasien_dokumen_ubah on public.pasien_dokumen for update to authenticated
  using ((select public.is_active_staff())) with check ((select public.is_active_staff()));
-- Tidak ada kebijakan DELETE.

revoke execute on function public.pasien_jaga() from public, anon, authenticated;
revoke execute on function public.pasien_dokumen_jaga() from public, anon, authenticated;
revoke execute on function public.pasien_kunjungan() from public, anon, authenticated;
