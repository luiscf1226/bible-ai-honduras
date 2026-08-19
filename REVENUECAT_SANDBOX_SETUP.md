# RevenueCat sandbox — Pro $4.99/month

**Status: deferred — no action required now.** This repository does not yet contain an Expo app, so creating store products or a RevenueCat project would not unblock development. Resume this task once the Expo app has final iOS bundle ID and Android application ID, before beta testing.

**Decision when resumed:** start with RevenueCat **Test Store**. It proves the app's purchase, entitlement, restore, and paywall logic without an Apple or Google developer account. Before store submission, repeat the same checks with Apple's and Google's real sandboxes. Test Store is not a production substitute.

## Product contract (keep these names stable)

| RevenueCat object | Value |
| --- | --- |
| Entitlement ID | `pro` |
| Offering ID | `default` (mark as Current) |
| Package | Monthly (`$rc_monthly`) |
| Test Store product ID | `pro_monthly` |
| Price / duration | USD $4.99 / 1 month, auto-renewing |
| iOS + Android product ID | Decide once the real bundle/package ID exists; recommended pattern: `<reverse-domain-app-id>.pro.monthly` |
| Trial / introductory offer | None in v1 — add only after deciding the retention and margin policy. |

The code should unlock the four paid modules only when `CustomerInfo.entitlements.active.pro` exists. It must not gate Pro on a product ID, price, or a client-maintained Boolean.

## Do this now — no Apple/Google setup required

1. Create one RevenueCat project for this app and keep development and production under it.
2. In **Product catalog → Test Store**, create `pro_monthly`: USD 4.99, one-month subscription.
3. Create the `pro` entitlement and attach `pro_monthly`.
4. Create the `default` offering; add a Monthly package containing `pro_monthly`; make the offering Current.
5. Record the Test Store SDK key only in local/build environment configuration. Do not commit it, even though it is a public client SDK key.
6. When the Expo app exists, install `react-native-purchases` (and optionally `react-native-purchases-ui`), use React Native SDK **9.5.4 or newer**, and make an Expo development build. Expo Go only mocks RevenueCat APIs and cannot make a real Test Store or store purchase.
7. Initialise Purchases after the app knows the signed-in account's stable internal user ID. Use that non-PII ID as RevenueCat's App User ID; do not use email or a display name. If anonymous use is needed before sign-in, call `logIn(internalUserId)` after authentication.
8. Build one subscription service/provider that: loads `currentOffering`, purchases its Monthly package, calls `restorePurchases`, listens for CustomerInfo changes, and exposes only `isPro` to the UI. The backend must enforce free quotas independently; never trust a client-only Pro flag.
9. Test in Test Store: success, cancel, error, restore, app restart, sign-out/sign-in, entitlement expiration, and each of the four Pro gates. Test Store's one-month subscriptions renew every five minutes and expire after five renewals.

At this stage, there is no real charge, no Apple Developer Program enrollment, and no Google Play Console account needed.

## Defer until the app is buildable

There is currently no Expo/source code on `master`, so do **not** open store products yet. Product identifiers cannot be reused after deletion on Apple, and both store configurations need the final app identity. Do them when the Expo configuration has final iOS bundle ID and Android application ID, but before beta/release work.

### iOS real sandbox / App Store Connect

You will need:

1. An Apple Developer Program account and an App Store Connect app using the final bundle ID.
2. The Paid Applications Agreement accepted, plus required tax and banking forms. Apple/RevenueCat state these are required even to test IAPs.
3. One subscription group (for example, `Bible AI Pro`) and one Auto-Renewable Subscription using the decided product ID, one-month duration, US price $4.99, localization, availability, and reviewer screenshot/notes.
4. A sandbox Apple Account and an iOS simulator (iOS 14+) or physical device with Developer Mode for the development build.
5. In RevenueCat: an Apple App Store app configuration with the final bundle ID, App Store shared secret, In-App Purchase key, and preferably App Store Connect API key; import the Apple product and attach it to the same `pro` entitlement and Monthly package.

An iOS product in **Ready to Submit** can be used in sandbox/TestFlight; App Review approval is needed for production sale. Store changes can take time to appear in sandbox, so leave buffer before a demo.

### Android real sandbox / Google Play

You will need:

1. A Google Play Console developer account and an app using the final Android application ID.
2. A signed AAB/APK uploaded to an internal or closed test track; a closed track with the test account opted in is the most conservative RevenueCat flow. Make the test release available in at least the tester's country.
3. A monthly subscription with the decided product ID and $4.99 USD base-plan price. Keep the Android product in the same RevenueCat `pro` entitlement and Monthly package.
4. The testing Google Account added both to the test track and to **Settings → License testing**. On the device, use one licensed Play account, a PIN, and the Play Store. Open the track's opt-in URL.
5. In RevenueCat: a Google Play app configuration with the exact package name and Google service-account credentials granted the required Play Console/API permissions. Keep the JSON credential out of the repo and CI logs.

Google test subscriptions renew every five minutes for a one-month product and end after six renewals. Test approved and declined payment, renewal, cancellation, grace/account-hold behavior, restore, and expiration.

## Required before release (not later than this)

- Replace the Test Store key with each release build's platform-specific RevenueCat SDK key. A Test Store key must never ship to App Store or Play Store.
- Fetch package/product data and display the store-provided localized price string in the paywall; do not hard-code `$4.99` as the checkout price.
- Add a visible **Restore purchases** action and a Terms/Privacy link in the paywall.
- Configure RevenueCat webhooks to the backend (or securely refresh RevenueCat CustomerInfo server-side) so quota enforcement remains correct across devices and app reinstalls.
- Run a real Apple sandbox purchase and real Google license-tester purchase, then verify it appears as sandbox data in RevenueCat, unlocks all Pro modules, persists through restart, restores after reinstall/sign-in, and revokes after expiry.
- Verify Apple/Google agreements, tax, and banking are complete, and submit IAP metadata alongside the app for review.

## Cost / cap to plan for

RevenueCat's current public plan is free up to **$2,500 monthly tracked revenue (MTR)**, then **1% of tracked revenue**. Sandbox/Test Store activity does not create sale revenue. At $4.99/month, $2,500 is about **501 active monthly subscribers** before that threshold. The PRD goal of 1,200 subscribers corresponds to $5,988 monthly gross; at the advertised 1% rate, RevenueCat would be about **$59.88/month**, in addition to Apple/Google store commission and taxes. Re-check this at account creation because pricing can change.

## Sources checked — 19 August 2026

- [RevenueCat product, entitlement, and offering setup](https://www.revenuecat.com/docs/projects/configuring-products)
- [RevenueCat Test Store](https://www.revenuecat.com/docs/test-and-launch/sandbox/test-store)
- [RevenueCat Expo integration](https://www.revenuecat.com/docs/getting-started/installation/expo)
- [RevenueCat identity guidance](https://www.revenuecat.com/docs/customers/identifying-customers)
- [RevenueCat launch checklist](https://www.revenuecat.com/docs/test-and-launch/launch-checklist)
- [RevenueCat Apple product setup](https://www.revenuecat.com/docs/getting-started/entitlements/ios-products) and [Apple sandbox testing](https://developer.apple.com/help/app-store-connect/test-in-app-purchases/overview-of-testing-in-sandbox)
- [RevenueCat Google Play sandbox](https://www.revenuecat.com/docs/test-and-launch/sandbox/google-play-store) and [Google Play Billing testing](https://developer.android.com/google/play/billing/test)
- [RevenueCat pricing](https://www.revenuecat.com/pricing)
