# TOOLBAR_QUIET_CONTRAST_REBALANCE_003

## Objective

Correct the owner-visible heaviness introduced by the optical sharpness contour without changing toolbar geometry, font weight, metric projection or layer boundaries.

## Delivered contract

- Light-theme toolbar ink returns to the previous quiet opacity ladder.
- Light-theme field surfaces, borders, inset and shadow return to their previous low-noise values.
- Numeric weight remains unchanged; the perceived boldness was caused by higher opacity rather than a font-weight mutation.
- DPR-snapped metric rendering, zero letter spacing, orientation-aware projection and native popup and transform layers remain unchanged.

## Verification

- Targeted toolbar tests pass.
- Renderer build passes.
- Retina DPR 2 proof confirms shell transform none and shell zoom 1 after the contrast rebalance.

## Scope truth

This contour changes light-theme toolbar chrome tokens and their contract assertions only. It does not alter editor rendering, toolbar behavior, project data, import, export or dependencies.
