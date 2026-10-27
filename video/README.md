# Vesphe promo videos

Promo videos built with [Remotion](https://www.remotion.dev) (videos written in React), so
the animated parts are sharp, on-brand and easy to change. You add the screen recordings
and voiceover; it renders finished MP4s.

## Videos

| Composition | Size | Length | For |
|---|---|---|---|
| `CustomerPortrait` | 1080×1920 (9:16) | 75s | Reels, TikTok, WhatsApp Status, Shorts |
| `CustomerLandscape` | 1920×1080 (16:9) | 75s | YouTube, website, presentations |
| `CustomerTeaser` | 1080×1920 (9:16) | 15s | Ads, stories |

Vendor and investor videos come next, using the same building blocks.

## Use it

```sh
cd video
npm install
npm run studio                 # preview in the browser, scrub the timeline
npm run render:customer:all    # renders all three into video/out/
```

Before you record anything you can already preview and render: missing recordings show
as labelled placeholders inside the phone.

## Add your footage

1. Follow `scripts/customer.md` (voiceover, shot list, recording tips, demo data).
2. Put recordings in `public/clips/customer/` and audio in `public/audio/`.
3. Set the paths in `src/media.ts`.
4. Change wording or timing in `src/customer/script.ts`.

`scripts/customer-captions.srt` has timed subtitles for CapCut/YouTube if you edit there instead.

## Demo data

`demo-data/seed-demo-menu.sql` fills a demo store with 8 dishes chosen to show the details
sheet, both health warnings and the meal planner. `demo-data/remove-demo-menu.sql` hides it
again after recording. These change the live database, so run them only when you're ready
to record.
