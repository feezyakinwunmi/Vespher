# Vesphe — customer promo video

**Length:** 75 seconds (plus a 15-second cut) · **Formats:** 9:16 (Reels, TikTok, Status, Shorts) and 16:9 (YouTube, website)
**Goal:** get people to download Vesphe. **Tone:** warm, confident, quick — a friend telling you about something good.

## Voiceover and on-screen text

Read at a relaxed pace (~2.5 words a second). Timings match the animation; if your read runs
long, change the `seconds` for that scene in `src/customer/script.ts`.

| Time | Scene | Voiceover (say this) | On screen |
|---|---|---|---|
| 0:00–0:05 | Hook | "Ordering food shouldn't be a gamble with your health." | Same words, *gamble* and *health* in orange |
| 0:05–0:08 | Logo | "Meet Vesphe." | Logo · "Food that fits you." |
| 0:08–0:18 | Know your food | "See exactly what's in every dish — ingredients, allergens and dietary tags — before you order." | "See what's really in every dish" · Ingredients / Allergens / Dietary tags |
| 0:18–0:28 | Health check | "Tell Vesphe about your health. Diabetic? Allergic to nuts? We'll warn you before it reaches your cart." | "Warned before it hits your cart" · Diabetes / Allergies / Blood pressure |
| 0:28–0:38 | Vesphe Pro | "With Vesphe Pro, your whole week of meals is planned — the right food for breakfast, lunch and dinner." | "Your week of meals, planned for you" |
| 0:38–0:47 | Pay your way | "Pay by card or cash. Checkout takes seconds, secured by Paystack." | "Card or cash, done in seconds" |
| 0:47–0:59 | Live tracking | "Then watch your rider come to you, live. Your delivery code makes sure only you get your order." | "Watch your rider come to you" · Live map / Delivery code |
| 0:59–1:08 | Updates | "You're updated at every step — and real people are just a message away." | "Updates at every step" · Push alerts / Support chat |
| 1:08–1:15 | End | "Vesphe. Eat smart. Download now." | Logo · "Eat smart." · Download Vesphe |

**15-second cut:** "Know your food — before you order it. See what's in every dish. Get warned if it's not right for you. Track it to your door. Vesphe — eat smart."

**Caption for posting:**
> Ordering food shouldn't be a gamble with your health 🥗 Vesphe shows you what's in every dish, warns you about food that doesn't suit you, and tracks your order live to your door. Download Vesphe today 🧡 #Vesphe #EatSmart #FoodDelivery #HealthyEating #Lagos

## Before you record

1. **Demo store:** in the app, sign up a vendor with `demo.vendor@vesphe.app` (or change the email in
   `demo-data/seed-demo-menu.sql`), then ask Claude to run the seed. Add a good photo to each dish
   from the web dashboard (Vendor → Menu). Bright, top-down food photos look best.
2. **Demo customer:** sign up a customer, set a delivery address, and in the health profile turn on
   **Type 2 diabetes** and **Nut allergy** with warnings enabled. Give them Vesphe Pro (pay once in
   test mode) so the meal planner opens.
3. **Phone:** use a production/development build (not Expo Go), full battery, Do Not Disturb on
   (so only Vesphe notifications show), brightness up, clean notification bar.
4. **Record** with the phone's built-in screen recorder. Move slowly and pause ~1 second on each
   screen — clips are trimmed to fit, and calm footage looks premium.

## Shot list (record each ~1.5× the scene length)

| File (put in `public/clips/customer/`) | Length | What to do |
|---|---|---|
| `explore.mp4` | 15s | Open **Explore**, scroll slowly, tap **Grilled Croaker & Vegetables**, let the details sheet slide up, scroll to ingredients and allergens. |
| `health.mp4` | 15s | On Explore, tap **+** on **Puff-Puff** → the health warning appears. Pause on it. (Second take: **Beef Suya** for the nut allergy.) |
| `planner.mp4` | 15s | Open **Meal planner** (Pro), show today highlighted, scroll the week. |
| `checkout.mp4` | 13s | Cart with 2 dishes → **Pay with card** → Paystack page → order confirmed. (Use a Paystack test card.) |
| `tracking.mp4` | 18s | An order in transit: live map with the rider moving, then the delivery code. Ask a rider/teammate to drive the demo order. |
| `updates.mp4` | 13s | Lock screen with a Vesphe push arriving ("Order on the way"), tap it, then open **Help → Complaints & chat** and show a reply. |

Then set each path in `src/media.ts`, e.g. `explore: 'clips/customer/explore.mp4'`.

## Audio

- **Voiceover:** record in a quiet room (a wardrobe full of clothes works great) on your phone,
  save as `public/audio/voiceover-customer.mp3`, set `AUDIO.voiceover` in `src/media.ts`.
  Or generate one with an AI voice (ElevenLabs) from the table above.
- **Music:** an upbeat Afrobeats / Afro-pop instrumental, royalty-free (YouTube Audio Library,
  Pixabay Music, Epidemic Sound). Save as `public/audio/music.mp3`, set `AUDIO.music`.
  Music is automatically lowered under the voiceover.
