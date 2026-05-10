export const motion = {
  duration: {
    xs: 120,
    sm: 180,
    md: 240,
    lg: 320,
    xl: 480,
  },
  ease: {
    out: "cubic-bezier(0.22, 1, 0.36, 1)",
    in: "cubic-bezier(0.4, 0, 1, 1)",
    inOut: "cubic-bezier(0.4, 0, 0.2, 1)",
    spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
  spring: { type: "spring" as const, stiffness: 320, damping: 30, mass: 0.8 },
  springSoft: { type: "spring" as const, stiffness: 180, damping: 26, mass: 1 },
} as const;

export const radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  pill: 999,
} as const;

export const space = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 32, 8: 40 } as const;

export const elevation = {
  none: "none",
  low: "0 1px 0 rgba(255,255,255,0.04) inset, 0 1px 2px rgba(0,0,0,0.4)",
  med: "0 8px 24px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.04) inset",
  high: "0 18px 60px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.06) inset",
} as const;

export const Z = { base: 0, sticky: 10, overlay: 40, modal: 100, toast: 1000 } as const;

export const FONT_STACK =
  'Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif';

export const MONO_STACK =
  'ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono",monospace';
