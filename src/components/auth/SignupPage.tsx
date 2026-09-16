// src/components/auth/SignupPage.tsx
//
// Signup screen. Same "no modal" approach as LoginPage — plain page
// flow with min-h-screen so Android Chrome's keyboard just scrolls
// the page instead of breaking the layout.
//
// UPDATED for phase 2: joining an org now happens via an invite code
// (redeemed through a database function) instead of a public dropdown
// of every organization's name. If the page is opened with
// ?invite=TOKEN in the URL (from a link an admin shared), the token
// is pre-filled and previewed automatically. No router/new dependency
// is used — just the browser's built-in URLSearchParams.
//
// Two modes:
//   - "create": user is setting up a brand-new organization and
//                becomes its admin
//   - "invite": user has an invite code from an existing org's admin
//                and joins with whatever role that invite grants
//                (reporter or admin — decided by whoever created it)

import { useState, useEffect, type FormEvent } from 'react'
import { useAuth, type InvitePreview } from '../../contexts/AuthContext'

interface SignupPageProps {
  onSwitchToLogin: () => void
}

type SignupMode = 'create' | 'invite'

function getInviteTokenFromUrl(): string {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get('invite') ?? ''
}

export default function SignupPage({ onSwitchToLogin }: SignupPageProps) {
  const { signUpCreateOrg, signUpWithInvite, previewInvite } = useAuth()

  const initialToken = getInviteTokenFromUrl()
  const [mode, setMode] = useState<SignupMode>(initialToken ? 'invite' : 'create')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [orgName, setOrgName] = useState('')
  const [inviteToken, setInviteToken] = useState(initialToken)
  const [invitePreview, setInvitePreview] = useState<InvitePreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Auto-preview whenever the invite token changes (debounced lightly
  // via a short delay so we're not firing a request on every keystroke).
  useEffect(() => {
    if (mode !== 'invite' || !inviteToken.trim()) {
      setInvitePreview(null)
      return
    }

    let cancelled = false
    setPreviewLoading(true)
    const timeout = setTimeout(() => {
      previewInvite(inviteToken).then((result) => {
        if (!cancelled) {
          setInvitePreview(result)
          setPreviewLoading(false)
        }
      })
    }, 400)

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [inviteToken, mode, previewInvite])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfoMessage(null)

    if (!fullName.trim() || !email.trim() || !password) {
      setError('Please fill in your name, email, and password.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (mode === 'create' && !orgName.trim()) {
      setError('Please enter a name for your organization.')
      return
    }
    if (mode === 'invite') {
      if (!inviteToken.trim()) {
        setError('Please enter your invite code.')
        return
      }
      if (invitePreview && !invitePreview.isValid) {
        setError('This invite code is invalid, expired, or already used.')
        return
      }
    }

    setSubmitting(true)

    const result =
      mode === 'create'
        ? await signUpCreateOrg({
            email: email.trim(),
            password,
            fullName: fullName.trim(),
            orgName: orgName.trim(),
          })
        : await signUpWithInvite({
            email: email.trim(),
            password,
            fullName: fullName.trim(),
            inviteToken: inviteToken.trim(),
          })

    setSubmitting(false)

    if (result.error) {
      // Supabase returns a "check your email" instruction (when email
      // confirmation is enabled) through the same error slot — treat
      // that case as informational rather than a failure.
      if (result.error.toLowerCase().startsWith('check your email')) {
        setInfoMessage(result.error)
      } else {
        setError(result.error)
      }
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center px-4 py-12">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900">SiteTrack</h1>
          <p className="mt-1 text-sm text-slate-500">Maintenance &amp; incident tracking</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Create an account</h2>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="signup-mode" className="block text-sm font-medium text-slate-700">
                I am...
              </label>
              <select
                id="signup-mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as SignupMode)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              >
                <option value="create">Setting up a new organization (becomes Admin)</option>
                <option value="invite">Joining with an invite code</option>
              </select>
            </div>

            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-slate-700">
                Full name
              </label>
              <input
                id="fullName"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                placeholder="Jane Rivera"
              />
            </div>

            {mode === 'create' ? (
              <div>
                <label htmlFor="orgName" className="block text-sm font-medium text-slate-700">
                  Organization name
                </label>
                <input
                  id="orgName"
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  placeholder="Riverside Property Management"
                />
              </div>
            ) : (
              <div>
                <label htmlFor="inviteToken" className="block text-sm font-medium text-slate-700">
                  Invite code
                </label>
                <input
                  id="inviteToken"
                  type="text"
                  value={inviteToken}
                  onChange={(e) => setInviteToken(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  placeholder="Paste the code your admin sent you"
                />
                {previewLoading && (
                  <p className="mt-1 text-xs text-slate-500">Checking invite…</p>
                )}
                {!previewLoading && invitePreview && invitePreview.isValid && (
                  <p className="mt-1 text-xs text-green-700">
                    Valid invite — you&apos;ll join <strong>{invitePreview.orgName}</strong> as{' '}
                    {invitePreview.role}.
                  </p>
                )}
                {!previewLoading && invitePreview && !invitePreview.isValid && (
                  <p className="mt-1 text-xs text-red-600">
                    This invite code is invalid, expired, or already used.
                  </p>
                )}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                placeholder="At least 6 characters"
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-slate-700"
              >
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            {infoMessage && (
              <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                {infoMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-slate-900 px-4 py-2.5 text-base font-medium text-white hover:bg-slate-800 active:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Creating account…' : 'Sign up'}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-sm text-slate-600">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="font-medium text-slate-900 underline underline-offset-2"
          >
            Log in
          </button>
        </p>
      </div>
    </div>
  )
              }
