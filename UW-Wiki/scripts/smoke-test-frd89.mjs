import { eq, requireEnv, supabaseRest } from "./lib/env.mjs";

const env = requireEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY");
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!anonKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  process.exit(1);
}
const failures = [];
function assert(label, condition, detail = "") {
  if (condition) console.log(`✓ ${label}`);
  else failures.push(`${label}${detail ? `: ${detail}` : ""}`);
}

const notifications = await supabaseRest("/notifications?select=id,type,delivered_email,payload,read_at&limit=1").catch((error) => ({ error }));
assert("notifications has FRD-9 columns", Array.isArray(notifications), notifications.error?.message);

const prefs = await supabaseRest("/notification_preferences?select=user_id,in_app_pr_status,email_pr_status,in_app_comment_reply,email_comment_reply,in_app_page_update&limit=1").catch((error) => ({ error }));
assert("notification_preferences has FRD-9 columns", Array.isArray(prefs), prefs.error?.message);

const anonHeaders = {
  apikey: anonKey,
  Authorization: `Bearer ${anonKey}`,
};

const [page] = await supabaseRest("/pages?select=id,current_version_id&current_version_id=not.is.null&limit=1");
const [proposal] = await supabaseRest("/edit_proposals?select=id", {
  method: "POST",
  prefer: "return=representation",
  body: JSON.stringify({
    page_id: page.id,
    base_version_id: page.current_version_id,
    base_page_version_id: page.current_version_id,
    is_anonymous: true,
    section_slugs: ["audit"],
    rationale: "temporary frd89 smoke proposal",
    status: "pending",
  }),
});
const [comment] = await supabaseRest("/proposal_review_comments?select=id", {
  method: "POST",
  prefer: "return=representation",
  body: JSON.stringify({
    proposal_id: proposal.id,
    message: "temporary review comment",
  }),
});

const anonRead = await fetch(
  `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/proposal_review_comments?select=id&id=${eq(comment.id)}`,
  { headers: anonHeaders },
);
const anonRows = await anonRead.json().catch(() => []);
assert("anon cannot read proposal_review_comments rows", Array.isArray(anonRows) && anonRows.length === 0);

await supabaseRest(`/edit_proposals?id=${eq(proposal.id)}`, { method: "DELETE" });

if (failures.length) {
  console.error("FRD-8/9 smoke failures:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("All FRD-8/9 smoke checks passed.");
