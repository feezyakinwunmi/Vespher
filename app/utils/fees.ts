// app/utils/fees.ts
// Paystack local card fee (Nigeria): 1.5% + ₦100, the ₦100 waived under ₦2,500,
// capped at ₦2,000. Used as an estimate wherever the actual fee isn't stored yet.
export const PAYSTACK_FEE_PERCENTAGE = 1.5;

export function estimatePaystackFee(amount: number): number {
  if (!amount || amount <= 0) return 0;
  const flat = amount >= 2500 ? 100 : 0;
  return Math.min(Math.round(amount * (PAYSTACK_FEE_PERCENTAGE / 100) + flat), 2000);
}
