// src/types/database.ts
//
// TypeScript types that mirror the Supabase Postgres schema exactly.
// Keep this file in sync with the SQL schema in README.md if columns change.
//
// UPDATED for phase 2: added the Invite type/table entry.

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
// for full autocomplete + type safety on .from('table') calls.
// -----------------------------------------------------------------

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: Organization
        Insert: Partial<Organization> & { name: string }
        Update: Partial<Organization>
      }
      profiles: {
        Row: Profile
        Insert: Partial<Profile> & { id: string; org_id: string; role: UserRole }
        Update: Partial<Profile>
      }
      locations: {
        Row: Location
        Insert: Partial<Location> & { org_id: string; name: string }
        Update: Partial<Location>
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
      }
      incident_updates: {
        Row: IncidentUpdate
        Insert: Partial<IncidentUpdate> & {
          incident_id: string
          user_id: string
          note: string
        }
        Update: Partial<IncidentUpdate>
      }
      invites: {
        Row: Invite
        Insert: Partial<Invite> & {
          org_id: string
          role: InviteRole
          created_by: string
        }
        Update: Partial<Invite>
      }
    }
  }
}
