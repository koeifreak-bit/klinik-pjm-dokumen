-- Uji modul surat, kredensial, pasien. Semua dibatalkan (RAISE 'ROLLBACK_OK …'). Hasil yang diharapkan: semua baris = t / true.
do $$
declare
  s uuid := gen_random_uuid(); x uuid := gen_random_uuid();
  hasil text := ''; n int; r public.surat; r2 public.surat; r3 public.surat; p uuid; d uuid; k uuid;
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data) values
    (s, 'uji-s@klinik.test', 'authenticated', 'authenticated', '{"nama":"Perawat Uji"}'),
    (x, 'uji-x@klinik.test', 'authenticated', 'authenticated', '{"nama":"Nonaktif Uji"}');
  update public.profiles set aktif = false where id = x;

  perform set_config('request.jwt.claims', json_build_object('sub', s, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  -- === SURAT ===
  r  := public.buat_surat('Keluar', '2031-11-03', null, null, 'Undangan rapat', 'Dinas Kesehatan', 'Undangan', 'Biasa', null, null);
  r2 := public.buat_surat('Keluar', '2031-11-20', null, null, 'Laporan bulanan', 'Dinas Kesehatan', 'Laporan', 'Penting', null, null);
  r3 := public.buat_surat('Masuk', '2031-11-01', '2031-11-04', null, 'Permohonan data', 'RS Contoh', 'Permohonan', 'Segera', '045/RS/XI/2031', null);
  hasil := hasil || format(E'\n1 nomor keluar #1 = 001/PJM-KLN/XI/2031: %s', r.nomor_surat = '001/PJM-KLN/XI/2031');
  hasil := hasil || format(E'\n2 nomor keluar #2 = 002/PJM-KLN/XI/2031: %s', r2.nomor_surat = '002/PJM-KLN/XI/2031');
  hasil := hasil || format(E'\n3 agenda keluar K-0002/2031 & masuk M-0001/2031 (urutan terpisah): %s', r2.nomor_agenda = 'K-0002/2031' and r3.nomor_agenda = 'M-0001/2031');
  hasil := hasil || format(E'\n4 status awal Draf / Diterima, nomor pengirim disimpan: %s', r.status = 'Draf' and r3.status = 'Diterima' and r3.nomor_surat = '045/RS/XI/2031');
  begin update public.surat set nomor_surat = '999/X' where id = r.id; hasil := hasil || E'\n5 nomor keluar terkunci: false';
  exception when others then hasil := hasil || format(E'\n5 nomor keluar terkunci: %s', sqlerrm like 'Nomor surat keluar%'); end;
  begin update public.surat set tanggal_surat = '2031-12-01' where id = r.id; hasil := hasil || E'\n6 tanggal keluar tidak boleh pindah bulan: false';
  exception when others then hasil := hasil || format(E'\n6 tanggal keluar tidak boleh pindah bulan: %s', sqlerrm like 'Tanggal surat keluar%'); end;
  update public.surat set disposisi_kepada = s, disposisi_instruksi = 'Tindak lanjuti' where id = r3.id;
  hasil := hasil || format(E'\n7 disposisi → status Didisposisi: %s', (select status from public.surat where id = r3.id) = 'Didisposisi');
  delete from public.surat where id = r.id; get diagnostics n = row_count;
  hasil := hasil || format(E'\n8 surat tidak dapat dihapus (0 baris): %s', n = 0);
  begin update public.surat set status = 'Terkirim' where id = r3.id; hasil := hasil || E'\n9 status tak sesuai arah ditolak: false';
  exception when others then hasil := hasil || E'\n9 status tak sesuai arah ditolak: true'; end;

  -- === KREDENSIAL ===
  begin insert into public.kredensial (profil_id, jenis, nama) values (s, 'SIP', 'SIP Perawat'); hasil := hasil || E'\n10 SIP tanpa tanggal ditolak: false';
  exception when others then hasil := hasil || format(E'\n10 SIP tanpa tanggal ditolak: %s', sqlerrm like 'SIP wajib%'); end;
  insert into public.kredensial (profil_id, jenis, nama) values (s, 'STR', 'STR Perawat') returning id into k;
  hasil := hasil || format(E'\n11 STR tanpa tanggal (seumur hidup) diterima: %s', k is not null);
  begin insert into public.kredensial (profil_id, jenis, nama, tanggal_terbit, berlaku_sampai) values (s, 'Sertifikat Pelatihan', 'BTCLS', '2026-05-01', '2025-05-01'); hasil := hasil || E'\n12 berlaku < terbit ditolak: false';
  exception when others then hasil := hasil || format(E'\n12 berlaku < terbit ditolak: %s', sqlerrm like 'Tanggal berlaku%'); end;

  -- === PASIEN ===
  insert into public.pasien (no_rm, nama) values (' rm-0001 ', 'Pasien Uji') returning id into p;
  hasil := hasil || format(E'\n13 No. RM dirapikan jadi RM-0001: %s', (select no_rm from public.pasien where id = p) = 'RM-0001');
  begin insert into public.pasien (no_rm, nama) values ('Rm-0001', 'Duplikat'); hasil := hasil || E'\n14 No. RM ganda ditolak: false';
  exception when others then hasil := hasil || format(E'\n14 No. RM ganda ditolak: %s', sqlerrm like 'No. RM%sudah terdaftar%'); end;
  insert into public.pasien_dokumen (pasien_id, jenis, tanggal_dokumen, judul, nama_file, storage_path)
    values (p, 'Asuhan Keperawatan', '2026-10-01', 'Askep hari 1', 'a.pdf', 'pasien/' || p || '/a/a.pdf') returning id into d;
  insert into public.pasien_dokumen (pasien_id, jenis, tanggal_dokumen, judul, nama_file, storage_path)
    values (p, 'Informed Consent', '2026-09-01', 'Persetujuan', 'b.pdf', 'pasien/' || p || '/b/b.pdf');
  hasil := hasil || format(E'\n15 kunjungan terakhir = dokumen terbaru (2026-10-01): %s', (select kunjungan_terakhir from public.pasien where id = p) = '2026-10-01');
  delete from public.pasien_dokumen where id = d; get diagnostics n = row_count;
  hasil := hasil || format(E'\n16 dokumen pasien tidak dapat dihapus (0 baris): %s', n = 0 and exists (select 1 from public.pasien_dokumen where id = d));
  delete from public.pasien where id = p; get diagnostics n = row_count;
  hasil := hasil || format(E'\n17 pasien tidak dapat dihapus (0 baris): %s', n = 0);
  begin update public.pasien_dokumen set status = 'Ditarik' where id = d; hasil := hasil || E'\n18 tarik tanpa alasan ditolak: false';
  exception when others then hasil := hasil || format(E'\n18 tarik tanpa alasan ditolak: %s', sqlerrm like 'Tuliskan alasan%'); end;
  update public.pasien_dokumen set status = 'Ditarik', alasan_tarik = 'Salah unggah pasien' where id = d;
  hasil := hasil || format(E'\n19 tarik dengan alasan: dicatat siapa & kapan: %s', (select ditarik_oleh = s and ditarik_pada is not null from public.pasien_dokumen where id = d));
  begin update public.pasien_dokumen set status = 'Aktif' where id = d; hasil := hasil || E'\n20 ditarik tidak bisa diaktifkan lagi: false';
  exception when others then hasil := hasil || format(E'\n20 ditarik tidak bisa diaktifkan lagi: %s', sqlerrm like 'Dokumen yang sudah ditarik%'); end;
  begin update public.pasien_dokumen set storage_path = 'pasien/lain.pdf' where id = d; hasil := hasil || E'\n21 berkas dokumen terkunci: false';
  exception when others then hasil := hasil || format(E'\n21 berkas dokumen terkunci: %s', sqlerrm like 'Berkas dan pasien%'); end;

  -- === Akun nonaktif ===
  perform set_config('request.jwt.claims', json_build_object('sub', x, 'role', 'authenticated')::text, true);
  select (select count(*) from public.surat) + (select count(*) from public.kredensial) + (select count(*) from public.pasien) + (select count(*) from public.pasien_dokumen) into n;
  hasil := hasil || format(E'\n22 akun nonaktif tidak melihat apa pun: %s', n = 0);
  begin perform public.buat_surat('Keluar', '2031-11-05', null, null, 'Coba', 'Siapa saja', null, null, null, null); hasil := hasil || E'\n23 akun nonaktif tidak bisa membuat surat: false';
  exception when others then hasil := hasil || format(E'\n23 akun nonaktif tidak bisa membuat surat: %s', sqlerrm like 'Akun Anda tidak aktif%'); end;

  perform set_config('role', 'postgres', true);
  -- Kebijakan storage: hapus hanya untuk surat/ dan kredensial/, tidak untuk pasien/.
  hasil := hasil || format(E'\n24 kebijakan hapus storage mengecualikan pasien/: %s',
    (select qual from pg_policies where schemaname = 'storage' and policyname = 'dokumen_hapus') like '%surat%kredensial%'
    and (select qual from pg_policies where schemaname = 'storage' and policyname = 'dokumen_hapus') not like '%pasien%');
  raise exception 'ROLLBACK_OK%', hasil;
end $$;
