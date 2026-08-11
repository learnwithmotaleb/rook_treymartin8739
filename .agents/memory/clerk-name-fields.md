---
name: Clerk name field constraints
description: The Replit-managed Clerk instance has lastName disabled; only firstName is accepted at signup.
---

## Rule
`signUp.password()` is NOT a real Clerk SDK method — it was called via `as any` and internally forwarded all params (including name fields) to the Clerk REST API in snake_case, causing "last_name / first_name is not a valid parameter" errors. Always use `signUp.create()` for the creation step.

The Replit-managed Clerk instance for this project also has name fields (firstName, lastName) turned OFF in dashboard user-attribute settings. Passing either to `signUp.create()` still causes API errors.

**Why:** Clerk dashboard → User & Authentication → Email, Phone, Username → Name settings only has firstName enabled for this tenant. Replit-managed Clerk tenants cannot be reconfigured through the normal Clerk dashboard.

**How to apply:**
- Only pass `firstName` to any Clerk signup/update call.
- Store the user's full display name (first + last) in our own `users.name` column via `PATCH /api/me`.
- The UI can still show two separate First Name / Last Name input fields — just concatenate them as `firstName` before passing to Clerk: `firstName: \`${first.trim()} ${last.trim()}\`.trim()`.
