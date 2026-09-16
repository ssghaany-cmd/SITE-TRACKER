// src/components/reporter/MyIncidentsList.tsx
//
// Read-only list of the current reporter's own submitted incidents.
// Purely presentational — receives incidents/loading/error as props
// from ReporterView, which owns the data fetch via useIncidents().

import { useEffect, useState } from 'react'
import type { IncidentWithRelations } from '../../types/database'
import StatusBadge from '../shared/StatusBadge'
import PriorityBadge from '../shared/PriorityBadge'
import LoadingSpinner from '../shared/LoadingSpinner'
import { formatDate } from '../../utils/formatDate'
import { getSignedPhotoUrl } from '../../utils/storage'

interface MyIncidentsListProps {
  incidents: IncidentWithRelations[]
  loading: boolean
  error: string | null
}

export default function MyIncidentsList({ incidents, loading, error }: MyIncidentsListProps) {
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    const incidentsWithPhotos = incidents.filter((i) => i.photo_url)
    if (incidentsWithPhotos.length === 0) return

    let cancelled = false

    Promise.all(
      incidentsWithPhotos.map(async (incident) => {
        const url = await getSignedPhotoUrl(incident.photo_url as string)
        return { id: incident.id, url }
      })
    ).then((results) => {
      if (cancelled) return
      const map: Record<string, string> = {}
      results.forEach(({ id, url }) => {
        if (url) map[id] = url
      })
      setPhotoUrls(map)
    })

    return () => {
      cancelled = true
    }
  }, [incidents])

  if (loading) {
    return <LoadingSpinner label="Loading your incidents…" />
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {error}
      </div>
    )
  }

  if (incidents.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
        You haven&apos;t reported any incidents yet.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {incidents.map((incident) => (
        <div
          key={incident.id}
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium text-slate-900">{incident.category}</p>
              <p className="text-sm text-slate-500">
                {incident.location?.name ?? 'Unknown location'}
              </p>
            </div>
            <div className="flex flex-shrink-0 flex-col items-end gap-1">
              <StatusBadge status={incident.status} />
              <PriorityBadge priority={incident.priority} />
            </div>
          </div>

          <p className="mt-2 text-sm text-slate-700">{incident.description}</p>

          {photoUrls[incident.id] && (
            <img
              src={photoUrls[incident.id]}
              alt="Incident"
              className="mt-3 h-40 w-full rounded-md object-cover"
            />
          )}

          <p className="mt-3 text-xs text-slate-400">
            Submitted {formatDate(incident.created_at)}
          </p>
        </div>
      ))}
    </div>
  )
          }
