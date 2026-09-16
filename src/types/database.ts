// src/types/database.ts
//
// TypeScript types that mirror the Supabase Postgres schema exactly.
// Keep this file in sync with the SQL schema in README.md if columns change.
//
// FIX (round 2): each table also needs a `Relationships` array (even if
// empty) alongside Row/Insert/Update. Without it, @supabase/supabase-js's
// internal GenericSchema/GenericTable constraint check fails for the
// WHOLE schema (not just the affected table), and every .insert()/
// .update()/.rpc() call silently resolves to `never` — which is exactly
// the class of error this fixes.

export type UserRole = 'reporter' | 'admin' | 'superadmin'

export type IncidentStatus = 'open' | 'in_progress' | 'resolved'

export type IncidentPriority = 'low' | 'medium' | 'high'

export type InviteRole = 'reporter' | 'admin'

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

// -----------------------------------------------------------------
// Convenience "joined" shapes used by the UI (not raw table rows,
// but common query result shapes we'll reuse across components).
// -----------------------------------------------------------------

export interface IncidentWithRelations extends Incident {
  location?: Pick<Location, 'id' | 'name' | 'address'> | null
  reporter?: Pick<Profile, 'id' | 'full_name'> | null
  assignee?: Pick<Profile, 'id' | 'full_name'> | null
}

export interface IncidentUpdateWithUser extends IncidentUpdate {
  user?: Pick<Profile, 'id' | 'full_name'> | null
}

// -----------------------------------------------------------------
// Supabase generated-style Database type.
// This lets us type the supabase-js client (createClient<Database>(...))
// for full autocomplete + type safety on .from('table') and .rpc(...) calls.
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
