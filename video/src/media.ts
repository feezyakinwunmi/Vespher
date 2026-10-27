// Your recordings and audio. Drop files into video/public/ and set the path here.
// Leave a value as null and the video shows a labelled placeholder instead, so you
// can preview and time everything before recording.
//
// Screen recordings: portrait phone recordings (MP4) or screenshots (PNG/JPG) work.
// Paths are relative to video/public/.

export const CLIPS: Record<string, string | null> = {
  explore: null, //   'clips/customer/explore.mp4'   Explore page → tap a dish → details sheet
  health: null, //    'clips/customer/health.mp4'    Add a dish that clashes with your health profile → warning
  planner: null, //   'clips/customer/planner.mp4'   Meal planner, today highlighted
  checkout: null, //  'clips/customer/checkout.mp4'  Cart → pay by card → order confirmed
  tracking: null, //  'clips/customer/tracking.mp4'  Live map with the rider moving + delivery code
  updates: null, //   'clips/customer/updates.mp4'   Push notification arriving + support chat
};

export const AUDIO = {
  music: null as string | null, //      'audio/music.mp3'               background track (royalty-free)
  voiceover: null as string | null, //  'audio/voiceover-customer.mp3'  your recorded voiceover
  musicVolume: 0.25, // lowered automatically when a voiceover is present
};

export const LINKS = {
  website: 'vesphe.app',
  handle: '@vesphe',
};
