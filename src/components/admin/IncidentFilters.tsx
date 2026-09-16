// src/components/admin/IncidentFilters.tsx
//
// Controlled filter bar for the admin dashboard: status, priority,
// and location dropdowns. Purely presentational — the parent owns
// filter state and does the actual filtering.

import type { IncidentStatus, IncidentPriority, Location } from '../../types/database'
import type { IncidentFilters as IncidentFiltersState } from '../../hooks/useIncidents'

interface IncidentFiltersProps {
  filters: IncidentFiltersState
  onChange: (filters: IncidentFiltersState) => void
  locations: Location[]
}

const STATUS_OPTIONS: { value: IncidentStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
]

const PRIORITY_OPTIONS: { value: IncidentPriority | 'all'; label: string }[] = [
  { value: 'all', label: 'All priorities' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

export default function IncidentFilters({ filters, onChange, locations }: IncidentFiltersProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div>
        <label htmlFor="filter-status" className="block text-xs font-medium text-slate-600">
          Status
        </label>
        <select
          id="filter-status"
          value={filters.status ?? 'all'}
          onChange={(e) =>
            onChange({ ...filters, status: e.target.value as IncidentFiltersState['status'] })
          }
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="filter-priority" className="block text-xs font-medium text-slate-600">
          Priority
        </label>
        <select
          id="filter-priority"
          value={filters.priority ?? 'all'}
          onChange={(e) =>
            onChange({ ...filters, priority: e.target.value as IncidentFiltersState['priority'] })
          }
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          {PRIORITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="filter-location" className="block text-xs font-medium text-slate-600">
          Location
        </label>
        <select
          id="filter-location"
          value={filters.locationId ?? 'all'}
          onChange={(e) => onChange({ ...filters, locationId: e.target.value })}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          <option value="all">All locations</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
        }
