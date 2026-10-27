// The customer video: what is on screen and what is said, scene by scene.
// Edit the words here; timing is in seconds. Full script with voiceover is in
// video/scripts/customer.md.

export interface FeatureScene {
  kind: 'feature';
  id: string;
  seconds: number;
  clip: string; // key in CLIPS (media.ts)
  icon: string; // emoji shown in the kicker
  kicker: string;
  title: string;
  sub: string;
  chips?: string[];
  // Short label shown in the placeholder before you add the recording.
  record: string;
}

export interface HookScene {
  kind: 'hook';
  id: string;
  seconds: number;
  lines: string[];
}

export interface LogoScene {
  kind: 'logo';
  id: string;
  seconds: number;
  tagline: string;
}

export interface EndScene {
  kind: 'end';
  id: string;
  seconds: number;
  title: string;
  sub: string;
  cta: string;
}

export type Scene = HookScene | LogoScene | FeatureScene | EndScene;

const FEATURES: Record<string, FeatureScene> = {
  explore: {
    kind: 'feature',
    id: 'explore',
    seconds: 10,
    clip: 'explore',
    icon: '🥗',
    kicker: 'Know your food',
    title: "See what's really in every dish",
    sub: 'Ingredients, allergens and dietary tags on every meal, before you order.',
    chips: ['Ingredients', 'Allergens', 'Dietary tags'],
    record: 'Explore → tap a dish → details',
  },
  health: {
    kind: 'feature',
    id: 'health',
    seconds: 10,
    clip: 'health',
    icon: '🛡️',
    kicker: 'Health check',
    title: 'Warned before it hits your cart',
    sub: "Diabetic? Allergic to nuts? Vesphe flags food that doesn't suit you.",
    chips: ['Diabetes', 'Allergies', 'Blood pressure'],
    record: 'Add a risky dish → health warning',
  },
  planner: {
    kind: 'feature',
    id: 'planner',
    seconds: 10,
    clip: 'planner',
    icon: '📅',
    kicker: 'Vesphe Pro',
    title: 'Your week of meals, planned for you',
    sub: 'The right food for breakfast, lunch and dinner, matched to you.',
    chips: ['Breakfast', 'Lunch', 'Dinner'],
    record: 'Meal planner, today highlighted',
  },
  checkout: {
    kind: 'feature',
    id: 'checkout',
    seconds: 9,
    clip: 'checkout',
    icon: '💳',
    kicker: 'Pay your way',
    title: 'Card or cash, done in seconds',
    sub: 'Secure card payments powered by Paystack.',
    chips: ['Card', 'Cash on delivery'],
    record: 'Cart → pay → order confirmed',
  },
  tracking: {
    kind: 'feature',
    id: 'tracking',
    seconds: 12,
    clip: 'tracking',
    icon: '🛵',
    kicker: 'Live tracking',
    title: 'Watch your rider come to you',
    sub: 'Your delivery code makes sure only you receive your order.',
    chips: ['Live map', 'Delivery code'],
    record: 'Live map + delivery code',
  },
  updates: {
    kind: 'feature',
    id: 'updates',
    seconds: 9,
    clip: 'updates',
    icon: '🔔',
    kicker: 'Always in the loop',
    title: 'Updates at every step',
    sub: 'Instant alerts, and real people to chat with when you need help.',
    chips: ['Push alerts', 'Support chat'],
    record: 'Notification arriving + support chat',
  },
};

const END: EndScene = {
  kind: 'end',
  id: 'end',
  seconds: 7,
  title: 'Eat smart.',
  sub: 'Healthy choices, delivered.',
  cta: 'Download Vesphe',
};

// 75 seconds: Reels / TikTok / Status (9:16) and YouTube / website (16:9).
export const CUSTOMER_FULL: Scene[] = [
  { kind: 'hook', id: 'hook', seconds: 5, lines: ['Ordering food', "shouldn't be a gamble", 'with your health.'] },
  { kind: 'logo', id: 'logo', seconds: 3, tagline: 'Food that fits you.' },
  FEATURES.explore,
  FEATURES.health,
  FEATURES.planner,
  FEATURES.checkout,
  FEATURES.tracking,
  FEATURES.updates,
  END,
];

// 15 seconds: ads and stories. Same scenes, shorter, no subtitles.
export const CUSTOMER_TEASER: Scene[] = [
  { kind: 'hook', id: 'hook', seconds: 2.5, lines: ['Know your food.', 'Before you order it.'] },
  { ...FEATURES.explore, seconds: 3, sub: '' },
  { ...FEATURES.health, seconds: 3, sub: '' },
  { ...FEATURES.tracking, seconds: 3, sub: '' },
  { ...END, seconds: 3.5 },
];

export const totalSeconds = (scenes: Scene[]) => scenes.reduce((s, x) => s + x.seconds, 0);
