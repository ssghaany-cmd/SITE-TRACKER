// src/components/admin/ReportsAnalytics.tsx
//
// Simple analytics dashboard: incident counts by category, by location,
// and average time-to-resolution. Built with plain CSS bar charts
// (percentage-width divs) rather than a charting library, since the
// project intentionally avoids adding new npm dependencies.

import { useMemo } from 'react'
import { useIncidents } from '../../hooks/useIncidents'
import LoadingSpinner from '../shared/LoadingSpinner'

function BarRow({ label, count, max }: { label: string; count: number; max: number }) {
  const widthPct = max > 0 ? Math.max((count / max) * 100, 4) : 0
  return (
    <div className="flex items-center gap-3">
      <div className="w-32 flex-shrink-0 truncate text-sm text-slate-700" title={label}>
        {label}
      </div>
      <div className="h-5 flex-1 rounded bg-slate-100">
        <div
          className="h-5 rounded bg-slate-700"
          style={{ width: `${widthPct}%` }}
          aria-hidden="true"
        />
      </div>
      <div className="w-8 flex-shrink-0 text-right text-sm font-medium text-slate-900">
        {count}
      </div>
    </div>
  )
}

export default function ReportsAnalytics() {
  const { incidents, loading, error } = useIncidents({ scope: 'org' })

  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>()
    incidents.forEach((i) => map.set(i.category, (map.get(i.category) ?? 0) + 1))
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [incidents])

  const locationCounts = useMemo(() => {
    const map = new Map<string, number>()
    incidents.forEach((i) => {
      const label = i.location?.name ?? 'Unknown'
      map.set(label, (map.get(label) ?? 0) + 1)
    })
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [incidents])

  const avgResolutionHours = useMemo(() => {
    const resolved = incidents.filter((i) => i.resolved_at)
    if (resolved.length === 0) return null
    const totalHours = resolved.reduce((sum, i) => {
      const created = new Date(i.created_at).getTime()
      const resolvedAt = new Date(i.resolved_at as string).getTime()
      return sum + (resolvedAt - created) / (1000 * 60 * 60)
    }, 0)
    return totalHours / resolved.length
  }, [incidents])

  const maxCategoryCount = categoryCounts.length > 0 ? categoryCounts[0][1] : 0
  const maxLocationCount = locationCounts.length > 0 ? locationCounts[0][1] : 0

  if (loading) {
    return <LoadingSpinner label="Loading report data…" />
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-slate-900">{incidents.length}</p>
          <p className="mt-1 text-xs text-slate-500">Total Incidents</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-slate-900">
            {avgResolutionHours !== null ? avgResolutionHours.toFixed(1) : '—'}
          </p>
          <p className="mt-1 text-xs text-slate-500">Avg Hours to Resolve</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-slate-900">{categoryCounts.length}</p>
          <p className="mt-1 text-xs text-slate-500">Distinct Categories</p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">Incidents by Category</h3>
        {categoryCounts.length === 0 ? (
          <p className="text-sm text-slate-500">No incidents yet.</p>
        ) : (
          <div className="space-y-2">
            {categoryCounts.map(([category, count]) => (
              <BarRow key={category} label={category} count={count} max={maxCategoryCount} />
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">Incidents by Location</h3>
        {locationCounts.length === 0 ? (
          <p className="text-sm text-slate-500">No incidents yet.</p>
        ) : (
          <div className="space-y-2">
            {locationCounts.map(([location, count]) => (
              <BarRow key={location} label={location} count={count} max={maxLocationCount} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
    }
