"use client";

import type { CSSProperties } from "react";
import { motion } from "framer-motion";
import { useTheme } from "@/lib/useTheme";
import { radius } from "./tokens";

type Props = {
  /**
   * 0..100 — share of the LEFT side (e.g. long%). Right side fills the rest.
   */
  leftPercent: number;
  leftLabel?: string;
  rightLabel?: string;
  leftColor?: string;
  rightColor?: string;
  height?: number;
  style?: CSSProperties;
  /**
   * Show numeric values inside the bar.
   */
  showValues?: boolean;
};

/**
 * Two-sided gradient bar for risk / long-short / importance / criticality indicators.
 * The only place where colored gradients are encouraged in this app.
 */
export function RiskBar({
  leftPercent,
  leftLabel,
  rightLabel,
  leftColor,
  rightColor,
  height = 10,
  style,
  showValues = true,
}: Props) {
  const { T } = useTheme();
  const left = Math.max(0, Math.min(100, leftPercent));
  const right = 100 - left;

  const lc = leftColor ?? T.green;
  const rc = rightColor ?? T.red;

  return (
    <div style={{ display: "grid", gap: 6, ...style }}>
      {(leftLabel || rightLabel) && (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700 }}>
          <span style={{ color: lc }}>
            {leftLabel}
            {showValues ? ` ${left.toFixed(0)}%` : ""}
          </span>
          <span style={{ color: rc }}>
            {showValues ? `${right.toFixed(0)}% ` : ""}
            {rightLabel}
          </span>
        </div>
      )}

      <div
        role="img"
        aria-label={`${leftLabel ?? "left"} ${left.toFixed(0)}% / ${rightLabel ?? "right"} ${right.toFixed(0)}%`}
        style={{
          position: "relative",
          height,
          borderRadius: radius.pill,
          background: `linear-gradient(90deg, ${lc} 0%, ${lc}aa 45%, ${rc}aa 55%, ${rc} 100%)`,
          overflow: "hidden",
          border: `1px solid ${T.borderSoft}`,
        }}
      >
        <motion.div
          initial={{ left: "50%" }}
          animate={{ left: `${left}%` }}
          transition={{ type: "spring", stiffness: 220, damping: 26 }}
          style={{
            position: "absolute",
            top: -2,
            bottom: -2,
            width: 3,
            background: T.text,
            borderRadius: 2,
            transform: "translateX(-50%)",
            boxShadow: "0 0 0 2px rgba(0,0,0,0.4)",
          }}
        />
      </div>
    </div>
  );
}
