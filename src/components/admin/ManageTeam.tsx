// src/components/admin/ManageTeam.tsx
//
// Lets an admin/superadmin view their org's team and change a member's
// role between 'reporter' and 'admin'. Granting 'superadmin' is never
// exposed here — and even if someone tried to force it through the API,
// the enforce_profile_update_rules() database trigger (see the phase 2
// SQL) blocks it server-side. A user also can never change their own
// role from this screen (their own row's role selector is disabled) —
// again backed by the same trigger, not just this UI.

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import type { Profile, UserRole } from '../../types/database'
import LoadingSpinner from '../shared/LoadingSpinner'

const ROLE_LABELS: Record<UserRole, string> = {
  reporter: 'Reporter',
  admin: 'Admin',
  superadmin: 'Super Admin',
}

export default function ManageTeam() {
  const { profile } = useAuth()
  const [members, setMembers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)
  const [rowErrorId, setRowErrorId] = useState<string | null>(null)

  const fetchMembers = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('org_id', profile.org_id)
      .order('full_name', { ascending: true })

    if (fetchError) {
      setError(fetchError.message)
      setMembers([])
    } else {
      setMembers((data ?? []) as Profile[])
    }
    setLoading(false)
  }, [profile])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  const handleRoleChange = async (memberId: string, newRole: 'reporter' | 'admin') => {
    setBusyId(memberId)
    setRowError(null)
    setRowErrorId(null)

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', memberId)

    setBusyId(null)

    if (updateError) {
      setRowError(updateError.message)
      setRowErrorId(memberId)
      return
    }

    fetchMembers()
  }

  if (!profile) return null

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <h3 className="mb-4 text-lg font-semibold text-slate-900">Team Members</h3>

      {loading ? (
        <LoadingSpinner label="Loading team…" />
      ) : error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : members.length === 0 ? (
        <p className="text-sm text-slate-500">No team members found.</p>
      ) : (
        <div className="space-y-3">
          {members.map((member) => {
            const isSelf = member.id === profile.id
            const isSuperadmin = member.role === 'superadmin'

            return (
              <div
                key={member.id}
                className="flex flex-col gap-2 rounded-md border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {member.full_name}
                    {isSelf && <span className="ml-2 text-xs text-slate-400">(You)</span>}
                  </p>
                  <p className="text-xs text-slate-500">{ROLE_LABELS[member.role]}</p>
                </div>

                <div className="flex flex-col items-start gap-1 sm:items-end">
                  {isSuperadmin ? (
                    <span className="text-xs text-slate-400">
                      Super Admin role can&apos;t be changed here.
                    </span>
                  ) : (
                    <select
                      value={member.role}
                      disabled={isSelf || busyId === member.id}
                      onChange={(e) =>
                        handleRoleChange(member.id, e.target.value as 'reporter' | 'admin')
                      }
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:opacity-60"
                    >
                      <option value="reporter">Reporter</option>
                      <option value="admin">Admin</option>
                    </select>
                  )}
                  {isSelf && (
                    <span className="text-xs text-slate-400">
                      You can&apos;t change your own role.
                    </span>
                  )}
                  {rowErrorId === member.id && rowError && (
                    <span className="text-xs text-red-600">{rowError}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
            }
