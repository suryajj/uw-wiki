// Raw Supabase row types — generated from the DB schema.
// These mirror table columns exactly. Domain types live in domain.ts.
//
// To regenerate: `supabase gen types typescript --project-id <ref> > src/types/database.ts`

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Role = "user" | "reviewer" | "admin";

// Placeholder shapes — full generated types arrive once schema is pushed.
export type UserRow = {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  role: Role;
  created_at: string;
};
