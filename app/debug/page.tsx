"use client";

import { useEffect, useState } from "react";

type Snap = {
  ua: string;
  hasWindow: boolean;
  hasTelegram: boolean;
  hasWebApp: boolean;
  initDataLen: number;
  initDataUnsafeUser: any;
  platform: string;
  version: string;
  colorScheme: string;
};

function getSnap(): Snap {
  const hasWindow = typeof window !== "undefined";
  const tg = hasWindow ? (window as any)?.Telegram : undefined;
  const wa = tg?.WebApp;

  return {
    ua: hasWindow ? navigator.userAgent : "",
    hasWindow,
    hasTelegram: !!tg,
    hasWebApp: !!wa,
    initDataLen: wa?.initData ? String(wa.initData).length : 0,
    initDataUnsafeUser: wa?.initDataUnsafe?.user ?? null,
    platform: wa?.platform ?? "",
    version: wa?.version ?? "",
    colorScheme: wa?.colorScheme ?? "",
  };
}

export default function DebugPage() {
  const [snap, setSnap] = useState<Snap>(() => getSnap());
  const [ticks, setTicks] = useState(0);

  useEffect(() => {
    // Подождём до 2 секунд, часто WebApp появляется не мгновенно
    const started = Date.now();
    const t = setInterval(() => {
      setSnap(getSnap());
      setTicks((x) => x + 1);
      if (Date.now() - started > 2000) clearInterval(t);
    }, 150);

    return () => clearInterval(t);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        padding: 16,
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>
        DEBUG / Telegram WebApp
      </div>

      <div style={{ opacity: 0.9, marginBottom: 12 }}>
        Ticks: {ticks} (обновления состояния)
      </div>

      <pre
        style={{
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          background: "rgba(255,255,255,.06)",
          border: "1px solid rgba(255,255,255,.12)",
          borderRadius: 12,
          padding: 12,
        }}
      >
        {JSON.stringify(snap, null, 2)}
      </pre>

      <div style={{ marginTop: 14, opacity: 0.9, lineHeight: 1.5 }}>
        Если <b>hasWebApp=false</b>, значит это НЕ WebApp-запуск (или скрипт не
        загрузился). Тогда проблема в способе открытия/настройке BotFather, а не
        в коде.
      </div>
    </div>
  );
}
