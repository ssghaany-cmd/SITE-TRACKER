// src/components/reporter/NewIncidentForm.tsx
//
// Form for reporters to submit a new incident: location, category,
// description, and an optional photo. Photo upload flow:
//   1. Insert the incident row first (need its id for the storage path)
//   2. Upload the photo to {org_id}/{incident_id}/{timestamp}.{ext}
//   3. Update the incident row's photo_url with that storage path
//
// Priority is intentionally not selectable here — it defaults to
// 'medium' at the database level; admins can adjust it after triage.

import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useLocations } from '../../hooks/useLocations'
import { uploadIncidentPhoto } from '../../utils/storage'

interface NewIncidentFormProps {
  orgId: string
  reporterId: string
  onCreated: () => void
}

const CATEGORY_OPTIONS = [
  'Plumbing',
  'Electrical',
  'HVAC',
  'Structural',
  'Landscaping',
  'Safety & Security',
  'Pest Control',
  'Appliance',
  'Other',
]

export default function NewIncidentForm({ orgId, reporterId, onCreated }: NewIncidentFormProps) {
  const { locations, loading: locationsLoading } = useLocations()

  const [locationId, setLocationId] = useState('')
  const [category, setCategory] = useState('')
  const [customCategory, setCustomCategory] = useState('')
  const [description, setDescription] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const resetForm = () => {
    setLocationId('')
    setCategory('')
    setCustomCategory('')
    setDescription('')
    setPhotoFile(null)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)

    const finalCategory = category === 'Other' ? customCategory.trim() : category

    if (!locationId) {
      setError('Please select a location.')
      return
    }
    if (!finalCategory) {
      setError('Please select or enter a category.')
      return
    }
    if (!description.trim()) {
      setError('Please describe the issue.')
      return
    }

    setSubmitting(true)

    const { data: inserted, error: insertError } = await supabase
      .from('incidents')
      .insert({
        org_id: orgId,
        location_id: locationId,
        reported_by: reporterId,
        category: finalCategory,
        description: description.trim(),
      })
      .select()
      .single()

    if (insertError || !inserted) {
      setError(insertError?.message ?? 'Failed to submit incident.')
      setSubmitting(false)
      return
    }

    if (photoFile) {
      const { path, error: uploadError } = await uploadIncidentPhoto(
        orgId,
        inserted.id,
        photoFile
      )

      if (uploadError) {
        setError(
          `Incident submitted, but the photo failed to upload: ${uploadError}. You can try again later.`
        )
        setSubmitting(false)
        resetForm()
        onCreated()
        return
      }

      if (path) {
        const { error: updateError } = await supabase
          .from('incidents')
          .update({ photo_url: path })
          .eq('id', inserted.id)

        if (updateError) {
          console.error('Failed to save photo reference:', updateError.message)
        }
      }
    }

    setSubmitting(false)
    setSuccessMessage('Incident submitted successfully.')
    resetForm()
    onCreated()
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">Report a New Incident</h2>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="location" className="block text-sm font-medium text-slate-700">
            Location
          </label>
          <select
            id="location"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            disabled={locationsLoading}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:opacity-60"
          >
            <option value="">
              {locationsLoading ? 'Loading locations…' : 'Select a location'}
            </option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="category" className="block text-sm font-medium text-slate-700">
            Category
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          >
            <option value="">Select a category</option>
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {category === 'Other' && (
          <div>
            <label htmlFor="customCategory" className="block text-sm font-medium text-slate-700">
              Describe the category
            </label>
            <input
              id="customCategory"
              type="text"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              placeholder="e.g. Signage, Elevator"
            />
          </div>
        )}

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-slate-700">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            placeholder="What's the issue? Where exactly? Any safety concerns?"
          />
        </div>

        <div>
          <label htmlFor="photo" className="block text-sm font-medium text-slate-700">
            Photo (optional)
          </label>
          <input
            id="photo"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
            className="mt-1 w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
          />
          {photoFile && (
            <p className="mt-1 text-xs text-slate-500">Selected: {photoFile.name}</p>
          )}
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            {successMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-slate-900 px-4 py-2.5 text-base font-medium text-white hover:bg-slate-800 active:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {submitting ? 'Submitting…' : 'Submit Incident'}
        </button>
      </form>
    </div>
  )
  }
