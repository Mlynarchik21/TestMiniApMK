"use client";

import type { CSSProperties } from "react";
import { useTheme } from "@/lib/useTheme";
import { radius } from "./tokens";

type Props = {
  width?: number | string;
  height?: number | string;
  radius?: number;
  style?: CSSProperties;
};

export function Skeleton({ width = "100%", height = 16, radius: r = 8, style }: Props) {
  const { T, theme } = useTheme();

  const base = theme === "light" ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.04)";
  const shine = theme === "light" ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)";

  return (
    <div
      aria-hidden
      style={{
        width,
        height,
        borderRadius: r,
        background: `linear-gradient(90deg, ${base} 0%, ${shine} 50%, ${base} 100%)`,
        backgroundSize: "200% 100%",
        animation: "skeletonShine 1400ms ease-in-out infinite",
        border: `1px solid ${T.borderSoft}`,
        ...style,
      }}
    />
  );
}

export function SkeletonStack({ count = 3, gap = 10 }: { count?: number; gap?: number }) {
  return (
    <div style={{ display: "grid", gap }}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} height={i === 0 ? 22 : 14} width={i === 0 ? "60%" : i % 2 ? "100%" : "84%"} radius={radius.sm} />
      ))}
    </div>
  );
}
