// src/components/layout/StatsHeader.tsx
//
// Simple stats strip showing counts of open / in-progress / resolved
// incidents. Purely presentational — pass in whatever incident list is
// relevant to the current view (a reporter's own incidents, or the
// full org list on the admin dashboard) and it computes the counts.

import type { Incident } from '../../types/database'

interface StatsHeaderProps {
  incidents: Pick<Incident, 'status'>[]
}

export default function StatsHeader({ incidents }: StatsHeaderProps) {
  const openCount = incidents.filter((i) => i.status === 'open').length
  const inProgressCount = incidents.filter((i) => i.status === 'in_progress').length
  const resolvedCount = incidents.filter((i) => i.status === 'resolved').length

  const stats = [
    { label: 'Open', value: openCount, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'In Progress', value: inProgressCount, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { label: 'Resolved', value: resolvedCount, color: 'text-green-600', bg: 'bg-green-50' },
  ]

  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={`rounded-lg border border-slate-200 ${stat.bg} px-3 py-4 text-center sm:px-4`}
        >
          <p className={`text-2xl font-bold sm:text-3xl ${stat.color}`}>{stat.value}</p>
          <p className="mt-1 text-xs font-medium text-slate-600 sm:text-sm">{stat.label}</p>
        </div>
      ))}
    </div>
  )
}
