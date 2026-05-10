type Impact = "light" | "medium" | "heavy" | "rigid" | "soft";
type Notification = "success" | "warning" | "error";

function tg(): any {
  if (typeof window === "undefined") return null;
  return (window as any)?.Telegram?.WebApp ?? null;
}

export const haptics = {
  impact(style: Impact = "light") {
    try { tg()?.HapticFeedback?.impactOccurred?.(style); } catch {}
  },
  notify(type: Notification) {
    try { tg()?.HapticFeedback?.notificationOccurred?.(type); } catch {}
  },
  selection() {
    try { tg()?.HapticFeedback?.selectionChanged?.(); } catch {}
  },
};
