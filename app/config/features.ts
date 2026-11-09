// app/config/features.ts
// Features held back from the first store release.

// Voice ordering ("Hey Vesphe"). Also switch VOICE_ORDERING_ENABLED in app.config.js.
export const VOICE_ORDERING_ENABLED = false;

// Vesphe Pro and Pro Max. Apple and Google require their own billing for digital
// subscriptions, so these stay off until in-app purchases are built.
export const PRO_SUBSCRIPTIONS_ENABLED = false;

// Vendors buy promotions on the web dashboard; the app shows their status only.
export const PROMOTION_PURCHASE_IN_APP = false;
