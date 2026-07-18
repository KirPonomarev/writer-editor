# TOOLBAR_LIGHTWEIGHT_CONTROL_TEXT_300_004

STATUS: OWNER_APPROVED_CANONICAL_BASELINE
OWNER_DECISION_DATE: 2026-07-18

## Objective

Make the main formatting toolbar visibly lighter after owner review found the existing text weight too heavy, without weakening icon clarity or changing geometry.

## Delivered contract

- One `--toolbar-chrome-control-font-weight` token owns toolbar control text and is set to 300.
- Font family, font weight, font size and line-height values use the same light token in both orientations.
- Vertical paragraph and list labels use the same token.
- Phosphor icon weight, popup menu typography and editor typography remain unchanged.
- DPR-snapped metrics, zero letter spacing, orientation-aware scale projection and width tuning remain unchanged.

## Visual proof

- Controlled Retina A and B captures use the same current runtime, minimal profile, `28`, `1.0`, 1440 by 782 viewport and 580 by 48 toolbar geometry.
- The only A and B variable is the control text token: 400 versus 300.
- The 300 proof reports computed weight 300 for both `28` and `1.0`, DPR 2, shell transform none and shell zoom 1.

## Scope truth

This contour changes only the font weight of toolbar control values and vertical field labels. It does not alter toolbar functions, icons, menus, editor content, storage, import, export or dependencies.

## Canonical decision

The owner accepted the 300 proof as the retained main-toolbar baseline. Future sidebar work remains an independent design layer and cannot change this toolbar baseline by implication. Any replacement requires a separate owner-approved UI contour with a controlled comparison.
