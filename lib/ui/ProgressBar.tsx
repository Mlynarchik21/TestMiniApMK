"use client";

import type { CSSProperties } from "react";
import { motion } from "framer-motion";
import { useTheme } from "@/lib/useTheme";
import { radius } from "./tokens";

type Tone = "neutral" | "success" | "danger" | "warning" | "brand";

type Props = {
  value: number;
  max?: number;
  tone?: Tone;
  height?: number;
  showValue?: boolean;
  label?: string;
  rightLabel?: string;
  /**
   * If two-color stops (e.g. for risk gauges), supply [low, high] colors.
   */
  gradient?: [string, string];
  style?: CSSProperties;
};

export function ProgressBar({
  value,
  max = 100,
  tone = "brand",
  height = 8,
  showValue = false,
  label,
  rightLabel,
  gradient,
  style,
}: Props) {
  const { T } = useTheme();
  const pct = Math.max(0, Math.min(100, (value / max) * 100));

  const palette: Record<Tone, [string, string]> = {
    neutral: [T.textFaint, T.textSoft],
    brand: [`${T.brand}88`, T.brand],
    success: [`${T.green}88`, T.green],
    danger: [`${T.red}88`, T.red],
    warning: [`${T.yellow}88`, T.yellow],
  };

  const [c1, c2] = gradient ?? palette[tone];

  return (
    <div style={{ display: "grid", gap: 6, ...style }}>
      {(label || rightLabel || showValue) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: T.textMuted }}>
          <span style={{ fontWeight: 600 }}>{label}</span>
          <span style={{ color: T.textSoft, fontWeight: 700 }}>
            {rightLabel ?? (showValue ? `${pct.toFixed(0)}%` : "")}
          </span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        style={{
          height,
          borderRadius: radius.pill,
          background: T.card,
          border: `1px solid ${T.borderSoft}`,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          style={{
            height: "100%",
            borderRadius: radius.pill,
            background: `linear-gradient(90deg, ${c1} 0%, ${c2} 100%)`,
          }}
        />
      </div>
    </div>
  );
}
