"use client";

import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useTheme } from "@/lib/useTheme";
import { FONT_STACK } from "./tokens";

type Props = {
  children: ReactNode;
  /** Reserve bottom space for BottomNav (default true). */
  withNav?: boolean;
  /** Sync header / bg colors with Telegram WebApp. */
  syncTelegram?: boolean;
  maxWidth?: number;
  style?: CSSProperties;
};

export function PageShell({
  children,
  withNav = true,
  syncTelegram = true,
  maxWidth = 560,
  style,
}: Props) {
  const { T, theme } = useTheme();

  const [pagePaddingTop, setPagePaddingTop] = useState(
    "calc(env(safe-area-inset-top, 0px) + 8px)"
  );

  useEffect(() => {
    if (!syncTelegram) return;
    const tg = (window as any)?.Telegram?.WebApp;
    try {
      tg?.ready?.();
      tg?.expand?.();
      tg?.setHeaderColor?.(theme === "light" ? "#ffffff" : "#000000");
      tg?.setBackgroundColor?.(theme === "light" ? "#f2f2f7" : "#000000");
      if (tg?.isFullscreen) {
        setPagePaddingTop("calc(env(safe-area-inset-top, 0px) + 88px)");
      }
    } catch {}
  }, [syncTelegram, theme]);

  const reservedBottom = withNav
    ? "calc(env(safe-area-inset-bottom, 0px) + 84px)"
    : "calc(env(safe-area-inset-bottom, 0px) + 24px)";

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: T.bg,
        color: T.text,
        fontFamily: FONT_STACK,
        paddingTop: pagePaddingTop,
        paddingBottom: reservedBottom,
        ...style,
      }}
    >
      <div style={{ maxWidth, margin: "0 auto", padding: "0 16px" }}>{children}</div>
    </main>
  );
}
