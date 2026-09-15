// src/App.tsx
//
// Top-level app shell. Wraps everything in AuthProvider, then the
// AuthGate component decides what to show based on session/profile
// state: login/signup, a "no profile found" fallback, or the correct
// role-based view (reporter vs admin/superadmin).

import { useState } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginPage from './components/auth/LoginPage'
import SignupPage from './components/auth/SignupPage'
import Header from './components/layout/Header'
import ReporterView from './components/reporter/ReporterView'
import AdminDashboard from './components/admin/AdminDashboard'
import LoadingSpinner from './components/shared/LoadingSpinner'

type AuthScreen = 'login' | 'signup'

function AuthGate() {
  const { session, profile, loading, signOut } = useAuth()
  const [authScreen, setAuthScreen] = useState<AuthScreen>('login')

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoadingSpinner label="Loading SiteTrack…" size="lg" />
      </div>
    )
  }

  if (!session) {
    return authScreen === 'login' ? (
      <LoginPage onSwitchToSignup={() => setAuthScreen('signup')} />
    ) : (
      <SignupPage onSwitchToLogin={() => setAuthScreen('login')} />
    )
  }

  // Session exists but no matching profile row was found — surface a
  // clear recovery path rather than silently rendering a blank page.
  if (!profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4 text-center">
        <p className="max-w-sm text-slate-700">
          We couldn&apos;t find your account details. Try signing out and back in, or contact
          your administrator.
        </p>
        <button
          type="button"
          onClick={() => signOut()}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Sign out
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      {profile.role === 'reporter' ? <ReporterView /> : <AdminDashboard />}
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  )
        }
