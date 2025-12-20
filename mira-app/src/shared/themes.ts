// Predefined themes for Mira projects
// Requirements: 16.3

export interface ThemeColors {
  background: string
  foreground: string
  card: string
  cardForeground: string
  popover: string
  popoverForeground: string
  primary: string
  primaryForeground: string
  secondary: string
  secondaryForeground: string
  muted: string
  mutedForeground: string
  accent: string
  accentForeground: string
  destructive: string
  destructiveForeground: string
  border: string
  input: string
  ring: string
  chart1: string
  chart2: string
  chart3: string
  chart4: string
  chart5: string
  sidebar: string
  sidebarForeground: string
  sidebarPrimary: string
  sidebarPrimaryForeground: string
  sidebarAccent: string
  sidebarAccentForeground: string
  sidebarBorder: string
  sidebarRing?: string
  radius?: string
  spacing?: string
  shadow2xs?: string
  shadowXs?: string
  shadowSm?: string
  shadow?: string
  shadowMd?: string
  shadowLg?: string
  shadowXl?: string
  shadow2xl?: string
  fontSans?: string
  fontMono?: string
  fontSerif?: string
}

export interface Theme {
  id: string
  name: string
  description?: string
  colors: Partial<ThemeColors>
}

import themes from './themes.json'

export const PREDEFINED_THEMES: Theme[] = themes as Theme[]
