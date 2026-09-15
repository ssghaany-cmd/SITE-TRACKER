// src/hooks/useIncidents.ts
//
// Reusable data hook for fetching incidents, shared by the reporter's
// "my incidents" list and the admin dashboard's org-wide table.
// RLS on the `incidents` table already enforces who can see what rows;
// this hook just adds convenient client-side filters on top.

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { IncidentStatus, IncidentPriority, IncidentWithRelations } from '../types/database'

export interface IncidentFilters {
  status?: IncidentStatus | 'all'
  priority?: IncidentPriority | 'all'
  locationId?: string | 'all'
}

interface UseIncidentsOptions {
  // 'mine' -> only incidents reported by `userId` (reporter view)
  // 'org'  -> all incidents visible under RLS (admin/superadmin view)
  scope: 'mine' | 'org'
  userId?: string
  filters?: IncidentFilters
}

export function useIncidents({ scope, userId, filters }: UseIncidentsOptions) {
  const [incidents, setIncidents] = useState<IncidentWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchIncidents = useCallback(async () => {
    setLoading(true)
    setError(null)

    let query = supabase
      .from('incidents')
      .select(
        `
        *,
        location:locations(id, name, address),
        reporter:profiles!incidents_reported_by_fkey(id, full_name),
        assignee:profiles!incidents_assigned_to_fkey(id, full_name)
      `
      )
      .order('created_at', { ascending: false })

    if (scope === 'mine' && userId) {
      query = query.eq('reported_by', userId)
    }

    if (filters?.status && filters.status !== 'all') {
      query = query.eq('status', filters.status)
    }
    if (filters?.priority && filters.priority !== 'all') {
      query = query.eq('priority', filters.priority)
    }
    if (filters?.locationId && filters.locationId !== 'all') {
      query = query.eq('location_id', filters.locationId)
    }

    const { data, error: fetchError } = await query

    if (fetchError) {
      setError(fetchError.message)
      setIncidents([])
    } else {
      setIncidents((data ?? []) as unknown as IncidentWithRelations[])
    }
    setLoading(false)
  }, [scope, userId, filters?.status, filters?.priority, filters?.locationId])

  useEffect(() => {
    fetchIncidents()
  }, [fetchIncidents])

  return { incidents, loading, error, refetch: fetchIncidents }
    }
