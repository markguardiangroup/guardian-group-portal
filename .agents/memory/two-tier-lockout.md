---
name: Two-tier account lockout
description: Separate a self-clearing anti-brute-force soft lock from a permanent status lock with a much higher threshold, to prevent anonymous DoS-lock of arbitrary accounts.
---
A login-attempt lockout that flips a user's persistent `status` to `locked` (requiring admin unlock or password reset) after only a small number of failures (e.g. 3) is a public DoS vector: anyone who knows/guesses a username can permanently lock that account with a handful of bad requests, no auth required.

**Why:** Rate-limiting bad guesses is a legitimate anti-brute-force control, but the *penalty* for tripping it must be proportional and self-healing at low counts. Permanently changing account status is a much more severe, sticky consequence and should require a materially higher bar so it can't be used as a weapon against a victim's account.

**How to apply:** Keep two independent thresholds:
1. A short-window, low-threshold "soft" lock (e.g. 3 fails / 15 min) that just blocks login attempts temporarily and clears itself once the window passes — no status change, no admin action needed.
2. A much higher, wider-window "hard" lock (e.g. 10 fails / 60 min) that is the only thing allowed to flip `status` to `locked`.

Implement via a helper that counts *consecutive* failures within the window (not just a boolean flag), so both thresholds can be evaluated from the same failure history. Only the hard-lock path should ever touch persistent account status.
