// src/components/admin/IncidentDetailPanel.tsx
//
// Detail panel for a selected incident: full description, photo,
// status + assignee controls (update immediately on change — no
// separate save button), and the embedded activity log. Rendered
// inline below the table (not a modal), so it works the same way on
// mobile as everywhere else in the app.

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { IncidentWithRelations, IncidentStatus, Profile } from '../../types/database'
import StatusBadge from '../shared/StatusBadge'
import PriorityBadge from '../shared/PriorityBadge'
import ActivityLog from './ActivityLog'
import { formatDate } from '../../utils/formatDate'
import { getSignedPhotoUrl } from '../../utils/storage'

interface IncidentDetailPanelProps {
  incident: IncidentWithRelations
  orgMembers: Pick<Profile, 'id' | 'full_name'>[]
  currentUserId: string
  onUpdated: () => void
  onClose: () => void
}

const STATUS_OPTIONS: { value: IncidentStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
]

export default function IncidentDetailPanel({
  incident,
  orgMembers,
  currentUserId,
  onUpdated,
  onClose,
}: IncidentDetailPanelProps) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setPhotoUrl(null)
    if (incident.photo_url) {
      getSignedPhotoUrl(incident.photo_url).then(setPhotoUrl)
    }
  }, [incident.photo_url])

  const handleStatusChange = async (newStatus: IncidentStatus) => {
    setUpdating(true)
    setError(null)

    const { error: updateError } = await supabase
      .from('incidents')
      .update({
        status: newStatus,
        resolved_at: newStatus === 'resolved' ? new Date().toISOString() : null,
      })
      .eq('id', incident.id)

    setUpdating(false)

    if (updateError) {
      setError(updateError.message)
      return
    }
    onUpdated()
  }

  const handleAssigneeChange = async (assigneeId: string) => {
    setUpdating(true)
    setError(null)

    const { error: updateError } = await supabase
      .from('incidents')
      .update({ assigned_to: assigneeId || null })
      .eq('id', incident.id)

    setUpdating(false)

    if (updateError) {
      setError(updateError.message)
      return
    }
    onUpdated()
  }

  return (
    <div className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{incident.category}</h3>
          <p className="text-sm text-slate-500">
            {incident.location?.name ?? 'Unknown location'}
            {incident.location?.address ? ` · ${incident.location.address}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-slate-300 px-2.5 py-1 text-sm text-slate-600 hover:bg-slate-50"
        >
          Close
        </button>
      </div>

      <div className="mt-3 flex gap-2">
        <StatusBadge status={incident.status} />
        <PriorityBadge priority={incident.priority} />
      </div>

      <p className="mt-3 text-sm text-slate-700">{incident.description}</p>

      {photoUrl && (
        <img
          src={photoUrl}
          alt="Incident"
          className="mt-3 max-h-64 w-full rounded-md object-cover"
        />
      )}

      <div className="mt-3 space-y-1 text-xs text-slate-500">
        <p>Reported by {incident.reporter?.full_name ?? 'Unknown'}</p>
        <p>Submitted {formatDate(incident.created_at)}</p>
        {incident.resolved_at && <p>Resolved {formatDate(incident.resolved_at)}</p>}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="detail-status" className="block text-xs font-medium text-slate-600">
            Status
          </label>
          <select
            id="detail-status"
            value={incident.status}
            disabled={updating}
            onChange={(e) => handleStatusChange(e.target.value as IncidentStatus)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:opacity-60"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="detail-assignee" className="block text-xs font-medium text-slate-600">
            Assigned To
          </label>
          <select
            id="detail-assignee"
            value={incident.assigned_to ?? ''}
            disabled={updating}
            onChange={(e) => handleAssigneeChange(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:opacity-60"
          >
            <option value="">Unassigned</option>
            {orgMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.full_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-5 border-t border-slate-200 pt-4">
        <ActivityLog incidentId={incident.id} currentUserId={currentUserId} />
      </div>
    </div>
  )
      }
