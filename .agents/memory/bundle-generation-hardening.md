---
name: Bundle/document conversion hardening pattern
description: How SSRF and unbounded-resource DoS were mitigated in the case bundle PDF generation pipeline; reuse this pattern for any future headless-Chromium or file-merge feature.
---

## SSRF via headless Chromium HTML rendering
Any feature that renders untrusted HTML (e.g. `.msg` email body) to PDF/image via headless Chromium is an SSRF vector: `<img src>`, `<iframe>`, `<object>`, CSS `url()`, etc. can all trigger outbound requests to internal/cloud-metadata addresses.

**Why:** sanitizing HTML server-side can miss an attribute/tag; Chromium flags are a second independent layer.

**How to apply:** do both — (1) strip/allowlist HTML (drop network-capable tags/attrs, only allow `data:` URIs for images) AND (2) launch Chromium with network-isolating flags (`--proxy-server=127.0.0.1:1`, `--host-resolver-rules=MAP * 0.0.0.0`, disable background networking/sync/extensions). Belt-and-suspenders — don't rely on sanitization alone for any headless-browser rendering of user-controlled content.

## Unbounded multi-document merge/bundle generation DoS
A feature that lets a user pick N documents and merge/convert them server-side (e.g. case bundle PDF) needs three independent limits, not just one:
- Max item count per bundle (cheap check, do it on create/update AND at generation time since bundle contents can change between those).
- Max combined raw source bytes, tracked cumulatively *during* the download/convert loop — a per-item try/catch that "warn and skip" on error will silently swallow a deliberate size-limit throw unless you special-case it to rethrow instead of skip.
- Per-user (not just global) concurrency guard on top of any existing global serial queue — a global queue alone lets one user monopolize it by repeatedly queuing large jobs; add a `Set<userId>` guard with try/finally cleanup.

## Adding a new derived field computed only during (re)generation
The bundle download route serves straight from `cachedFileUrl` when present and skips the whole generation pipeline. Any new per-generation derived field (e.g. per-document page ranges) only gets computed/persisted on a *fresh* generation, so bundles that already have a cache from before the feature shipped will silently lack the new field until their cache is invalidated (edit+save, or manually null `cachedFileUrl`/`cachedAt`).

**Why:** discovered while adding a page-index CSV export keyed on a `documentPageInfo` column — existing cached bundles showed the new export button as unavailable even though the code was correct, because they'd never re-run the generation pipeline.

**How to apply:** when adding a new field that's computed inside the bundle-generation try block, remember existing rows won't have it until regenerated; if backward compatibility matters, consider a migration/backfill or gate the feature UI on the field's presence (as we did) rather than assuming all rows have it.
