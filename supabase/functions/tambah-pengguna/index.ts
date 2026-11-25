// tambah-pengguna v1 (2026-11-25), port dari DCM tambah-pengguna v2.
// Admin aktif membuat akun staf. Data profil ditulis lewat Postgres langsung (SUPABASE_DB_URL) agar tidak
// terkena galat platform "JWT issued at future"; panggilan Auth dicoba ulang sekali bila galat itu muncul.
import { createClient } from 'npm:@supabase/supabase-js@2'
import postgres from 'npm:postgres@3.4.5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const env = (key: string) => Deno.env.get(key)?.trim() || ''
const JABATAN = ['Perawat', 'Kepala Perawat', 'Bidan', 'Dokter', 'Staf Administrasi', 'Lainnya']

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

async function withSkewRetry<T extends { error: { message: string } | null }>(call: () => Promise<T>): Promise<T> {
  const first = await call()
  if (!first.error || !/issued at future/i.test(first.error.message)) return first
  await new Promise(resolve => setTimeout(resolve, 2000))
  return call()
}

function pesanAuth(message = '') {
  if (/already (been )?registered|already exists/i.test(message)) return 'Email sudah terdaftar.'
  if (/password/i.test(message)) return 'Kata sandi ditolak: minimal 8 karakter.'
  return message || 'Gagal membuat akun.'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Gunakan POST.' }, 405)

  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'Anda harus masuk terlebih dahulu.' }, 401)

  const secretKeys = (() => { try { return JSON.parse(env('SUPABASE_SECRET_KEYS') || '{}') } catch { return {} } })()
  const secretKey = env('SUPABASE_SERVICE_ROLE_KEY') || secretKeys.default
  if (!secretKey || !env('SUPABASE_URL') || !env('SUPABASE_DB_URL')) return json({ error: 'Konfigurasi server Supabase tidak lengkap.' }, 500)
  const admin = createClient(env('SUPABASE_URL'), secretKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const sql = postgres(env('SUPABASE_DB_URL'), { prepare: false, max: 1, idle_timeout: 5, connect_timeout: 10 })

  let createdId: string | null = null
  try {
    const { data: authData, error: authError } = await withSkewRetry(() => admin.auth.getUser(token))
    if (authError || !authData.user) return json({ error: 'Sesi tidak valid. Silakan masuk ulang.' }, 401)

    const [caller] = await sql<{ is_admin: boolean; aktif: boolean }[]>`select is_admin, aktif from public.profiles where id = ${authData.user.id}::uuid`
    if (!caller?.aktif || !caller.is_admin) return json({ error: 'Hanya admin aktif yang dapat menambah pengguna.' }, 403)

    const body = await req.json().catch(() => ({}))
    const nama = String(body.nama || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    const jabatan = String(body.jabatan || '')
    const isAdmin = body.is_admin === true
    if (nama.length < 2 || nama.length > 120) return json({ error: 'Nama harus 2–120 huruf.' }, 400)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Format email tidak valid.' }, 400)
    if (password.length < 8) return json({ error: 'Kata sandi minimal 8 karakter.' }, 400)
    if (!JABATAN.includes(jabatan)) return json({ error: 'Jabatan tidak dikenal.' }, 400)

    const { data: created, error: createError } = await withSkewRetry(() => admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { nama, jabatan },
    }))
    if (createError || !created.user) return json({ error: pesanAuth(createError?.message) }, 400)
    createdId = created.user.id

    // Trigger handle_new_user sudah membuat profil (is_admin selalu false); set data final di sini.
    await sql`
      insert into public.profiles (id, nama, email, jabatan, is_admin, aktif)
      values (${createdId}::uuid, ${nama}, ${email}, ${jabatan}, ${isAdmin}, true)
      on conflict (id) do update set nama = excluded.nama, email = excluded.email, jabatan = excluded.jabatan, is_admin = excluded.is_admin, aktif = true`
    return json({ ok: true, user_id: createdId })
  } catch (e) {
    console.error('tambah-pengguna gagal:', e instanceof Error ? e.message : e)
    // Jangan tinggalkan akun login tanpa profil yang benar.
    if (createdId) await admin.auth.admin.deleteUser(createdId).catch(() => {})
    return json({ error: 'Gagal membuat akun. Coba lagi.' }, 500)
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {})
  }
})
