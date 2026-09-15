// src/hooks/useLocations.ts
//
// Fetches the list of locations visible to the current user (scoped by
// RLS to their org, or all orgs for superadmins). Used to populate the
// location dropdown on the "New Incident" form and the admin filters.

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Location } from '../types/database'

export function useLocations() {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLocations = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('locations')
      .select('*')
      .order('name', { ascending: true })

    if (fetchError) {
      setError(fetchError.message)
      setLocations([])
    } else {
      setLocations((data ?? []) as Location[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchLocations()
  }, [fetchLocations])

  return { locations, loading, error, refetch: fetchLocations }
}
