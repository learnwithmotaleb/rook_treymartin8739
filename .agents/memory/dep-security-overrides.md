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

## Why
Blanket overrides force pnpm to resolve all instances of the package to the safe version range, even across deeply nested dep chains. This is the only remediation path when the vulnerable package is not a direct dep.

## How to apply
1. Run `pnpm audit 2>&1 | grep -A8 "high\|critical"` to find the vulnerable package name and patched version range.
2. Add `'<package>': '>=<patched-version>'` to `overrides:` in `pnpm-workspace.yaml` with a comment citing the GHSA ID.
3. Run `pnpm install` to apply.
4. Verify with `pnpm audit 2>&1 | tail -3`.
5. Run `pnpm run typecheck` to confirm nothing broke.

## What remains (acceptable moderate/low)
After ws + undici fixes: 0 high, remaining are postcss, uuid, qs, tar, js-yaml, markdown-it — all in build/dev tooling, not production runtime.
