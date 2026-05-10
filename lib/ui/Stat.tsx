"use client";

import type { CSSProperties, ReactNode } from "react";
import { useTheme } from "@/lib/useTheme";
import { ArrowDownRight, ArrowUpRight } from "./icons";
import { MONO_STACK, radius } from "./tokens";

type Props = {
  label: string;
  value: ReactNode;
  delta?: number | null;
  deltaSuffix?: string;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "neutral" | "positive" | "negative";
  align?: "left" | "center";
  compact?: boolean;
  style?: CSSProperties;
};

export function Stat({
  label,
  value,
  delta = null,
  deltaSuffix = "%",
  hint,
  icon,
  tone = "neutral",
  align = "left",
  compact = false,
  style,
}: Props) {
  const { T } = useTheme();

  const valueColor =
    tone === "positive" ? T.green : tone === "negative" ? T.red : T.textMain;

  const deltaColor =
    delta == null ? T.textFaint : delta > 0 ? T.green : delta < 0 ? T.red : T.textMuted;

  return (
    <div
      style={{
        display: "grid",
        gap: compact ? 2 : 4,
        textAlign: align,
        padding: compact ? "8px 10px" : "12px 14px",
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: compact ? radius.md : radius.lg,
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 11,
          fontWeight: 600,
          color: T.textMuted,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          justifyContent: align === "center" ? "center" : "flex-start",
        }}
      >
        {icon}
        {label}
      </div>
      <div
        style={{
          fontSize: compact ? 18 : 22,
          fontWeight: 800,
          color: valueColor,
          letterSpacing: "-0.025em",
          fontFamily: MONO_STACK,
        }}
      >
        {value}
      </div>
      {(hint || delta != null) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            color: deltaColor,
            justifyContent: align === "center" ? "center" : "flex-start",
          }}
        >
          {delta != null && (
            <>
              {delta > 0 ? <ArrowUpRight size={12} /> : delta < 0 ? <ArrowDownRight size={12} /> : null}
              {delta > 0 ? "+" : ""}
              {Number.isFinite(delta) ? delta.toFixed(2) : "—"}
              {deltaSuffix}
            </>
          )}
          {hint && <span style={{ color: T.textFaint }}>{hint}</span>}
        </div>
      )}
    </div>
  );
}
