// src/components/auth/LoginPage.tsx
//
// Login screen. Deliberately NOT a modal — plain page flow with
// min-h-screen (not h-screen) so the layout scrolls naturally when
// the on-screen keyboard opens on Android Chrome.
//
// PHASE 4: added a "Forgot password?" link that swaps the form for a
// small "enter your email" request form (still no modal — just an
// inline swap within the same card).

import { useState, type FormEvent } from 'react'
import { useAuth } from '../../contexts/AuthContext'

interface LoginPageProps {
  onSwitchToSignup: () => void
}

export default function LoginPage({ onSwitchToSignup }: LoginPageProps) {
  const { signIn, requestPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSubmitting, setResetSubmitting] = useState(false)
  const [resetMessage, setResetMessage] = useState<string | null>(null)
  const [resetError, setResetError] = useState<string | null>(null)

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

  const handleForgotPasswordSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setResetError(null)
    setResetMessage(null)

    if (!resetEmail.trim()) {
      setResetError('Please enter your email address.')
      return
    }

    setResetSubmitting(true)
    const { error: resetErr } = await requestPasswordReset(resetEmail.trim())
    setResetSubmitting(false)

    if (resetErr) {
      setResetError(resetErr)
      return
    }

    setResetMessage('If an account exists for that email, a reset link has been sent.')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center px-4 py-12">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900">SiteTrack</h1>
          <p className="mt-1 text-sm text-slate-500">Maintenance &amp; incident tracking</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          {showForgotPassword ? (
            <>
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Reset your password</h2>
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4" noValidate>
                <div>
                  <label htmlFor="reset-email" className="block text-sm font-medium text-slate-700">
                    Email
                  </label>
                  <input
                    id="reset-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                    placeholder="you@company.com"
                  />
                </div>

                {resetError && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {resetError}
                  </div>
                )}

                {resetMessage && (
                  <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                    {resetMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={resetSubmitting}
                  className="w-full rounded-md bg-slate-900 px-4 py-2.5 text-base font-medium text-white hover:bg-slate-800 active:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {resetSubmitting ? 'Sending…' : 'Send Reset Link'}
                </button>
              </form>

              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(false)
                  setResetError(null)
                  setResetMessage(null)
                }}
                className="mt-4 text-sm font-medium text-slate-900 underline underline-offset-2"
              >
                Back to login
              </button>
            </>
          ) : (
            <>
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
                  <div className="flex items-center justify-between">
                    <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-xs font-medium text-slate-500 underline underline-offset-2"
                    >
                      Forgot password?
                    </button>
                  </div>
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
            </>
          )}
        </div>

        {!showForgotPassword && (
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
        )}
      </div>
    </div>
  )
}
