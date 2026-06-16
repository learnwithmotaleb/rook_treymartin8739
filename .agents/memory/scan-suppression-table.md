---
name: Scan suppression table
description: How resolved threats are permanently suppressed from future scans
---

## Rule
`suppressedAccountsTable` is the authoritative suppression list. The scan pipeline loads it as **step 0** (before any API, photo, or AI work) and never re-discovers dismissed accounts.

## Schema
```sql
suppressed_accounts (
  id UUID PK,
  user_id UUID → users(id) CASCADE,
  platform TEXT,
  username TEXT,          -- normalized: no @, lowercase, trimmed
  resolve_action TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, platform, username)
)
```
Created via direct SQL (drizzle-kit push can't handle non-interactive TTY).

## Write path
Both resolve endpoints in `threats.ts` upsert into this table after the threats update. Bulk resolve fetches platform+username first, then bulk-inserts. Uses `.onConflictDoNothing()`.

## Read path (scanOrchestrator.ts)
1. Load all rows for userId → build `Set<string>` using `buildSuppressKey(platform, username)`.
2. Filter each discovery stage: real candidates, web search candidates, simulated candidates.
3. `generateSimulatedCandidates()` accepts optional `suppressionSet` and skips suppressed combos before returning.
4. Late-stage loop uses the same set as a safety-net catch (logs a warning if triggered — indicates a discovery path bypassed pre-filtering).

## Helpers (exported from scanOrchestrator.ts)
- `normalizeSuppressUsername(raw)` — strips `@`, lowercases, trims
- `buildSuppressKey(platform, username)` — returns `"platform:username"`

**Why:** Old approach (querying threatsTable for `resolvedAt IS NOT NULL`) fired too late (after expensive photo/AI work), was fragile (relied on threat lifecycle), and was incomplete (didn't catch all resolution paths). A dedicated table is the only reliable source of truth.

**How to apply:** When adding a new discovery path, filter its candidates against `suppressionSet` using `buildSuppressKey()` before pushing to `allCandidates`.
