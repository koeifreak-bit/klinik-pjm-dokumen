-- 006: kunci search_path pada dua fungsi bantu tanggal (saran Supabase advisor).
alter function public.hari_ini_wib() set search_path = public;
alter function public.bulan_romawi(int) set search_path = public;
