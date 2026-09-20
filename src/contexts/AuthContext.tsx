// src/contexts/AuthContext.tsx
//
// Central identity provider for the app. Tracks the Supabase auth session
// and the matching `profiles` row (role + org_id), and exposes sign in /
// sign up (create-new-org or redeem-invite) / sign out / password-reset
// actions via the useAuth() hook.
//
// PHASE 4: added password reset support.
//   - requestPasswordReset(email): sends the user a reset link
//   - Supabase redirects them back to this same app with a recovery
//     token in the URL; supabase-js (detectSessionInUrl: true, already
//     set in supabaseClient.ts) picks this up automatically and fires
//     a 'PASSWORD_RECOVERY' auth event, which we catch below and flip
//     `isPasswordRecovery` to true.
//   - App.tsx checks `isPasswordRecovery` and shows ResetPasswordPage
//     instead of the normal login/dashboard flow until they set a new
//     password via updatePassword().

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Profile } from '../types/database'
import type { Session, User } from '@supabase/supabase-js'

interface SignUpCreateOrgParams {
  email: string
  password: string
  fullName: string
  orgName: string
}

interface SignUpWithInviteParams {
  email: string
  password: string
  fullName: string
  inviteToken: string
}

export interface InvitePreview {
  orgName: string | null
  role: string | null
  isValid: boolean
}

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  isPasswordRecovery: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUpCreateOrg: (params: SignUpCreateOrgParams) => Promise<{ error: string | null }>
  signUpWithInvite: (params: SignUpWithInviteParams) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  previewInvite: (token: string) => Promise<InvitePreview>
  refreshProfile: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const EMAIL_CONFIRMATION_MESSAGE =
  'Check your email to confirm your account. After confirming, come back and log in — ' +
  'if your organization or invite wasn\'t set up yet, sign up again with the same details ' +
  'once you have an active session.'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.error('Failed to load profile:', error.message)
      setProfile(null)
      return
    }
    setProfile((data as Profile | null) ?? null)
  }, [])

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setUser(data.session?.user ?? null)
      if (data.session?.user) {
        loadProfile(data.session.user.id).finally(() => {
          if (mounted) setLoading(false)
        })
      } else {
        setLoading(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession)
      setUser(newSession?.user ?? null)

      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true)
      }

      if (newSession?.user) {
        loadProfile(newSession.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [loadProfile])

  const refreshProfile = useCallback(async () => {
    if (user) {
      await loadProfile(user.id)
    }
  }, [user, loadProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }, [])

  const signUpCreateOrg = useCallback(
    async ({ email, password, fullName, orgName }: SignUpCreateOrgParams) => {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      })
      if (signUpError) return { error: signUpError.message }

      if (!signUpData.session) {
        return { error: EMAIL_CONFIRMATION_MESSAGE }
      }

      const { error: rpcError } = await supabase.rpc('create_organization_and_admin_profile', {
        org_name: orgName,
        admin_full_name: fullName,
      })
      if (rpcError) return { error: rpcError.message }

      await loadProfile(signUpData.user!.id)
      return { error: null }
    },
    [loadProfile]
  )

  const signUpWithInvite = useCallback(
    async ({ email, password, fullName, inviteToken }: SignUpWithInviteParams) => {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      })
      if (signUpError) return { error: signUpError.message }

      if (!signUpData.session) {
        return { error: EMAIL_CONFIRMATION_MESSAGE }
      }

      const { error: rpcError } = await supabase.rpc('redeem_invite', {
        invite_token: inviteToken.trim(),
        new_full_name: fullName,
      })
      if (rpcError) return { error: rpcError.message }

      await loadProfile(signUpData.user!.id)
      return { error: null }
    },
    [loadProfile]
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  const previewInvite = useCallback(async (token: string): Promise<InvitePreview> => {
    if (!token.trim()) {
      return { orgName: null, role: null, isValid: false }
    }

    const { data, error } = await supabase
      .rpc('preview_invite', { invite_token: token.trim() })
      .maybeSingle()

    if (error || !data) {
      return { orgName: null, role: null, isValid: false }
    }

    return {
      orgName: (data as { org_name: string | null }).org_name,
      role: (data as { invite_role: string | null }).invite_role,
      isValid: (data as { is_valid: boolean }).is_valid,
    }
  }, [])

  const requestPasswordReset = useCallback(async (email: string) => {
    const redirectTo = `${window.location.origin}${window.location.pathname}`
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    return { error: error?.message ?? null }
  }, [])

  const updatePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (!error) {
      setIsPasswordRecovery(false)
    }
    return { error: error?.message ?? null }
  }, [])

  const value: AuthContextValue = {
    session,
    user,
    profile,
    loading,
    isPasswordRecovery,
    signIn,
    signUpCreateOrg,
    signUpWithInvite,
    signOut,
    previewInvite,
    refreshProfile,
    requestPasswordReset,
    updatePassword,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
    }
