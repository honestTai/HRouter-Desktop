# HRouter account workspace and desktop usage widget — 2026-10-01

## Reference and boundaries

Read the user-referenced `/Users/honesttai/Documents/GitHub/sub2api` project without modifying it. Relevant contracts were checked in:

- `frontend/src/api/auth.ts` and `frontend/src/types/index.ts`: temporary TOTP challenge vs authenticated session; `/auth/login/2fa` payload.
- `frontend/src/api/payment.ts`, `frontend/src/types/payment.ts`, `frontend/src/views/user/WalletView.vue`: checkout limits, order lookup and verification, payment currency and pending/credited states.
- `backend/internal/handler/gateway_handler.go`: API-Key `/v1/usage`, actual daily charge, wallet balance, quota and rate-limit windows.

No real account was logged into, no payment was made, and no user's real Agent configuration was changed for verification. WebDAV/S3 implementations are retained; their settings component remains unmounted and no new remote-sync entry or enablement was added.

## Account workspace

- Exactly one HRouter entry appears immediately after Skills when a provider contains a literal Key and an actual HTTPS HRouter endpoint. The existing endpoint/credential detector is retained; display names and website metadata do not enable the entry.
- The unauthenticated entry renders the React login form, not private account queries. Existing valid sessions can go directly in. Successful login mounts Home with dashboard and usage records together.
- API Keys, Profile, Payment and Orders are child views of one workspace, using shared React components and a breadcrumb. No account-page iframe was introduced. Top-level duplicate account navigation was removed; the generic usage page remains Agent analytics.
- Logout or Key removal unmounts private pages. A new login starts at Home. TOTP challenges remain in component state and are never stored as authenticated sessions.
- API Key import includes all registered Agent IDs.
- Payment amount validation checks positive finite amounts, method availability, disabled recharge and both global/method bounds. Orders are polled while pending. `PAID` and `RECHARGING` do not mean balance credited; `COMPLETED` refreshes balance/orders. Manual verification uses the authenticated order API, not the former “done” dismissal as evidence of payment.
- Actual charged order currency is displayed. Only HTTPS payment links without embedded credentials can be opened; QR content is rendered as an image. SDK-only payment responses without a QR/link are reported as unsupported, not silently treated as a working checkout. Orders can be cancelled from Orders and recreated with another method.

## Desktop widget

- A dedicated Tauri `usage-widget` window renders React rather than a second complete App. Native resize, maximize/restore, minimize, close and optional always-on-top are available. Text density can be adjusted independently from 75% to 150%.
- `skip_taskbar(false)` preserves the Windows taskbar entry. The main window's close-to-tray policy is not applied to this window.
- Main Agent changes reach the widget by targeted event and shared preference changes. The widget uses exact Agent IDs with no default-to-Claude fallback for unsupported/missing provider state. Theme/language preferences propagate between windows.
- Every 5 seconds the widget queries the same usage database/aggregation as analytics. Session import refreshes every 60 seconds. Token bars show composition and cache-hit ratio, not invented quotas.
- Generation speed uses up to 20 recent completed single requests in a 5-minute window, with valid timing, excluding first-token wait. Failed, old, aggregate and zero-duration rows are excluded. The bar explicitly labels its 100 tok/s reference scale; it is not a provider limit or an instantaneous streaming-speed promise.
- Financial data is separate from model-price estimates. The currently selected provider and a configuration revision identify each query. Agent/provider changes do not reuse another scope's cached balance. If there is no single current provider (e.g. additive configurations), no arbitrary Key is chosen.
- HRouter finances are fetched by the backend from the fixed HTTPS Key-usage endpoint with redirects disabled, a timeout and bounded response size. No key enters window URLs, events or widget snapshot payloads. `usage.today.actual_cost` is used for daily spend, not model cost, lifetime spend or account-wide totals.
- Other enabled provider usage queries retain their existing adapters. Explicit `extra.todayCost` can supply daily spend; a generic `used` amount is never relabeled as today. Unknown totals have no percentage bar, and missing daily spend remains absent rather than zero.
- Query errors are visible. The widget does not publish estimated usage cost as real provider charges.

## Verification

- TypeScript: passed.
- Frontend: 143 test files / 916 tests passed.
- Rust library: 2,444 passed / 5 ignored / 0 failed.
- Production renderer build and macOS debug native build passed. The pre-existing large renderer-chunk warning remains.
- Added tests cover Key-gated placement, the unified breadcrumb workspace, login/TOTP isolation, payment bounds/states/URL validation, independent widget controls, Agent/finance isolation, unknown quotas, theme synchronization, API-Key cost parsing, credential schemas and valid speed samples.

## Not claimed as verified

- No Windows machine was available for native taskbar, resize, multi-monitor or display-scaling acceptance. The cross-platform Tauri implementation and renderer behavior are covered, but Windows runtime acceptance remains required.
- No real-account login/payment end-to-end acceptance or GUI screenshot acceptance was performed in this change.
- This is a standalone desktop window, not a macOS WidgetKit extension or a Windows OS widget-provider package.
- The full website's OAuth/captcha and provider-specific Stripe/Airwallex embedded SDK flows were not ported in this change. Password/TOTP login and QR/HTTPS checkout use the reference contracts; SDK-only checkout is explicitly reported rather than faked.
- New native commands require the rebuilt desktop backend; hot-reloading only the renderer into an older running preview cannot open the widget.

The isolated `/tmp/HRouter UI Preview.app` bundle was updated atomically and ad-hoc signature verification passed. The running process was not stopped/relaunched; quit and reopen that preview to load the new native commands. The production app bundle was not changed.
