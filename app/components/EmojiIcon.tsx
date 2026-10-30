// app/components/EmojiIcon.tsx
// Health conditions, allergens, goals and meal times store an emoji as their
// `icon`. Emojis render differently on every phone, so we draw a matching
// vector icon instead. Unknown emojis fall back to a neutral dot.
import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const ICONS: Record<string, IconName> = {
  // People & life stages
  '👶': 'baby-face-outline',
  '🧒': 'human-child',
  '🧑': 'account',
  '👨': 'human-male',
  '👴': 'human-cane',
  '👵': 'human-cane',
  '🤰': 'human-pregnant',
  '🍼': 'baby-bottle-outline',
  // Health
  '🌸': 'flower-outline',
  '🩸': 'water',
  '⚠️': 'alert-outline',
  '❤️': 'heart-pulse',
  '💙': 'heart-outline',
  '🫀': 'heart-pulse',
  '🧠': 'brain',
  '🧬': 'dna',
  '🦶': 'foot-print',
  '🦴': 'bone',
  '🏥': 'hospital-box-outline',
  '⚖️': 'scale-bathroom',
  '🫁': 'lungs',
  '🔥': 'fire',
  '💩': 'stomach',
  '🟢': 'circle',
  '🚽': 'toilet',
  '😰': 'emoticon-confused-outline',
  '😞': 'emoticon-sad-outline',
  '⚕️': 'medical-bag',
  '🩺': 'stethoscope',
  '🩹': 'bandage',
  '🛡️': 'shield-outline',
  '🔋': 'battery-charging-outline',
  '🚫': 'cancel',
  // Food & diets
  '🌾': 'barley',
  '🥜': 'peanut-outline',
  '🌰': 'seed-outline',
  '🥛': 'cup-outline',
  '🥚': 'egg-outline',
  '🦐': 'fish',
  '🐟': 'fish',
  '🌱': 'sprout-outline',
  '🌻': 'flower',
  '🍎': 'food-apple-outline',
  '🥦': 'leaf',
  '🥑': 'fruit-pear',
  '🍖': 'food-drumstick-outline',
  '🍞': 'bread-slice-outline',
  '🥗': 'bowl-mix-outline',
  '🍬': 'candy-outline',
  '🧂': 'shaker-outline',
  '🥣': 'bowl-outline',
  '⚪': 'circle-outline',
  '☪️': 'star-crescent',
  '✡️': 'star-david',
  // Fitness
  '💪': 'arm-flex-outline',
  '📈': 'trending-up',
  '🏃': 'run',
  '🔄': 'refresh',
  // Meal times & misc
  '☀️': 'white-balance-sunny',
  '🍽️': 'silverware-fork-knife',
  '🌙': 'weather-night',
  '🌆': 'weather-sunset',
  '🍿': 'popcorn',
  '⭐': 'star-outline',
  '⚡': 'lightning-bolt-outline',
  '💰': 'cash',
  '🎁': 'gift-outline',
  '🚚': 'truck-delivery-outline',
  '🏪': 'storefront-outline',
};

// Emojis are sometimes stored with or without the U+FE0F variation selector.
const lookup = (emoji?: string | null): IconName => {
  if (!emoji) return 'circle-small';
  return ICONS[emoji] || ICONS[emoji.replace(/️/g, '')] || ICONS[`${emoji}️`] || 'circle-small';
};

export function EmojiIcon({ emoji, size = 16, color = '#f97316' }: { emoji?: string | null; size?: number; color?: string }) {
  return <MaterialCommunityIcons name={lookup(emoji)} size={size} color={color} />;
}
