# Real-device restfix, 2026-09-28

Starting branch: ambassador-final-uiux-20260927. Local and fetched remote commit: 2486e21c11b4212b3904655244a20f9959f51907. Clean working tree before changes. The final audit was read: 86 PASS, 0 FAIL, one not applicable, 116 screenshots. Original 25 PASS invariants remain mandatory.

User's eight new findings authorize only the corrections below. No other design work, production deployment, database work or business-handler changes. The new short service-entry transition explicitly replaces the earlier no-transition direction for this one entry.

| Finding | Observed cause / current state | Target |
|---|---|---|
| Reception entry | Native role entry already opens app directly; initial empty render and stale one-time toolbar resemble an intermediate page | Same actual list workspace immediately; summary follows rendered rooms |
| Empty reception | Hiding search moves content into the fixed 64px search grid track | Empty message in remaining workspace height; existing upload action retained |
| Mobile list | Legacy people width 48px overflows its 34px track, overlapping names by 6px; room number also exceeds its track | Explicit three tracks and bounded children with positive name/people gap |
| Reception menu | Icon is hidden but two-track menu remains; text auto-places in 44px icon track | Text occupies full available row width; Service menu unchanged |
| View dates | View adapter copies raw ISO date input values | Localized display only, original values unchanged |
| Service edit header | Legacy sticky header/flex body and outer overlay scrolling allow Safari focus/scroll ambiguity | Static header sibling, one body scroller, initial label visible, footer unchanged |
| Success remark | Existing normal note uses warning styling and heading | Note text preserved, quiet label/separator, no warning icon |
| Service transition | Native direct entry bypasses old entry-secondary animation hook | Reuse existing transition visuals for <=650ms, non-blocking, reduced-motion aware, no request |

Evidence: user's written real-iPhone findings and IMG_6621 through IMG_6636; reviewed together and cross-checked against computed browser bounds. Final verification includes the original Chromium audit and targeted Chromium/WebKit checks. Emulation must not be called a real iPhone retest. Synthetic check-in/import submission is allowed only inside isolated test contexts with every Supabase request aborted, to verify the requested success/transition states. No hotel data is modified.

First targeted CI findings: the iPad date assertion read before the view adapter had inserted its `dd` elements (empty array, original ISO inputs correct); it now waits for the actual data view. The Linux WebKit run emitted errors outside the application source involving `navigator.storage.persisted`; the Vercel feedback toolbar is excluded from the isolated browser test, and stack traces are retained for any remaining runtime error. Network abort errors explicitly caused by blocked Supabase requests are recorded separately as isolation evidence. The synthetic success test waits for the existing native selected-table state before submitting. Any failed phase now captures its visible state and synthetic room snapshot for diagnosis. No application business handler is modified by these test corrections.
