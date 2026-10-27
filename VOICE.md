# Voice ordering — "Hey Vesphe" (Vesphe Pro Max)

Customers order hands-free: Vesphe listens, suggests dishes that suit their health
profile and the time of day, fills the cart, reads back the total and places the order
after a clear "yes" — cash on delivery (under ₦10,000) or a saved card.

Voice is part of **Vesphe Pro Max** (Pro + voice). Every customer gets a free trial of
3 voice orders (admin setting), then needs Pro Max.

> **Expo Go can't run voice.** Speech recognition and the wake word are native modules
> that Expo Go doesn't include. In Expo Go the mic button explains this. To use voice you
> need your own build of the app (steps 5–6 below).

---

## Step-by-step setup

### 1. Anthropic (the AI that understands orders) — required

1. Go to <https://console.anthropic.com> and sign up (use the business email).
2. **Settings → Billing**: add a card and buy credits (start with $5–10; it lasts a long
   time on Claude Haiku 5.5: $0.10 per million input tokens, $0.50 per million output).
3. **Settings → Limits**: set a monthly spend limit (e.g. $20) so a bug can never run up
   a big bill.
4. **API keys → Create key**, name it `vesphe-supabase`, copy it (starts with `sk-ant-`).
   You only see it once.

### 2. Put the key on Supabase — required

In a terminal in the project folder:

```sh
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...your key...
```

Never put this key in `.env` or the app — it stays on the server. (It also powers dish
auto-fill for vendors.) Test: in the app, voice should no longer say "not set up yet".

### 3. Prices and limits — in the web dashboard

Admin → **Settings**:

- **Vesphe Pro Max** monthly/yearly price (default ₦4,500 / ₦45,000) and free voice orders (3).
- **Voice ordering**: replies per day, per Pro Max member per month (default 600 ≈ 60
  orders), and during the trial; the **dollar rate** for cost estimates.

Admin → **Reports → Voice ordering** shows Pro Max revenue vs. the estimated Claude cost.
If the cost gets close to revenue, raise the price or lower the monthly limit.

### 4. Picovoice ("Hey Vesphe" wake word) — optional

Without this, voice still works with the floating mic, the app-icon shortcut and Siri.

1. Sign up at <https://console.picovoice.ai> and copy your **AccessKey** (home page).
2. **Porcupine → Create wake word**: type `Hey Vesphe`, language **English**, train it.
3. Download it for **Android**, then again for **iOS** (two `.ppn` files).
4. Rename them `hey-vesphe_android.ppn` and `hey-vesphe_ios.ppn` and put both in
   `assets/wake-word/`.
5. Add the key to the app environment:
   - `.env`: `EXPO_PUBLIC_PICOVOICE_ACCESS_KEY=your-access-key`
   - EAS: `eas env:create --name EXPO_PUBLIC_PICOVOICE_ACCESS_KEY --value your-access-key --environment production --environment preview --environment development`

Picovoice's free plan is for personal/non-commercial use — get a paid plan before launch.
Customers switch it on in **Profile → Voice ordering → "Hey Vesphe"**.

### 5. Apple (to install on your iPhone) — needed for iOS

1. Join the **Apple Developer Program** at <https://developer.apple.com/programs/>
   ($99/year; personal or company account, approval can take 1–2 days).
2. Install the EAS tool and log in: `npm install -g eas-cli` then `eas login`
   (your Expo account — the project id is already in `app.config.js`).
3. Register your iPhone for test builds: `eas device:create`, open the link on the iPhone
   and install the profile it gives you (Settings → General → VPN & Device Management).

### 6. Build and install the app

**Test build on your phone (recommended first):**

```sh
eas build --profile development --platform ios      # or --platform android
```

When it finishes, open the link/QR code on the phone and install. Then on your computer:

```sh
npx expo start --dev-client
```

and open the project from the installed Vesphe app (not Expo Go).

**Store build (TestFlight / Play Store):**

```sh
eas build --profile production --platform ios
eas submit --platform ios          # uploads to TestFlight / App Store Connect
eas build --profile production --platform android
eas submit --platform android
```

### 7. Try it

1. Sign in as a customer, set a delivery address and (optionally) health conditions.
2. Tap the orange floating mic (drag it anywhere you like) and say:
   *"What's good for lunch?"*, then *"Add one jollof rice"*, then *"Check out with cash"*,
   then *"Yes, place it."*
3. Siri: Shortcuts app → + → "Open URLs" → `vesphe://voice` → name it "Vesphe order",
   then say "Hey Siri, Vesphe order".

---

## How it works

| Part | Where |
|---|---|
| Speech → text | On the phone (`expo-speech-recognition`, Apple / Google recognisers, English (Nigeria)) |
| Text → speech | On the phone (`expo-speech`, the phone's built-in voice) |
| Understanding + recommendations | `supabase/functions/voice-assistant` (Claude Haiku 5.5, thinking off for fast replies). Menu search and health checks run on the server; cart and checkout actions run in the app |
| Access (Pro Max / trial) and metering | `voice_access()`, `voice_usage`, `admin_voice_report()` in the database |
| Checkout | `app/services/voiceOrder.ts` (same pricing rules as the cart), `supabase/functions/charge-saved-card` |
| Wake word | Picovoice Porcupine, on the phone, only while Vesphe is open and the customer switched it on |
| Screen | `app/voice/VoiceAssistantContext.tsx` (voice sheet), `app/voice/FloatingMic.tsx` (draggable mic) |

Safety rails: the assistant only mentions dishes it found in the database; dishes that
clash with the customer's health profile are flagged on the server; it must read back the
items, total, address and payment and hear "yes" before ordering; the app re-checks the
total before placing; daily, monthly and trial limits cap AI cost.

Apple and Google only let Siri and Google Assistant listen while the phone is locked or
another app is open, so "Hey Vesphe" works while Vesphe is open; from anywhere else use
the Siri shortcut or "Hey Google, open Vesphe".

## Not supported by voice yet

Promo codes, rewards/wallet, scheduled orders, and adding a new card or address — the
assistant tells customers to do those on screen.
