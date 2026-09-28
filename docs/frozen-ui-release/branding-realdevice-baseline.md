# Branding / physical iPhone restfix — baseline and permitted delta

- Branch: ambassador-final-uiux-20260927
- Remote and local HEAD verified: 5d4b35b75d1aaa734c476310f80365cdb0eab1f1; no newer commit, no reset.
- Preview: https://ambassador-fruehstuecksliste-nufrk0ypk-restaurant-silk.vercel.app/index-live.html
- Deployment: dpl_2HdDBegpqDgJ7auK8o8StCUmAPPn, READY, Preview.
- Production remains dpl_29za56884wS1msm4zdJNBjeEbuPc / 534119f0e6ccbe8b36050337b630737db206af2e.

## Investigation before product edits

A fresh browser request to the exact Preview renders the approved inline SVGs:
`person-tablet` and `person-counter`, viewBox `0 0 32 32`; no role-icon pseudo-elements.
The physical iPhone report of old icons is accepted as an unresolved delivery discrepancy;
it is NOT reproduced in this fresh context. A device cache cause is plausible, not proven.
The existing script URL is still `/workflow-polish.js?v=8.39.2`; the stylesheet is
`/final-design.css?v=20260927`. Release-specific content versions will remove this ambiguity.
The SVG geometry and role chooser layout do not need re-drawing.

The active HTML splash has a three-steam outline coffee SVG from the recovered application.
The active favicon SVG also has the obsolete outline contour. The active Apple touch image
is linked from HTML. There is no manifest link or active manifest/PWA icon set in this app.
No inactive legacy files or recovered business application will be modified.

The add-room textarea receives a petrol border on :focus plus a shadow and a separated
:focus-visible outline. These are multiple simultaneous contours. Keep a clearly visible
2px petrol outline at offset -1px over the existing border and remove only the redundant
shadow; preserve focus behavior and keyboard accessibility.

## Soll/Ist and boundaries

| Area | Baseline finding | Permitted change |
|---|---|---|
| Hybrid C | Correct fresh DOM, physical discrepancy | Content-versioned script delivery, exact SVG proof |
| Chooser | Frozen, approved | Zero geometry or visual change outside icon boxes |
| Splash | Old outline cup | Existing filled asset as presentation, no timing/layout change |
| System icons | Old active SVG/PNG | Same existing paths at scale 0.83, centered on petrol |
| Manifest | No active manifest | Document N/A; do not create new PWA behavior |
| Name field focus | Border + glow + offset outline | One visible accessible petrol contour |
| Field groups/footer | Approved | Byte-identical existing rules; geometry regression |
| Animation | 4700 ms standard / 80 reduced | No code change |
| Recovered app/backend | Frozen | Byte-identical; all test data browser-local, Supabase blocked |
