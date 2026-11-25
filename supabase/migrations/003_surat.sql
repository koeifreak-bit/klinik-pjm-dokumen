-- 003: register surat masuk & keluar. Nomor dibuat atomik di database dan tidak dapat diubah; surat tidak dihapus (cukup Dibatalkan).
create table public.surat_urutan (
  tahun int not null, arah text not null check (arah in ('Masuk','Keluar')),
  terakhir int not null default 0, primary key (tahun, arah)
);
alter table public.surat_urutan enable row level security; -- hanya diakses lewat buat_surat()

create table public.surat (
  id uuid primary key default gen_random_uuid(),
  arah text not null check (arah in ('Masuk','Keluar')),
  tahun int not null,
  urut int not null,
  nomor_agenda text not null unique,
  nomor_surat text,
  tanggal_surat date not null,
  tanggal_terima date,
  tanggal_kirim date,
  perihal text not null check (length(trim(perihal)) between 3 and 300),
  pihak text not null check (length(trim(pihak)) between 2 and 200),
  jenis text not null default 'Lainnya' check (jenis in ('Undangan','Pemberitahuan','Permohonan','Laporan','Rujukan','Edaran','Keputusan','Lainnya')),
  sifat text not null default 'Biasa' check (sifat in ('Biasa','Penting','Segera','Rahasia')),
  status text not null,
  disposisi_kepada uuid references public.profiles(id),
  disposisi_instruksi text,
  disposisi_tanggal date,
  catatan text,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (arah, tahun, urut),
  constraint surat_status_sesuai_arah check (
    (arah = 'Masuk' and status in ('Diterima','Didisposisi','Selesai','Dibatalkan')) or
    (arah = 'Keluar' and status in ('Draf','Terkirim','Selesai','Dibatalkan')))
);
create index idx_surat_tahun on public.surat (tahun desc, arah, urut desc);
create index idx_surat_disposisi on public.surat (disposisi_kepada) where disposisi_kepada is not null;
create trigger trg_surat_updated_at before update on public.surat for each row execute function public.set_updated_at();

-- Membuat surat + nomor. Tahun register: surat keluar = tahun tanggal surat; surat masuk = tahun tanggal diterima.
create or replace function public.buat_surat(
  p_arah text, p_tanggal_surat date, p_tanggal_terima date, p_tanggal_kirim date,
  p_perihal text, p_pihak text, p_jenis text, p_sifat text, p_nomor_surat_masuk text, p_catatan text
) returns public.surat
language plpgsql security definer set search_path = public as $$
declare v_tahun int; v_urut int; v_tgl date; v_kode text; v public.surat;
begin
  if not public.is_active_staff() then raise exception 'Akun Anda tidak aktif.'; end if;
  if p_arah not in ('Masuk','Keluar') then raise exception 'Arah surat harus Masuk atau Keluar.'; end if;
  if p_tanggal_surat is null then raise exception 'Tanggal surat wajib diisi.'; end if;
  if length(trim(coalesce(p_perihal,''))) < 3 then raise exception 'Perihal minimal 3 huruf.'; end if;
  if length(trim(coalesce(p_pihak,''))) < 2 then raise exception 'Isi % surat.', case when p_arah = 'Masuk' then 'pengirim' else 'tujuan' end; end if;
  v_tgl := case when p_arah = 'Keluar' then p_tanggal_surat else coalesce(p_tanggal_terima, public.hari_ini_wib()) end;
  v_tahun := extract(year from v_tgl)::int;
  insert into public.surat_urutan (tahun, arah, terakhir) values (v_tahun, p_arah, 1)
  on conflict (tahun, arah) do update set terakhir = public.surat_urutan.terakhir + 1
  returning terakhir into v_urut;
  select kode_surat into v_kode from public.pengaturan_klinik where id = 1;
  insert into public.surat (arah, tahun, urut, nomor_agenda, nomor_surat, tanggal_surat, tanggal_terima, tanggal_kirim,
                            perihal, pihak, jenis, sifat, status, catatan)
  values (p_arah, v_tahun, v_urut,
          (case when p_arah = 'Masuk' then 'M-' else 'K-' end) || lpad(v_urut::text, greatest(4, length(v_urut::text)), '0') || '/' || v_tahun,
          case when p_arah = 'Keluar'
               then lpad(v_urut::text, greatest(3, length(v_urut::text)), '0') || '/' || coalesce(v_kode, 'PJM-KLN') || '/' || public.bulan_romawi(extract(month from p_tanggal_surat)::int) || '/' || v_tahun
               else nullif(trim(coalesce(p_nomor_surat_masuk, '')), '') end,
          p_tanggal_surat,
          case when p_arah = 'Masuk' then coalesce(p_tanggal_terima, public.hari_ini_wib()) end,
          case when p_arah = 'Keluar' then p_tanggal_kirim end,
          trim(p_perihal), trim(p_pihak), coalesce(p_jenis, 'Lainnya'), coalesce(p_sifat, 'Biasa'),
          case when p_arah = 'Masuk' then 'Diterima' else 'Draf' end,
          nullif(trim(coalesce(p_catatan, '')), ''))
  returning * into v;
  return v;
