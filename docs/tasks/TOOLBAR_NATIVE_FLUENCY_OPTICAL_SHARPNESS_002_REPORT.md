# TOOLBAR_NATIVE_FLUENCY_OPTICAL_SHARPNESS_002

## Objective

Close the owner visual rejection of the technically sharp but compositionally soft literal metric-scale toolbar while preserving the existing toolbar layers and persisted controls.

## Evidence synthesis

- Obsidian sharpness planning defines sharpness as a combined rendering, metric, typography and composition property rather than a filter or post-processing effect.
- Repo native-fluency canon keeps toolbar chrome separate from the editor viewport, popup layer and transform handles.
- The 1:1 Retina review showed sharp rasterized text and SVG edges, but literal upper-range metric growth made fields, radii and whitespace oversized and reduced perceived clarity.

## Delivered contract

- Persisted toolbar scale remains bounded to 0.5x–2.0x with a 0.05 step.
- Horizontal content metrics project to 0.8x–1.15x; vertical content metrics project to 0.75x–1.35x.
- Padding, gaps and radii use square-root optical projection so chrome rhythm grows more quietly than content.
- All projected metrics remain snapped to device-pixel steps.
- Width scale, popup menus, transform handles, the editor sheet and the left system toolbar remain independent layers.
- Toolbar text uses zero letter spacing and native font smoothing; light chrome contrast is restored without filters or fake scaling.

## Verification

- Targeted toolbar tests: 25 passed, 0 failed.
- Sector M tests: 361 total, 306 passed, 55 skipped, 0 failed.
- OSS policy: passed.
- Full repository test command: passed with current-wave and strict-lie guards clear.
- Retina proof: DPR 2; shell transform none; shell zoom 1.
- Horizontal state 2.0 proof: 1149.5 by 55 CSS pixels, 15 pixel control text, 18.5 pixel icons and 37 pixel fields.
- Vertical state 2.0 proof: 216 by 504.5 CSS pixels, 17.5 pixel control text, 21.5 pixel icons and 43 pixel fields.

## Scope truth

This contour changes only toolbar optical projection and chrome readability. It does not alter editor sheet rendering, project storage, recovery, import, export, command capabilities or dependency policy.
