// src/components/layout/Header.tsx
//
// Top navigation bar shown on every authenticated page. Displays the
// app name, the current user's name + role, and a sign-out button.

import { useAuth } from '../../contexts/AuthContext'

const ROLE_LABELS: Record<string, string> = {
  reporter: 'Reporter',
  admin: 'Admin',
  superadmin: 'Super Admin',
}

export default function Header() {
  const { profile, signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-slate-900">SiteTrack</span>
        </div>

        <div className="flex items-center gap-3">
          {profile && (
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-900">{profile.full_name}</p>
              <p className="text-xs text-slate-500">
                {ROLE_LABELS[profile.role] ?? profile.role}
              </p>
            </div>
          )}
          {profile && (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 sm:hidden">
              {ROLE_LABELS[profile.role] ?? profile.role}
            </span>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 active:bg-slate-100"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  )
}
