// Single source of truth for design tokens. Screens import from here — never hard-code colors.
export const colors = {
  bg: '#0B0B0F',
  surface: '#14141A',
  surfaceRaised: '#1C1C24',
  border: 'rgba(255,255,255,0.08)',
  text: '#F4F4F6',
  textMuted: '#9A9AA6',
  textFaint: '#5E5E6A',
  accent: '#8B7CFF',
  accentSoft: 'rgba(139,124,255,0.14)',
  success: '#3DD68C',
  warning: '#F5B544',
  danger: '#FF5C6C',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;

export const type = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: '700' as const, letterSpacing: -0.8 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const, letterSpacing: -0.4 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' as const, letterSpacing: -0.2 },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500' as const },
  overline: { fontSize: 11, lineHeight: 14, fontWeight: '700' as const, letterSpacing: 1.2 },
} as const;
