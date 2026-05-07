// Smoke test: verifies Supabase project URL + secret key authenticate
// against the cloud project, and probes each baseline table's existence.
// Uses raw fetch against PostgREST so we don't pull in @supabase/realtime-js
// (which needs ws on Node < 22).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    }),
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const secret = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !secret) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

console.log("Project URL:", url);
console.log("Secret prefix:", secret.slice(0, 12) + "...");
console.log("");

const tables = [
  "universities",
  "users",
  "organizations",
  "pages",
  "page_versions",
  "edit_proposals",
  "comments",
  "comment_votes",
  "comment_reports",
  "pulse_ratings",
  "pulse_aggregates",
  "external_links",
  "bookmarks",
  "user_affiliations",
  "notifications",
  "notification_preferences",
  "lifecycle_config",
  "chunks",
];

const headers = {
  apikey: secret,
  Authorization: `Bearer ${secret}`,
  Prefer: "count=exact",
};

let ok = 0;
let missing = 0;
const errors = [];

console.log("---- Schema audit ----");
for (const t of tables) {
  const r = await fetch(`${url}/rest/v1/${t}?select=*&limit=0`, {
    headers,
  });
  if (r.ok) {
    const count = r.headers.get("content-range")?.split("/")[1] ?? "?";
    console.log(`  ${t.padEnd(28)} OK (${count} rows)`);
    ok++;
  } else {
    const body = await r.text();
    let msg = body;
    try {
      msg = JSON.parse(body).message ?? body;
    } catch {}
    console.log(`  ${t.padEnd(28)} ✗ ${r.status} ${msg.slice(0, 80)}`);
    errors.push({ table: t, status: r.status, msg });
    if (r.status === 404 || msg.includes("does not exist")) missing++;
  }
}

console.log("");
console.log(`Tables OK: ${ok} / ${tables.length}`);

// Probe pgvector extension via SQL function (only works once migration ran).
console.log("");
console.log("---- pgvector check ----");
const pgv = await fetch(
  `${url}/rest/v1/rpc/check_pgvector_installed`,
  { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: "{}" },
).catch(() => null);
if (pgv && pgv.ok) {
  console.log("  pgvector function callable");
} else {
  console.log("  (no `check_pgvector_installed` rpc — that's fine, optional)");
}

console.log("");
if (errors.length === 0) {
  console.log("✓ All baseline tables present. Migration applied.");
  process.exit(0);
} else if (missing === tables.length) {
  console.log("⚠  No baseline tables exist yet. Apply the migration:");
  console.log("   1. Open Supabase dashboard → SQL Editor");
  console.log("   2. Paste contents of supabase/migrations/001_init_foundation.sql, run");
  console.log("   3. Paste contents of supabase/seed.sql, run");
  console.log("   4. Re-run this script");
  process.exit(2);
} else {
  console.log(`⚠  Partial migration: ${missing} of ${tables.length} tables missing.`);
  process.exit(2);
}
