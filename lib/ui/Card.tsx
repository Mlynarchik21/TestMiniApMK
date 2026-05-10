"use client";

import type { CSSProperties, ReactNode } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { useTheme } from "@/lib/useTheme";
import { radius, FONT_STACK } from "./tokens";

type Variant = "flat" | "outline" | "elevated";

export type CardProps = Omit<HTMLMotionProps<"section">, "ref"> & {
  variant?: Variant;
  padding?: number | string;
  radius?: number;
  interactive?: boolean;
  children?: ReactNode;
};

export function Card({
  variant = "flat",
  padding = 16,
  radius: r = radius.xl,
  interactive = false,
  style,
  whileTap,
  children,
  ...rest
}: CardProps) {
  const { T } = useTheme();

  const base: CSSProperties = {
    padding,
    borderRadius: r,
    fontFamily: FONT_STACK,
    color: T.textMain,
    transition: "border-color 200ms cubic-bezier(0.22,1,0.36,1)",
  };

  const variants: Record<Variant, CSSProperties> = {
    flat: {
      background: T.card,
      border: `1px solid ${T.border}`,
    },
    outline: {
      background: "transparent",
      border: `1px solid ${T.border}`,
    },
    elevated: {
      background: T.surface,
      border: `1px solid ${T.border}`,
      boxShadow: "0 8px 24px rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.04) inset",
    },
  };

  return (
    <motion.section
      whileTap={interactive ? (whileTap ?? { scale: 0.985 }) : undefined}
      style={{ ...base, ...variants[variant], cursor: interactive ? "pointer" : undefined, WebkitTapHighlightColor: "transparent", ...style }}
      {...rest}
    >
      {children}
    </motion.section>
  );
}

export function CardTitle({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  const { T } = useTheme();
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 700,
        color: T.textMuted,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        marginBottom: 12,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
