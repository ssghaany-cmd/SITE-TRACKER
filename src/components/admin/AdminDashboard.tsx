// src/components/admin/AdminDashboard.tsx
//
// Top-level container for the admin/superadmin role. Fetches all
// org-visible incidents once (unfiltered, so stats always reflect
// true totals), applies filters client-side for the table, and
// fetches the org member list once for the assignee dropdown.
//
// UPDATED for phase 2: added tab navigation between the original
// Incidents view and three new management screens (Locations, Team,
// Invites). Tabs are plain local state — no router/new dependency.

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useIncidents, type IncidentFilters as IncidentFiltersState } from '../../hooks/useIncidents'
import { useLocations } from '../../hooks/useLocations'
import { supabase } from '../../lib/supabaseClient'
import type { Profile } from '../../types/database'
import StatsHeader from '../layout/StatsHeader'
import IncidentFilters from './IncidentFilters'
import IncidentTable from './IncidentTable'
import IncidentDetailPanel from './IncidentDetailPanel'
import ManageLocations from './ManageLocations'
import ManageTeam from './ManageTeam'
import ManageInvites from './ManageInvites'

type AdminTab = 'incidents' | 'locations' | 'team' | 'invites'

const TABS: { id: AdminTab; label: string }[] = [
  { id: 'incidents', label: 'Incidents' },
  { id: 'locations', label: 'Locations' },
  { id: 'team', label: 'Team' },
  { id: 'invites', label: 'Invites' },
]

export default function AdminDashboard() {
  const { profile } = useAuth()
  const { incidents, loading, error, refetch } = useIncidents({ scope: 'org' })
  const { locations } = useLocations()

  const [activeTab, setActiveTab] = useState<AdminTab>('incidents')

  const [filters, setFilters] = useState<IncidentFiltersState>({
    status: 'all',
    priority: 'all',
    locationId: 'all',
  })
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null)
  const [orgMembers, setOrgMembers] = useState<Pick<Profile, 'id' | 'full_name'>[]>([])

  const fetchOrgMembers = useCallback(async () => {
    if (!profile) return
    const { data, error: membersError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('org_id', profile.org_id)
      .order('full_name', { ascending: true })

    if (membersError) {
      console.error('Failed to fetch org members:', membersError.message)
      return
    }
    setOrgMembers((data ?? []) as Pick<Profile, 'id' | 'full_name'>[])
  }, [profile])

  useEffect(() => {
    fetchOrgMembers()
  }, [fetchOrgMembers])

  const filteredIncidents = useMemo(() => {
    return incidents.filter((incident) => {
      if (filters.status && filters.status !== 'all' && incident.status !== filters.status) {
        return false
      }
      if (
        filters.priority &&
        filters.priority !== 'all' &&
        incident.priority !== filters.priority
      ) {
        return false
      }
      if (
        filters.locationId &&
        filters.locationId !== 'all' &&
        incident.location_id !== filters.locationId
      ) {
        return false
      }
      return true
    })
  }, [incidents, filters])

  const selectedIncident = useMemo(
    () => incidents.find((i) => i.id === selectedIncidentId) ?? null,
    [incidents, selectedIncidentId]
  )

  if (!profile) {
    return null
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <StatsHeader incidents={incidents} />

      <div className="border-b border-slate-200">
        <nav className="-mb-px flex gap-4 overflow-x-auto sm:gap-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium ${
                activeTab === tab.id
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'incidents' && (
        <>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <IncidentFilters filters={filters} onChange={setFilters} locations={locations} />
          </div>

          <IncidentTable
            incidents={filteredIncidents}
            loading={loading}
            error={error}
            selectedIncidentId={selectedIncidentId}
            onSelect={setSelectedIncidentId}
          />

          {selectedIncident && (
            <IncidentDetailPanel
              incident={selectedIncident}
              orgMembers={orgMembers}
              currentUserId={profile.id}
              onUpdated={refetch}
              onClose={() => setSelectedIncidentId(null)}
            />
          )}
        </>
      )}

      {activeTab === 'locations' && <ManageLocations />}
      {activeTab === 'team' && <ManageTeam />}
      {activeTab === 'invites' && <ManageInvites />}
    </div>
  )
}
