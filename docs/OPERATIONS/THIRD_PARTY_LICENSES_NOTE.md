# Third-Party Licenses Note

Third-party dependency licenses are managed via npm metadata and lockfiles.

Current baseline:
- Dependency license inventory source: `package-lock.json` + installed package manifests.
- Bundled visual asset inventory: selected Phosphor Icons Regular SVG files under `src/renderer/assets/icons/phosphor/regular`, with the upstream MIT license stored beside the assets.
- Release process expectation: generate `THIRD_PARTY_NOTICES` for distribution artifacts.
- Current production posture (mainline at this contour): fresh `npm ls --omit=dev --json --long` scan shows `UNKNOWN=0`, `DENY=0`.
- Current review set includes `AGPL-3.0-or-later` for project code and MIT for the bundled Phosphor visual asset subset; no runtime package dependency was added for the icon system.

Out of scope for this ticket:
- Full notice bundle generation and packaging automation.

Follow-up ticket:
- `THIRD_PARTY_NOTICES_GENERATION_v1.0`
