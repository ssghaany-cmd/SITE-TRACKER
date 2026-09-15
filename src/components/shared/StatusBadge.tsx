// src/components/shared/StatusBadge.tsx
//
// Small colored pill showing an incident's status. Used in lists,
// tables, and detail panels wherever a status needs to be shown.

import type { IncidentStatus } from '../../types/database'

interface StatusBadgeProps {
  status: IncidentStatus
}

const STATUS_STYLES: Record<IncidentStatus, string> = {
  open: 'bg-red-100 text-red-800 border-red-200',
  in_progress: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  resolved: 'bg-green-100 text-green-800 border-green-200',
}

const STATUS_LABELS: Record<IncidentStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}
