import type { TextStyleOptions } from 'pixi.js'

export const UI_COLORS = {
  soot: 0x0b0f12,
  coal: 0x12181d,
  gunmetal: 0x1b2228,
  steelDark: 0x303b40,
  steel: 0x526266,
  steelLight: 0x7c8b8b,
  paper: 0xd8c89a,
  text: 0xe7e0ca,
  muted: 0x9aa5a1,
  brass: 0xd6a24b,
  brassLight: 0xf0cf72,
  warning: 0xd45c48,
  success: 0x78b880,
  info: 0x72aeb0,
  black: 0x050709,
  white: 0xffffff
} as const

export const UI_FONT = {
  display: 'Arial Black, PingFang SC, Microsoft YaHei, sans-serif',
  body: 'PingFang SC, Microsoft YaHei, Arial, sans-serif',
  utility: 'Courier New, PingFang SC, Microsoft YaHei, monospace',
  pixel: 'Fusion Pixel 10px Proportional, PingFang SC, Microsoft YaHei, sans-serif'
} as const

export async function preloadUiFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return
  try {
    await document.fonts.load(`20px "${UI_FONT.pixel.split(',')[0]}"`)
  } catch {
    // The UI remains playable with the system CJK fallback when a webfont is unavailable.
  }
}

export function bodyStyle(fontSize: number, overrides: TextStyleOptions = {}): TextStyleOptions {
  return {
    fontFamily: UI_FONT.body,
    fontSize,
    fontWeight: '600',
    fill: UI_COLORS.text,
    letterSpacing: 0,
    lineHeight: Math.round(fontSize * 1.42),
    ...overrides
  }
}

export function utilityStyle(fontSize: number, overrides: TextStyleOptions = {}): TextStyleOptions {
  return {
    fontFamily: UI_FONT.utility,
    fontSize,
    fontWeight: '700',
    fill: UI_COLORS.muted,
    letterSpacing: 0,
    lineHeight: Math.round(fontSize * 1.35),
    ...overrides
  }
}

export function displayStyle(fontSize: number, overrides: TextStyleOptions = {}): TextStyleOptions {
  return {
    fontFamily: UI_FONT.display,
    fontSize,
    fontWeight: '900',
    fill: UI_COLORS.paper,
    letterSpacing: 0,
    ...overrides
  }
}

export function pixelStyle(fontSize: number, overrides: TextStyleOptions = {}): TextStyleOptions {
  return {
    fontFamily: UI_FONT.pixel,
    fontSize,
    fontWeight: '400',
    fill: UI_COLORS.paper,
    letterSpacing: 0,
    lineHeight: Math.round(fontSize * 1.18),
    ...overrides
  }
}
