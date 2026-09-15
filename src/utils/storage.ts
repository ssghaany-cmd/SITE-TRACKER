// src/utils/storage.ts
//
// Helpers for the private "incident-photos" Supabase Storage bucket.
// Because the bucket is private (see RLS storage policies in the
// schema SQL), we store the raw storage PATH on incidents.photo_url
// (not a public URL) and generate short-lived signed URLs on demand
// whenever a photo needs to be displayed.

import { supabase } from '../lib/supabaseClient'

export const PHOTO_BUCKET = 'incident-photos'

const SIGNED_URL_EXPIRES_IN_SECONDS = 60 * 60 // 1 hour

/**
 * Generate a temporary signed URL for a stored photo path.
 * Returns null if the file doesn't exist or the user isn't permitted
 * to read it under RLS.
 */
export async function getSignedPhotoUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRES_IN_SECONDS)

  if (error || !data) {
    console.error('Failed to create signed URL:', error?.message)
    return null
  }
  return data.signedUrl
}

/**
 * Upload an incident photo under the required {org_id}/{incident_id}/...
 * folder convention (matches the storage RLS policy) and return the
 * storage path to save on the incident row.
 */
export async function uploadIncidentPhoto(
  orgId: string,
  incidentId: string,
  file: File
): Promise<{ path: string | null; error: string | null }> {
  const fileExt = file.name.includes('.') ? file.name.split('.').pop() : 'jpg'
  const path = `${orgId}/${incidentId}/${Date.now()}.${fileExt}`

  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })

  if (error) {
    return { path: null, error: error.message }
  }
  return { path, error: null }
}
