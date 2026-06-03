---
name: RevenueCat proxy client bridge
description: How to wire @replit/revenuecat-sdk through @replit/connectors-sdk proxy — the SDK passes a Request object not init.
---

## The rule
`@replit/revenuecat-sdk` uses `@hey-api/client-fetch` internally. It builds a full `Request` object and passes it as the first argument to `fetch`, with `init === null`. Never read `init.method` or `init.body` — always check `input instanceof Request` first.

**Why:** The standard fetch signature allows `fetch(input, init)` where `input` can be a `Request`. The SDK always uses this form. The `@replit/connectors-sdk` proxy accepts a plain object body, not a Request — so we must extract and re-serialize.

## How to apply
In `scripts/src/revenueCatClient.ts`:
```ts
if (input instanceof Request) {
  url = input.url;
  method = input.method.toUpperCase();  // NOT init?.method — that's null
  const bodyText = await input.text();
  if (bodyText) body = JSON.parse(bodyText);
}
```

Also: rebuild a fresh `Response` after reading the proxy response body, or the SDK gets "body already consumed":
```ts
const responseText = await proxyResponse.text();
return new Response(responseText, {
  status: proxyResponse.status,
  headers: { "content-type": "application/json" },
});
```

## Seed script quirk
The RC Replit integration creates one project automatically ("Social Guard" or similar). The seed script must fall back to `items[0]` instead of name-matching, since the project name may differ from the app name.
