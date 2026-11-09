# Vesphe – setup & deployment checklist

Do these in order. Supabase project ref: `cniefqlzdrszzardacap`.

## 0. Tools (new laptop)

```sh
npm install -g eas-cli
npx supabase login
npx supabase link --project-ref cniefqlzdrszzardacap
eas login
```

## 1. Rotate leaked keys

`EXPO_PUBLIC_PAYSTACK_SECRET_KEY` was bundled into earlier app builds. In Paystack →
Settings → API Keys, **generate a new secret key**. Vesphe uses Paystack for all payments.

## 2. App environment (.env + EAS)

Copy `.env.example` to `.env` and fill in the 4 public keys. EAS cloud builds do not read
your local `.env`, so add the same keys to EAS:

```sh
eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://cniefqlzdrszzardacap.supabase.co" --environment development --environment preview --environment production --visibility plaintext
eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<anon key>" --environment development --environment preview --environment production --visibility plaintext
eas env:create --name EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY --value "<pk_...>" --environment development --environment preview --environment production --visibility plaintext
eas env:create --name EXPO_PUBLIC_GOOGLE_MAPS_API_KEY --value "<maps key>" --environment development --environment preview --environment production --visibility plaintext
```

## 3. Function secrets

```sh
npx supabase secrets set PAYSTACK_SECRET_KEY=sk_live_xxx
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxx   # optional: AI dish auto-fill
```

Without `ANTHROPIC_API_KEY`, vendor auto-fill still works for the ~50 common dishes built
into the app; other dishes ask the vendor to type ingredients.

## 4. Database

Run both migrations (CLI: `npx supabase db push`, or paste each file into
Supabase → SQL Editor and run, in this order):

1. `migrations/20261023000000_security_hardening.sql`: blocks clients from writing roles,
   approvals, wallet balances, payment status, rewards and menu approval.
2. `migrations/20261024000000_pro_and_dish_details.sql`: dish ingredient/allergen/meal-time
   columns, Vesphe Pro subscriptions and admin-set Pro prices.
3. `migrations/20261025000000_direct_vendor_payouts.sql`: vendor Paystack subaccounts
   (no more wallet). See the note at the bottom of that file about disabling any old
   trigger that still credits `vendor_wallets`.

Test on a staging project first if you can: signup, checkout (cash + card), vendor
accept/reject, refund, payout, promotion purchase, Pro purchase, menu approval, and the
logistics app's rider flows (it shares these tables).

## 5. Edge functions

```sh
npx supabase functions deploy verify-bank setup-subaccount init-payment verify-payment process-refund delete-account suggest-dish-info
npx supabase functions delete request-payout   # old unauthenticated transfer endpoint
npx supabase functions delete payout           # vendor wallet withdrawals (replaced by split payments)
npx supabase functions delete create-recipient # replaced by setup-subaccount
```

`process-withdrawal` (admin Withdrawals screen) is not in this repo. If it is deployed,
make sure it checks that the caller is an admin.

## 5b. Vendor payouts (Paystack split payments)

There is no vendor wallet any more. On every card payment, Paystack sends the vendor's
share straight to their bank (their "subaccount"), usually the next business day. Your
commission and the delivery fee stay in your Paystack balance. Cash orders work as before.

- Existing vendors: each must open **Settings → Bank details → Verify** once (or an admin
  can do it in Admin → Vendors). Until then their store can't take card payments; customers
  see a message and can pay cash.
- Wallet balances vendors already have must be paid out one last time, manually.
- Refunds on split payments come out of your Paystack balance, including the vendor's
  share if it has already settled. Keep enough balance to cover refunds.
- The app no longer needs `EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY`: payments start on the server.

## 6. Google sign-in

1. Google Cloud Console → APIs & Services → OAuth consent screen: set app name, support email, logo.
2. Credentials → Create credentials → OAuth client ID → **Web application**.
   Authorised redirect URI: `https://cniefqlzdrszzardacap.supabase.co/auth/v1/callback`
3. Supabase → Authentication → Providers → **Google**: enable, paste the Web client ID and secret.
4. Supabase → Authentication → URL Configuration → Redirect URLs: add `vesphe://auth-callback`.

Google sign-in only works in a development or store build. Expo Go can't open `vesphe://` links.

## 7. Run the app (Expo SDK 58)

The project is on Expo SDK 58 (React Native 0.88), matching the current Expo Go.

```sh
npm install
npm start            # Expo Go: scan the QR code with Expo Go (SDK 58)
npm run start:dev    # development build (after: eas build --profile development --platform android)
```

In Expo Go, push notifications are switched off (Expo Go can't receive them). Google
sign-in works if you add `exp://**` to Supabase → Authentication → Redirect URLs.
Use a development build to test push notifications and the real `vesphe://` link.

Android release builds now minify with R8. If something works in development but crashes
in a release build, a library probably needs a ProGuard keep rule.

Delete `yarn.lock` (keep `package-lock.json`): it is out of date, and EAS uses yarn when
it finds it, which breaks the build.

## 8. Paystack webhook (recommended, later)

Card payments are confirmed by `verify-payment` right after checkout and retried when the
customer opens the order. A `charge.success` webhook would also cover customers who close
the app mid-payment.

## 9. Admin sign-in code (2-step login)

Admins now enter a 6-digit code emailed to them after their password, on the web dashboard
and in the app. The code is sent by Supabase Auth, so the email must show the code:

1. Supabase dashboard → Authentication → Emails → **Magic Link** template.
2. Make sure the body contains `{{ .Token }}`, e.g.
   `<p>Your Vesphe sign-in code is <strong>{{ .Token }}</strong>. It expires in 1 hour.</p>`
3. Authentication → Emails → SMTP settings: set up your own SMTP (e.g. Resend, Brevo, Zoho).
   Supabase's built-in mailer only sends a few emails per hour and may only deliver to
   project team members, which would block admin codes and password resets.

A code-verified session lasts 12 hours, then the admin is asked for a new code. The new
report, rider and refund-review database functions refuse admin sessions without the code.

## 10. Push notifications

- Every in-app notification is now also pushed to all of the user's phones (Expo push
  service, sent from the database). Nothing to configure for Android/iOS beyond the
  existing EAS credentials (`google-services.json` / FCM key for Android, APNs key for iOS:
  `eas credentials`).
- If you turn on "Enhanced push security" in the Expo dashboard, pushes will be rejected —
  leave it off (or tell me and I'll add the access token).
- Push only works in a development/production build, not in Expo Go.
- `send-notification` (the old relay) is no longer used by the database. Delete it once the
  rider app no longer calls it.
