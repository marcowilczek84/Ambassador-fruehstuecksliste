# Personal employee access — server adapter preparation

Based on actual live source de5b310251e60fe7577166a29c82f31d67643524. Disabled by default.

Prepared same-origin personal access handler and native Supabase data relay. No client database token is returned. Existing application UI and financial logic are preserved.

Local adapter configuration tests: 2 passed. Native data relay tests live in the isolated HUB branch. Full breakfast build/regression/browser tests are still open.

NOT COMPLETE: frontend session wiring, native Supabase issuer registration, identity policies deployment, complete end-to-end flow. No deployment, database change or activation performed. Do not enable MODULE_SSO_ENABLED until those pass.
The existing guest-memory device restriction remains required. Photo import/export permission is gated when personal access is enabled.
