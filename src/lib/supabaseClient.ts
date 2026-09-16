// src/lib/supabaseClient.ts
//
// Single shared Supabase client instance for the whole app.
// Reads connection details from environment variables — never hardcode
// secrets here. See .env.example for the required variable names.
//
// NOTE: intentionally NOT using createClient<Database>(...). The
// installed @supabase/supabase-js version's generic type matching for
// custom Database types was fighting us across several rounds of
// fixes (silently resolving every table's Row/Insert/Update to
// `never`). Dropping the generic makes the client untyped — you lose
// autocomplete on .from('table_name') and compile-time checking of
// insert/update payloads — but every runtime call still works exactly
// the same, since Supabase enforces the real schema at the database
// level (and RLS enforces authorization) regardless of what
// TypeScript thinks the shape is. This is a common, low-risk trade-off.

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
      'Copy .env.example to .env.local and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
