"use client";

import { motion } from "framer-motion";
import { useTheme } from "@/lib/useTheme";
import { haptics } from "./haptics";

type Props = {
  on: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  ariaLabel?: string;
};

export function Toggle({ on, onChange, disabled, size = "md", ariaLabel }: Props) {
  const { T } = useTheme();
  const W = size === "sm" ? 36 : 46;
  const H = size === "sm" ? 22 : 28;
  const D = H - 6;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        haptics.selection();
        onChange(!on);
      }}
      style={{
        width: W,
        height: H,
        borderRadius: 999,
        border: "none",
        background: on ? T.brand : "rgba(128,128,128,0.28)",
        cursor: disabled ? "not-allowed" : "pointer",
        position: "relative",
        flexShrink: 0,
        WebkitTapHighlightColor: "transparent",
        opacity: disabled ? 0.5 : 1,
        transition: "background 200ms cubic-bezier(0.22,1,0.36,1)",
        padding: 0,
      }}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 700, damping: 32 }}
        style={{
          position: "absolute",
          top: 3,
          left: on ? W - D - 3 : 3,
          width: D,
          height: D,
          borderRadius: 999,
          background: "#fff",
          boxShadow: "0 1px 4px rgba(0,0,0,0.32)",
        }}
      />
    </button>
  );
}