end $$;
revoke execute on function public.buat_surat(text, date, date, date, text, text, text, text, text, text) from public, anon;
grant execute on function public.buat_surat(text, date, date, date, text, text, text, text, text, text) to authenticated;

-- Penjaga: nomor & arah tidak dapat diubah; nomor surat keluar terkunci; disposisi otomatis mengubah status.
create or replace function public.surat_jaga() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.arah is distinct from old.arah or new.tahun is distinct from old.tahun or new.urut is distinct from old.urut
     or new.nomor_agenda is distinct from old.nomor_agenda then
    raise exception 'Nomor agenda dan arah surat tidak dapat diubah.';
  end if;
  if old.arah = 'Keluar' and new.nomor_surat is distinct from old.nomor_surat then
    raise exception 'Nomor surat keluar dibuat otomatis dan tidak dapat diubah. Batalkan surat ini dan buat yang baru bila keliru.';
  end if;
  if old.arah = 'Keluar' and new.tanggal_surat is distinct from old.tanggal_surat
     and extract(month from new.tanggal_surat) is distinct from extract(month from old.tanggal_surat) then
    raise exception 'Tanggal surat keluar tidak dapat dipindah ke bulan lain karena bulan tercantum di nomor surat.';
  end if;
  if new.disposisi_kepada is not null and old.disposisi_kepada is null and new.status = 'Diterima' then
    new.status := 'Didisposisi';
    new.disposisi_tanggal := coalesce(new.disposisi_tanggal, public.hari_ini_wib());
  end if;
  return new;
end $$;
create trigger trg_surat_jaga before update on public.surat for each row execute function public.surat_jaga();

alter table public.surat enable row level security;
create policy surat_baca on public.surat for select to authenticated using ((select public.is_active_staff()));
create policy surat_ubah on public.surat for update to authenticated
  using ((select public.is_active_staff())) with check ((select public.is_active_staff()));
-- Tidak ada INSERT langsung (pakai buat_surat) dan tidak ada DELETE.

create table public.surat_berkas (
  id uuid primary key default gen_random_uuid(),
  surat_id uuid not null references public.surat(id) on delete cascade,
  nama_file text not null,
  storage_path text not null unique check (storage_path like 'surat/%'),
  ukuran bigint,
  mime text,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index idx_surat_berkas on public.surat_berkas (surat_id);
alter table public.surat_berkas enable row level security;
create policy surat_berkas_semua on public.surat_berkas for all to authenticated
  using ((select public.is_active_staff())) with check ((select public.is_active_staff()));

revoke execute on function public.surat_jaga() from public, anon, authenticated;
