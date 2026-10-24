// app/config/support.ts
// Single source for support contact details shown across customer, vendor and
// suspended-account screens. Update here before launch if these change.
export const SUPPORT = {
  phoneDisplay: '+234 916 146 0898',
  phoneE164: '+2349161460898',
  whatsapp: '2349161460898',
  email: 'info.phantomire@gmail.com',
};

export const supportLinks = {
  call: `tel:${SUPPORT.phoneE164}`,
  whatsapp: `https://wa.me/${SUPPORT.whatsapp}`,
  email: (subject?: string) =>
    `mailto:${SUPPORT.email}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`,
};
