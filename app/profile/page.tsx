"use client";

import { useEffect, useState, useCallback } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/useTheme";

type UserData = {
  id: string;
  tgId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  createdAt?: string | null;
};

type SubData = {
  plan: string;
  status: string;
  expiresAt: string | null;
  createdAt: string;
};

function getToken() {
  try { return localStorage.getItem("sessionToken") || ""; } catch { return ""; }
}

function clearToken() {
  try { localStorage.removeItem("sessionToken"); } catch {}
}

async function api(path: string, init?: RequestInit) {
  const token = getToken();
  const res = await fetch(path, {
    cache: "no-store", ...init,
    headers: { "content-type": "application/json", ...(init?.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  return res.json().catch(() => ({ ok: false, error: "BAD_JSON" }));
}

function initials(u: UserData) {
  const first = u.firstName?.[0] ?? u.username?.[0] ?? "?";
  const last = u.lastName?.[0] ?? "";
  return (first + last).toUpperCase();
}

function displayName(u: UserData) {
  const parts = [u.firstName, u.lastName].filter(Boolean).join(" ");
  return parts || u.username || `User ${u.tgId}`;
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
}

function planLabel(plan: string) {
  if (plan === "pro") return "Pro";
  if (plan === "trial") return "Trial";
  return "Free";
}

function statusLabel(status: string) {
  if (status === "expired") return "Истекла";
  if (status === "trial") return "Пробный";
  return "Активна";
}

function ArrowLeft() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path d="M14.7 5.3a1 1 0 0 1 0 1.4L10.41 11H20a1 1 0 1 1 0 2h-9.59l4.3 4.3a1 1 0 0 1-1.42 1.4l-6-6a1 1 0 0 1 0-1.4l6-6a1 1 0 0 1 1.41 0Z" fill="currentColor" />
    </svg>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { T } = useTheme();

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserData | null>(null);
  const [sub, setSub] = useState<SubData | null>(null);
  const [err, setErr] = useState("");
  const [deleteStep, setDeleteStep] = useState<"idle" | "confirm" | "deleting">("idle");
  const [deleteErr, setDeleteErr] = useState("");
  const [pagePaddingTop, setPagePaddingTop] = useState("calc(env(safe-area-inset-top,0px) + 15px)");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [profileRes, subRes] = await Promise.all([
        api("/api/profile"),
        api("/api/subscription"),
      ]);
      if (profileRes.ok) setUser(profileRes.user);
      else setErr(profileRes.error || "Не удалось загрузить профиль");
      if (subRes.ok) setSub(subRes.subscription);
    } finally { setLoading(false); }
  }, []);

  async function deleteAccount() {
    setDeleteStep("deleting");
    setDeleteErr("");
    try {
      const json = await api("/api/account", { method: "DELETE" });
      if (json.ok) {
        clearToken();
        router.replace("/gate");
      } else {
        setDeleteErr(json.message || json.error || "Ошибка удаления");
        setDeleteStep("confirm");
      }
    } catch (e: any) {
      setDeleteErr(e?.message ?? "Ошибка");
      setDeleteStep("confirm");
    }
  }

  useEffect(() => {
    load();
    const tg = (window as any)?.Telegram?.WebApp;
    try {
      tg?.ready?.(); tg?.expand?.();
      tg?.setHeaderColor?.("#000000"); tg?.setBackgroundColor?.("#000000");
      if (tg?.isFullscreen) setPagePaddingTop("calc(env(safe-area-inset-top,0px) + 88px)");
    } catch {}
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, [load]);

  function reveal(i: number): CSSProperties {
    return mounted
      ? { opacity: 1, animationName: "fadeUp", animationDuration: "560ms", animationTimingFunction: "cubic-bezier(0.22,1,0.36,1)", animationFillMode: "both", animationDelay: `${i * 60}ms` }
      : { opacity: 0, transform: "translate3d(0,14px,0)" };
  }

  const font = 'Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif';
  const block: CSSProperties = { padding: 16, borderRadius: 22, border: `1px solid ${T.border}`, background: `linear-gradient(180deg,${T.card} 0%,rgba(255,255,255,0.02) 100%)`, marginBottom: 14 };
  const infoRow: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${T.borderSoft}` };
  const infoRowLast: CSSProperties = { ...infoRow, borderBottom: "none" };

  const planColor = sub?.plan === "pro" ? T.brand : sub?.plan === "trial" ? T.yellow : T.textMuted;
  const statusOk = sub?.status === "active" || sub?.status === "trial";

  return (
    <>
      <style jsx global>{`
        *{box-sizing:border-box}
        html,body{margin:0;padding:0;background:${T.bg};overflow-x:hidden}
        select,input,button,textarea{font:inherit}
        @keyframes fadeUp{from{opacity:0;transform:translate3d(0,14px,0)}to{opacity:1;transform:translate3d(0,0,0)}}
      `}</style>

      <main style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: font, paddingBottom: "calc(env(safe-area-inset-bottom,0px)+40px)", paddingTop: pagePaddingTop }}>
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 16px" }}>

          {/* Header */}
          <section style={{ ...reveal(0), marginBottom: 22, display: "grid", gridTemplateColumns: "44px 1fr 44px", alignItems: "center", gap: 12, marginTop: 8 }}>
            <button type="button" onClick={() => router.replace("/home")} style={{ width: 44, height: 44, borderRadius: 999, border: `1px solid ${T.borderHard}`, background: T.card, color: T.textMain, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
              <ArrowLeft />
            </button>
            <div style={{ textAlign: "center", fontSize: 20, fontWeight: 800, letterSpacing: "-0.025em", color: T.textMain }}>Профиль</div>
            <div />
          </section>

          {loading && <div style={{ textAlign: "center", color: T.textMuted, padding: "50px 0" }}>Загрузка…</div>}
          {!loading && err && <div style={{ color: T.red, fontSize: 14, padding: "20px 0", textAlign: "center" }}>{err}</div>}

          {!loading && user && (
            <>
              {/* Avatar + name */}
              <section style={{ ...reveal(1), ...block, textAlign: "center", padding: "24px 16px" }}>
                <div style={{ width: 68, height: 68, borderRadius: 999, background: T.brand, color: "#fff", fontSize: 24, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                  {initials(user)}
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: T.textMain, letterSpacing: "-0.02em" }}>{displayName(user)}</div>
                {user.username && (
                  <div style={{ fontSize: 14, color: T.textMuted, marginTop: 4 }}>@{user.username}</div>
                )}
                <div style={{ fontSize: 12, color: T.textFaint, marginTop: 6 }}>
                  В системе с {formatDate(user.createdAt)}
                </div>
              </section>

              {/* Subscription */}
              <section style={{ ...reveal(2), ...block }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Подписка</div>

                <div style={infoRow}>
                  <span style={{ fontSize: 14, color: T.textSoft }}>Тариф</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: planColor }}>{planLabel(sub?.plan ?? "free")}</span>
                </div>
                <div style={infoRow}>
                  <span style={{ fontSize: 14, color: T.textSoft }}>Статус</span>
                  <span style={{ fontSize: 13, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: statusOk ? "rgba(100,217,123,0.12)" : "rgba(255,106,106,0.1)", color: statusOk ? T.green : T.red }}>
                    {statusLabel(sub?.status ?? "active")}
                  </span>
                </div>
                <div style={infoRowLast}>
                  <span style={{ fontSize: 14, color: T.textSoft }}>Действует до</span>
                  <span style={{ fontSize: 14, color: T.textMain }}>{sub?.expiresAt ? formatDate(sub.expiresAt) : "Бессрочно"}</span>
                </div>

                {sub?.plan === "free" && (
                  <button
                    type="button"
                    style={{ width: "100%", marginTop: 14, height: 44, borderRadius: 999, border: `1px solid ${T.brand}`, background: `${T.brand}18`, color: T.brand, fontWeight: 700, fontSize: 14, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}
                    onClick={() => {}}
                  >
                    Улучшить до Pro
                  </button>
                )}
              </section>

              {/* Account info */}
              <section style={{ ...reveal(3), ...block }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Аккаунт</div>

                <div style={infoRow}>
                  <span style={{ fontSize: 14, color: T.textSoft }}>Telegram ID</span>
                  <span style={{ fontSize: 13, fontFamily: "monospace", color: T.textFaint }}>{user.tgId}</span>
                </div>
                <div style={infoRowLast}>
                  <span style={{ fontSize: 14, color: T.textSoft }}>ID профиля</span>
                  <span style={{ fontSize: 11, fontFamily: "monospace", color: T.textFaint }}>{user.id.slice(-14)}</span>
                </div>
              </section>

              {/* Danger zone */}
              <section style={{ ...reveal(4), padding: "14px 16px", borderRadius: 22, border: `1px solid rgba(255,106,106,0.18)`, background: "rgba(255,106,106,0.04)", marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.red, marginBottom: 8 }}>Опасная зона</div>

                {deleteStep === "idle" && (
                  <button
                    type="button"
                    onClick={() => setDeleteStep("confirm")}
                    style={{ width: "100%", height: 44, borderRadius: 999, border: `1px solid rgba(255,106,106,0.35)`, background: "transparent", color: T.red, fontWeight: 700, fontSize: 14, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}
                  >
                    Удалить аккаунт
                  </button>
                )}

                {deleteStep === "confirm" && (
                  <div>
                    <div style={{ fontSize: 13, color: T.textSoft, marginBottom: 12, lineHeight: 1.5 }}>
                      Это действие необратимо. Все данные, торговая история, настройки бота и API ключи будут удалены навсегда.
                    </div>
                    {deleteErr && <div style={{ color: T.red, fontSize: 12, marginBottom: 8 }}>{deleteErr}</div>}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => { setDeleteStep("idle"); setDeleteErr(""); }}
                        style={{ height: 44, borderRadius: 999, border: `1px solid ${T.border}`, background: T.card, color: T.textSoft, fontWeight: 700, fontSize: 14, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}
                      >
                        Отмена
                      </button>
                      <button
                        type="button"
                        onClick={deleteAccount}
                        style={{ height: 44, borderRadius: 999, border: "none", background: T.red, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                )}

                {deleteStep === "deleting" && (
                  <div style={{ textAlign: "center", color: T.red, fontSize: 14, padding: "8px 0" }}>Удаление…</div>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </>
  );
}
