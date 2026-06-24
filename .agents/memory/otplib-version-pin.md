---
name: otplib version pin (TOTP/MFA)
description: Why otplib must stay on v12, not v13 — the codebase uses the v12 `authenticator` API.
---

otplib must stay pinned to **v12** (`^12.0.1`). Do NOT upgrade to v13.

**Why:** The TOTP/MFA code (server-side login verify, totp-setup, totp-confirm)
is built entirely around otplib v12's `authenticator` object API:
`authenticator.generateSecret()`, `authenticator.keyuri(account, issuer, secret)`,
`authenticator.check(token, secret)`. otplib v13 is a complete rewrite that
**removes** the `authenticator` export (it exposes `TOTP`, `generateSecret`,
`generateURI`, `verify`, etc. instead), so on v13 `authenticator` is `undefined`
and TOTP setup fails at runtime with "Failed to generate TOTP setup".

**How to apply:** If TOTP/MFA endpoints start 500ing or `authenticator` is
undefined, check the installed otplib major version first. v13 deprecation
warnings on install are expected and safe to ignore while pinned to v12. Only
move to v13 if you also rewrite every `authenticator.*` call site to the v13 API.

**Critical gotcha — restart after dependency change:** After downgrading/changing
a dependency that's loaded at server boot, the package manager's "auto-reboot"
did NOT actually restart the running `tsx server/index.ts` process — it kept the
OLD module cached in memory, so the runtime error persisted even though
node_modules was already fixed and an ESM `createRequire("otplib").authenticator`
test passed from the CLI. An explicit `restart_workflow("Start application")` was
required to pick up the new version. Always force a workflow restart and re-check
logs after a dependency swap; don't trust the auto-reboot alone.
