import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

export const auth = $state<{ session: Session | null; loading: boolean }>({ session: null, loading: true })

supabase.auth.getSession().then(({ data }) => {
  auth.session = data.session
  auth.loading = false
})

supabase.auth.onAuthStateChange((_event, session) => {
  auth.session = session
})
