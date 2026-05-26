---
name: Changelog patch discipline
description: Always read the active version's patch from changelog.json before writing entries — never trust a cached/scratchpad value.
---

# Rule
Before appending any entry to changelog.json, always read the live `patch` value from the active version (where `isActive=true`) in `changelog.json`.

**Why:** After a publish, `bumpDevPatchAfterPublish` increments `patch` by 1. If the scratchpad or context window has a stale patch number, every entry written in that session lands on the wrong patch — appearing under the published version instead of the new dev patch.

**How to apply:**
```python
python3 -c "
import json
with open('changelog.json') as f:
    d = json.load(f)
ver = next(v for v in d['versions'] if v['isActive'])
print(f'Active version: v{ver[\"major\"]}.{ver[\"minor\"]} patch={ver[\"patch\"]} publishedPatch={ver[\"publishedPatch\"]}')
"
```
Run this once at the start of any session before writing changelog entries, and re-run after any publish event.

Also note: there are currently 2 versions in changelog.json — `versions[0]` is v1.0 (inactive, 489 entries) and `versions[1]` is v1.1 (active). Always filter by `isActive=true`, never assume index 0 is the active one.
