"use client";

import { forwardRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { useTheme } from "@/lib/useTheme";
import { haptics } from "./haptics";
import { Loader2 } from "./icons";
import { radius } from "./tokens";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "tonal";
type Size = "sm" | "md" | "lg";

export type ButtonProps = Omit<HTMLMotionProps<"button">, "ref" | "children"> & {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  haptic?: "light" | "medium" | "heavy" | false;
  tone?: string;
  children?: ReactNode;
};

const SIZES: Record<Size, { h: number; px: number; fs: number; gap: number }> = {
  sm: { h: 36, px: 14, fs: 13, gap: 6 },
  md: { h: 44, px: 18, fs: 14, gap: 8 },
  lg: { h: 52, px: 22, fs: 15, gap: 10 },
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    block = false,
    loading = false,
    leadingIcon,
    trailingIcon,
    haptic = "light",
    tone,
    onClick,
    disabled,
    style,
    children,
    ...rest
  },
  ref
) {
  const { T } = useTheme();
  const sz = SIZES[size];

  const accent = tone ?? T.brand;

  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: sz.gap,
    height: sz.h,
    paddingInline: sz.px,
    fontSize: sz.fs,
    fontWeight: 700,
    borderRadius: radius.pill,
    cursor: disabled || loading ? "not-allowed" : "pointer",
    border: "1px solid transparent",
    background: "transparent",
    color: T.textMain,
    transition: "background-color 160ms, border-color 160ms, color 160ms, opacity 160ms",
    width: block ? "100%" : undefined,
    opacity: disabled ? 0.45 : loading ? 0.85 : 1,
    WebkitTapHighlightColor: "transparent",
    userSelect: "none",
    letterSpacing: "-0.01em",
  };

  const variants: Record<Variant, CSSProperties> = {
    primary: {
      background: accent,
      color: "#fff",
    },
    secondary: {
      background: T.card,
      border: `1px solid ${T.borderHard}`,
      color: T.textMain,
    },
    ghost: {
      background: "transparent",
      border: `1px solid ${T.border}`,
      color: T.textSoft,
    },
    danger: {
      background: T.red,
      color: "#fff",
    },
    tonal: {
      background: `${accent}1c`,
      border: `1px solid ${accent}55`,
      color: accent,
    },
  };

  return (
    <motion.button
      ref={ref}
      type="button"
      whileTap={disabled || loading ? undefined : { scale: 0.97 }}
      onClick={(e) => {
        if (disabled || loading) return;
        if (haptic) haptics.impact(haptic);
        onClick?.(e);
      }}
      disabled={disabled || loading}
      style={{ ...base, ...variants[variant], ...style }}
      {...rest}
    >
      {loading ? (
        <Loader2 size={size === "sm" ? 14 : 16} style={{ animation: "miniSpin 900ms linear infinite" }} />
      ) : leadingIcon}
      {children}
      {!loading && trailingIcon}
    </motion.button>
  );
});
