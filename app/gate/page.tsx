"use client";

import { useEffect, useState } from "react";

export default function GatePage() {
  const [text, setText] = useState("Загрузка...");

  useEffect(() => {
    const tg = (window as any)?.Telegram?.WebApp;
    if (!tg) {
      setText("Telegram.WebApp НЕ найден ❌");
      return;
    }

    tg.ready?.();
    setText("Telegram.WebApp найден ✅ initData длина: " + (tg.initData?.length || 0));
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        fontSize: 16,
        textAlign: "center",
        whiteSpace: "pre-wrap",
      }}
    >
      {text}
    </div>
  );
}
