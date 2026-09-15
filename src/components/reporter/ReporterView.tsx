// src/components/reporter/ReporterView.tsx
//
// Top-level container for the reporter role: stats header (scoped to
// their own incidents), the new-incident form, and their submission
// history. Owns the single useIncidents() call and passes data down.

import { useAuth } from '../../contexts/AuthContext'
import { useIncidents } from '../../hooks/useIncidents'
import StatsHeader from '../layout/StatsHeader'
import NewIncidentForm from './NewIncidentForm'
import MyIncidentsList from './MyIncidentsList'

export default function ReporterView() {
  const { profile } = useAuth()

  const { incidents, loading, error, refetch } = useIncidents({
    scope: 'mine',
    userId: profile?.id,
  })

  if (!profile) {
    return null
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
      <StatsHeader incidents={incidents} />

      <NewIncidentForm orgId={profile.org_id} reporterId={profile.id} onCreated={refetch} />

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">My Reported Incidents</h2>
        <MyIncidentsList incidents={incidents} loading={loading} error={error} />
      </div>
    </div>
  )
}
