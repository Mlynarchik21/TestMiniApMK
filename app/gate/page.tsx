"use client";

import { useEffect, useState } from "react";
import WebApp from "@twa-dev/sdk";

export default function GatePage() {
  const [text, setText] = useState("Загрузка...");

  useEffect(() => {
    try {
      // WebApp объект теперь всегда есть (из npm), но initData будет только внутри Telegram
      WebApp.ready();

      const initData = WebApp.initData || "";
      if (!initData) {
        setText("Не внутри Telegram\nОткрой Mini App внутри Telegram (WebApp).");
        return;
      }

      setText("Telegram WebApp найден ✅\ninitData длина: " + initData.length);
    } catch (e: any) {
      setText("Ошибка инициализации WebApp: " + String(e?.message ?? e));
    }
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
