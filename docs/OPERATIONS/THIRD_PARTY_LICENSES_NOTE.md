# Third-Party Licenses Note

Third-party dependency licenses are managed via npm metadata and lockfiles.

Current baseline:
- Dependency license inventory source: `package-lock.json` + installed package manifests.
- Release process expectation: generate `THIRD_PARTY_NOTICES` for distribution artifacts.
- Current production posture (mainline at this contour): fresh `npm ls --omit=dev --json --long` scan shows `UNKNOWN=0`, `DENY=0`.
- Current review set is limited to `AGPL-3.0-or-later` (project license); no new review license classes are introduced in current production dependency scope.

Out of scope for this ticket:
- Full notice bundle generation and packaging automation.

Follow-up ticket:
- `THIRD_PARTY_NOTICES_GENERATION_v1.0`
