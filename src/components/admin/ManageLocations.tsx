// src/components/admin/ManageLocations.tsx
//
// Lets an admin/superadmin add, edit, and delete their org's locations.
// No new SQL was needed for this — the existing "locations: admin
// write" RLS policy from the original schema already covers it.
//
// Deleting a location that has incidents attached will fail at the
// database level (incidents.location_id is ON DELETE RESTRICT, by
// design — we never want to silently orphan or cascade-delete
// incident history), so that error is caught and shown as a friendly
// message rather than a raw Postgres error.

import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { useLocations } from '../../hooks/useLocations'
import LoadingSpinner from '../shared/LoadingSpinner'

export default function ManageLocations() {
  const { profile } = useAuth()
  const { locations, loading, error, refetch } = useLocations()

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [rowError, setRowError] = useState<string | null>(null)
  const [rowErrorId, setRowErrorId] = useState<string | null>(null)
  const [rowBusy, setRowBusy] = useState<string | null>(null)

  if (!profile) return null

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!name.trim()) {
      setFormError('Please enter a location name.')
      return
    }

    setSubmitting(true)
    const { error: insertError } = await supabase.from('locations').insert({
      org_id: profile.org_id,
      name: name.trim(),
      address: address.trim(),
    })
    setSubmitting(false)

    if (insertError) {
      setFormError(insertError.message)
      return
    }

    setName('')
    setAddress('')
    refetch()
  }

  const startEdit = (id: string, currentName: string, currentAddress: string) => {
    setEditingId(id)
    setEditName(currentName)
    setEditAddress(currentAddress)
    setRowError(null)
    setRowErrorId(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName('')
    setEditAddress('')
    setRowError(null)
    setRowErrorId(null)
  }

  const saveEdit = async (id: string) => {
    if (!editName.trim()) {
      setRowError('Location name cannot be empty.')
      setRowErrorId(id)
      return
    }
    setRowBusy(id)
    setRowError(null)
    setRowErrorId(null)

    const { error: updateError } = await supabase
      .from('locations')
      .update({ name: editName.trim(), address: editAddress.trim() })
      .eq('id', id)

    setRowBusy(null)

    if (updateError) {
      setRowError(updateError.message)
      setRowErrorId(id)
      return
    }

    cancelEdit()
    refetch()
  }

  const handleDelete = async (id: string) => {
    setRowBusy(id)
    setRowError(null)
    setRowErrorId(null)

    const { error: deleteError } = await supabase.from('locations').delete().eq('id', id)

    setRowBusy(null)

    if (deleteError) {
      // Postgres foreign key violation code is 23503
      if (deleteError.code === '23503') {
        setRowError('Cannot delete — this location has incidents attached to it.')
      } else {
        setRowError(deleteError.message)
      }
      setRowErrorId(id)
      return
    }

    refetch()
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">Add a Location</h3>
        <form onSubmit={handleAdd} className="space-y-4" noValidate>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="loc-name" className="block text-sm font-medium text-slate-700">
                Name
              </label>
              <input
                id="loc-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                placeholder="Building A"
              />
            </div>
            <div>
              <label htmlFor="loc-address" className="block text-sm font-medium text-slate-700">
                Address
              </label>
              <input
                id="loc-address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                placeholder="123 Main St"
              />
            </div>
          </div>

          {formError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 active:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Adding…' : 'Add Location'}
          </button>
        </form>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">Locations</h3>

        {loading ? (
          <LoadingSpinner label="Loading locations…" />
        ) : error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : locations.length === 0 ? (
          <p className="text-sm text-slate-500">No locations yet — add one above.</p>
        ) : (
          <div className="space-y-3">
            {locations.map((loc) => (
              <div key={loc.id} className="rounded-md border border-slate-200 p-3">
                {editingId === loc.id ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                      placeholder="Name"
                    />
                    <input
                      type="text"
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                      placeholder="Address"
                    />
                    {rowErrorId === loc.id && rowError && (
                      <p className="text-xs text-red-600">{rowError}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => saveEdit(loc.id)}
                        disabled={rowBusy === loc.id}
                        className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900">{loc.name}</p>
                      {loc.address && <p className="text-sm text-slate-500">{loc.address}</p>}
                    </div>
                    <div className="flex flex-shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(loc.id, loc.name, loc.address)}
                        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(loc.id)}
                        disabled={rowBusy === loc.id}
                        className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                      >
                        {rowBusy === loc.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </div>
                )}
                {editingId !== loc.id && rowErrorId === loc.id && rowError && (
                  <p className="mt-1 text-xs text-red-600">{rowError}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
