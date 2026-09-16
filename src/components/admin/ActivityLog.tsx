// src/components/admin/ActivityLog.tsx
//
// Activity log for a single incident: lists incident_updates notes
// (oldest first) and lets admins/superadmins add a new note. Self
// contained — fetches and refetches its own data independent of the
// parent detail panel.

import { useState, useEffect, useCallback, type FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { IncidentUpdateWithUser } from '../../types/database'
import LoadingSpinner from '../shared/LoadingSpinner'
import { formatDate } from '../../utils/formatDate'

interface ActivityLogProps {
  incidentId: string
  currentUserId: string
}

export default function ActivityLog({ incidentId, currentUserId }: ActivityLogProps) {
  const [updates, setUpdates] = useState<IncidentUpdateWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchUpdates = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('incident_updates')
      .select(
        `
        *,
        user:profiles!incident_updates_user_id_fkey(id, full_name)
      `
      )
      .eq('incident_id', incidentId)
      .order('created_at', { ascending: true })

    if (fetchError) {
      setError(fetchError.message)
      setUpdates([])
    } else {
      setUpdates((data ?? []) as unknown as IncidentUpdateWithUser[])
    }
    setLoading(false)
  }, [incidentId])

  useEffect(() => {
    fetchUpdates()
  }, [fetchUpdates])

  const handleAddNote = async (e: FormEvent) => {
    e.preventDefault()
    if (!noteText.trim()) return

    setSubmitting(true)
    const { error: insertError } = await supabase.from('incident_updates').insert({
      incident_id: incidentId,
      user_id: currentUserId,
      note: noteText.trim(),
    })
    setSubmitting(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    setNoteText('')
    fetchUpdates()
  }

  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold text-slate-900">Activity Log</h4>

      {loading ? (
        <LoadingSpinner size="sm" />
      ) : error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : updates.length === 0 ? (
        <p className="text-sm text-slate-500">No activity yet.</p>
      ) : (
        <ul className="space-y-2">
          {updates.map((update) => (
            <li key={update.id} className="rounded-md bg-slate-50 px-3 py-2 text-sm">
              <p className="text-slate-800">{update.note}</p>
              <p className="mt-1 text-xs text-slate-400">
                {update.user?.full_name ?? 'Unknown'} · {formatDate(update.created_at)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAddNote} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Add an update note…"
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
        <button
          type="submit"
          disabled={submitting || !noteText.trim()}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 active:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Adding…' : 'Add Note'}
        </button>
      </form>
    </div>
  )
        }
