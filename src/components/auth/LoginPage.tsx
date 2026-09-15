// src/components/auth/LoginPage.tsx
//
// Login screen. Deliberately NOT a modal — plain page flow with
// min-h-screen (not h-screen) so the layout scrolls naturally when
// the on-screen keyboard opens on Android Chrome, instead of the
// form getting clipped or pushed off-screen the way fixed-height
// modals do.

import { useState, type FormEvent } from 'react'
import { useAuth } from '../../contexts/AuthContext'

interface LoginPageProps {
  onSwitchToSignup: () => void
}

export default function LoginPage({ onSwitchToSignup }: LoginPageProps) {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email || !password) {
      setError('Please enter your email and password.')
      return
    }

    setSubmitting(true)
    const { error: signInError } = await signIn(email.trim(), password)
    setSubmitting(false)

    if (signInError) {
      setError(signInError)
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
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Log in</h2>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-slate-900 px-4 py-2.5 text-base font-medium text-white hover:bg-slate-800 active:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Logging in…' : 'Log in'}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-sm text-slate-600">
          Don&apos;t have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToSignup}
            className="font-medium text-slate-900 underline underline-offset-2"
          >
            Sign up
          </button>
        </p>
      </div>
    </div>
  )
}
