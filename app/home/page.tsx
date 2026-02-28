"use client";

import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 16
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 700 }}>Home (заглушка)</div>
      <button
        onClick={() => router.back()}
        style={{
          padding: "12px 16px",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,.25)",
          background: "#fff",
          color: "#000",
          fontWeight: 700
        }}
      >
        Назад
      </button>
    </div>
  );
}
