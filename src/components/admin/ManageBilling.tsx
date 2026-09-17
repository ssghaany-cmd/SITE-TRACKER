// src/components/admin/ManageBilling.tsx
//
// Shows the org's current subscription status and lets an admin start
// a Stripe Checkout session (to subscribe) or open the Stripe Customer
// Portal (to manage/cancel an existing subscription). Both actions call
// Supabase Edge Functions — see supabase/functions setup in the README.

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import type { Subscription } from '../../types/database'
import LoadingSpinner from '../shared/LoadingSpinner'
import { formatDate } from '../../utils/formatDate'

const STATUS_LABELS: Record<string, string> = {
  trialing: 'Trialing',
  active: 'Active',
  past_due: 'Past Due',
  canceled: 'Canceled',
  incomplete: 'Incomplete',
}

const STATUS_STYLES: Record<string, string> = {
  trialing: 'bg-blue-100 text-blue-800',
  active: 'bg-green-100 text-green-800',
  past_due: 'bg-orange-100 text-orange-800',
  canceled: 'bg-slate-100 text-slate-700',
  incomplete: 'bg-red-100 text-red-800',
}

export default function ManageBilling() {
  const { profile } = useAuth()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const fetchSubscription = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('org_id', profile.org_id)
      .maybeSingle()

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setSubscription((data as Subscription | null) ?? null)
    }
    setLoading(false)
  }, [profile])

  useEffect(() => {
    fetchSubscription()
  }, [fetchSubscription])

  const handleSubscribe = async () => {
    setActionLoading(true)
    setError(null)

    const { data, error: fnError } = await supabase.functions.invoke('create-checkout-session')

    setActionLoading(false)

    if (fnError || !data?.url) {
      setError(fnError?.message ?? 'Failed to start checkout.')
      return
    }

    window.location.href = data.url
  }

  const handleManageBilling = async () => {
    setActionLoading(true)
    setError(null)

    const { data, error: fnError } = await supabase.functions.invoke('create-portal-session')

    setActionLoading(false)

    if (fnError || !data?.url) {
      setError(fnError?.message ?? 'Failed to open billing portal.')
      return
    }

    window.location.href = data.url
  }

  if (!profile) return null

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <h3 className="mb-4 text-lg font-semibold text-slate-900">Billing</h3>

      {loading ? (
        <LoadingSpinner label="Loading billing status…" />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">Status:</span>
            {subscription ? (
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  STATUS_STYLES[subscription.status] ?? 'bg-slate-100 text-slate-700'
                }`}
              >
                {STATUS_LABELS[subscription.status] ?? subscription.status}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                No subscription yet
              </span>
            )}
          </div>

          {subscription?.current_period_end && (
            <p className="text-sm text-slate-500">
              Current period ends {formatDate(subscription.current_period_end)}
            </p>
          )}

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            {!subscription || subscription.status === 'canceled' ? (
              <button
                type="button"
                onClick={handleSubscribe}
                disabled={actionLoading}
                className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 active:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {actionLoading ? 'Loading…' : 'Subscribe'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleManageBilling}
                disabled={actionLoading}
                className="rounded-md border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {actionLoading ? 'Loading…' : 'Manage Billing'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
         }
