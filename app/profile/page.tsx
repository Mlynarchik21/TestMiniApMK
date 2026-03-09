"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ProfileResp =
  | {
      ok: true;
      user: {
        id: string;
        tgId: string;
        username: string | null;
        firstName: string | null;
        lastName: string | null;
      };
    }
  | {
      ok: false;
      error: string;
    };

function getToken() {
  try {
    return localStorage.getItem("sessionToken") || "";
  } catch {
    return "";
  }
}

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ProfileResp | null>(null);

  async function loadProfile() {
    setLoading(true);
    try {
      const token = getToken();

      const res = await fetch("/api/profile", {
        method: "GET",
        cache: "no-store",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const json = (await res.json()) as ProfileResp;
      setData(json);
    } catch (e: any) {
      setData({
        ok: false,
        error: e?.message || "Request failed",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 16,
        background: "#000",
        color: "#fff",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
      }}
    >
      <div style={{ maxWidth: 520, margin: "0 auto", display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 900 }}>Profile</div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => router.replace("/home")} style={btnGhost()}>
              Home
            </button>
          </div>
        </div>

        <div
          style={{
            background: "#111",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 16,
            padding: 14,
            whiteSpace: "pre-wrap",
          }}
        >
          {loading ? (
            "Loading..."
          ) : data?.ok ? (
            JSON.stringify(data.user, null, 2)
          ) : (
            JSON.stringify(data, null, 2)
          )}
        </div>

        <button onClick={loadProfile} style={btnPrimary(false)}>
          Reload
        </button>
      </div>
    </main>
  );
}

function btnPrimary(disabled: boolean): React.CSSProperties {
  return {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.25)",
    background: "#fff",
    color: "#000",
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.85 : 1,
  };
}

function btnGhost(): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.25)",
    background: "transparent",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  };
}