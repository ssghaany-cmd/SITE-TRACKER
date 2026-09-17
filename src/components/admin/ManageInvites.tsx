// src/components/admin/ManageInvites.tsx
//
// Lets an admin/superadmin generate shareable invite links for their
// org (choosing whether the invite grants 'reporter' or 'admin').
//
// UPDATED for phase 3: added a recipient email field. When provided,
// the invite is emailed directly via the send-invite-email Edge
// Function instead of requiring manual copy/paste. The link is still
// shown and copyable either way, as a fallback if email delivery
// fails or isn't set up yet.

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import type { Invite, InviteRole } from '../../types/database'
import LoadingSpinner from '../shared/LoadingSpinner'
import { formatDate } from '../../utils/formatDate'

export default function ManageInvites() {
  const { profile } = useAuth()
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [role, setRole] = useState<InviteRole>('reporter')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [emailStatus, setEmailStatus] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const fetchInvites = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('invites')
      .select('*')
      .eq('org_id', profile.org_id)
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
      setInvites([])
    } else {
      setInvites((data ?? []) as Invite[])
    }
    setLoading(false)
  }, [profile])

  useEffect(() => {
    fetchInvites()
  }, [fetchInvites])

  const handleGenerate = async () => {
    if (!profile) return
    setGenerating(true)
    setError(null)
    setGeneratedLink(null)
    setEmailStatus(null)
    setCopied(false)

    const { data, error: insertError } = await supabase
      .from('invites')
      .insert({
        org_id: profile.org_id,
        role,
        created_by: profile.id,
      })
      .select()
      .single()

    if (insertError || !data) {
      setGenerating(false)
      setError(insertError?.message ?? 'Failed to generate invite.')
      return
    }

    const link = `${window.location.origin}${window.location.pathname}?invite=${data.token}`
    setGeneratedLink(link)

    if (recipientEmail.trim()) {
      const { error: fnError } = await supabase.functions.invoke('send-invite-email', {
        body: { to: recipientEmail.trim(), inviteLink: link, role },
      })

      if (fnError) {
        setEmailStatus(
          `Invite created, but the email couldn't be sent (${fnError.message}). Share the link below manually instead.`
        )
      } else {
        setEmailStatus(`Invite emailed to ${recipientEmail.trim()}.`)
      }
    }

    setGenerating(false)
    setRecipientEmail('')
    fetchInvites()
  }

  const handleCopy = async () => {
    if (!generatedLink) return
    try {
      await navigator.clipboard.writeText(generatedLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API can fail on some mobile browsers without HTTPS/permissions —
      // the link is still shown on-screen for manual copy.
    }
  }

  const handleRevoke = async (id: string) => {
    setRevokingId(id)
    setError(null)

    const { error: deleteError } = await supabase.from('invites').delete().eq('id', id)

    setRevokingId(null)

    if (deleteError) {
      setError(deleteError.message)
      return
    }
    fetchInvites()
  }

  if (!profile) return null

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">Generate an Invite</h3>

        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="invite-role" className="block text-sm font-medium text-slate-700">
                Role for this invite
              </label>
              <select
                id="invite-role"
                value={role}
                onChange={(e) => setRole(e.target.value as InviteRole)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              >
                <option value="reporter">Reporter</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="invite-email"
                className="block text-sm font-medium text-slate-700"
              >
                Email it to (optional)
              </label>
              <input
                id="invite-email"
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                placeholder="teammate@company.com"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 active:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {generating ? 'Generating…' : 'Generate Invite'}
          </button>
        </div>

        {emailStatus && (
          <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
            {emailStatus}
          </div>
        )}

        {generatedLink && (
          <div className="mt-4 rounded-md border border-green-200 bg-green-50 p-3">
            <p className="text-sm text-green-800">Invite link (works once):</p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                readOnly
                value={generatedLink}
                onClick={(e) => (e.target as HTMLInputElement).select()}
                className="flex-1 rounded-md border border-green-300 bg-white px-3 py-2 text-sm text-slate-900"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-md border border-green-300 bg-white px-3 py-2 text-sm font-medium text-green-800 hover:bg-green-100"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">Active &amp; Past Invites</h3>

        {loading ? (
          <LoadingSpinner label="Loading invites…" />
        ) : invites.length === 0 ? (
          <p className="text-sm text-slate-500">No invites generated yet.</p>
        ) : (
          <div className="space-y-2">
            {invites.map((invite) => {
              const isUsedUp = invite.uses >= invite.max_uses
              const isExpired = invite.expires_at ? new Date(invite.expires_at) < new Date() : false
              const isRevocable = !isUsedUp

              return (
                <div
                  key={invite.id}
                  className="flex flex-col gap-1 rounded-md border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      Role: {invite.role === 'admin' ? 'Admin' : 'Reporter'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {invite.uses}/{invite.max_uses} used · Created{' '}
                      {formatDate(invite.created_at)}
                      {isUsedUp && ' · Used'}
                      {isExpired && !isUsedUp && ' · Expired'}
                    </p>
                  </div>
                  {isRevocable && (
                    <button
                      type="button"
                      onClick={() => handleRevoke(invite.id)}
                      disabled={revokingId === invite.id}
                      className="self-start rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 sm:self-auto"
                    >
                      {revokingId === invite.id ? 'Revoking…' : 'Revoke'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
              }
