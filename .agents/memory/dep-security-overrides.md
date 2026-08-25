---
name: Dep security overrides pattern
description: How to use pnpm-workspace.yaml overrides to remediate transitive high-severity vulnerabilities when no direct upgrade path exists.
---

# Dependency Security Overrides Pattern

## Rule
When `pnpm audit` reports high/critical vulns in transitive deps where no direct dependency can be upgraded, add blanket overrides to `pnpm-workspace.yaml` under the `overrides:` key.

## Current overrides (security-related)
- `ws: '>=8.21.0'` — GHSA-3h5q-q39x-f9x3, Memory exhaustion DoS via ws fragments (8.x fixed in 8.21.0)
- `undici: '>=6.27.0'` — GHSA-g8m3-5g58-fq7m, WebSocket DoS via fragment count bypass
- `expo-server-sdk>undici: '>=7.28.0'` — GHSA-vmh5-mc38-953g, TLS cert bypass via SOCKS5 ProxyAgent (scoped because expo-server-sdk needs undici 7.x)

## React Native codegen exception
Keep the global `brace-expansion` security override on the modern 5.x line, but scope `minimatch@3` to patched `brace-expansion` 1.x.

**Why:** React Native 0.81 codegen still uses `glob` 7 and `minimatch` 3, which invoke the 1.x CommonJS API. Forcing 5.x into that dependency path crashes iOS code generation with `expand is not a function`.

**How to apply:** Keep the nested pnpm override alongside the global one, regenerate the lockfile, then run the native codegen command that EAS uses before retrying an iOS build. Recheck the audit result rather than assuming a previously safe range remains current.

## Why
Blanket overrides force pnpm to resolve all instances of the package to the safe version range, even across deeply nested dep chains. This is the only remediation path when the vulnerable package is not a direct dep.

## How to apply
1. Run `pnpm audit 2>&1 | grep -A8 "high\|critical"` to find the vulnerable package name and patched version range.
2. Add `'<package>': '>=<patched-version>'` to `overrides:` in `pnpm-workspace.yaml` with a comment citing the GHSA ID.
3. Run `pnpm install` to apply.
4. Verify with `pnpm audit 2>&1 | tail -3`.
5. Run `pnpm run typecheck` to confirm nothing broke.

## Audit posture
Advisory data and patched-version ranges change over time. Re-run the audit after any override change and treat its current high/critical findings as the source of truth.
