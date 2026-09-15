// src/contexts/AuthContext.tsx
//
// Central identity provider for the app. Tracks the Supabase auth session
// and the matching `profiles` row (role + org_id), and exposes sign in /
// sign up (create-new-org or join-existing-org) / sign out actions via
// the useAuth() hook.

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Profile, UserRole } from '../types/database'
import type { Session, User } from '@supabase/supabase-js'

export interface OrgOption {
  id: string
  name: string
}

interface SignUpCreateOrgParams {
  email: string
  password: string
  fullName: string
  orgName: string
}

interface SignUpJoinOrgParams {
  email: string
  password: string
  fullName: string
  orgId: string
}

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUpCreateOrg: (params: SignUpCreateOrgParams) => Promise<{ error: string | null }>
  signUpJoinOrg: (params: SignUpJoinOrgParams) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  fetchOrganizations: () => Promise<OrgOption[]>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

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
      if (!signUpData.user) {
        return {
          error:
            'Check your email to confirm your account, then log in again to finish setting up your organization.',
        }
      }

      const { error: rpcError } = await supabase.rpc('create_organization_and_admin_profile', {
        org_name: orgName,
        admin_full_name: fullName,
      })
      if (rpcError) return { error: rpcError.message }

      await loadProfile(signUpData.user.id)
      return { error: null }
    },
    [loadProfile]
  )

  const signUpJoinOrg = useCallback(
    async ({ email, password, fullName, orgId }: SignUpJoinOrgParams) => {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      })
      if (signUpError) return { error: signUpError.message }
      if (!signUpData.user) {
        return {
          error:
            'Check your email to confirm your account, then log in again to finish joining your organization.',
        }
      }

      const newProfile: Partial<Profile> & { id: string; org_id: string; role: UserRole } = {
        id: signUpData.user.id,
        org_id: orgId,
        role: 'reporter',
        full_name: fullName,
        assigned_locations: [],
      }

      const { error: profileError } = await supabase.from('profiles').insert(newProfile)
      if (profileError) return { error: profileError.message }

      await loadProfile(signUpData.user.id)
      return { error: null }
    },
    [loadProfile]
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  const fetchOrganizations = useCallback(async (): Promise<OrgOption[]> => {
    const { data, error } = await supabase
      .from('organizations')
      .select('id, name')
      .order('name', { ascending: true })

    if (error) {
      console.error('Failed to fetch organizations:', error.message)
      return []
    }
    return (data ?? []) as OrgOption[]
  }, [])

  const value: AuthContextValue = {
    session,
    user,
    profile,
    loading,
    signIn,
    signUpCreateOrg,
    signUpJoinOrg,
    signOut,
    fetchOrganizations,
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
