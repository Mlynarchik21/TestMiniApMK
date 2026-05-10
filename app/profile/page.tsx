"use client";

import { useEffect, useState, useCallback } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/useTheme";
import { ArrowLeft as LArrowLeft, Copy as LCopy, Star as LStar } from "lucide-react";
import { haptics } from "@/lib/ui/haptics";
import { BottomNav } from "@/lib/ui/BottomNav";

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
  vipExpiresAt: string | null;
  createdAt: string;
};

type ReferredUser = {
  id: string;
  name: string;
  username: string | null;
  joinedAt: string;
  plan: string;
  subscribed: boolean;
  lastPaymentPlan: string | null;
};

type ReferralStats = {
  totalReferred: number;
  paidThisMonth: number;
  proThisMonth: number;
  nextReward: string | null;
};

type ReferralData = {
  referralCode: string;
  referralLink: string;
  stats: ReferralStats;
  referred: ReferredUser[];
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

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function planLabel(plan: string) {
  if (plan === "pro") return "Pro";
  if (plan === "basic") return "Basic";
  if (plan === "trial") return "Trial";
  return "Free";
}

function statusLabel(status: string) {
  if (status === "expired") return "Истекла";
  if (status === "trial") return "Пробный";
  return "Активна";
}

function ArrowLeft() {
  return <LArrowLeft size={18} strokeWidth={2} aria-hidden />;
}

function CopyIcon() {
  return <LCopy size={14} strokeWidth={2} aria-hidden />;
}

function StarIcon() {
  return <LStar size={14} strokeWidth={2} aria-hidden />;
}

export default function ProfilePage() {
  const router = useRouter();
  const { T } = useTheme();

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserData | null>(null);
  const [sub, setSub] = useState<SubData | null>(null);
  const [referral, setReferral] = useState<ReferralData | null>(null);
  const [err, setErr] = useState("");
  const [deleteStep, setDeleteStep] = useState<"idle" | "confirm" | "deleting">("idle");
  const [deleteErr, setDeleteErr] = useState("");
  const [pagePaddingTop, setPagePaddingTop] = useState("calc(env(safe-area-inset-top,0px) + 15px)");
  const [buyingPlan, setBuyingPlan] = useState<"basic" | "pro" | null>(null);
  const [buyMsg, setBuyMsg] = useState("");
  const [buyingVip, setBuyingVip] = useState(false);
  const [vipBuyMsg, setVipBuyMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [showReferredList, setShowReferredList] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [profileRes, subRes, refRes] = await Promise.all([
        api("/api/profile"),
        api("/api/subscription"),
        api("/api/referral"),
      ]);
      if (profileRes.ok) setUser(profileRes.user);
      else setErr(profileRes.error || "Не удалось загрузить профиль");
      if (subRes.ok) setSub(subRes.subscription);
      if (refRes.ok) setReferral(refRes as ReferralData);
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

  async function buyPlan(plan: "basic" | "pro") {
    setBuyingPlan(plan);
    setBuyMsg("");
    try {
      const json = await api("/api/payments/create-invoice", { method: "POST", body: JSON.stringify({ plan }) });
      if (!json.ok) {
        setBuyMsg(json.message || json.error || "Ошибка создания счёта");
        return;
      }
      const tg = (window as any)?.Telegram?.WebApp;
      if (!tg?.openInvoice) {
        setBuyMsg("Оплата доступна только внутри Telegram");
        return;
      }
      tg.openInvoice(json.invoiceLink, (status: string) => {
        if (status === "paid") {
          setBuyMsg("Оплата прошла! Подписка активируется в течение минуты.");
          setTimeout(() => load(), 3000);
        } else if (status === "cancelled") {
          setBuyMsg("");
        } else if (status === "failed") {
          setBuyMsg("Ошибка оплаты. Попробуйте ещё раз.");
        }
      });
    } catch (e: any) {
      setBuyMsg(e?.message ?? "Ошибка");
    } finally {
      setBuyingPlan(null);
    }
  }

  async function buyVip() {
    setBuyingVip(true);
    setVipBuyMsg("");
    try {
      const json = await api("/api/payments/create-invoice", { method: "POST", body: JSON.stringify({ plan: "vip" }) });
      if (!json.ok) {
        setVipBuyMsg(json.message || json.error || "Ошибка создания счёта");
        return;
      }
      const tg = (window as any)?.Telegram?.WebApp;
      if (!tg?.openInvoice) {
        setVipBuyMsg("Оплата доступна только внутри Telegram");
        return;
      }
      tg.openInvoice(json.invoiceLink, (status: string) => {
        if (status === "paid") {
          setVipBuyMsg("Оплата прошла! Ссылка придёт в бот.");
          setTimeout(() => load(), 3000);
        } else if (status === "cancelled") {
          setVipBuyMsg("");
        } else if (status === "failed") {
          setVipBuyMsg("Ошибка оплаты. Попробуйте ещё раз.");
        }
      });
    } catch (e: any) {
      setVipBuyMsg(e?.message ?? "Ошибка");
    } finally {
      setBuyingVip(false);
    }
  }

  function copyLink() {
    const link = referral?.referralLink;
    if (!link) return;
    try {
      navigator.clipboard.writeText(link).then(() => {
        haptics.notify("success");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    } catch {
      setCopied(false);
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
  const block: CSSProperties = { padding: 16, borderRadius: 22, border: `1px solid ${T.border}`, background: T.card, marginBottom: 14 };
  const infoRow: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${T.borderSoft}` };
  const infoRowLast: CSSProperties = { ...infoRow, borderBottom: "none" };

  const planColor = sub?.plan === "pro" ? T.brand : sub?.plan === "basic" ? T.green : sub?.plan === "trial" ? T.yellow : T.textMuted;
  const statusOk = sub?.status === "active" || sub?.status === "trial";
  const isPro = sub?.plan === "pro" && statusOk;
  const isBasic = sub?.plan === "basic" && statusOk;
  const vipActive = sub?.vipExpiresAt ? new Date(sub.vipExpiresAt) > new Date() : false;

  return (
    <>
      <style jsx global>{`
        *{box-sizing:border-box}
        html,body{margin:0;padding:0;background:${T.bg};overflow-x:hidden}
        select,input,button,textarea{font:inherit}
        @keyframes fadeUp{from{opacity:0;transform:translate3d(0,14px,0)}to{opacity:1;transform:translate3d(0,0,0)}}
      `}</style>

      <main style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: font, paddingBottom: "calc(env(safe-area-inset-bottom,0px)+92px)", paddingTop: pagePaddingTop }}>
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

                {buyMsg && (
                  <div style={{ marginTop: 10, fontSize: 13, color: buyMsg.includes("прошла") ? T.green : T.red, textAlign: "center" }}>{buyMsg}</div>
                )}

                {/* Plan purchase buttons */}
                {!isPro && (
                  <div style={{ display: "grid", gridTemplateColumns: isBasic ? "1fr" : "1fr 1fr", gap: 8, marginTop: 14 }}>
                    {!isBasic && (
                      <button
                        type="button"
                        disabled={!!buyingPlan}
                        onClick={() => buyPlan("basic")}
                        style={{ height: 44, borderRadius: 999, border: `1px solid ${T.green}`, background: `${T.green}18`, color: T.green, fontWeight: 700, fontSize: 13, cursor: buyingPlan ? "not-allowed" : "pointer", opacity: buyingPlan === "basic" ? 0.6 : 1, WebkitTapHighlightColor: "transparent", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
                      >
                        <StarIcon /> Basic — 100 ⭐
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={!!buyingPlan}
                      onClick={() => buyPlan("pro")}
                      style={{ height: 44, borderRadius: 999, border: `1px solid ${T.brand}`, background: `${T.brand}18`, color: T.brand, fontWeight: 700, fontSize: 13, cursor: buyingPlan ? "not-allowed" : "pointer", opacity: buyingPlan === "pro" ? 0.6 : 1, WebkitTapHighlightColor: "transparent", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
                    >
                      <StarIcon /> Pro — 2500 ⭐
                    </button>
                  </div>
                )}

                {isPro && (
                  <button
                    type="button"
                    disabled={!!buyingPlan}
                    onClick={() => buyPlan("pro")}
                    style={{ width: "100%", marginTop: 14, height: 44, borderRadius: 999, border: `1px solid ${T.brand}`, background: `${T.brand}18`, color: T.brand, fontWeight: 700, fontSize: 13, cursor: buyingPlan ? "not-allowed" : "pointer", WebkitTapHighlightColor: "transparent", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
                  >
                    <StarIcon /> Продлить Pro — 2500 ⭐
                  </button>
                )}

                {isBasic && !isPro && (
                  <button
                    type="button"
                    disabled={!!buyingPlan}
                    onClick={() => buyPlan("pro")}
                    style={{ width: "100%", marginTop: 8, height: 44, borderRadius: 999, border: `1px solid ${T.brand}`, background: `${T.brand}18`, color: T.brand, fontWeight: 700, fontSize: 13, cursor: buyingPlan ? "not-allowed" : "pointer", WebkitTapHighlightColor: "transparent", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
                  >
                    <StarIcon /> Улучшить до Pro — 2500 ⭐
                  </button>
                )}

                {/* VIP channel section */}
                <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${T.borderSoft}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.yellow, marginBottom: 10 }}>VIP Канал</div>
                  {vipActive ? (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${T.borderSoft}` }}>
                        <span style={{ fontSize: 14, color: T.textSoft }}>VIP доступ</span>
                        <span style={{ fontSize: 13, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: "rgba(243,215,9,0.12)", color: T.yellow }}>Активен</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
                        <span style={{ fontSize: 14, color: T.textSoft }}>До</span>
                        <span style={{ fontSize: 14, color: T.textMain }}>{formatDate(sub!.vipExpiresAt)}</span>
                      </div>
                      <button
                        type="button"
                        disabled={buyingVip}
                        onClick={buyVip}
                        style={{ width: "100%", marginTop: 6, height: 40, borderRadius: 999, border: `1px solid ${T.yellow}`, background: `${T.yellow}18`, color: T.yellow, fontWeight: 700, fontSize: 13, cursor: buyingVip ? "not-allowed" : "pointer", opacity: buyingVip ? 0.6 : 1, WebkitTapHighlightColor: "transparent", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
                      >
                        <StarIcon /> Продлить VIP — 250 ⭐
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={buyingVip}
                      onClick={buyVip}
                      style={{ width: "100%", height: 44, borderRadius: 999, border: `1px solid ${T.yellow}`, background: `${T.yellow}18`, color: T.yellow, fontWeight: 700, fontSize: 13, cursor: buyingVip ? "not-allowed" : "pointer", opacity: buyingVip ? 0.6 : 1, WebkitTapHighlightColor: "transparent", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
                    >
                      <StarIcon /> VIP Канал — 250 ⭐/месяц
                    </button>
                  )}
                  {vipBuyMsg && (
                    <div style={{ marginTop: 8, fontSize: 13, color: vipBuyMsg.includes("прошла") ? T.green : T.yellow, textAlign: "center" }}>{vipBuyMsg}</div>
                  )}
                </div>
              </section>

              {/* Referral system */}
              {referral && (
                <section style={{ ...reveal(3), ...block }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Реферальная программа</div>

                  {/* Stats bar */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
                    {[
                      { label: "Приглашено", value: referral.stats.totalReferred },
                      { label: "Оплатили", value: referral.stats.paidThisMonth },
                      { label: "Pro купили", value: referral.stats.proThisMonth },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ background: T.surface, borderRadius: 14, padding: "10px 8px", textAlign: "center", border: `1px solid ${T.border}` }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: T.textMain }}>{value}</div>
                        <div style={{ fontSize: 10, color: T.textFaint, marginTop: 2 }}>{label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Next reward hint */}
                  {referral.stats.nextReward && (
                    <div style={{ fontSize: 12, color: T.brand, background: `${T.brand}10`, borderRadius: 10, padding: "8px 12px", marginBottom: 12, lineHeight: 1.4 }}>
                      🎯 {referral.stats.nextReward}
                    </div>
                  )}

                  {/* Reward explanation */}
                  <div style={{ fontSize: 11, color: T.textFaint, marginBottom: 12, lineHeight: 1.5 }}>
                    5 приглашённых с любой подпиской = <span style={{ color: T.green }}>Basic на месяц</span><br />
                    5 приглашённых с Pro = <span style={{ color: T.brand }}>Pro на месяц</span>
                  </div>

                  {/* Referral link */}
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{ flex: 1, background: T.surface, border: `1px solid ${T.borderHard}`, borderRadius: 12, padding: "10px 12px", fontSize: 12, color: T.textSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {referral.referralLink}
                    </div>
                    <button
                      type="button"
                      onClick={copyLink}
                      style={{ height: 40, paddingInline: 14, borderRadius: 12, border: `1px solid ${T.borderHard}`, background: copied ? `${T.green}18` : T.card, color: copied ? T.green : T.textSoft, fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, flexShrink: 0, WebkitTapHighlightColor: "transparent" }}
                    >
                      <CopyIcon />
                      {copied ? "Скопировано" : "Копировать"}
                    </button>
                  </div>

                  {/* Referred users list toggle */}
                  {referral.referred.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <button
                        type="button"
                        onClick={() => setShowReferredList((v) => !v)}
                        style={{ fontSize: 13, color: T.brand, background: "none", border: "none", padding: 0, cursor: "pointer", fontWeight: 600 }}
                      >
                        {showReferredList ? "Скрыть" : `Показать приглашённых (${referral.referred.length})`}
                      </button>

                      {showReferredList && (
                        <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                          {referral.referred.map((r) => (
                            <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${T.borderSoft}` }}>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: T.textMain }}>{r.name}</div>
                                <div style={{ fontSize: 11, color: T.textFaint }}>{formatDateShort(r.joinedAt)}</div>
                              </div>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 999, background: r.plan === "pro" ? `${T.brand}18` : r.plan === "basic" ? `${T.green}18` : `${T.textMuted}18`, color: r.plan === "pro" ? T.brand : r.plan === "basic" ? T.green : T.textMuted }}>
                                {planLabel(r.plan)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </section>
              )}

              {/* Account info */}
              <section style={{ ...reveal(4), ...block }}>
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
              <section style={{ ...reveal(5), padding: "14px 16px", borderRadius: 22, border: `1px solid rgba(255,106,106,0.18)`, background: "rgba(255,106,106,0.04)", marginBottom: 14 }}>
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
      <BottomNav />
    </>
  );
}
