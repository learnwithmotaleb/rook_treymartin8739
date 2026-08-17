---
name: Clerk sign-up password flow
description: This Clerk instance requires password to be submitted via update() after email verification, not during create().
---

## Rule
After `attemptEmailAddressVerification({ code })` resolves, check `result.missingFields`. If it includes `"password"`, the account is not yet complete — call `live.update({ password })` and use *that* result's `createdSessionId` and `status` to activate the session.

**Why:** This Clerk tenant's sign-up flow is configured as "email verification first, then password". Passing `password` to `create()` does not satisfy the requirement; Clerk still expects an explicit `update()` call after the email code is verified. Calling `create()` with password is harmless but insufficient.

**How to apply:**
```js
const result = await live.attemptEmailAddressVerification({ code });
let final = result;
if (result.status === "missing_requirements" && result.missingFields?.includes("password")) {
  final = await live.update({ password });
}
if (final.status === "complete") {
  await setSignUpActive({ session: final.createdSessionId });
}
```

Also relevant: `useSignUp()` in Clerk React v6 returns a computed signal object (plain object snapshot), not the live `SignUpResource` class instance. It has `create` but NOT `prepareEmailAddressVerification`, `update`, or `attemptEmailAddressVerification`. Always use `clerk.client.signUp` (via `useClerk()`) or the return value of `create()` (which returns `this`) for any post-create method calls.
