// src/components/shared/PriorityBadge.tsx
//
// Small colored pill showing an incident's priority level.

import type { IncidentPriority } from '../../types/database'

interface PriorityBadgeProps {
  priority: IncidentPriority
}

const PRIORITY_STYLES: Record<IncidentPriority, string> = {
  low: 'bg-slate-100 text-slate-700 border-slate-200',
  medium: 'bg-blue-100 text-blue-800 border-blue-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
}

const PRIORITY_LABELS: Record<IncidentPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

export default function PriorityBadge({ priority }: PriorityBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${PRIORITY_STYLES[priority]}`}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  )
}
