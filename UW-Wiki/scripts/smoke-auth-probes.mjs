import { loadEnv } from "./lib/env.mjs";

const env = loadEnv();
const appUrl = process.env.NEXT_PUBLIC_APP_URL || env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const probes = [
  ["/api/health", 200],
  ["/my/profile", 307],
  ["/my/bookmarks", 307],
  ["/my/contributions", 307],
  ["/my/notifications", 307],
  ["/admin/reviews", 307],
  ["/admin/cold-start", 307],
];

const failures = [];
for (const [path, expected] of probes) {
  const res = await fetch(`${appUrl}${path}`, { redirect: "manual" });
  const text = await res.text();
  const location = res.headers.get("location") ?? "";
  console.log(`${path.padEnd(24)} ${res.status} ${location}`);
  const serverRedirect = res.status === 200 && text.includes("NEXT_REDIRECT") && text.includes("/auth/sign-in");
  if (res.status !== expected && !serverRedirect) {
    failures.push(`${path}: expected ${expected}, got ${res.status}`);
  }
}

if (failures.length) {
  console.error("Auth probe failures:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Auth/redirect probes passed.");
