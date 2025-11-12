import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import type { Database } from '@/types/supabase'

export const createClient = () => {
  return createClientComponentClient<Database>()
}

export const createServerClient = () => {
  return createServerComponentClient<Database>({ cookies })
}

// Create a Supabase client using the service role key. Use this on server-side
// only when you intentionally need to bypass RLS (for public pages that must
// show published results). Keep usage minimal and audit access.
export const createServiceRoleClient = () => {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    throw new Error('Missing Supabase service role env variables')
  }
  // Import here to avoid bundling service role key into client bundles
  const { createClient } = require('@supabase/supabase-js')
  // createClient here without type argument to avoid TS generic on require
  const svc = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } })
  return svc
}

export type SupabaseClient = ReturnType<typeof createClient>
