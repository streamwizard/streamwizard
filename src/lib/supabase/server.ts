import { Database } from '@/types/supabase'
import { createServerClient } from '@supabase/ssr'
import { env } from '../env'

export const {  SUPABASE_URL, SUPABASE_ANON_KEY } = env


export function createClient(supabaseAccessToken: string) {

  return createServerClient<Database>(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${supabaseAccessToken}`,
        },
      },
      cookies: {
        get: undefined,
        set: undefined,
        remove: undefined
      }
    }
  )
}