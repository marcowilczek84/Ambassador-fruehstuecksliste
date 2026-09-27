# Frozen UI release — implementation and acceptance boundary

Canonical instruction: complete 37-section specification supplied on 2026-09-28. Baseline branch `ambassador-final-uiux-20260927`, commit `81627e259252d6bf2dd8ba533af1619d492cfe26`.

Before implementation, the preceding 71-screenshot audit was read: 25 PASS, four FAIL, one not applicable. Its app code matches the baseline commit; intervening commits only added audit scripts.

| Prior finding | Required result | Presentation change |
|---|---|---|
| iPhone row geometry varied (76/94 px) | Same geometry for all states | One fixed row geometry, explicit child positions |
| iPhone status lines touched | Positive measured gap | Per-row 4 px line with 8 px top/bottom insets |
| iPad column 50–58 lacked room 55 gap | Empty, inert, equal-height placeholder | Empty presentation node before room 56 |
| iPad reception click 21 blocked by another column | Normal clicks; stable list | Flatten column wrappers with `display: contents`; confine detail layer to right pane |

The final CSS consolidates the permitted surfaces in one scoped presentation layer. Original Ambassador/Meili assets and the existing font remain. The read-only reception view displays the existing edit-form values; its Edit button reveals the original controls and handlers. No React-owned node is moved. The recovered application, database configuration, synchronization, parsing, persistence, translations and business handlers remain unchanged.

The existing GitHub Actions workflow and Playwright audit path are retained. The workflow builds, resolves a successful non-production deployment for its exact commit, then tests 390×844, 1024×1366 and 1440×900. Screenshots use browser-local synthetic guests; all Supabase requests are blocked. No save, import acceptance, check-in, deletion or finish confirmation is submitted. Unreachable states are reported explicitly. Technical invariant failures fail the workflow.

Acceptance remains pending until the final preview audit and external visual review. No Production deployment is authorized by this release task.

## Controlled corrections after the first Preview audit

Preview commit `4de9900b1fb884b9eb48890d6d0544710c7f1af9` produced 103 screenshots. All four P1 checks and all 25 preceding PASS invariants passed. New checks found the iPhone check-in/special footer 7 px below the viewport and the legacy import footer inside its scroll body. The corrected layout removes overlay padding on phones and makes the existing import list the sole scroll region, without moving React nodes. Opera's text wrapper is made block-level to match the external type control.

The new confirmation coverage also exposed a pre-existing presentation dispatch error: Service's menu tried to find Finish in the native menu, although its existing native action is in the footer. The menu now forwards to that same footer handler; confirmation, roles and business logic are unchanged. The audit now recognizes legacy confirmation sections that have no ARIA dialog role. The next complete CI run is the release candidate; this initial run is retained as diagnostic evidence.
