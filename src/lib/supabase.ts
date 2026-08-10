import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const rawUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// O createClient deve receber somente a URL base do projeto, nunca /rest/v1 ou /auth/v1.
const url = rawUrl?.trim().replace(/\/(rest\/v1|auth\/v1)\/?$/, '').replace(/\/$/, '')
export const supabaseConfigured = Boolean(url && key)

let client: SupabaseClient | null = null
if (supabaseConfigured) {
  try {
    client = createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true } })
  } catch (error) {
    console.error('URL do Supabase inválida:', error)
  }
}

export const supabase = client
