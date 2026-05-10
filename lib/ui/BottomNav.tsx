"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useTheme } from "@/lib/useTheme";
import { haptics } from "./haptics";
import { Home, Bot, BookOpen, User } from "./icons";

type NavItem = {
  href: string;
  label: string;
  icon: (props: { size?: number; strokeWidth?: number }) => ReactNode;
};

type ActiveMatcher = (path: string) => boolean;

const ITEMS: Array<NavItem & { active?: ActiveMatcher }> = [
  { href: "/home", label: "Главная", icon: (p) => <Home {...p} /> },
  {
    href: "/robot",
    label: "Робот",
    icon: (p) => <Bot {...p} />,
    active: (p) => p === "/robot" || p.startsWith("/robot/") || p === "/bot" || p.startsWith("/bot/"),
  },
  { href: "/course", label: "Курсы", icon: (p) => <BookOpen {...p} /> },
  { href: "/profile", label: "Профиль", icon: (p) => <User {...p} /> },
];

export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname() || "";
  const { T } = useTheme();

  return (
    <nav
      aria-label="Основная навигация"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 40,
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)",
        paddingTop: 8,
        background: `${T.bg}f0`,
        backdropFilter: "saturate(140%) blur(18px)",
        WebkitBackdropFilter: "saturate(140%) blur(18px)",
        borderTop: `1px solid ${T.borderSoft}`,
      }}
    >
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: "0 12px",
          display: "grid",
          gridTemplateColumns: `repeat(${ITEMS.length}, 1fr)`,
          maxWidth: 560,
          marginInline: "auto",
        }}
      >
        {ITEMS.map((item) => {
          const active = item.active
            ? item.active(pathname)
            : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <li key={item.href}>
              <button
                type="button"
                onClick={() => {
                  if (active) return;
                  haptics.selection();
                  router.push(item.href);
                }}
                style={{
                  width: "100%",
                  height: 52,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                  padding: 6,
                  borderRadius: 14,
                  background: "transparent",
                  border: "none",
                  color: active ? T.textMain : T.textFaint,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.02em",
                  cursor: "pointer",
                  WebkitTapHighlightColor: "transparent",
                  position: "relative",
                }}
              >
                <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {item.icon({ size: 22, strokeWidth: active ? 2 : 1.6 })}
                  {active && (
                    <motion.div
                      layoutId="bottom-nav-dot"
                      transition={{ type: "spring", stiffness: 360, damping: 32 }}
                      style={{
                        position: "absolute",
                        bottom: -6,
                        width: 4,
                        height: 4,
                        borderRadius: 99,
                        background: T.brand,
                      }}
                    />
                  )}
                </div>
                <span>{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
