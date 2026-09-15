// src/components/auth/SignupPage.tsx
//
// Signup screen. Same "no modal" approach as LoginPage — plain page
// flow with min-h-screen so Android Chrome's keyboard just scrolls
// the page instead of breaking the layout.
//
// Two modes, chosen via a <select> dropdown (not a modal/wizard):
//   - "create": user is setting up a brand-new organization and
//                becomes its admin (see create_organization_and_admin_profile RPC)
//   - "join":   user is joining an existing organization, picked from
//                a dropdown, and always lands as a 'reporter'
//
// There is no free-choice role dropdown here on purpose — letting a
// signing-up user pick their own role would be a privilege-escalation
// hole. Admin/superadmin promotion happens via an existing admin
// editing a profile's role after the fact.

import { useState, useEffect, type FormEvent } from 'react'
import { useAuth, type OrgOption } from '../../contexts/AuthContext'

interface SignupPageProps {
  onSwitchToLogin: () => void
}

type SignupMode = 'create' | 'join'

export default function SignupPage({ onSwitchToLogin }: SignupPageProps) {
  const { signUpCreateOrg, signUpJoinOrg, fetchOrganizations } = useAuth()

  const [mode, setMode] = useState<SignupMode>('create')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [orgName, setOrgName] = useState('')
  const [orgId, setOrgId] = useState('')
  const [orgOptions, setOrgOptions] = useState<OrgOption[]>([])
  const [orgsLoading, setOrgsLoading] = useState(true)

  const [error, setError] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let mounted = true
    fetchOrganizations().then((orgs) => {
      if (mounted) {
        setOrgOptions(orgs)
        setOrgsLoading(false)
      }
    })
    return () => {
      mounted = false
    }
  }, [fetchOrganizations])

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
    if (mode === 'join' && !orgId) {
      setError('Please select your organization.')
      return
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
        : await signUpJoinOrg({
            email: email.trim(),
            password,
            fullName: fullName.trim(),
            orgId,
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
                <option value="join">Joining an existing organization (as Reporter)</option>
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
                <label htmlFor="orgId" className="block text-sm font-medium text-slate-700">
                  Organization
                </label>
                <select
                  id="orgId"
                  value={orgId}
                  onChange={(e) => setOrgId(e.target.value)}
                  disabled={orgsLoading}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:opacity-60"
                >
                  <option value="">
                    {orgsLoading ? 'Loading organizations…' : 'Select your organization'}
                  </option>
                  {orgOptions.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
                {!orgsLoading && orgOptions.length === 0 && (
                  <p className="mt-1 text-xs text-slate-500">
                    No organizations exist yet — choose &quot;Setting up a new organization&quot;
                    above instead.
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
