import { supabaseRest } from "./lib/env.mjs";

const rows = await supabaseRest(
  "/users?select=id,email,display_name,role,email_verified_at,created_at&order=created_at.desc&limit=50",
);

console.table(
  rows.map((row) => ({
    id: row.id,
    email: row.email,
    displayName: row.display_name ?? "",
    role: row.role,
    verified: !!row.email_verified_at,
    createdAt: row.created_at,
  })),
);
