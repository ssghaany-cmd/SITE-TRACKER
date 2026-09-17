// src/types/database.ts
//
// TypeScript types that mirror the Supabase Postgres schema exactly.
// Keep this file in sync with the SQL schema in README.md if columns change.
//
// PHASE 3: added Vendor and Subscription types. Note: the Supabase
// client itself (src/lib/supabaseClient.ts) is intentionally untyped
// (see that file's comments) after the earlier generic-matching
// issues, so the `Database` interface below is kept for documentation
// / potential future use but isn't currently wired into createClient().

export type UserRole = 'reporter' | 'admin' | 'superadmin'

export type IncidentStatus = 'open' | 'in_progress' | 'resolved'

export type IncidentPriority = 'low' | 'medium' | 'high'

export type InviteRole = 'reporter' | 'admin'

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete'

export interface Organization {
  id: string
  name: string
  created_at: string
}

export interface Profile {
  id: string // matches auth.users.id
  org_id: string
  role: UserRole
  full_name: string
  assigned_locations: string[]
  created_at: string
}

export interface Location {
  id: string
  org_id: string
  name: string
  address: string
  created_at: string
}

export interface Incident {
  id: string
  org_id: string
  location_id: string
  reported_by: string
  category: string
  description: string
  status: IncidentStatus
  priority: IncidentPriority
  photo_url: string | null
  assigned_to: string | null
  vendor_id: string | null
  created_at: string
  resolved_at: string | null
}

export interface IncidentUpdate {
  id: string
  incident_id: string
  user_id: string
  note: string
  created_at: string
}

export interface Invite {
  id: string
  org_id: string
  role: InviteRole
  token: string
  created_by: string
  max_uses: number
  uses: number
  expires_at: string | null
  created_at: string
}

export interface Vendor {
  id: string
  org_id: string
  name: string
  contact_name: string
  phone: string
  email: string
  specialty: string
  created_at: string
}

export interface Subscription {
  id: string
  org_id: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  status: SubscriptionStatus
  plan: string
  current_period_end: string | null
  created_at: string
  updated_at: string
}

// -----------------------------------------------------------------
// Convenience "joined" shapes used by the UI (not raw table rows,
// but common query result shapes we'll reuse across components).
// -----------------------------------------------------------------

export interface IncidentWithRelations extends Incident {
  location?: Pick<Location, 'id' | 'name' | 'address'> | null
  reporter?: Pick<Profile, 'id' | 'full_name'> | null
  assignee?: Pick<Profile, 'id' | 'full_name'> | null
  vendor?: Pick<Vendor, 'id' | 'name'> | null
}

export interface IncidentUpdateWithUser extends IncidentUpdate {
  user?: Pick<Profile, 'id' | 'full_name'> | null
}

// -----------------------------------------------------------------
// Supabase generated-style Database type (documentation only — the
// client is currently untyped; see note at the top of this file).
// -----------------------------------------------------------------

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: Organization
        Insert: Partial<Organization> & { name: string }
        Update: Partial<Organization>
        Relationships: []
      }
      profiles: {
        Row: Profile
        Insert: Partial<Profile> & { id: string; org_id: string; role: UserRole }
        Update: Partial<Profile>
        Relationships: []
      }
      locations: {
        Row: Location
        Insert: Partial<Location> & { org_id: string; name: string }
        Update: Partial<Location>
        Relationships: []
      }
      incidents: {
        Row: Incident
        Insert: Partial<Incident> & {
          org_id: string
          location_id: string
          reported_by: string
          category: string
          description: string
        }
        Update: Partial<Incident>
        Relationships: []
      }
      incident_updates: {
        Row: IncidentUpdate
        Insert: Partial<IncidentUpdate> & {
          incident_id: string
          user_id: string
          note: string
        }
        Update: Partial<IncidentUpdate>
        Relationships: []
      }
      invites: {
        Row: Invite
        Insert: Partial<Invite> & {
          org_id: string
          role: InviteRole
          created_by: string
        }
        Update: Partial<Invite>
        Relationships: []
      }
      vendors: {
        Row: Vendor
        Insert: Partial<Vendor> & { org_id: string; name: string }
        Update: Partial<Vendor>
        Relationships: []
      }
      subscriptions: {
        Row: Subscription
        Insert: Partial<Subscription> & { org_id: string }
        Update: Partial<Subscription>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      create_organization_and_admin_profile: {
        Args: { org_name: string; admin_full_name: string }
        Returns: string
      }
      redeem_invite: {
        Args: { invite_token: string; new_full_name: string }
        Returns: string
      }
      preview_invite: {
        Args: { invite_token: string }
        Returns: {
          org_name: string | null
          invite_role: string | null
          is_valid: boolean
        }[]
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
