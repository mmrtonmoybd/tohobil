export const appConfig = {
  name: 'Tohobil',
  packageId: 'com.tohobil.app',
  colors: { teal: '#14B8A6', indigo: '#6366F1' },
  featureFlags: {
    receiptOcr: false,
    widget: false,
    sharedBooks: false,
    push: false,
    pro: false,
  },
} as const;
