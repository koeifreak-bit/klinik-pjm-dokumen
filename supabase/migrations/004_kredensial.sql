-- 004: kredensial staf (STR, SIP, sertifikat pelatihan). STR berlaku seumur hidup (UU 17/2023) → tanggal boleh kosong; SIP wajib bertanggal.
create table public.kredensial (
  id uuid primary key default gen_random_uuid(),
  profil_id uuid not null references public.profiles(id),
  jenis text not null check (jenis in ('STR','SIP','Sertifikat Pelatihan','Lainnya')),
  nama text not null check (length(trim(nama)) between 2 and 150),
  nomor text,
  penerbit text,
  tanggal_terbit date,
  berlaku_sampai date,
  catatan text,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_kredensial_profil on public.kredensial (profil_id);
create index idx_kredensial_berlaku on public.kredensial (berlaku_sampai) where berlaku_sampai is not null;
create trigger trg_kredensial_updated_at before update on public.kredensial for each row execute function public.set_updated_at();

create or replace function public.kredensial_jaga() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.jenis = 'SIP' and new.berlaku_sampai is null then
    raise exception 'SIP wajib memiliki tanggal berlaku sampai (masa berlaku SIP 5 tahun).';
  end if;
  if new.berlaku_sampai is not null and new.tanggal_terbit is not null and new.berlaku_sampai < new.tanggal_terbit then
    raise exception 'Tanggal berlaku sampai tidak boleh sebelum tanggal terbit.';
  end if;
  return new;
end $$;
create trigger trg_kredensial_jaga before insert or update on public.kredensial for each row execute function public.kredensial_jaga();
revoke execute on function public.kredensial_jaga() from public, anon, authenticated;

alter table public.kredensial enable row level security;
create policy kredensial_semua on public.kredensial for all to authenticated
  using ((select public.is_active_staff())) with check ((select public.is_active_staff()));

create table public.kredensial_berkas (
  id uuid primary key default gen_random_uuid(),
  kredensial_id uuid not null references public.kredensial(id) on delete cascade,
  nama_file text not null,
  storage_path text not null unique check (storage_path like 'kredensial/%'),
  ukuran bigint,
  mime text,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index idx_kredensial_berkas on public.kredensial_berkas (kredensial_id);
alter table public.kredensial_berkas enable row level security;
create policy kredensial_berkas_semua on public.kredensial_berkas for all to authenticated
  using ((select public.is_active_staff())) with check ((select public.is_active_staff()));
