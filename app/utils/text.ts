// app/utils/text.ts

// 'in_transit' -> 'In transit', 'PAID' -> 'Paid'. For statuses and roles shown to people.
export function humanize(value?: string | null): string {
  if (!value) return '';
  const words = value.replace(/[_-]+/g, ' ').trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
