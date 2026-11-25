-- Uji modul akses. Semua perubahan dibatalkan: blok selalu diakhiri RAISE 'ROLLBACK_OK …'.
-- Jalankan di SQL Editor; hasil yang diharapkan: ERROR berisi "ROLLBACK_OK" dan semua nilai = lulus.
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid(); d uuid := gen_random_uuid();
  hasil text := '';
  n int;
begin
  -- Pengguna uji (trigger membuat profil). Metadata is_admin harus DIABAIKAN.
  insert into auth.users (id, email, aud, role, raw_user_meta_data) values
    (a, 'uji-a@klinik.test', 'authenticated', 'authenticated', '{"nama":"Admin Uji","jabatan":"Kepala Perawat","is_admin":true}'),
    (b, 'uji-b@klinik.test', 'authenticated', 'authenticated', '{"nama":"Perawat Uji","jabatan":"Perawat"}'),
    (c, 'uji-c@klinik.test', 'authenticated', 'authenticated', '{"nama":"Bidan Uji","jabatan":"Bidan"}'),
    (d, 'uji-d@klinik.test', 'authenticated', 'authenticated', '{"nama":"Nonaktif Uji","jabatan":"Jabatan Aneh"}');
  select count(*) into n from public.profiles where id in (a,b,c,d) and not is_admin;
  hasil := hasil || format(E'\n1 profil dibuat & is_admin metadata diabaikan: %s', n = 4);
  hasil := hasil || format(E'\n2 jabatan tak dikenal → Perawat: %s', (select jabatan from public.profiles where id = d) = 'Perawat');

  -- Admin pertama lewat SQL (auth.uid() kosong) — harus boleh.
  update public.profiles set is_admin = true where id = a;
  update public.profiles set aktif = false where id = d;
  hasil := hasil || format(E'\n3 admin pertama via SQL: %s', (select is_admin from public.profiles where id = a));

  -- === Sebagai staf B ===
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into n from public.profiles where id in (a,b,c,d);
  hasil := hasil || format(E'\n4 staf aktif melihat profil (3 aktif + 1 nonaktif = 4): %s', n = 4);
  -- RLS menolak diam-diam (0 baris, tanpa galat) — aplikasi wajib memeriksa jumlah baris.
  begin update public.profiles set jabatan = 'Dokter' where id = c; get diagnostics n = row_count;
    hasil := hasil || format(E'\n5 staf ubah akun lain DITOLAK (0 baris): %s', n = 0);
  exception when others then hasil := hasil || format(E'\n5 staf ubah akun lain DITOLAK: %s', sqlerrm like 'Hanya admin%'); end;
  perform set_config('role', 'postgres', true);
  hasil := hasil || format(E'\n5b jabatan akun lain tetap Bidan: %s', (select jabatan from public.profiles where id = c) = 'Bidan');
  perform set_config('role', 'authenticated', true);
  begin update public.profiles set is_admin = true where id = b; hasil := hasil || E'\n6 staf jadikan diri admin DITOLAK: false';
  exception when others then hasil := hasil || format(E'\n6 staf jadikan diri admin DITOLAK: %s', sqlerrm like 'Anda hanya dapat%'); end;
  update public.profiles set nama = 'Perawat Uji Baru' where id = b;
  hasil := hasil || format(E'\n7 staf ubah nama sendiri: %s', (select nama from public.profiles where id = b) = 'Perawat Uji Baru');
  begin insert into public.profiles (id, nama, email) values (gen_random_uuid(), 'Palsu', 'x@x'); hasil := hasil || E'\n8 staf tambah profil DITOLAK: false';
  exception when others then hasil := hasil || E'\n8 staf tambah profil DITOLAK: true'; end;

  -- === Sebagai nonaktif D ===
  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
  select count(*) into n from public.profiles;
  hasil := hasil || format(E'\n9 akun nonaktif tidak melihat data apa pun: %s', n = 0);
  update public.profiles set nama = 'Coba Ubah' where id = d;
  get diagnostics n = row_count;
  hasil := hasil || format(E'\n10 akun nonaktif tidak bisa mengubah (0 baris): %s', n = 0);

  -- === Sebagai admin A ===
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  update public.profiles set jabatan = 'Dokter' where id = c;
  hasil := hasil || format(E'\n11 admin ubah jabatan orang lain: %s', (select jabatan from public.profiles where id = c) = 'Dokter');
  begin update public.profiles set aktif = false where id = a; hasil := hasil || E'\n12 admin terakhir nonaktifkan diri DITOLAK: false';
  exception when others then hasil := hasil || format(E'\n12 admin terakhir nonaktifkan diri DITOLAK: %s', sqlerrm like 'Tidak dapat menonaktifkan%'); end;
  update public.profiles set is_admin = true where id = b;
  update public.profiles set is_admin = false where id = a;
  hasil := hasil || format(E'\n13 setelah ada admin lain, admin lama boleh dicabut: %s', not (select is_admin from public.profiles where id = a));

  perform set_config('role', 'postgres', true);
  raise exception 'ROLLBACK_OK%', hasil;
end $$;
