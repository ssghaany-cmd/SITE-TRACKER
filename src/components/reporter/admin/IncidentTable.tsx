// src/components/admin/IncidentTable.tsx
//
// Org-wide incident list for admins. Renders as a proper table on
// larger screens and as stacked cards on mobile (Android Chrome
// friendly — no horizontal-scroll table wrangling on a small screen).
// Clicking a row/card selects it for the detail panel below.

import type { IncidentWithRelations } from '../../types/database'
import StatusBadge from '../shared/StatusBadge'
import PriorityBadge from '../shared/PriorityBadge'
import LoadingSpinner from '../shared/LoadingSpinner'
import { formatDateShort } from '../../utils/formatDate'

interface IncidentTableProps {
  incidents: IncidentWithRelations[]
  loading: boolean
  error: string | null
  selectedIncidentId: string | null
  onSelect: (incidentId: string) => void
}

export default function IncidentTable({
  incidents,
  loading,
  error,
  selectedIncidentId,
  onSelect,
}: IncidentTableProps) {
  if (loading) {
    return <LoadingSpinner label="Loading incidents…" />
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
        No incidents match these filters.
      </div>
    )
  }

  return (
    <>
      {/* Desktop / tablet table */}
      <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white sm:block">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-slate-600">Category</th>
              <th className="px-4 py-2 text-left font-medium text-slate-600">Location</th>
              <th className="px-4 py-2 text-left font-medium text-slate-600">Priority</th>
              <th className="px-4 py-2 text-left font-medium text-slate-600">Status</th>
              <th className="px-4 py-2 text-left font-medium text-slate-600">Assigned To</th>
              <th className="px-4 py-2 text-left font-medium text-slate-600">Reported</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {incidents.map((incident) => (
              <tr
                key={incident.id}
                onClick={() => onSelect(incident.id)}
                className={`cursor-pointer hover:bg-slate-50 ${
                  selectedIncidentId === incident.id ? 'bg-slate-100' : ''
                }`}
              >
                <td className="px-4 py-2.5 font-medium text-slate-900">{incident.category}</td>
                <td className="px-4 py-2.5 text-slate-600">
                  {incident.location?.name ?? 'Unknown'}
                </td>
                <td className="px-4 py-2.5">
                  <PriorityBadge priority={incident.priority} />
                </td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={incident.status} />
                </td>
                <td className="px-4 py-2.5 text-slate-600">
                  {incident.assignee?.full_name ?? 'Unassigned'}
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">
                  {formatDateShort(incident.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 sm:hidden">
        {incidents.map((incident) => (
          <div
            key={incident.id}
            onClick={() => onSelect(incident.id)}
            className={`cursor-pointer rounded-lg border bg-white p-4 shadow-sm ${
              selectedIncidentId === incident.id ? 'border-slate-500' : 'border-slate-200'
            }`}
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
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>{incident.assignee?.full_name ?? 'Unassigned'}</span>
              <span>{formatDateShort(incident.created_at)}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
