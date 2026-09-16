// src/contexts/AuthContext.tsx
//
// Central identity provider for the app. Tracks the Supabase auth session
// and the matching `profiles` row (role + org_id), and exposes sign in /
// sign up (create-new-org or redeem-invite) / sign out actions via the
// useAuth() hook.
//
// FIX: signUp() returns a `user` object even when Supabase's "Confirm
// email" setting is ON — but in that case there's no active `session`
// yet, so an immediate .rpc() call runs UNAUTHENTICATED (auth.uid() is
// null inside the database function), which previously surfaced as a
// confusing raw Postgres error ("null value in column 'id' ..."). We
// now check for `session` (not just `user`) before attempting the RPC,
// and show a clear message instead.
//
// NOTE: with email confirmation ON, the org/invite RPC genuinely cannot
// run until the user has a session — and this app doesn't yet persist
// "finish creating my org" across the confirmation-email round trip.
// For now, either keep "Confirm email" OFF in Supabase (recommended
// for internal rollout — see README), or treat this message as a
// signal to build a proper "resume after confirming" flow later.

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
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUpCreateOrg: (params: SignUpCreateOrgParams) => Promise<{ error: string | null }>
  signUpWithInvite: (params: SignUpWithInviteParams) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  previewInvite: (token: string) => Promise<InvitePreview>
  refreshProfile: () => Promise<void>
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

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setUser(newSession?.user ?? null)
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

      // signUp() can return a `user` even when there's no active
      // `session` yet (email confirmation required). Without a
      // session, the RPC below would run unauthenticated and fail.
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

  const value: AuthContextValue = {
    session,
    user,
    profile,
    loading,
    signIn,
    signUpCreateOrg,
    signUpWithInvite,
    signOut,
    previewInvite,
    refreshProfile,
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
