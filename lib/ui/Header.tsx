"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useTheme } from "@/lib/useTheme";
import { ArrowLeft } from "./icons";
import { haptics } from "./haptics";

type Props = {
  title: ReactNode;
  subtitle?: ReactNode;
  /**
   * - string  → router.replace(string)
   * - function → custom handler
   * - false → hide back button (left slot stays empty for grid)
   * - undefined → router.back()
   */
  back?: string | (() => void) | false;
  badge?: ReactNode;
  right?: ReactNode;
  sticky?: boolean;
};

export function Header({ title, subtitle, back, badge, right, sticky = false }: Props) {
  const router = useRouter();
  const { T } = useTheme();

  const onBack = () => {
    haptics.selection();
    if (back === false) return;
    if (typeof back === "function") return back();
    if (typeof back === "string") return router.replace(back);
    router.back();
  };

  return (
    <motion.header
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: sticky ? "sticky" : "relative",
        top: sticky ? 0 : undefined,
        zIndex: sticky ? 20 : undefined,
        background: sticky ? `${T.bg}f2` : undefined,
        backdropFilter: sticky ? "saturate(140%) blur(16px)" : undefined,
        WebkitBackdropFilter: sticky ? "saturate(140%) blur(16px)" : undefined,
        borderBottom: sticky ? `1px solid ${T.borderSoft}` : undefined,
        display: "grid",
        gridTemplateColumns: "44px 1fr 44px",
        alignItems: "center",
        gap: 12,
        padding: sticky ? "8px 0 12px" : "0 0 16px",
        marginBottom: sticky ? 0 : 8,
      }}
    >
      {back === false ? (
        <div />
      ) : (
        <button
          type="button"
          onClick={onBack}
          aria-label="Назад"
          style={{
            width: 44,
            height: 44,
            borderRadius: 999,
            border: `1px solid ${T.borderHard}`,
            background: T.card,
            color: T.textMain,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            WebkitTapHighlightColor: "transparent",
            transition: "transform 120ms cubic-bezier(0.22,1,0.36,1)",
          }}
        >
          <ArrowLeft size={18} strokeWidth={2} />
        </button>
      )}

      <div style={{ textAlign: "center", minWidth: 0 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: "-0.025em",
            color: T.textMain,
            maxWidth: "100%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{title}</span>
          {badge && (
            <span
              style={{
                background: T.brand,
                color: "#fff",
                fontSize: 11,
                fontWeight: 700,
                borderRadius: 999,
                padding: "2px 7px",
                lineHeight: 1.4,
              }}
            >
              {badge}
            </span>
          )}
        </div>
        {subtitle && (
          <div style={{ fontSize: 11, color: T.textFaint, marginTop: 2 }}>{subtitle}</div>
        )}
      </div>

      {right ? (
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
          {right}
        </div>
      ) : (
        <div />
      )}
    </motion.header>
  );
}
