# Seeding And Roles

Supabase Auth owns login identities. `public.users` mirrors each auth user through the `handle_new_user` trigger and stores the UW Wiki role.

## Roles

- `user`: normal signed-in contributor.
- `reviewer`: can review proposals and moderate reports.
- `admin`: can access every admin dashboard surface.

## Create Test Accounts

1. Sign up through `/auth/sign-in`, or create a user in Supabase Auth.
2. Confirm the user exists in `public.users`.
3. Run:

```sh
node scripts/list-users-roles.mjs
node scripts/ensure-dev-role.mjs someone@example.com reviewer
node scripts/ensure-dev-role.mjs admin@example.com admin
```

To add an affiliation for conflict-of-interest testing:

```sh
node scripts/ensure-dev-role.mjs reviewer@example.com reviewer watonomous "Team member"
```

## Recommended Test Set

| Email Pattern | Role | Use |
|---|---|---|
| `test-user@...` | `user` | bookmarks, comments, Pulse, contributions |
| `test-reviewer@...` | `reviewer` | PR queue, request changes, accept/reject, moderation |
| `test-admin@...` | `admin` | cold start, lifecycle, users, official sections, activity |
| `test-affiliated@...` | `reviewer` plus affiliation | COI disclosure testing |

## Cleanup

Remove test data from Supabase Auth first, then remove any orphaned `public.users` rows if needed. Smoke scripts clean up their temporary rows automatically.

Never commit real credentials or production user details.
