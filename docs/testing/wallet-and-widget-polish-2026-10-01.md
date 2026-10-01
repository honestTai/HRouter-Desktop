# Wallet, usage timing, and desktop widget polish — 2026-10-01

## Reference and scope

Reviewed the current local `sub2api` checkout, including commit `08d8bae544359c05a3c224a3f725dd1f7b0c6781` (2026-10-01 09:17 +0800, `fix(wallet): remove unreliable token estimate`). The reference repository was read only; no files were modified there.

Primary references: `WalletView.vue`, `RechargePresetGrid.vue`, `RechargeOrderSummary.vue`, `useRechargeCheckout.ts`, `paymentFlow.ts`, `rechargeRebate.ts`, and the gateway `/v1/usage` response builder. Existing unrelated working-tree changes in HRouter Desktop were retained.

## Changes

- Removed wallet reference-model selection, hardcoded 96% cache assumptions, Token predictions and official-price comparisons, including their unused model queries.
- Matched the reference rebate percentage contract (5 means 5%), half-open tier upper bounds, maximum 10% rebate and multiplicative base credit rate. Added cent-ceiling fee and expected credit summaries. Order results remain authoritative.
- Normalized direct payment aliases, retained canonical-method precedence, filtered unavailable presets, and switched to a compatible payment method when possible. A disabled balance recharge does not disable code redemption.
- Recharge buttons now have explicit column layout, wrapping, responsive spacing and pressed state. Failed/loading balance queries no longer appear as a zero balance.
- Provider search is in the provider list rather than viewport-fixed. Closing it clears the filter so an invisible search cannot hide providers.
- Skills import list has top/bottom padding, card gaps, readable two-line descriptions, visible paths and named checkboxes.
- Request duration and first token are independently labeled and retain millisecond precision. Full duration takes precedence over latency. Missing session timing is explicitly marked, not estimated from conversation event timestamps. HRouter usage rows reuse the same timing component.
- Speed sampling filters valid measured requests before applying the 20-row limit, so newer session imports cannot crowd out timed samples.
- Floating monitor distinguishes measured output speed (tok/s), server-reported key throughput (tok/min), key lifetime spend, actual daily charge, and wallet balance. A balance-only wallet does not invent a used quota or quota maximum. Subscription quota windows remain separate.
- Native WidgetKit extension displays selected-Agent tokens/cache/speed and returned HRouter spend/balance, with small, medium and large sizes. The main window updates its scalar snapshot even when the floating monitor is closed. Snapshot files contain no API keys, endpoints or session contents; financial data must match Agent/provider/revision. Old-day Agent snapshots and stale finance are not displayed as current.

## Verification

- TypeScript typecheck passed.
- Frontend: 143 test files, 924 tests passed.
- Rust library: 2446 passed, 5 ignored.
- Swift WidgetKit release compilation passed (arm64, macOS 12 target).
- Added regressions for timing precision/missing values, search placement/reset, import spacing, removed token estimates, vertical amount cards, rebate boundaries, fee rounding, method aliases, finance semantics and pre-limit speed sampling with Agent isolation.
- No real payment was placed; account financial values were verified against source contracts and test fixtures, not a live transaction.
- No automated GUI screenshot acceptance was performed. The native widget's actual system-scheduled refresh and installation should be checked in the signed test build. WidgetKit refresh is not equivalent to the floating window's polling interval.

## Manual acceptance

1. Quit the previous application and install the new DMG. Keep existing configuration.
2. Search providers, type a filter, close it, and confirm the full list returns. Check narrow and wide window layouts.
3. Open Skills → Import Existing: the first card must not touch the header, long descriptions should wrap, and footer actions must stay reachable.
4. Wallet: no Token estimate or reference model. Check amounts on both sides of a tier boundary, fee and credited preview, and returned order amount. Do not confirm a paid transaction unless intended.
5. Usage: session-only rows show timing unavailable; a measured proxy request shows distinct duration/first-token labels. HRouter request rows use returned server timings.
6. Floating monitor: lifetime spend and balance remain separate; a missing measured speed does not become a fake tok/s value. Key throughput is explicitly labeled tok/min.
7. On supported macOS versions, add HRouter via Edit Widgets (Notification Center on earlier systems), choose a size, and switch Agent in the app. Check update timestamps. The floating monitor remains available separately.

## Known boundaries

- Historical Codex token-only session logs cannot reconstruct genuine HTTP latency/TTFT. Direct traffic not observed by the proxy is not retroactively timed.
- `/v1/usage` exposes key-wide throughput, not individual request generation speed; these are intentionally not conflated.
- This is not a full port of every sub2api subscription/SDK-based payment flow. Existing unsupported SDK-only payment handling is unchanged.
- The macOS test package is Developer ID signed but has not been Apple notarized. No update artifacts or public release were published.
