"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { useTheme } from "@/lib/useTheme";

type Props = {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
};

export function EmptyState({ icon, title, description, action, compact = false }: Props) {
  const { T } = useTheme();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: compact ? "32px 16px" : "60px 20px",
        gap: 12,
      }}
    >
      {icon && (
        <div
          style={{
            width: compact ? 48 : 64,
            height: compact ? 48 : 64,
            borderRadius: compact ? 14 : 20,
            background: T.card,
            border: `1px solid ${T.borderSoft}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: T.textMuted,
          }}
        >
          {icon}
        </div>
      )}
      <div style={{ fontSize: compact ? 14 : 16, fontWeight: 700, color: T.textMain, letterSpacing: "-0.01em" }}>
        {title}
      </div>
      {description && (
        <div style={{ fontSize: 13, color: T.textFaint, lineHeight: 1.5, maxWidth: 280 }}>
          {description}
        </div>
      )}
      {action && <div style={{ marginTop: 4 }}>{action}</div>}
    </motion.div>
  );
}
