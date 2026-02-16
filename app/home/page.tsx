"use client";

import { useRouter } from "next/navigation";

export default function HomeStub() {
  const router = useRouter();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        padding: 16,
        fontFamily:
          '-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text",Inter,Roboto,"Segoe UI",Arial,sans-serif',
      }}
    >
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Главная (заглушка)</h2>

      <button
        onClick={() => router.push("/gate")}
        style={{
          marginTop: 16,
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,.32)",
          background: "#000",
          color: "#fff",
          padding: "8px 14px",
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        Назад
      </button>
    </div>
  );
}
